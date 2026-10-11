const { Room } = require('colyseus');
const { SalaState, Jogador } = require('./estado');
const fb = require('./firebase');
const cfg = require('./config');

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem O/0/I/1 (confunde na tela do celular)
const CANAL_CODIGOS = 'nr:codigos';
const VOO = { xMin: -4.2, xMax: 4.2, yMin: 0.6, yMax: 9.5 }; // mesmos limites do boss3d.js

function sortearCodigo() {
  let c = '';
  for (let i = 0; i < 5; i++) c += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  return c;
}
const limitar = (n, min, max) => Math.min(max, Math.max(min, Math.floor(Number(n) || min)));

class SalaRoom extends Room {
  async onCreate(opcoes) {
    const modo = opcoes.modo === 'pvp' ? 'pvp' : 'coop';
    this.maxClients = modo === 'pvp' ? cfg.MAX_PVP : cfg.MAX_COOP;
    this.autoDispose = true;
    if (opcoes.privada) this.setPrivate(true);

    // Código curto e único (é o próprio roomId, então "entrar por código" = joinById)
    let codigo;
    do { codigo = sortearCodigo(); } while (await this.presence.sismember(CANAL_CODIGOS, codigo));
    await this.presence.sadd(CANAL_CODIGOS, codigo);
    this.roomId = codigo;
    this._codigo = codigo;

    const s = new SalaState();
    s.codigo = codigo;
    s.modo = modo;
    s.fase = 'lobby';
    s.mapa = limitar(opcoes.mapa, 1, cfg.MAPAS);
    s.nivel = limitar(opcoes.nivel, 1, cfg.NIVEIS);
    s.seed = 0;
    s.maxJogadores = this.maxClients;
    this.setState(s);

    this._taxa = new Map(); // anti-spam por conexão
    this._taxaJogo = new Map(); // anti-spam das mensagens de jogo (mov/tiro), que são frequentes
    this.setPatchRate(50); // 20 atualizações/s do estado para os clientes
    this._ultimoEmote = new Map();

    this.onMessage('p', (c, t) => { if (this._ok(c)) c.send('q', t); });          // ping (eco)
    this.onMessage('rtt', (c, ms) => this._rtt(c, ms));
    this.onMessage('pronto', (c, v) => this._pronto(c, v));
    this.onMessage('config', (c, d) => this._config(c, d));
    this.onMessage('iniciar', (c) => this._iniciar(c));
    this.onMessage('emote', (c, id) => this._emote(c, id));
    this.onMessage('expulsar', (c, id) => this._expulsar(c, id));
    this.onMessage('mov', (c, d) => this._mov(c, d));
    this.onMessage('tiro', (c, d) => this._tiro(c, d));

    this._meta();
  }

  // ── AUTENTICAÇÃO ─────────────────────────────────────────────
  async onAuth(client, opcoes) {
    let uid, perfil;
    if (opcoes && opcoes.token) {
      try { uid = await fb.verificarToken(opcoes.token); }
      catch (e) { throw new Error('Sessão inválida. Faça login de novo.'); }
      perfil = await fb.perfilPublico(uid);
    } else if (cfg.DEV_SEM_AUTH) {
      uid = 'dev-' + client.sessionId;
      perfil = { nome: String(opcoes.nome || 'Teste').slice(0, 16), nivel: 1, avatarId: 'padrao', molduraId: 'bronze', tituloId: 'novato' };
    } else {
      throw new Error('Login necessário.');
    }
    for (const j of this.state.jogadores.values()) {
      if (j.uid === uid) throw new Error('Você já está nessa sala em outro aparelho.');
    }
    return { uid, perfil };
  }

  onJoin(client, _opcoes, auth) {
    const j = new Jogador();
    j.id = client.sessionId;
    j.uid = auth.uid;
    Object.assign(j, auth.perfil);
    j.pronto = false;
    j.ping = 0;
    j.conectado = true;
    j.x = 0; j.y = 5; j.hp = 1; j.hpMax = 1; j.vivo = true;
    this.state.jogadores.set(client.sessionId, j);
    if (!this.state.hostId) this.state.hostId = client.sessionId;
    this._meta();
  }

  async onLeave(client, consentido) {
    const j = this.state.jogadores.get(client.sessionId);
    if (!j) return;
    // Em partida, queda de conexão (túnel, troca de wifi) dá 60s para voltar sem perder nada
    if (!consentido && this.state.fase === 'jogando') {
      j.conectado = false;
      try {
        await this.allowReconnection(client, cfg.TEMPO_RECONEXAO_S);
        j.conectado = true;
        return;
      } catch (e) { /* não voltou */ }
    }
    this.state.jogadores.delete(client.sessionId);
    if (this.state.hostId === client.sessionId) {
      const prox = this.state.jogadores.keys().next();
      this.state.hostId = prox.done ? '' : prox.value; // host sai → passa pro próximo
    }
    this._meta();
  }

  async onDispose() {
    if (this._codigo) await this.presence.srem(CANAL_CODIGOS, this._codigo);
  }

