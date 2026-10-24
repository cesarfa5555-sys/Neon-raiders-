// ══════════════════════════════════════════════════════════════════
// POCAS.JS — poças d'água no meio do mapa.
//   • Cada poça tem formato irregular, reflexo do céu/cidade e uma borda de lama.
//   • Gotas da chuva fazem pequenas ondas sozinhas.
//   • Quando um personagem (ou inimigo) pisa na poça: ondas se espalhando, respingos de água e SOM de chapinhar.
//
// É uma camada fina e independente do resto do jogo (só precisa do "mundo" e dos "efeitos"):
// fácil de portar para outra engine. Posições são fixas (iguais para todos os jogadores do co-op).
// Para mudar quantidade/lugar/tamanho das poças: tabela POCAS logo abaixo.
// ══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var T = window.THREE;

  // x, z = centro; rx, rz = raios (tamanho); rot = giro. Todas dentro da arena, perto do meio.
  var POCAS = [
    { x: 7.5, z: -4.0, rx: 4.2, rz: 2.8, rot: 0.4 },
    { x: -8.5, z: 3.5, rx: 3.4, rz: 2.4, rot: -0.7 },
    { x: 2.0, z: 9.5, rx: 3.0, rz: 2.0, rot: 1.2 },
    { x: -3.5, z: -9.0, rx: 4.6, rz: 3.0, rot: 0.1 },
    { x: 13.0, z: 8.0, rx: 2.6, rz: 1.8, rot: -0.3 },
    { x: -15.0, z: -4.0, rx: 3.0, rz: 2.2, rot: 0.9 },
    { x: 0.5, z: -0.5, rx: 2.4, rz: 1.7, rot: -1.0 },        // uma bem no centro do mapa
  ];

  function rand(seed) { var a = seed | 0; return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // textura de UMA poça: contorno irregular, lama na borda, céu refletido no meio (com bordas transparentes)
  function texturaPoca(seed, natural) {
    var N = 256, c = document.createElement('canvas'); c.width = c.height = N; var g = c.getContext('2d'), r = rand(seed), pts = [], K = 20;
    for (var i = 0; i < K; i++) { var a = i / K * Math.PI * 2, rr = 0.8 + r() * 0.2 + Math.sin(a * 3 + seed) * 0.05; pts.push([N / 2 + Math.cos(a) * N / 2 * 0.92 * rr, N / 2 + Math.sin(a) * N / 2 * 0.92 * rr]); }
    function caminho(esc) { g.beginPath(); for (var i = 0; i <= K; i++) { var p = pts[i % K], q = pts[(i + 1) % K], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2; var cx = N / 2 + (mx - N / 2) * esc, cy = N / 2 + (my - N / 2) * esc; if (i === 0) g.moveTo(cx, cy); else g.quadraticCurveTo(N / 2 + (p[0] - N / 2) * esc, N / 2 + (p[1] - N / 2) * esc, cx, cy); } g.closePath(); }
    // borda de lama (marrom escuro, esfumada)
    g.filter = 'blur(3px)'; caminho(1.0); g.fillStyle = natural ? 'rgba(70,52,34,0.9)' : 'rgba(10,14,30,0.9)'; g.fill(); g.filter = 'none';
    // água: gradiente que reflete o céu (natural) ou as luzes da cidade (cyberpunk)
    caminho(0.9); var gr = g.createRadialGradient(N * 0.4, N * 0.38, 4, N / 2, N / 2, N * 0.5);
    if (natural) { gr.addColorStop(0, 'rgba(214,238,255,0.95)'); gr.addColorStop(0.55, 'rgba(120,170,205,0.92)'); gr.addColorStop(1, 'rgba(62,100,128,0.92)'); }
    else { gr.addColorStop(0, 'rgba(120,200,255,0.9)'); gr.addColorStop(0.5, 'rgba(60,40,120,0.92)'); gr.addColorStop(1, 'rgba(10,12,40,0.95)'); }
    g.fillStyle = gr; g.fill();
    g.save(); caminho(0.9); g.clip();                                         // reflexos: faixas verticais claras / neon
    for (var k = 0; k < 14; k++) { var x = r() * N, w = 3 + r() * 9; g.fillStyle = natural ? 'rgba(255,255,255,' + (0.1 + r() * 0.18) + ')' : ['rgba(46,230,255,0.25)', 'rgba(255,61,166,0.22)', 'rgba(255,210,61,0.18)'][k % 3]; g.fillRect(x, N * 0.15 + r() * N * 0.2, w, N * (0.3 + r() * 0.4)); }
    g.restore();
    var t = new T.CanvasTexture(c); return t;
  }

  function criar(mundo, fx, opcoes) {
    opcoes = opcoes || {};
    var scene = mundo.scene, natural = (window.NRMundo && window.NRMundo.AJUSTES.ambiente === 'natural'), A = window.NRAudio;
    var lista = POCAS.map(function (p, i) {
      var mat = new T.MeshBasicMaterial({ map: texturaPoca(11 + i * 7, natural), transparent: true, depthWrite: false, opacity: 0.97 });
      var m = new T.Mesh(new T.PlaneGeometry(p.rx * 2.2, p.rz * 2.2), mat); m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI / 2, 0, p.rot); m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.045, p.z);
      m.rotation.set(-Math.PI / 2, 0, p.rot, 'XYZ'); scene.add(m);
      // brilho que passeia pela água
      var br = new T.Mesh(new T.PlaneGeometry(p.rx * 1.6, p.rz * 1.6), new T.MeshBasicMaterial({ map: mundo.glowTex, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.25, color: natural ? 0xffffff : 0x66ccff }));
      br.rotation.x = -Math.PI / 2; br.position.set(p.x, 0.05, p.z); scene.add(br);
      return { p: p, m: m, br: br, cos: Math.cos(p.rot), sin: -Math.sin(p.rot), fase: i * 1.7 };   // eixo maior da poça no chão = (cos, sin)
    });
    var cor = natural ? 0xe8f6ff : 0x8fd8ff;
    var agenda = [];                                               // ondas programadas (anéis em sequência)
    var tChuva = 0, ultimoSom = 0;

    function dentro(x, z) {                                        // índice da poça em (x,z) ou -1
      for (var i = 0; i < lista.length; i++) {
        var q = lista[i], dx = x - q.p.x, dz = z - q.p.z, u = dx * q.cos + dz * q.sin, v = -dx * q.sin + dz * q.cos;      // coordenadas no eixo da poça
        if ((u * u) / (q.p.rx * q.p.rx) + (v * v) / (q.p.rz * q.p.rz) < 0.82) return i;
      }
      return -1;
    }
    // respingo: anéis se espalhando (3 ondas escalonadas) + gotas pulando + som
    function chapinhar(x, z, forca, comSom) {
      forca = forca || 1;
      fx.anel(x, z, 0.1, 0.9 + forca * 1.3, 0.75, cor, 0.6);
      agenda.push({ t: 0.12, x: x, z: z, r: 1.4 + forca * 1.6, d: 0.85, op: 0.4 }, { t: 0.26, x: x, z: z, r: 1.9 + forca * 2.0, d: 1.0, op: 0.28 });
      var n = Math.round(6 + 7 * forca);
      for (var i = 0; i < n; i++) { var a = Math.random() * 6.283, v = 1.2 + Math.random() * 2.6 * (0.6 + forca * 0.5); fx.particula(x + Math.cos(a) * 0.15, 0.1, z + Math.sin(a) * 0.15, Math.cos(a) * v * 0.6, 2.6 + Math.random() * 3.2 * (0.6 + forca * 0.5), Math.sin(a) * v * 0.6, 0.45 + Math.random() * 0.3, 0.28 + Math.random() * 0.2, cor, 11, 0.6, 0); }
      if (comSom && A) A.tocar('agua', { forca: forca });
    }
    function atualizar(dt, t, fx0, fz0) {
      // reflexos "respiram" (brilho vai e volta)
      for (var i = 0; i < lista.length; i++) { var q = lista[i]; q.br.material.opacity = 0.18 + 0.12 * Math.sin(t * 1.3 + q.fase); q.br.position.x = q.p.x + Math.sin(t * 0.4 + q.fase) * q.p.rx * 0.25; q.br.position.z = q.p.z + Math.cos(t * 0.33 + q.fase) * q.p.rz * 0.25; }
      // ondas escalonadas
      for (var k = agenda.length - 1; k >= 0; k--) { var e = agenda[k]; e.t -= dt; if (e.t <= 0) { fx.anel(e.x, e.z, 0.1, e.r, e.d, cor, e.op); agenda.splice(k, 1); } }
      // gotas de chuva caindo nas poças perto do jogador (ondinhas pequenas)
      tChuva -= dt;
      if (tChuva <= 0) {
        tChuva = 0.07 + Math.random() * 0.12;
        var q2 = lista[(Math.random() * lista.length) | 0], a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * 0.8, u = Math.cos(a) * q2.p.rx * d, v = Math.sin(a) * q2.p.rz * d;
        var x = q2.p.x + u * q2.cos - v * q2.sin, z = q2.p.z + u * q2.sin + v * q2.cos;
        if (Math.hypot(x - fx0, z - fz0) < 24) fx.anel(x, z, 0.05, 0.5 + Math.random() * 0.35, 0.7, cor, 0.35);
      }
    }
    return { dentro: dentro, chapinhar: chapinhar, atualizar: atualizar, lista: lista };
  }

  window.NRPocas = { criar: criar, POCAS: POCAS };
})();
