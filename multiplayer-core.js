// ══════════════════════════════════════════════════════════════════
// MULTIPLAYER-CORE.JS — carregador da biblioteca Colyseus + cliente NRMultiplayer
// Usado por multiplayer.html (lobby) e online3d.js (dentro da partida).
// Fica na mesma pasta do jogo.
// ══════════════════════════════════════════════════════════════════
// Erros que acontecem enquanto a biblioteca carrega só são anotados (a página mostra um aviso final se tudo falhar)
window.addEventListener('error', function (e) { if (window.__lib) { (window.__libErros = window.__libErros || []).push(String(e.message)); e.preventDefault(); } });
function colyseusOk() { return window.Colyseus && typeof window.Colyseus.Client === 'function'; }
function scriptUmd(url) {
  return new Promise(function (ok, er) {
    var s = document.createElement('script'); s.src = url; s.crossOrigin = 'anonymous';
    s.onload = ok; s.onerror = function () { er(new Error('não baixou')); };
    document.head.appendChild(s);
  });
}
function garantirNode() {
  if (typeof window.global === 'undefined') window.global = window;
  if (typeof window.process === 'undefined') window.process = { env: {}, browser: true, version: '', versions: {}, platform: 'browser', argv: [], cwd: function () { return '/'; }, nextTick: function (f) { var a = [].slice.call(arguments, 1); setTimeout(function () { f.apply(null, a); }, 0); }, on: function () {}, emit: function () {}, hrtime: function () { var n = performance.now(); return [Math.floor(n / 1000), Math.floor((n % 1000) * 1e6)]; } };
  if (typeof window.setImmediate === 'undefined') window.setImmediate = function (f) { return setTimeout(f, 0); };
  if (typeof window.Buffer === 'undefined') {
    var enc = function (s) { return new TextEncoder().encode(s); };
    window.Buffer = { isBuffer: function () { return false; }, from: function (x) { return typeof x === 'string' ? enc(x) : new Uint8Array(x); }, alloc: function (n) { return new Uint8Array(n); }, byteLength: function (s) { return enc(s).length; } };
  }
  if (typeof window.buffer === 'undefined') window.buffer = { Buffer: window.Buffer, isUtf8: function () { return true; } };
}
async function tentarUmd(url, rotulo, erros) {
  window.Colyseus = undefined; window.__libErros = []; window.__lib = true;
  try { await scriptUmd(url); } catch (e) { window.__libErros.push(e.message); }
  window.__lib = false;
  if (colyseusOk()) return true;
  erros.push(rotulo + ': ' + (window.__libErros[0] || 'incompleta'));
  return false;
}
async function carregarColyseus() {
  var erros = [], versoes = ['0.15.0', '0.15.4', '0.15.10', '0.15.20'];
  var hosts = [['unpkg', 'https://unpkg.com/colyseus.js@V/dist/colyseus.js'], ['jsd', 'https://cdn.jsdelivr.net/npm/colyseus.js@V/dist/colyseus.js']];
  // 1) sem nenhum truque (é como a biblioteca foi feita para rodar no navegador)
  for (var i = 0; i < versoes.length; i++) for (var h = 0; h < hosts.length; h++)
    if (await tentarUmd(hosts[h][1].replace('V', versoes[i]), hosts[h][0] + '@' + versoes[i], erros)) return;
  // 2) com os "globais de Node" simulados
  garantirNode();
  for (var j = 0; j < versoes.length; j++)
    if (await tentarUmd(hosts[0][1].replace('V', versoes[j]), 'node+' + versoes[j], erros)) return;
  // 3) versão ESM
  var esm = ['https://esm.sh/colyseus.js@0.15.0', 'https://esm.sh/colyseus.js@0.15'];
  for (var k = 0; k < esm.length; k++) {
    try {
      var m = await (new Function('u', 'return import(u)'))(esm[k]);
      var C = typeof m.Client === 'function' ? m : (m.default && typeof m.default.Client === 'function' ? m.default : null);
      if (C) { window.Colyseus = C; return; }
      erros.push('ESM' + (k + 1) + ': formato inesperado');
    } catch (e) { erros.push('ESM' + (k + 1) + ': ' + ((e && e.message) || e)); }
  }
  var v = (navigator.userAgent.match(/Chrome\/[\d.]+/) || ['navegador desconhecido'])[0];
  throw new Error('Biblioteca do multiplayer não funcionou (' + v + '). ' + erros.join(' | '));
}

