// ══════════════════════════════════════════════════════════════════
// PARTIDA.JS — o maestro. Liga tudo: simulação, rede, gráficos, som, HUD.
//
//  SOLO   → a simulação (sim.js) roda aqui no celular a 60 passos/s.
//  ONLINE → a simulação roda no SERVIDOR; aqui chegam "fotos" do jogo
//           15x por segundo, que são suavizadas (interpolação) para
//           parecer 60 fps, e o seu próprio movimento é previsto
//           localmente (predição) para o controle responder na hora.
//
// Ordem de cada quadro: ler controles → avançar o jogo → desenhar → HUD.
// Constantes ajustáveis logo abaixo.
// ══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var D = window.NRData, Sim = window.NRSim, Codec = window.NRCodec, A = window.NRAudio;
  var CFG = D.CFG;
  var Q = new URLSearchParams(location.search);
  var ONLINE = Q.get('online') === '1';

  // ── AJUSTES ──
  var PASSO = 1 / 60;            // passo fixo da simulação no modo solo
  var ATRASO_INTERP = 0.11;      // online: mostra o jogo 110 ms no passado para ficar liso
  var MOSTRAR_FPS = true;        // contador de FPS no canto
  var ENVIO_INPUT_MS = 50;       // online: manda seu movimento 20x por segundo

  var ui, mundo, fx, des, ctrl;
  var sim = null;                        // só no solo
  var infoSlot = {}, slotLocal = 0, meuId = 'eu', nomeLocal = 'Raider', loadout = null;
  var t = 0, ultimo = 0, acc = 0, hudT = 0;
  var estado = { rodando: false, pausado: false, fim: false, saindo: false };
  var vista = null;                      // o que o desenhista lê (mesmo formato do sim.S)
  var fps = { n: 0, t: 0, atual: 60, baixos: 0, quedas: 0 };
  var ultimaOnda = 1, chefeVivo = false;

  // ═════════════ ONLINE: buffer de pacotes + predição ═════════════
  var buf = [];                          // últimos pacotes { t (tempo do servidor), v (vista), chegou }
  var pend = [];                         // pacotes ainda com eventos por tocar
  var pp = { x: 0, z: 0, ok: false };    // posição prevista do jogador local
  var entradaEnv = { mx: 0, mz: 0, t: 0, atira: false, manual: false };
  var atirando = false, pulaPend = false;    // pulaPend: avisa o servidor do pulo para os OUTROS celulares verem                       // botão ATIRAR apertado (modo botão)
  function modoBotao() { return A.modoTiro() === 'botao'; }
  var vistaIn = { t: 0, onda: 1, ondaT: 0, abatesTotal: 0, jogadores: [], inimigos: [], projeteis: [], gemas: [], itens: [], zonas: [], granadas: [], chefe: null, eventos: [] };
  var poolI = [], poolP = [], poolJ = [];

  function vazia() { return { t: 0, onda: 1, ondaT: 0, abatesTotal: 0, jogadores: [], inimigos: [], projeteis: [], gemas: [], itens: [], zonas: [], granadas: [], chefe: null, eventos: [] }; }
  var lim = function (v, a, b) { return v < a ? a : v > b ? b : v; };

  function receberSnapshot(bytes) {
    var v = Codec.decodificar(bytes); if (!v) return;
    var pk = { t: v.t, v: v, chegou: performance.now(), mapa: null };
    buf.push(pk); if (buf.length > 14) buf.shift();
    pend.push(pk);
  }
  // monta a vista suavizada para o instante `tr` (tempo do servidor)
  function vistaOnline(tr, dt) {
    if (!buf.length) return vazia();
    var a = buf[0], b = buf[buf.length - 1];
    for (var i = 0; i < buf.length; i++) { if (buf[i].t >= tr) { b = buf[i]; a = buf[Math.max(0, i - 1)]; break; } if (i === buf.length - 1) { a = b = buf[i]; } }
    var u = b.t === a.t ? 1 : lim((tr - a.t) / (b.t - a.t), 0, 1), V = vistaIn, vb = b.v, va = a.v;
    V.t = vb.t; V.onda = vb.onda; V.ondaT = vb.ondaT; V.abatesTotal = vb.abatesTotal; V.fim = vb.fim;
    V.gemas = vb.gemas; V.itens = vb.itens; V.zonas = vb.zonas; V.granadas = vb.granadas;
    if (!a.mapa) { a.mapa = new Map(); va.inimigos.forEach(function (e) { a.mapa.set(e.id, e); }); }
    // inimigos: interpolação por id (teleportes e spawns aparecem direto)
    V.inimigos.length = vb.inimigos.length; V.chefe = null;
    for (var k = 0; k < vb.inimigos.length; k++) {
      var e = vb.inimigos[k], o = poolI[k] || (poolI[k] = {}), ea = a.mapa.get(e.id);
      o.id = e.id; o.t = e.t; o.chefe = e.chefe; o.elite = e.elite; o.flash = e.flash; o.lento = e.lento; o.prep = e.prep; o.carga = e.carga; o.hp = e.hp; o.hpMax = 1;
      o.raio = e.chefe ? D.CHEFES[e.t].raio : D.INIMIGOS[e.t] ? D.INIMIGOS[e.t].raio : 0.6;
      if (ea && Math.abs(ea.x - e.x) + Math.abs(ea.z - e.z) < 6) { o.x = ea.x + (e.x - ea.x) * u; o.z = ea.z + (e.z - ea.z) * u; } else { o.x = e.x; o.z = e.z; }
      V.inimigos[k] = o; if (o.chefe) V.chefe = o;
    }
    // projéteis: andam em linha reta, então basta somar velocidade × tempo
    V.projeteis.length = vb.projeteis.length;
    var dtb = tr - vb.t;
    for (var m = 0; m < vb.projeteis.length; m++) {
      var p = vb.projeteis[m], q = poolP[m] || (poolP[m] = {});
      q.id = p.id; q.kind = p.kind; q.vx = p.vx; q.vz = p.vz; q.x = p.x + p.vx * dtb; q.z = p.z + p.vz * dtb; V.projeteis[m] = q;
    }
    // jogadores: interpolação por slot
    V.jogadores.length = vb.jogadores.length;
    for (var j = 0; j < vb.jogadores.length; j++) {
      var pj = vb.jogadores[j], pa = null, r = poolJ[j] || (poolJ[j] = {});
      for (var z = 0; z < va.jogadores.length; z++) if (va.jogadores[z].slot === pj.slot) pa = va.jogadores[z];
      for (var key in pj) r[key] = pj[key];
      if (pa && Math.abs(pa.x - pj.x) + Math.abs(pa.z - pj.z) < 8) { r.x = pa.x + (pj.x - pa.x) * u; r.z = pa.z + (pj.z - pa.z) * u; }
      if (pj.slot === slotLocal) aplicarPredicao(r, pj, dt);
      V.jogadores[j] = r;
    }
    return V;
  }
  // PREDIÇÃO: o seu personagem anda na hora, sem esperar o servidor
  function aplicarPredicao(r, srv, dt) {
    if (!pp.ok) { pp.x = srv.x; pp.z = srv.z; pp.ok = true; }
    if (srv.vivo && srv.dashT <= 0 && estado.rodando) {
      var inp = ctrl.ler(), v = srv.vel || CFG.jogador.vel;
      pp.x += inp.mx * v * dt; pp.z += inp.mz * v * dt;
      var rr = Math.hypot(pp.x, pp.z), L = CFG.arenaRaio - 1.5; if (rr > L) { pp.x *= L / rr; pp.z *= L / rr; }
      var ex = srv.x - pp.x, ez = srv.z - pp.z, err = Math.hypot(ex, ez);
      // só corrige quando o erro cresce (lag, empurrão): parado, volta devagar para a posição do servidor
      if (err > 2.2) { pp.x += ex * Math.min(1, dt * 8); pp.z += ez * Math.min(1, dt * 8); }
      else if (Math.abs(inp.mx) + Math.abs(inp.mz) < 0.05) { pp.x += ex * Math.min(1, dt * 6); pp.z += ez * Math.min(1, dt * 6); }
    } else { pp.x = srv.x; pp.z = srv.z; }
    r.x = pp.x; r.z = pp.z;
  }
  // eventos do sim + o PULO dos outros jogadores (o seu pulo já tocou na hora, no seu celular)
  function processarEv(lista) {
    for (var k = 0; k < lista.length; k++) {
      var e = lista[k];
      if (e[0] === Sim.EV.PULO && e[1] !== slotLocal) { var jo = des.jogador(e[1]); if (jo && jo.modelo && jo.modelo.pular && !jo.caido) jo.modelo.pular(); }
      else if (e[0] === Sim.EV.TIRO && e[1] !== slotLocal) {
        // tiro de AMIGO: volume cai com a distância (metros = unidades do mapa) e o som vem do lado onde ele está
        var dx = e[2] - pp.x, dz = e[3] - pp.z;
        A.contextoTiro({ d: Math.sqrt(dx * dx + dz * dz), x: dx }); des.processarEventos([e], slotLocal); A.contextoTiro(null);
        continue;
      }
      des.processarEventos([e], slotLocal);
    }
  }
  function tocarEventosPendentes(tr) {
    while (pend.length && pend[0].t <= tr) { var pk = pend.shift(); if (pk.v.eventos.length) processarEv(pk.v.eventos); }
    if (pend.length > 30) pend.length = 0;      // atrasou demais: descarta em vez de acumular
  }
  function enviarEntrada() {
    if (!ONLINE || !estado.rodando) return;
    var i = ctrl.ler(), d = ctrl.consumirDash(), agora = performance.now();
    var man = modoBotao(), at = man && atirando;
    var mudou = Math.abs(i.mx - entradaEnv.mx) > 0.03 || Math.abs(i.mz - entradaEnv.mz) > 0.03 || at !== entradaEnv.atira || man !== entradaEnv.manual;
    if (mudou || d || pulaPend || agora - entradaEnv.t > 200) {
      window.NRRede.enviarEntrada({ mx: +i.mx.toFixed(2), mz: +i.mz.toFixed(2), dash: d, manual: man, atira: at, pulo: pulaPend }); pulaPend = false;
      entradaEnv.mx = i.mx; entradaEnv.mz = i.mz; entradaEnv.t = agora; entradaEnv.atira = at; entradaEnv.manual = man;
    }
  }

  // ═════════════ SOLO ═════════════
  function passoSolo(dt) {
    acc += dt;
    var n = 0;
    while (acc >= PASSO && n++ < 6) {
      var inp = ctrl.ler();
      var man = modoBotao(); sim.entrada(meuId, { mx: inp.mx, mz: inp.mz, dash: ctrl.consumirDash(), manual: man, atira: man && atirando });
      sim.passo(PASSO); acc -= PASSO;
      var evs = sim.drenarEventos(); if (evs.length) processarEv(evs);
    }
    if (acc > 0.2) acc = 0;
    var p = sim.jogador(meuId);
    // (sem cartas de level up e sem loja entre as ondas: só waves e nível)
    if (sim.S.fim && !estado.fim) finalizarSolo();
  }
  var lojaVerVista = -1;

  // ═════════════ HUD / OVERLAY ═════════════
  function jogadorLocal() {
    var L = vista ? vista.jogadores : [];
    for (var i = 0; i < L.length; i++) if (L[i].slot === slotLocal) return L[i];
    return null;
  }
  function atualizarHud() {
    var p = jogadorLocal(); if (!p) return;
    var ch = vista.chefe, nomeCh = null;
    if (ch && !ch.morto) nomeCh = { nome: D.CHEFES[ch.t].nome, frac: ch.hp / ch.hpMax };
    var aliados = [];
    if (ONLINE) vista.jogadores.forEach(function (o) { if (o.slot !== slotLocal) aliados.push({ nome: (infoSlot[o.slot] && infoSlot[o.slot].nome) || 'Aliado', hp: o.hp, hpMax: o.hpMax, vivo: o.vivo, cor: '#' + ('000000' + des.COR_SLOT[o.slot % 4].toString(16)).slice(-6) }); });
    ui.atualizar({
      onda: vista.onda, ondaT: vista.ondaT, ondaDur: CFG.ondaDuracao, tempo: vista.t, abates: p.abates, moedas: p.moedaAcum || 0,
      hp: p.hp, hpMax: p.hpMax, nivel: p.nivel, xpFrac: p.xp / (p.xpProx || 1), hab: p.hab, pas: p.pas, vivo: p.vivo,
      dashCd: p.dashCd, dashRecarga: p.dashRecarga || CFG.jogador.dashRecarga, chefe: nomeCh, aliados: ONLINE ? aliados : null,
    });
    // música acompanha a tensão
    var inten = vista.onda >= 7 || chefeVivo ? 3 : vista.onda >= 3 ? 2 : 1; A.intensidade(inten);
  }
  // desenhado por cima do 3D: barras de vida acima dos personagens, anel de ressurreição, FPS
  var pt = { x: 0, y: 0, visivel: true };
  function overlayExtra(ctx, proj) {
    if (vista) vista.jogadores.forEach(function (p) {
      if (p.fora) return;
      proj(p.x, 2.9, p.z, pt); if (!pt.visivel) return;
      var cor = '#' + ('000000' + des.COR_SLOT[p.slot % 4].toString(16)).slice(-6);
      if (p.vivo) {
        var w = 46, h = 5, f = Math.max(0, p.hp / p.hpMax);
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(pt.x - w / 2 - 1, pt.y - 1, w + 2, h + 2);
        ctx.fillStyle = f > 0.35 ? '#39ff88' : '#ff4d5e'; ctx.fillRect(pt.x - w / 2, pt.y, w * f, h);
        if (ONLINE && p.slot !== slotLocal) { ctx.font = '700 10px Orbitron, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = cor; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; var nm = (infoSlot[p.slot] && infoSlot[p.slot].nome) || ''; ctx.strokeText(nm, pt.x, pt.y - 5); ctx.fillText(nm, pt.x, pt.y - 5); }
      } else {   // caído: anel de ressurreição + texto
        proj(p.x, 0.5, p.z, pt);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(pt.x, pt.y, 26, 0, 6.283); ctx.stroke();
        ctx.strokeStyle = '#39ff88'; ctx.beginPath(); ctx.arc(pt.x, pt.y, 26, -1.5708, -1.5708 + 6.283 * (p.reviveProg || 0)); ctx.stroke();
        ctx.font = '900 10px Orbitron, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeText('REVIVER', pt.x, pt.y - 34); ctx.fillText('REVIVER', pt.x, pt.y - 34);
      }
    });
    if (MOSTRAR_FPS) { ctx.font = '700 10px "Share Tech Mono", monospace'; ctx.textAlign = 'right'; ctx.fillStyle = fps.atual >= 50 ? '#39ff88' : fps.atual >= 35 ? '#ffd23d' : '#ff4d5e'; ctx.fillText(fps.atual + ' FPS', ctx.canvas.clientWidth - 6, ctx.canvas.clientHeight - 6 - 0); }
  }

  // ═════════════ LOOP ═════════════
  function frame(agora) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, (agora - ultimo) / 1000); ultimo = agora; if (dt <= 0) return;
    t += dt;
    // FPS e qualidade automática: se ficar abaixo de 38 por ~4 s, reduz a resolução
    fps.n++; fps.t += dt;
    if (fps.t >= 1) {
      fps.atual = Math.round(fps.n / fps.t); fps.n = 0; fps.t = 0;
      if (estado.rodando && fps.atual < 38) { if (++fps.baixos >= 4 && fps.quedas < 3) { mundo.baixarQualidade(); fps.quedas++; fps.baixos = 0; } } else fps.baixos = 0;
    }
    if (ONLINE) {
      // online: sempre mostra o último estado recebido (mesmo antes da contagem acabar, para os heróis já aparecerem)
      var ult = buf.length ? buf[buf.length - 1] : null;
      if (ult) { var tr = ult.t + Math.min(0.25, (performance.now() - ult.chegou) / 1000) - ATRASO_INTERP; vista = vistaOnline(tr, dt); tocarEventosPendentes(tr); }
      else if (!vista) vista = vazia();
    } else if (estado.rodando && !estado.pausado && !estado.fim) passoSolo(dt);
    // desenha
    var foco = jogadorLocal(), fx0 = foco ? foco.x : 0, fz0 = foco ? foco.z : 0;
    des.sincronizar(vista, estado.pausado ? 0.0001 : dt, t, slotLocal);
    mundo.atualizar(dt, t, fx0, fz0);
    fx.atualizar(estado.pausado ? 0 : dt);
    mundo.renderer.render(mundo.scene, mundo.camera);
    fx.desenharOverlay(dt, overlayExtra);
    hudT += dt; if (hudT > 0.09) { hudT = 0; if (estado.rodando || estado.fim) atualizarHud(); }
  }

  // ═════════════ FIM DE PARTIDA ═════════════
  function finalizarSolo() {
    estado.fim = true; ctrl.ativar(false);
    var res = sim.S.resultado, p = sim.jogador(meuId), eu = res.jogadores[0];
    A.parar(); A.tocar('derrota');
    setTimeout(function () {
      ui.resultado(res, { nivel: eu.nivel, moedas: eu.moedas, xpConta: eu.xpConta }, ['Salvando recompensa…']);
      window.NRConta.pagarPartida({ moedas: eu.moedas, xpConta: eu.xpConta, pontos: eu.pontos }, res).then(function (info) {
        var l = ['Recompensa salva na sua conta ' + window.NRIcones.svg('check')]; if (info.novoRecorde) l.push('<span style="color:#ffd23d">' + window.NRIcones.svg('estrela') + ' NOVO RECORDE NO RANKING ' + window.NRIcones.svg('estrela') + '</span>'); if (info.subiuNivel) l.push('<span style="color:#39ff88">' + window.NRIcones.svg('subir') + ' Seu nível de conta subiu!</span>');
        ui.resultadoExtra(l); A.tocar('moeda');
      }).catch(function (e) { console.error(e); ui.resultadoExtra(['<span style="color:#ff6677">Não foi possível salvar a recompensa (sem conexão?)</span>']); });
    }, 1300);
  }
  function finalizarOnline(res) {
    if (estado.fim) return; estado.fim = true; ctrl.ativar(false);
    window.NRRede.fimDaPartida(); A.parar(); A.tocar('derrota');
    var eu = null, sid = window.NRRede.sala() && window.NRRede.sala().sessionId;
    res.jogadores.forEach(function (j) { if (j.id === sid) eu = j; });
    var extra = ['Recompensa creditada pelo servidor ' + window.NRIcones.svg('check')]; res.jogadores.forEach(function (j) { extra.push(j.nome + ' — ' + j.abates + ' abates, ' + j.dano + ' de dano'); });
    setTimeout(function () { ui.resultado(res, eu, extra); }, 1300);
  }

  // ═════════════ INÍCIO ═════════════
  function contagemInicial(depois) {
    var passos = ['3', '2', '1', 'JÁ!'], i = 0;
    (function prox() {
      if (i >= passos.length) { ui.fimContagem(); depois(); return; }
      var go = i === passos.length - 1; ui.contagem(passos[i], go ? '#39ff88' : '#fff'); A.tocar(go ? 'contagemGo' : 'contagem');
      i++; setTimeout(prox, go ? 600 : 850);
    })();
  }
  function esperarToque(depois) {
    A.destravar();
    setTimeout(function () {
      if (A.pronto()) { depois(); return; }
      ui.contagem('<span style="font-size:26px">TOQUE PARA COMEÇAR</span>');
      var fn = function () { window.removeEventListener('pointerdown', fn); window.removeEventListener('keydown', fn); A.destravar(); ui.fimContagem(); setTimeout(depois, 150); };
      window.addEventListener('pointerdown', fn); window.addEventListener('keydown', fn);
    }, 200);
  }
  function comecarPartida() {
    ui.mostrarHud(); ctrl.ativar(true);
    A.musica('jogo'); A.intensidade(1);
    contagemInicial(function () { estado.rodando = true; ui.banner('ONDA 1', 'SOBREVIVA', '#2ee6ff'); });
  }

  // ═════════════ CALLBACKS DO DESENHISTA ═════════════
  var callbacksVisuais = {
    nivel: function (n) { ui.flash('#ffd23d'); ui.banner('NÍVEL ' + n, 'EVOLUÇÃO', '#ffd23d'); },
    dano: function () { ui.dano(); },
    onda: function (n) {
      if (n === ultimaOnda && n === 1) return; ultimaOnda = n;
      if (n % CFG.chefeACada !== 0) { ui.banner('ONDA ' + n, 'NOVA ONDA', '#2ee6ff'); A.tocar('ondaNova'); }
    },
    chefe: function (idx) { chefeVivo = true; A.intensidade(3); ui.banner(D.CHEFES[idx].nome, 'ALERTA: CHEFE', '#ff3344'); },
    chefeMorto: function () { chefeVivo = false; ui.flash('#ffffff'); ui.banner('CHEFE ELIMINADO', 'RECOMPENSA LIBERADA', '#39ff88'); A.tocar('vitoria'); },
    loja: function (n) { ui.flash('#39ff88'); A.intensidade(0); },
    horda: function (k) { ui.banner(k === 1 ? 'HORDA CERCANDO!' : 'MANADA!', 'ALERTA', '#ff8a2a'); },
    caiu: function (slot) { if (slot === slotLocal && ONLINE) ui.aviso('Você caiu! Um aliado pode te reviver ficando ao seu lado.', 4000); },
  };

  // ═════════════ MENUS (pausa, sair) ═════════════
  function irMenu() { estado.saindo = true; location.href = 'menu.html'; }
  var cbUi = {
    carta: function (i) {
      A.tocar('carta');
      if (ONLINE) window.NRRede.enviarCarta(i); else sim.escolher(meuId, i);
      ctrl.ativar(true);
    },
    pausar: function () { if (estado.fim || !estado.rodando) return; atirando = false; if (!ONLINE) estado.pausado = true; ui.pausa(true); A.tocar('clique'); },
    continuar: function () { estado.pausado = false; ui.pausa(false); ultimo = performance.now(); A.tocar('clique'); },
    sair: function () {
      A.tocar('voltar');
      if (ONLINE) { window.NRRede.sair(); irMenu(); }
      else if (!estado.fim && sim.S.t > 5) { ui.pausa(false); estado.pausado = false; sim.terminar('saiu'); finalizarSolo(); }
      else irMenu();
    },
    comprar: function (i) { if (ONLINE) window.NRRede.comprar(i); else { if (sim.comprar(meuId, i)) A.tocar('comprar'); else A.tocar('erro'); } },
    rerolar: function () { A.tocar('clique'); if (ONLINE) window.NRRede.rerolar(); else sim.rerolar(meuId); },
    prontoLoja: function () { A.tocar('confirmar'); if (ONLINE) window.NRRede.prontoLoja(); else sim.prontoLoja(meuId); },
    erroLoja: function () { A.tocar('erro'); },
    denovo: function () { if (ONLINE) { window.NRRede.sair(); location.href = 'sala.html'; } else location.reload(); },
    menu: function () { if (ONLINE) window.NRRede.sair(); irMenu(); },
  };

  // ═════════════ BOOT ═════════════
  async function construirCena() {
    if (window.NRHeroiGLB) { ui.carregando(45, 'Carregando modelos 3D…'); await window.NRHeroiGLB.precarregar(); }
    ui.carregando(55, 'Construindo a cidade…');
    var canvas = document.getElementById('cena');
    mundo = window.NRMundo.criar(canvas);
    fx = window.NREfeitos.criar(mundo, document.getElementById('overlay'));
    ui.carregando(75, 'Montando personagens…');
    des = window.NRDesenhista.criar(mundo, fx, { callbacks: callbacksVisuais, infoSlot: infoSlot });
    ctrl = window.NRControles.criar(document.getElementById('zonaToque'), document.getElementById('joy'), document.getElementById('joyBase'), document.getElementById('joyBot'));
    ctrl.ativar(false);
    ui.ligarDash(function () { ctrl.pedirDash(); });
    // PULAR: pulo visual do herói (animação 'jump' do Kenney). Não muda a simulação/servidor: só o seu personagem salta.
    function pular() { if (!estado.rodando || estado.pausado || !des) return; var jp = des.jogador(slotLocal); if (jp && jp.modelo && jp.modelo.pular && !jp.caido && jp.modelo.pular() && ONLINE) pulaPend = true; }
    ui.ligarPular(pular);
    // ATIRAR: no modo "POR BOTÃO" (Pausa/Ajustes → TIRO) o herói só atira enquanto o botão está apertado (tecla F no computador)
    function aplicarModoTiro() { ui.mostrarAtirar(modoBotao()); if (!modoBotao()) atirando = false; }
    ui.ligarAtirar(function (v) { atirando = !!v && estado.rodando && !estado.pausado; });
    window.addEventListener('keydown', function (e) { if (e.code === 'KeyF' && !e.repeat && estado.rodando && !estado.pausado) atirando = true; });
    window.addEventListener('keyup', function (e) { if (e.code === 'KeyF') atirando = false; });
    window.addEventListener('nr-modo-tiro', aplicarModoTiro);
    aplicarModoTiro();
    window.addEventListener('keydown', function (e) { if (e.code === 'KeyJ' || e.code === 'KeyK') pular(); });
    vista = ONLINE ? vazia() : sim.S;
  }
  function iniciarLoop() { ultimo = performance.now(); requestAnimationFrame(frame); }

  async function bootSolo() {
    ui.carregando(15, 'Carregando conta…');
    nomeLocal = await window.NRConta.nome(); loadout = await window.NRConta.loadout(true);
    var eq = D.resolverEquip(loadout); infoSlot[0] = { persona: eq.persona, arma: eq.arma, nome: nomeLocal };
    sim = Sim.criar({ seed: (Math.random() * 2147483647) | 0, coop: false });
    sim.adicionarJogador({ id: meuId, nome: nomeLocal, loadout: loadout });
    await construirCena();
    ui.carregando(100, 'Pronto!'); iniciarLoop(); ui.fimCarregando();
    esperarToque(comecarPartida);
  }

  async function bootOnline() {
    ui.carregando(10, 'Conectando ao servidor…');
    await window.NRRede.carregarBiblioteca();
    window.NRRede.iniciar({ url: window.NR_SERVIDOR, getToken: function () { return Promise.resolve(null); } });
    var comecou = false, tentativasRec = 0;
    var timeout = setTimeout(function () { ui.aviso('Não foi possível voltar à sala. Voltando ao menu…', 3000); setTimeout(irMenu, 3000); }, 20000);
    window.NRRede.on('iniciar', async function (info) {
      clearTimeout(timeout);
      slotLocal = info.eu; info.jogadores.forEach(function (j) { infoSlot[j.slot] = { persona: j.persona || 'padrao', arma: j.arma || 'base', nome: j.nome }; });
      if (!des) { await construirCena(); iniciarLoop(); ui.carregando(100, 'Esperando os outros jogadores…'); }
      window.NRRede.marcarPartida(location.pathname.split('/').pop() + '?online=1');
      window.NRRede.carregado();
    });
    window.NRRede.on('comecar', function () {
      if (comecou) return; comecou = true; ui.fimCarregando();
      esperarToque(function () { comecarPartidaOnline(); });
    });
    window.NRRede.on('snapshot', receberSnapshot);
    window.NRRede.on('cartas', function (d) { window.NRRede.enviarCarta(0); });      // servidor antigo: escolhe a 1ª carta sem mostrar nada (o servidor novo nem manda)
    window.NRRede.on('loja', function (d) { if (d && d.aberta) window.NRRede.prontoLoja(); });      // servidor antigo: pula a loja sozinho
    window.NRRede.on('fim', finalizarOnline);
    window.NRRede.on('erro', function (m) { ui.aviso(String(m), 4000); });
    window.NRRede.on('saiu', async function (d) {
      if (estado.fim || estado.saindo) return;
      if (!d.queda) { ui.aviso('Você saiu da sala.', 2500); setTimeout(irMenu, 2500); return; }
      ui.aviso('Conexão perdida. Reconectando…', 60000);
      for (var i = 0; i < 8; i++) { await new Promise(function (r) { setTimeout(r, 2500); }); if (await window.NRRede.reconectar()) { ui.aviso('Reconectado!', 1500); return; } }
      ui.aviso('Não foi possível reconectar.', 4000); setTimeout(irMenu, 4000);
    });
    ui.carregando(35, 'Voltando para a sala…');
    var r = await window.NRRede.reconectar();
    if (!r) { clearTimeout(timeout); ui.aviso('Sala não encontrada. Voltando ao menu…', 3000); setTimeout(irMenu, 3000); }
    setInterval(enviarEntrada, ENVIO_INPUT_MS);
  }
  function comecarPartidaOnline() {
    ui.mostrarHud(); ctrl.ativar(true); A.musica('jogo'); A.intensidade(1);
    ui.botaoDeNovo(true);
    // o servidor começa a simular ~3 s depois do "comecar": a contagem acompanha
    contagemInicial(function () { estado.rodando = true; ui.banner('ONDA 1', 'SOBREVIVA JUNTOS', '#2ee6ff'); });
  }

  // segundo plano: pausa o solo e silencia o som
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { A.suspender(); if (!ONLINE && estado.rodando && !estado.fim) cbUi.pausar(); }
    else A.retomar();
  });
  // celular em pé: o aviso 'gire o celular' cobre a tela, então a partida solo pausa
  window.addEventListener('nr:retrato', function () { if (!ONLINE && estado.rodando && !estado.fim) cbUi.pausar(); });
  window.addEventListener('keydown', function (e) { if (e.code === 'Escape') { estado.pausado ? cbUi.continuar() : cbUi.pausar(); } });
  // bloqueia gestos do navegador (zoom, arrastar para recarregar)
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  window.addEventListener('load', async function () {
    ui = window.NRInterface.criar(cbUi);
    try {
      if (typeof THREE === 'undefined') throw new Error('O motor 3D não carregou. Verifique a internet e recarregue.');
      if (ONLINE) await bootOnline(); else await bootSolo();
    } catch (e) {
      console.error(e);
      document.getElementById('carTexto').textContent = 'ERRO: ' + ((e && e.message) || e);
      document.getElementById('carTexto').style.color = '#ff6677';
    }
  });

  window.NRPartida = { estado: estado, get sim() { return sim; }, fps: fps };   // para depuração no console
})();