  // ── MENSAGENS ────────────────────────────────────────────────
  _ok(c) { // máx ~30 msgs/s por jogador; passou de 120 → derruba
    const agora = Date.now();
    let t = this._taxa.get(c.sessionId);
    if (!t || agora - t.ini > 1000) t = { ini: agora, n: 0 };
    t.n++;
    this._taxa.set(c.sessionId, t);
    if (t.n > 120) { c.leave(1008); return false; }
    return t.n <= 30;
  }

  // Mensagens de jogo: até 40/s por jogador; passou de 200/s derruba a conexão
  _okJogo(c) {
    const agora = Date.now();
    let t = this._taxaJogo.get(c.sessionId);
    if (!t || agora - t.ini > 1000) t = { ini: agora, n: 0 };
    t.n++;
    this._taxaJogo.set(c.sessionId, t);
    if (t.n > 200) { c.leave(1008); return false; }
    return t.n <= 40;
  }

  // d = [x, y, hp, hpMax, vivo]. O servidor NUNCA confia: limita tudo ao que é possível no jogo.
  _mov(c, d) {
    if (this.state.fase !== 'jogando' || !Array.isArray(d) || !this._okJogo(c)) return;
    const j = this.state.jogadores.get(c.sessionId);
    if (!j) return;
    const n = (v, min, max) => Math.min(max, Math.max(min, Number(v) || 0));
    j.x = n(d[0], VOO.xMin, VOO.xMax);
    j.y = n(d[1], VOO.yMin, VOO.yMax);
    j.hpMax = n(d[3], 1, 100000);
    j.hp = n(d[2], 0, j.hpMax);
    j.vivo = !!d[4];
  }

  // Tiro de outro jogador: só um aviso visual para os demais (o dano de verdade vem no passo 6)
  _tiro(c, d) {
    if (this.state.fase !== 'jogando' || !this._okJogo(c)) return;
    const j = this.state.jogadores.get(c.sessionId);
    if (!j || !j.vivo) return;
    this.broadcast('tiro', { de: c.sessionId, x: j.x, y: j.y, t: d === 3 ? 3 : 1 }, { except: c });
  }

  _rtt(c, ms) {
    if (!this._ok(c)) return;
    const j = this.state.jogadores.get(c.sessionId);
    if (!j || typeof ms !== 'number' || !isFinite(ms)) return;
    const novo = limitar(ms, 0, 2000);
    j.ping = j.ping ? Math.round(j.ping * 0.6 + novo * 0.4) : novo; // suaviza oscilação
  }

  _pronto(c, v) {
    if (!this._ok(c) || this.state.fase !== 'lobby') return;
    const j = this.state.jogadores.get(c.sessionId);
    if (j) j.pronto = !!v;
  }

  _config(c, d) {
    if (!this._ok(c) || this.state.fase !== 'lobby' || c.sessionId !== this.state.hostId || !d) return;
    this.state.mapa = limitar(d.mapa, 1, cfg.MAPAS);
    this.state.nivel = limitar(d.nivel, 1, cfg.NIVEIS);
    this.state.jogadores.forEach((j) => { j.pronto = false; }); // mudou o mapa → todos confirmam de novo
    this._meta();
  }

  _iniciar(c) {
    if (!this._ok(c) || this.state.fase !== 'lobby' || c.sessionId !== this.state.hostId) return;
    const lista = [...this.state.jogadores.values()];
    if (this.state.modo === 'pvp' && lista.length < 2) return c.send('erro', 'Falta o adversário.');
    if (lista.some((j) => j.id !== this.state.hostId && !j.pronto)) return c.send('erro', 'Nem todos estão prontos.');
    this.state.seed = (Math.random() * 0xffffffff) >>> 0;
    this.state.fase = 'jogando';
    this.lock();
    this.broadcast('iniciar', { seed: this.state.seed, modo: this.state.modo, mapa: this.state.mapa, nivel: this.state.nivel });
    this._meta();
  }

  _emote(c, id) {
    if (!this._ok(c)) return;
    const agora = Date.now();
    if (agora - (this._ultimoEmote.get(c.sessionId) || 0) < 1500) return;
    this._ultimoEmote.set(c.sessionId, agora);
    this.broadcast('emote', { de: c.sessionId, id: limitar(id, 0, 3) });
  }

  _expulsar(c, alvoId) {
    if (!this._ok(c) || this.state.fase !== 'lobby' || c.sessionId !== this.state.hostId || alvoId === c.sessionId) return;
    const alvo = this.clients.find((x) => x.sessionId === alvoId);
    if (alvo) { alvo.send('erro', 'Você foi removido da sala.'); alvo.leave(4000); }
  }

  // Dados que aparecem na lista de salas (client.getAvailableRooms)
  _meta() {
    const host = this.state.jogadores.get(this.state.hostId);
    this.setMetadata({
      codigo: this._codigo,
      modo: this.state.modo,
      host: host ? host.nome : '',
      jogadores: this.state.jogadores.size,
      max: this.maxClients,
      mapa: this.state.mapa,
      nivel: this.state.nivel,
      fase: this.state.fase,
    });
  }
}

module.exports = { SalaRoom };