// ══════════════════════════════════════════════════════════════════
// MULTIPLAYER-CLIENT.JS — ponte entre o jogo e o servidor Colyseus
// Neon Raiders. Carregar DEPOIS do colyseus.js (ver teste-multiplayer.html).
//
//   NRMultiplayer.iniciar({ url: 'wss://SEU-SERVIDOR', getToken })
//   await NRMultiplayer.medirPing()        → { ms, qualidade }
//   await NRMultiplayer.criarSala({ modo:'coop', mapa:1, nivel:1 })
//   await NRMultiplayer.entrarPorCodigo('K7M2P')
//   await NRMultiplayer.partidaRapida('coop')
//   await NRMultiplayer.listarSalas()
//   NRMultiplayer.pronto(true) / .iniciar() / .config({mapa,nivel}) / .emote(0..3) / .sair()
//   NRMultiplayer.on('estado'|'iniciar'|'emote'|'erro'|'saiu', fn)
// ══════════════════════════════════════════════════════════════════
(function () {
  let cliente = null, sala = null, cfg = {}, timerPing = null;
  const ouvintes = {};
  const CHAVE_RECONEXAO = 'nrReconexaoToken';
  // ── SESSÃO ONLINE (para VOLTAR SOZINHO à partida) ──────────────
  // Além do token no sessionStorage (some ao fechar a aba), guardamos uma cópia no localStorage com a hora da última
  // vez que a conexão estava de pé. Quem sai da partida sem querer (botão voltar, home, app fechado) e abre o
  // menu/lobby de novo em até ~50 s é levado de volta (auto-voltar.js). O servidor segura a vaga por 60 s.
  // sair() (sair de propósito) apaga tudo, então quem saiu de verdade NÃO é puxado de volta.
  const CHAVE_SESSAO = 'nrSessaoOnline';
  let timerSessao = null;
  function lerSessao() { try { return JSON.parse(localStorage.getItem(CHAVE_SESSAO) || 'null') || null; } catch (e) { return null; } }
  function salvarSessao(extra) { // junta o que já tinha + token atual + hora (extra = campos novos, ex.: { emPartida: true })
    try {
      var s = lerSessao() || {};
      if (sala && sala.reconnectionToken) s.token = sala.reconnectionToken;
      s.savedAt = Date.now();
      if (extra) for (var k in extra) s[k] = extra[k];
      localStorage.setItem(CHAVE_SESSAO, JSON.stringify(s));
    } catch (e) {}
  }
  function limparSessao() { try { localStorage.removeItem(CHAVE_SESSAO); } catch (e) {} }

  function emitir(ev, dado) { (ouvintes[ev] || []).forEach(function (f) { try { f(dado); } catch (e) { console.error(e); } }); }
  function on(ev, fn) { (ouvintes[ev] = ouvintes[ev] || []).push(fn); }
  function httpBase() { return cfg.url.replace(/^ws/, 'http'); }

  function normalizar(u) {
    u = String(u || '').trim().replace(/\/+$/, '');
    u = u.replace(/^http/i, 'ws');
    return u.replace(/^ws(s?):/i, function (m, s) { return 'ws' + s.toLowerCase() + ':'; });
  }

  // Mapas/níveis liberados jogando sozinho (o jogo guarda isso no celular e na conta)
  function progresso() {
    var m = Number(localStorage.getItem('mapaDesbloqueado')) || 1, n = [];
    for (var i = 1; i <= 6; i++) n.push(Number(localStorage.getItem('nivelDesbloqueado_mapa' + i)) || 1);
    return { m: Math.min(6, Math.max(1, m)), n: n };
  }
  function podeJogar(p, mapa, nivel) { p = p || progresso(); return mapa >= 1 && nivel >= 1 && mapa <= p.m && nivel <= (p.n[mapa - 1] || 1); }

  function iniciar(opcoes) {
    if (typeof Colyseus === 'undefined') throw new Error('A biblioteca Colyseus não carregou (recarregue a página).');
    cfg = opcoes;
    cfg.url = normalizar(opcoes.url);
    if (!/^wss?:\/\/./i.test(cfg.url)) throw new Error('Endereço do servidor inválido.');
    cliente = new Colyseus.Client(cfg.url);
  }

  async function _opcoes(extra) {
    var token = cfg.getToken ? await cfg.getToken() : null;
    return Object.assign({ token: token, nome: cfg.nomeTeste, prog: progresso() }, extra || {});
  }

  // Mede o ping até o servidor pelo HTTP (usa o menor de N tentativas, que é o mais fiel)
  async function medirPing(tentativas) {
    var n = tentativas || 4, melhor = Infinity;
    for (var i = 0; i < n; i++) {
      var t0 = performance.now();
      try {
        var res = await fetch(httpBase() + '/ping?x=' + Math.random(), { cache: 'no-store' });
        // 5xx = o servidor grátis ainda está acordando (o proxy responde antes do app subir)
        if (!res.ok) return { ms: null, qualidade: 'acordando' };
      }
      catch (e) { return { ms: null, qualidade: 'offline' }; }
      melhor = Math.min(melhor, performance.now() - t0);
    }
    var ms = Math.round(melhor);
    return { ms: ms, qualidade: ms < 60 ? 'otima' : ms < 120 ? 'boa' : ms < 200 ? 'media' : 'ruim' };
  }

  function snapshot(st) {
    var jogadores = [];
    st.jogadores.forEach(function (j) {
      jogadores.push({ id: j.id, nome: j.nome, nivel: j.nivel, avatarId: j.avatarId, molduraId: j.molduraId,
        tituloId: j.tituloId, bloqueado: j.bloqueado, estado: j.estado, pronto: j.pronto, ping: j.ping, conectado: j.conectado, x: j.x, y: j.y, hp: j.hp, hpMax: j.hpMax, vivo: j.vivo, host: j.id === st.hostId, eu: sala && j.id === sala.sessionId });
    });
    return { codigo: st.codigo, modo: st.modo, fase: st.fase, mapa: st.mapa, nivel: st.nivel, rodadas: st.rodadas, seed: st.seed,
      max: st.maxJogadores, souHost: sala && st.hostId === sala.sessionId, jogadores: jogadores };
  }

  function _ligar(r) {
    sala = r;
    try { sessionStorage.setItem(CHAVE_RECONEXAO, r.reconnectionToken); } catch (e) {}
    salvarSessao();
    clearInterval(timerSessao); timerSessao = setInterval(function () { if (sala) salvarSessao(); }, 4000); // sinal de vida: o menu confere a idade para saber se ainda dá para voltar
    r.onStateChange(function (st) { emitir('estado', snapshot(st)); });
    r.onMessage('iniciar', function (d) { emitir('iniciar', d); });
    r.onMessage('emote', function (d) { emitir('emote', d); });
    r.onMessage('tiro', function (d) { emitir('tiro', d); });
    ['espera', 'todos', 'comecar', 'dano', 'morte', 'fim', 'rodada-inicio', 'rodada-fim', 'pausa', 'derrota-total'].forEach(function (tipo) { r.onMessage(tipo, function (d) { emitir(tipo, d); }); });
    r.onMessage('erro', function (m) { emitir('erro', m); });
    var t0 = 0;
    r.onMessage('q', function (t) { var rtt = Math.round(performance.now() - t); r.send('rtt', rtt); emitir('ping', rtt); });
    clearInterval(timerPing);
    timerPing = setInterval(function () { if (sala) sala.send('p', performance.now()); }, 3000);
    r.onLeave(function (codigo, motivo) {
      clearInterval(timerPing); clearInterval(timerSessao);
      sala = null;
      if (codigo === 1000 || codigo === 4000) limparSessao(); // saiu de propósito: não volta sozinho
      // 1000 = saiu de propósito; qualquer outro código = queda → o jogo pode tentar reconectar()
      emitir('saiu', { codigo: codigo, motivo: motivo || '', queda: codigo !== 1000 && codigo !== 4000 });
    });
    return r;
  }

  async function _tentar(fn) {
    try { return _ligar(await fn()); }
    catch (e) { var msg = (e && e.message) || 'Falha ao conectar'; emitir('erro', msg); throw e; }
  }

  async function criarSala(o) {
    o = o || {};
    return _tentar(async function () { return cliente.create('sala', await _opcoes({ modo: o.modo, mapa: o.mapa, nivel: o.nivel, privada: o.privada !== false })); });
  }
  async function entrarPorCodigo(codigo) {
    return _tentar(async function () { return cliente.joinById(String(codigo).toUpperCase().trim(), await _opcoes()); });
  }
  async function partidaRapida(modo, mapa, nivel) {
    return _tentar(async function () { return cliente.joinOrCreate('sala', await _opcoes({ modo: modo || 'coop', privada: false, mapa: mapa, nivel: nivel })); });
  }
  async function listarSalas() {
    var lista = await cliente.getAvailableRooms('sala');
    return lista.filter(function (s) { return s.metadata && s.metadata.fase === 'lobby'; })
      .map(function (s) { return Object.assign({ id: s.roomId }, s.metadata); });
  }
  async function reconectar() {
    var tk; try { tk = sessionStorage.getItem(CHAVE_RECONEXAO); } catch (e) {}
    if (!tk) { var ss = lerSessao(); tk = ss && ss.token; } // aba/navegador reaberto: usa o token guardado
    if (!tk) return null;
    try { return _ligar(await cliente.reconnect(tk)); } catch (e) { return null; }
  }

  function _env(tipo, dado) { if (sala) sala.send(tipo, dado); }
  function sair() { try { sessionStorage.removeItem(CHAVE_RECONEXAO); } catch (e) {} limparSessao(); clearInterval(timerSessao); if (sala) sala.leave(true); }

  window.NRMultiplayer = {
    iniciar: iniciar, on: on, medirPing: medirPing, criarSala: criarSala, entrarPorCodigo: entrarPorCodigo,
    partidaRapida: partidaRapida, listarSalas: listarSalas, reconectar: reconectar,
    pronto: function (v) { _env('pronto', !!v); }, iniciarPartida: function () { _env('iniciar'); },
    config: function (d) { _env('config', d); }, emote: function (id) { _env('emote', id); },
    expulsar: function (id) { _env('expulsar', id); }, sair: sair,
    sala: function () { return sala; },
    progresso: progresso, podeJogar: podeJogar,
    enviar: function (tipo, dado) { _env(tipo, dado); },
    carregarBiblioteca: carregarColyseus,
    // Sessão (voltar sozinho): marcarPartida(url) = "estou no meio de uma partida, esta é a página dela"; fimDaPartida() = acabou, não volte
    marcarPartida: function (url) { salvarSessao({ emPartida: true, url: url }); },
    fimDaPartida: function () { salvarSessao({ emPartida: false }); },
    limparSessao: limparSessao,
    // Para o passo 6: gerador determinístico — todos os aparelhos sorteiam a MESMA sequência com a mesma seed
    criarRng: function (seed) { var a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; },
  };
})();
