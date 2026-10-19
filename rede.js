// ══════════════════════════════════════════════════════════════════
// REDE.JS — carregador da biblioteca Colyseus + cliente de rede NRRede (co-op online)
// Usado por sala.html (lobby) e jogo.html (dentro da partida).
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
// CLIENTE DE REDE — ponte entre o jogo e o servidor Colyseus.
//
//   NRRede.iniciar({ url, getToken })
//   await NRRede.medirPing()            → { ms, qualidade }
//   await NRRede.criarSala()            → sala privada (código de 5 letras)
//   await NRRede.entrarPorCodigo('K7M2P')
//   await NRRede.partidaRapida()        → entra numa sala aberta ou cria uma
//   NRRede.pronto(true) / .iniciarPartida() / .expulsar(id) / .emote(0..3) / .sair()
//   NRRede.enviarEntrada({mx,mz,dash})  → movimento (durante a partida)
//   NRRede.enviarCarta(i)               → escolha de habilidade ao subir de nível
//   NRRede.on('estado'|'iniciar'|'comecar'|'snapshot'|'cartas'|'fim'|'erro'|'saiu'|'ping'|'emote', fn)
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
  function limparOuvintes() { for (var k in ouvintes) delete ouvintes[k]; }
  function httpBase() { return cfg.url.replace(/^ws/, 'http'); }

  function normalizar(u) {
    u = String(u || '').trim().replace(/\/+$/, '');
    u = u.replace(/^http/i, 'ws');
    return u.replace(/^ws(s?):/i, function (m, s) { return 'ws' + s.toLowerCase() + ':'; });
  }

  function iniciar(opcoes) {
    if (typeof Colyseus === 'undefined') throw new Error('A biblioteca Colyseus não carregou (recarregue a página).');
    cfg = opcoes;
    cfg.url = normalizar(opcoes.url);
    if (!/^wss?:\/\/./i.test(cfg.url)) throw new Error('Endereço do servidor inválido.');
    cliente = new Colyseus.Client(cfg.url);
  }

  async function _opcoes(extra) {
    var token = cfg.getToken ? await cfg.getToken() : null;
    return Object.assign({ token: token, nome: cfg.nomeTeste, loadout: cfg.loadoutTeste }, extra || {});
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

  // estado do LOBBY (vem do Schema do Colyseus) → objeto simples para a tela
  function snapshotLobby(st) {
    var jogadores = [];
    st.jogadores.forEach(function (j) {
      jogadores.push({ id: j.id, nome: j.nome, nivel: j.nivel, avatarId: j.avatarId, molduraId: j.molduraId, tituloId: j.tituloId,
        pronto: j.pronto, ping: j.ping, conectado: j.conectado, slot: j.slot, host: j.id === st.hostId, eu: !!sala && j.id === sala.sessionId });
    });
    return { codigo: st.codigo, fase: st.fase, seed: st.seed, max: st.maxJogadores, souHost: !!sala && st.hostId === sala.sessionId, jogadores: jogadores };
  }

  function _ligar(r) {
    sala = r;
    try { sessionStorage.setItem(CHAVE_RECONEXAO, r.reconnectionToken); } catch (e) {}
    salvarSessao();
    clearInterval(timerSessao); timerSessao = setInterval(function () { if (sala) salvarSessao(); }, 4000); // sinal de vida
    r.onStateChange(function (st) { emitir('estado', snapshotLobby(st)); });
    r.onMessage('s', function (bytes) { emitir('snapshot', bytes); });          // estado da partida (binário)
    ['iniciar', 'comecar', 'cartas', 'loja', 'fim', 'emote'].forEach(function (tipo) { r.onMessage(tipo, function (d) { emitir(tipo, d); }); });
    r.onMessage('erro', function (m) { emitir('erro', m); });
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
    return _tentar(async function () { return cliente.create('sala', await _opcoes({ privada: o.privada !== false })); });
  }
  async function entrarPorCodigo(codigo) {
    return _tentar(async function () { return cliente.joinById(String(codigo).toUpperCase().trim(), await _opcoes()); });
  }
  async function partidaRapida() {
    return _tentar(async function () { return cliente.joinOrCreate('sala', await _opcoes({ privada: false })); });
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

  window.NRRede = {
    iniciar: iniciar, on: on, limparOuvintes: limparOuvintes, medirPing: medirPing, criarSala: criarSala, entrarPorCodigo: entrarPorCodigo,
    partidaRapida: partidaRapida, listarSalas: listarSalas, reconectar: reconectar,
    pronto: function (v) { _env('pronto', !!v); }, iniciarPartida: function () { _env('iniciar'); },
    emote: function (id) { _env('emote', id); }, expulsar: function (id) { _env('expulsar', id); }, sair: sair,
    sala: function () { return sala; },
    enviarEntrada: function (d) { _env('in', d); }, enviarCarta: function (i) { _env('carta', i); },
    comprar: function (i) { _env('comprar', i); }, rerolar: function () { _env('rerolar'); }, prontoLoja: function () { _env('prontoLoja'); }, carregado: function () { _env('carregado'); },
    carregarBiblioteca: carregarColyseus,
    // Sessão (voltar sozinho): marcarPartida(url) = "estou no meio de uma partida, esta é a página dela"; fimDaPartida() = acabou, não volte
    marcarPartida: function (url) { salvarSessao({ emPartida: true, url: url }); },
    fimDaPartida: function () { salvarSessao({ emPartida: false }); },
    limparSessao: limparSessao,
  };
})();
