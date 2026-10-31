// ══════════════════════════════════════════════════════════════════
// AUDIO.JS — TODO o som do jogo é criado aqui, por código (Web Audio).
// Não existe nenhum arquivo .mp3/.wav: efeitos e música são sintetizados
// na hora, então o jogo fica leve e o som é 100% original.
//
//   NRAudio.destravar()            → chamar num toque (celular só libera som depois de um toque)
//   NRAudio.tocar('tiro')          → efeito sonoro (nomes na lista SFX abaixo)
//   NRAudio.musica('jogo'|'menu')  → começa a música; NRAudio.intensidade(0..3) sobe as camadas
//   NRAudio.parar()                → para a música
//
// Ajustes rápidos: volumes no topo (VOL_*), andamento em BPM, escala em ESCALA.
// ══════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var VOL_MUSICA = 0.5, VOL_SFX = 0.9;   // padrões (o jogador muda nas configurações)
  var BPM = 118;
  // Progressão de acordes (Am - F - C - G): raiz do baixo e notas do acorde (Hz)
  var ACORDES = [
    { raiz: 55.0,  nota: [220.0, 261.63, 329.63] },   // Am
    { raiz: 43.65, nota: [174.61, 220.0, 261.63] },   // F
    { raiz: 65.41, nota: [196.0, 261.63, 329.63] },   // C
    { raiz: 49.0,  nota: [196.0, 246.94, 293.66] },   // G
  ];
  var ESCALA = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 784]; // pentatônica menor de A

  var vozes = [];                  // fim previsto de cada som em andamento (limite de vozes)
  var ctx = null, mestre = null, busSfx = null, busMus = null, ruidoBuf = null, comp = null;
  var volMus = VOL_MUSICA, volSfx = VOL_SFX, mudo = false;
  try {
    var vm = parseFloat(localStorage.getItem('nr_vol_musica')), vs = parseFloat(localStorage.getItem('nr_vol_sfx'));
    if (!isNaN(vm)) volMus = vm; if (!isNaN(vs)) volSfx = vs;
    mudo = localStorage.getItem('nr_mudo') === '1';
  } catch (e) {}

  function criar() {
    if (ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    busSfx = ctx.createGain(); busSfx.gain.value = volSfx;
    busMus = ctx.createGain(); busMus.gain.value = volMus;
    montarSaida();
    setInterval(vigiar, 1500);                          // vigia: se o áudio travar (NaN/estouro/interrompido), se recupera sozinho
    // 2 s de ruído branco reaproveitado por vários efeitos (explosões, chiados, hi-hat)
    ruidoBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    var d = ruidoBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  // compressor + volume mestre + medidor; separado do criar() para poder ser REFEITO se o áudio travar
  var anl = null, bufAnl = null;
  function montarSaida() {
    comp = ctx.createDynamicsCompressor();           // evita estourar quando muita coisa toca junto
    comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.2;
    mestre = ctx.createGain(); mestre.gain.value = mudo ? 0 : 1;
    busSfx.connect(comp); busMus.connect(comp); comp.connect(mestre); mestre.connect(ctx.destination);
    anl = ctx.createAnalyser(); anl.fftSize = 512; mestre.connect(anl); bufAnl = new Float32Array(anl.fftSize);
  }
  function reconstruir(motivo) {
    try { console.warn('[audio] refazendo a saída de áudio:', motivo); } catch (e) {}
    try { if (sint && sint.master) sint.master.disconnect(); } catch (e) {}
    sint = null; vozes.length = 0;
    try { busSfx.disconnect(); busMus.disconnect(); comp.disconnect(); mestre.disconnect(); if (anl) anl.disconnect(); } catch (e) {}
    try { montarSaida(); } catch (e) {}
  }
  function vigiar() {
    if (!ctx) return;
    if ((ctx.state === 'interrupted' || (ctx.state === 'suspended' && !document.hidden && !suspensoDeProposito)) && !document.hidden) { try { ctx.resume(); } catch (e) {} }
    if (ctx.state !== 'running' || !anl) return;
    anl.getFloatTimeDomainData(bufAnl);
    for (var i = 0; i < bufAnl.length; i++) { var v = bufAnl[i]; if (v !== v || v > 8 || v < -8) { reconstruir('valor inválido na saída'); return; } }
  }
  var suspensoDeProposito = false;
  function destravar() {
    if (!criar()) return;
    if (ctx.state === 'suspended' || ctx.state === 'interrupted') { suspensoDeProposito = false; ctx.resume(); }
  }
  // o navegador só libera o áudio depois de um toque: destrava no primeiro
  ['touchstart', 'pointerdown', 'keydown', 'click'].forEach(function (ev) {
    window.addEventListener(ev, function f() { destravar(); }, { passive: true });
  });

  // ── FERRAMENTAS DE SÍNTESE ──────────────────────────────────────
  // oscilador com varredura de frequência f0→f1 e envelope de volume
  function osc(tipo, f0, f1, dur, vol, t0, destino, atk) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipo; o.frequency.setValueAtTime(Math.max(20, f0), t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    var a = atk || 0.004;
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(destino || busSfx);
    o.start(t0); o.stop(t0 + dur + 0.05);
    return o;
  }
  // ruído filtrado (explosões, chiados, caixa de bateria)
  function ruido(dur, vol, tipoFiltro, f0, f1, t0, destino, q) {
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = ruidoBuf; s.loop = true;
    f.type = tipoFiltro || 'lowpass'; f.Q.value = q || 0.8;
    f.frequency.setValueAtTime(f0, t0); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(destino || busSfx);
    s.start(t0, Math.random()); s.stop(t0 + dur + 0.05);
  }
  function distorcao(k) {   // curva de saturação para sons "sujos"
    var n = 256, c = new Float32Array(n);
    for (var i = 0; i < n; i++) { var x = i * 2 / n - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); }
    return c;
  }

  // ── EFEITOS SONOROS ─────────────────────────────────────────────
  var ultimo = {};                 // limita sons muito repetidos (não vira ruído)
  var ESPERA = { agua: 0.09, passo: 0.11, corte: 0.05, tiro: 0.045, hit: 0.035, morte: 0.04, gema: 0.03, tiroInimigo: 0.08, drone: 0.08, tesla: 0.08, dano: 0.1 };
  var comboGema = 0, tComboGema = 0;

  var sint = null, ctxTiro = null;
  function sintTiro() { if (!sint && window.NRGunSynth && ctx) { try { sint = window.NRGunSynth.criar(ctx, busSfx); } catch (e) { sint = false; } } return sint || null; }

  var SFX = {
    // tiro do rifle: som SINTETIZADO (tiro-sintetizado.js, vindo do tiros.html). Se esse arquivo falhar, volta o "pew" antigo.
    tiro: function (t, o) {
      var g = sintTiro();
      if (g) {
        try {
          var aliado = !!(o && o.tom), cx = aliado ? ctxTiro : null;      // cx = { d: distância em metros, x: esquerda/direita } definido por NRAudio.contextoTiro()
          g.fire('rifle', { rapid: true, intensity: aliado ? 0.5 : 1, leve: aliado, distance: cx ? cx.d : 0, x: cx ? cx.x : 0, atraso: aliado ? 0.004 + Math.random() * 0.04 : 0 });      // atraso aleatório: tiros de amigos que chegam juntos não somam no mesmo instante (era o "estralo")
          return;
        } catch (e) { /* cai no som antigo */ }
      }
      var p = 1 + (Math.random() - 0.5) * 0.12 + (o && o.tom ? o.tom : 0);
      osc('sawtooth', 1500 * p, 240 * p, 0.14, 0.16, t);
      osc('square', 820 * p, 160 * p, 0.09, 0.07, t);
      ruido(0.03, 0.12, 'highpass', 4000, 4000, t);
    },
    // corte de katana: "shing" metálico + sopro de vento
    corte: function (t) {
      ruido(0.22, 0.2, 'bandpass', 1500, 6500, t, null, 2.5); osc('sawtooth', 2400, 900, 0.12, 0.07, t); osc('triangle', 3200, 1800, 0.18, 0.05, t + 0.02); ruido(0.08, 0.12, 'highpass', 6000, 6000, t);
    },
    // passo: batida surda e curta (volume e peso crescem com a corrida)
    passo: function (t, o) {
      var f = (o && o.forca) || 0.5; ruido(0.05, 0.05 + 0.06 * f, 'lowpass', 700 + 500 * f, 200, t); osc('sine', 110 + 30 * f, 55, 0.07, 0.06 + 0.06 * f, t);
    },
    // chapinhar na poça: jato de água curto + "plop" + respingos agudos
    agua: function (t, o) {
      var f = (o && o.forca) || 0.6;
      ruido(0.26, 0.12 + 0.09 * f, 'bandpass', 1700 + 900 * f, 450, t, null, 1.1); osc('sine', 520 + Math.random() * 300, 170, 0.13, 0.05 + 0.05 * f, t); ruido(0.14, 0.07, 'highpass', 5200, 3200, t + 0.035);
    },
    tiroInimigo: function (t) { osc('triangle', 520, 190, 0.18, 0.1, t); },
    drone: function (t) { osc('square', 1200, 700, 0.07, 0.05, t); },
    hit: function (t) { ruido(0.04, 0.09, 'bandpass', 2400 + Math.random() * 800, 1200, t, null, 1.2); },
    crit: function (t) { osc('square', 900, 1800, 0.08, 0.1, t); ruido(0.05, 0.1, 'highpass', 5000, 5000, t); },
    morte: function (t) {
      ruido(0.16, 0.2, 'lowpass', 1800, 220, t);
      osc('sine', 220 + Math.random() * 60, 55, 0.14, 0.14, t);
    },
    morteElite: function (t) { ruido(0.4, 0.4, 'lowpass', 2600, 120, t); osc('sine', 140, 38, 0.4, 0.4, t); osc('sawtooth', 300, 60, 0.3, 0.12, t); },
    gema: function (t) {
      // cada gema seguida sobe um degrau da escala: coletar vira "melodia"
      var agora = ctx.currentTime; if (agora - tComboGema > 0.55) comboGema = 0; tComboGema = agora;
      var f = ESCALA[Math.min(ESCALA.length - 1, comboGema % ESCALA.length)] * 2; comboGema++;
      osc('sine', f, f * 1.01, 0.12, 0.1, t); osc('triangle', f * 2, f * 2, 0.06, 0.03, t);
    },
    nivel: function (t) {   // level up: arpejo maior brilhante + brilho
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach(function (f, i) {
        osc('square', f, f, 0.25, 0.09, t + i * 0.07); osc('sine', f * 2, f * 2, 0.3, 0.06, t + i * 0.07);
      });
      ruido(0.7, 0.06, 'highpass', 6000, 9000, t + 0.1);
    },
    dano: function (t) { osc('sawtooth', 160, 45, 0.28, 0.3, t); ruido(0.2, 0.28, 'lowpass', 1400, 120, t); },
    dash: function (t) { ruido(0.28, 0.2, 'bandpass', 500, 4200, t, null, 2); osc('sine', 300, 900, 0.2, 0.06, t); },
    emp: function (t) {
      osc('sine', 130, 28, 0.7, 0.55, t); osc('sawtooth', 900, 90, 0.5, 0.12, t);
      ruido(0.5, 0.2, 'bandpass', 3000, 300, t, null, 3);
    },
    tesla: function (t) {   // crepitar elétrico
      for (var i = 0; i < 6; i++) osc('square', 400 + Math.random() * 2200, 200 + Math.random() * 600, 0.06, 0.07, t + i * 0.025);
      ruido(0.22, 0.13, 'highpass', 3500, 6000, t);
    },
    granada: function (t) { osc('sine', 700, 280, 0.25, 0.08, t); },
    explosao: function (t, o) {
      var g = o && o.grande ? 1.6 : 1;
      ruido(0.55 * g, 0.5, 'lowpass', 2400, 90, t); osc('sine', 110, 30, 0.5 * g, 0.6, t); osc('sawtooth', 200, 40, 0.3, 0.14, t);
    },
    orbitalCarrega: function (t) { osc('sawtooth', 200, 1600, 0.8, 0.09, t, null, 0.3); },
    orbital: function (t) {
      ruido(0.7, 0.45, 'lowpass', 5000, 100, t); osc('sine', 90, 25, 0.8, 0.7, t); osc('square', 2000, 100, 0.3, 0.12, t);
    },
    alertaChefe: function (t) {   // buzina grave de chefe
      var gd = ctx.createGain(); gd.gain.value = 0.35; gd.connect(busSfx);
      [0, 0.6, 1.2].forEach(function (d) {
        osc('sawtooth', 70, 62, 0.55, 0.5, t + d, gd, 0.05); osc('sawtooth', 70.7, 62.5, 0.55, 0.5, t + d, gd, 0.05);
        osc('square', 140, 124, 0.5, 0.15, t + d, gd, 0.05);
      });
      ruido(1.8, 0.1, 'lowpass', 300, 80, t);
    },
    ondaNova: function (t) {
      osc('sawtooth', 220, 440, 0.18, 0.12, t); osc('sawtooth', 330, 660, 0.18, 0.1, t + 0.15); osc('square', 660, 660, 0.3, 0.08, t + 0.3);
    },
    horda: function (t) { for (var i = 0; i < 4; i++) osc('sawtooth', 300, 300, 0.12, 0.14, t + i * 0.16); },
    capsula: function (t) {
      [880, 1175, 1568, 2093].forEach(function (f, i) { osc('triangle', f, f, 0.3, 0.1, t + i * 0.06); });
      ruido(0.5, 0.07, 'highpass', 7000, 9000, t);
    },
    cura: function (t) { osc('sine', 440, 880, 0.3, 0.12, t); osc('sine', 660, 1320, 0.3, 0.08, t + 0.08); },
    item: function (t) { osc('square', 600, 1200, 0.12, 0.09, t); osc('square', 900, 1800, 0.12, 0.07, t + 0.07); },
    caiu: function (t) { osc('sawtooth', 300, 40, 0.9, 0.35, t); ruido(0.6, 0.2, 'lowpass', 900, 80, t); },
    reviveu: function (t) { [392, 523, 659, 784].forEach(function (f, i) { osc('triangle', f, f, 0.4, 0.12, t + i * 0.09); }); },
    teleporte: function (t) { ruido(0.3, 0.15, 'bandpass', 4000, 300, t, null, 4); osc('sawtooth', 1200, 200, 0.25, 0.1, t); },
    telegrafo: function (t) { osc('square', 440, 440, 0.07, 0.07, t); osc('square', 440, 440, 0.07, 0.07, t + 0.14); },
    clique: function (t) { osc('square', 1400, 900, 0.05, 0.08, t); },
    confirmar: function (t) { osc('square', 660, 660, 0.08, 0.1, t); osc('square', 990, 990, 0.14, 0.1, t + 0.07); },
    voltar: function (t) { osc('square', 700, 450, 0.12, 0.09, t); },
    carta: function (t) { osc('sine', 500, 1000, 0.18, 0.12, t); osc('triangle', 1000, 2000, 0.2, 0.06, t + 0.05); },
    cartaAbre: function (t) { osc('sine', 300, 900, 0.3, 0.1, t); ruido(0.3, 0.06, 'highpass', 5000, 8000, t); },
    contagem: function (t) { osc('square', 440, 440, 0.18, 0.14, t); },
    contagemGo: function (t) { osc('square', 880, 880, 0.5, 0.16, t); osc('sawtooth', 220, 220, 0.5, 0.1, t); ruido(0.4, 0.15, 'highpass', 4000, 8000, t); },
    derrota: function (t) { [392, 349, 311, 261, 196].forEach(function (f, i) { osc('sawtooth', f, f * 0.98, 0.5, 0.12, t + i * 0.25); }); },
    vitoria: function (t) { [523, 659, 784, 1046, 1318].forEach(function (f, i) { osc('square', f, f, 0.4, 0.1, t + i * 0.1); }); },
    moeda: function (t) { osc('square', 1318, 1318, 0.05, 0.08, t); osc('square', 1760, 1760, 0.18, 0.08, t + 0.05); },
    comprar: function (t) { [523, 659, 784, 1046].forEach(function (f, i) { osc('square', f, f, 0.2, 0.09, t + i * 0.06); }); ruido(0.3, 0.06, 'highpass', 6000, 9000, t + 0.1); },
    erro: function (t) { osc('sawtooth', 200, 140, 0.25, 0.15, t); },
  };

  // PRIORIDADE (0 = pode cair primeiro quando há muito som ao mesmo tempo · 3 = nunca é cortado antes)
  var PRIORIDADE = { gema: 0, hit: 0, passo: 0, agua: 0, drone: 0, tesla: 0, tiroInimigo: 1, morte: 1, corte: 1, moeda: 1, tiro: 2, dano: 3 };
  function tocar(nome, op) {
    if (!ctx || mudo || ctx.state !== 'running') return;
    var f = SFX[nome]; if (!f) return;
    var t = ctx.currentTime, e = ESPERA[nome];
    var chave = nome === 'tiro' && op && op.tom ? 'tiroAliado' : nome;      // o tiro dos amigos tem limitador próprio (não "come" o seu)
    if (e) { if (ultimo[chave] && t - ultimo[chave] < (chave === 'tiroAliado' ? 0.02 : e)) return; ultimo[chave] = t; }
    // ORÇAMENTO DE VOZES: nas ondas altas (centenas de inimigos) o jogo pede centenas de sons por segundo; cada um cria nós de áudio.
    // Acima do limite os sons menos importantes (acertos, gemas, passos) são descartados em vez de entupir o áudio até ele calar.
    var i = 0, vivos = []; for (; i < vozes.length; i++) if (vozes[i] > t) vivos.push(vozes[i]); vozes = vivos;
    var pr = PRIORIDADE[nome] === undefined ? 2 : PRIORIDADE[nome], n = vozes.length;
    if (n >= 36 || (n >= 26 && pr <= 1) || (n >= 16 && pr === 0)) return;
    vozes.push(t + (nome === 'tiro' ? 0.5 : 0.35));
    try { f(t, op); } catch (err) { /* som nunca pode derrubar o jogo */ }
  }

  // ── MÚSICA PROCEDURAL ───────────────────────────────────────────
  var mus = { rodando: false, modo: 'jogo', passo: 0, proxT: 0, timer: null, nivel: 1, delay: null, reverbSend: null, alvoNivel: 1 };

  function montarEfeitosMusica() {
    if (mus.delay) return;
    // eco (delay) com realimentação: dá profundidade ao arpejo
    var d = ctx.createDelay(1); d.delayTime.value = 60 / BPM * 0.75;
    var fb = ctx.createGain(); fb.gain.value = 0.38;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    var env = ctx.createGain(); env.gain.value = 0.5;
    d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(env); env.connect(busMus);
    mus.delay = d;
  }
  function notaMus(tipo, f, t, dur, vol, filtroF, extra) {
    var o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
    o.type = tipo; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.setValueAtTime(filtroF, t);
    fl.frequency.exponentialRampToValueAtTime(Math.max(80, filtroF * 0.3), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(fl); fl.connect(g); g.connect(busMus);
    if (extra && extra.eco) g.connect(mus.delay);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function kick(t) { var o = osc('sine', 150, 42, 0.22, 0.9, t, busMus); }
  function caixa(t) { ruido(0.16, 0.38, 'bandpass', 1800, 900, t, busMus, 0.9); osc('triangle', 220, 120, 0.1, 0.25, t, busMus); }
  function hat(t, aberto) { ruido(aberto ? 0.2 : 0.04, aberto ? 0.12 : 0.09, 'highpass', 7000, 7000, t, busMus); }

  // 16 passos por compasso (semicolcheias)
  var P_BAIXO = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0];
  var P_ARP = [0, 2, 4, 2, 5, 4, 2, 0, 3, 4, 5, 7, 5, 4, 2, 4];

  function passoMusica(i, t) {
    var compasso = Math.floor(i / 16) % 4, s = i % 16, ac = ACORDES[compasso], seg = 60 / BPM / 4;
    var menu = mus.modo === 'menu', n = menu ? 0 : mus.nivel;
    // pad (todo compasso): acorde com 3 serras desafinadas e filtro abrindo devagar
    if (s === 0) {
      ac.nota.forEach(function (f) {
        notaMus('sawtooth', f * 0.5, t, seg * 16, menu ? 0.07 : 0.05, 700, null);
        notaMus('sawtooth', f * 0.5 * 1.006, t, seg * 16, menu ? 0.07 : 0.05, 700, null);
      });
    }
    // baixo pulsante (a partir do nível 0 no jogo; no menu é só o pad + arpejo suave)
    if (!menu && P_BAIXO[s]) {
      var oitava = (s === 6 || s === 13) ? 2 : 1;
      notaMus('sawtooth', ac.raiz * oitava, t, seg * 1.8, n >= 3 ? 0.3 : 0.24, n >= 3 ? 1400 : 700, null);
      notaMus('square', ac.raiz * oitava * 0.5, t, seg * 1.8, 0.12, 300, null);
    }
    if (!menu && n >= 1) {          // bateria entra
      if (s % 4 === 0) kick(t);
      if (n >= 2 && (s === 4 || s === 12)) caixa(t);
      if (s % 2 === 0) hat(t, false); if (s === 6 || s === 14) hat(t, true);
      if (n >= 3 && (s === 10 || s === 11)) kick(t);
    }
    // arpejo (sempre, mais suave no menu; mais denso com a intensidade)
    var tocaArp = menu ? (s % 4 === 0 || s === 6 || s === 10) : (n >= 2 ? true : s % 2 === 0);
    if (tocaArp && (n >= 1 || menu)) {
      var idx = P_ARP[s] + (compasso === 1 ? -1 : compasso === 3 ? 1 : 0); idx = Math.max(0, Math.min(ESCALA.length - 1, idx));
      notaMus(menu ? 'triangle' : 'square', ESCALA[idx] * (menu ? 1 : 2), t, seg * 2.2, menu ? 0.07 : 0.06, 3200, { eco: true });
    }
    // melodia principal (alta intensidade / chefe): notas longas do acorde, uma oitava acima
    if (!menu && n >= 3 && (s === 0 || s === 8)) {
      var f = ac.nota[(s === 0 ? 2 : 1)] * 2;
      notaMus('sawtooth', f, t, seg * 7, 0.09, 4200, { eco: true }); notaMus('sawtooth', f * 1.01, t, seg * 7, 0.07, 4200, { eco: true });
    }
  }
  function agendar() {
    if (!mus.rodando || !ctx) return;
    var seg = 60 / BPM / 4;
    if (mus.modo === 'menu') seg *= 1.35;               // menu mais lento
    while (mus.proxT < ctx.currentTime + 0.18) {
      // sobe/desce a intensidade só no começo de um compasso (transição limpa)
      if (mus.passo % 16 === 0) mus.nivel = mus.alvoNivel;
      passoMusica(mus.passo, mus.proxT);
      mus.passo++; mus.proxT += seg;
    }
  }
  function musica(modo) {
    if (!criar()) return;
    mus.modo = modo || 'jogo';
    montarEfeitosMusica();
    if (mus.rodando) return;
    mus.rodando = true; mus.passo = 0; mus.proxT = ctx.currentTime + 0.15;
    mus.timer = setInterval(function () { if (ctx.state === 'running') agendar(); else mus.proxT = ctx.currentTime + 0.15; }, 40);
  }
  function parar() { mus.rodando = false; clearInterval(mus.timer); mus.timer = null; }

  function aplicarVolumes() {
    if (!ctx) return;
    busMus.gain.value = volMus; busSfx.gain.value = volSfx; mestre.gain.value = mudo ? 0 : 1;
  }
  window.NRAudio = {
    destravar: destravar, tocar: tocar, musica: musica, parar: parar,
    intensidade: function (n) { mus.alvoNivel = Math.max(0, Math.min(3, n | 0)); },
    // MODO DE TIRO: 'auto' (atira sozinho no inimigo mais perto) ou 'botao' (só atira enquanto segura o botão ATIRAR). Guardado no aparelho.
    // Distância (m) e lado do amigo que atirou — o partida.js chama antes de processar cada tiro de aliado (null = som normal)
    contextoTiro: function (c) { ctxTiro = c || null; },
    modoTiro: function (v) { if (v === undefined) { var m = 'auto'; try { m = localStorage.getItem('nr_modo_tiro') === 'botao' ? 'botao' : 'auto'; } catch (e) {} return m; } try { localStorage.setItem('nr_modo_tiro', v === 'botao' ? 'botao' : 'auto'); } catch (e) {} return v; },
    volumeMusica: function (v) { if (v === undefined) return volMus; volMus = v; try { localStorage.setItem('nr_vol_musica', v); } catch (e) {} aplicarVolumes(); },
    volumeSfx: function (v) { if (v === undefined) return volSfx; volSfx = v; try { localStorage.setItem('nr_vol_sfx', v); } catch (e) {} aplicarVolumes(); },
    mudo: function (m) { if (m === undefined) return mudo; mudo = !!m; try { localStorage.setItem('nr_mudo', mudo ? '1' : '0'); } catch (e) {} aplicarVolumes(); },
    pronto: function () { return !!ctx && ctx.state === 'running'; },
    // pausa/retoma tudo quando o app vai para segundo plano
    suspender: function () { if (ctx && ctx.state === 'running') { suspensoDeProposito = true; ctx.suspend(); } },
    retomar: function () { suspensoDeProposito = false; if (ctx && ctx.state === 'suspended') ctx.resume(); },
  };
})();
