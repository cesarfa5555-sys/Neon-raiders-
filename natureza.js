// ══════════════════════════════════════════════════════════════════
// NATUREZA.JS — o cenário "NORMAL" do jogo: um campo de grama num dia claro, cercado por cerca de madeira, floresta,
// colinas e montanhas ao fundo. Substitui a cidade cyberpunk só DENTRO DA PARTIDA (o menu continua igual).
//
// Para voltar ao cenário cyberpunk: em mundo.js, AJUSTES.ambiente = 'cyberpunk'.
// Tudo é gerado por código (texturas desenhadas no <canvas>, árvores/pedras/arbustos com formas simples e
// InstancedMesh = centenas de objetos em poucas chamadas de desenho, leve para celular).
// ══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var T = window.THREE;

  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function rand(seed) { var a = seed | 0; return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // ── TEXTURA DA GRAMA (sem emenda visível: tudo é desenhado também deslocado ±tamanho) ──
  function texGrama() {
    var N = 512, c = canvas(N, N), g = c.getContext('2d'), r = rand(77);
    g.fillStyle = '#4b7a2f'; g.fillRect(0, 0, N, N);
    function manchas(cor, n, rmin, rmax, alfa) {                   // manchas suaves de tom (grama mais viva/seca)
      for (var i = 0; i < n; i++) {
        var x = r() * N, y = r() * N, rr = rmin + r() * (rmax - rmin);
        [[0, 0], [N, 0], [-N, 0], [0, N], [0, -N]].forEach(function (o) { var gr = g.createRadialGradient(x + o[0], y + o[1], 0, x + o[0], y + o[1], rr); gr.addColorStop(0, cor.replace('A', alfa)); gr.addColorStop(1, cor.replace('A', 0)); g.fillStyle = gr; g.fillRect(x + o[0] - rr, y + o[1] - rr, rr * 2, rr * 2); });
      }
    }
    manchas('rgba(36,86,30,A)', 26, 40, 110, 0.35); manchas('rgba(120,150,60,A)', 22, 30, 90, 0.3); manchas('rgba(110,86,48,A)', 7, 20, 55, 0.28);
    var cores = ['#3a6a25', '#4f8230', '#5b9137', '#3f7228', '#6b9a3e', '#35601f'];
    for (var i = 0; i < 9000; i++) {                               // folhas de grama
      var x = r() * N, y = r() * N, l = 3 + r() * 6, a = -1.57 + (r() - 0.5) * 0.9;
      g.strokeStyle = cores[(r() * cores.length) | 0]; g.lineWidth = 1 + r() * 1.2; g.globalAlpha = 0.5 + r() * 0.5;
      [[0, 0], [N, 0], [-N, 0], [0, N], [0, -N]].forEach(function (o) { g.beginPath(); g.moveTo(x + o[0], y + o[1]); g.lineTo(x + o[0] + Math.cos(a) * l, y + o[1] + Math.sin(a) * l); g.stroke(); });
    }
    g.globalAlpha = 1;
    var t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; return t;
  }
  // ── CLAREIRA DE TERRA (disco com borda esfumada) ──
  function texTerra() {
    var N = 512, c = canvas(N, N), g = c.getContext('2d'), r = rand(5);
    var gr = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2); gr.addColorStop(0, 'rgba(122,92,56,1)'); gr.addColorStop(0.72, 'rgba(112,84,50,0.95)'); gr.addColorStop(1, 'rgba(100,76,44,0)');
    g.fillStyle = gr; g.fillRect(0, 0, N, N);
    for (var i = 0; i < 2600; i++) { var a = r() * 6.283, d = Math.sqrt(r()) * N * 0.46, x = N / 2 + Math.cos(a) * d, y = N / 2 + Math.sin(a) * d; g.fillStyle = r() < 0.5 ? 'rgba(84,62,36,0.5)' : 'rgba(150,118,78,0.45)'; g.fillRect(x, y, 1 + r() * 3, 1 + r() * 2); }
    return new T.CanvasTexture(c);
  }

  function construir(ctx) {
    var scene = ctx.scene, R = ctx.R, r = rand(2026), dm = new T.Object3D();

    // ── LUZ E CÉU ──
    scene.fog = new T.FogExp2(0xbfd6e6, 0.0105);                    // névoa clara (horizonte azulado)
    ctx.renderer.setClearColor(0xa9cfee, 1);
    scene.add(new T.HemisphereLight(0xcfe6ff, 0x5b4a30, 0.95));       // luz do céu (azulada) + rebatida do chão (marrom)
    var sol = new T.DirectionalLight(0xfff0d2, 1.05); sol.position.set(-22, 40, 16); scene.add(sol);   // sol quente de manhã

    // ── CHÃO: grama + clareira de terra no centro ──
    var tg = texGrama(); tg.repeat.set((R + 70) / 5, (R + 70) / 5);
    var chao = new T.Mesh(new T.CircleGeometry(R + 70, 56), new T.MeshLambertMaterial({ map: tg })); chao.rotation.x = -Math.PI / 2; scene.add(chao);
    var terra = new T.Mesh(new T.PlaneGeometry(30, 30), new T.MeshLambertMaterial({ map: texTerra(), transparent: true, depthWrite: false })); terra.rotation.x = -Math.PI / 2; terra.position.y = 0.02; scene.add(terra);

    // ── CERCA DE MADEIRA no limite da arena (postes + 2 travessas) ──
    var NP = 150, postes = new T.InstancedMesh(new T.BoxGeometry(0.26, 1.5, 0.26), new T.MeshLambertMaterial({ color: 0x7a5530 }), NP);
    var trav = new T.InstancedMesh(new T.BoxGeometry(1, 0.13, 0.1), new T.MeshLambertMaterial({ color: 0x8a6238 }), NP * 2);
    for (var i = 0; i < NP; i++) {
      var a = i / NP * Math.PI * 2, rr = R + 0.6, x = Math.cos(a) * rr, z = Math.sin(a) * rr, comp = 2 * Math.PI * rr / NP;
      dm.position.set(x, 0.75, z); dm.rotation.set(0, -a, 0); dm.scale.set(1, 1, 1); dm.updateMatrix(); postes.setMatrixAt(i, dm.matrix);
      [0.55, 1.1].forEach(function (h, k) { dm.position.set(x, h, z); dm.rotation.set(0, -a - Math.PI / 2, 0); dm.scale.set(comp * 1.04, 1, 1); dm.updateMatrix(); trav.setMatrixAt(i * 2 + k, dm.matrix); });
    }
    dm.scale.set(1, 1, 1); scene.add(postes); scene.add(trav);

    function espalhar(n, rmin, rmax, evitarCentro) {
      var l = [];
      for (var i = 0; i < n; i++) { var a = r() * Math.PI * 2, d = rmin + Math.sqrt(r()) * (rmax - rmin); if (evitarCentro && d < evitarCentro) d += evitarCentro; l.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, rot: r() * 6.283, esc: 0.75 + r() * 0.75, cor: r() }); }
      return l;
    }
    function instanciar(geo, cor, lista, altura, escFn, colorFn) {
      var m = new T.InstancedMesh(geo, new T.MeshLambertMaterial({ color: 0xffffff }), lista.length); m.instanceColor = new T.InstancedBufferAttribute(new Float32Array(lista.length * 3).fill(1), 3);
      var c = new T.Color();
      lista.forEach(function (p, i) { var e = escFn ? escFn(p) : [p.esc, p.esc, p.esc]; dm.position.set(p.x, altura(p), p.z); dm.rotation.set(0, p.rot, 0); dm.scale.set(e[0], e[1], e[2]); dm.updateMatrix(); m.setMatrixAt(i, dm.matrix); c.setHex(colorFn ? colorFn(p) : cor); m.setColorAt(i, c); });
      dm.scale.set(1, 1, 1); scene.add(m); return m;
    }

    // ── FLORESTA ao redor (coníferas e árvores redondas) ──
    var arvores = espalhar(210, R + 3, R + 62, 0);
    arvores = arvores.filter(function (p, i) { return Math.hypot(p.x, p.z) > R + 2.5; });
    var conif = arvores.filter(function (p) { return p.cor < 0.62; }), redond = arvores.filter(function (p) { return p.cor >= 0.62; });
    var tronco = new T.CylinderGeometry(0.28, 0.4, 2.6, 6); tronco.translate(0, 1.3, 0);
    var verdes = [0x2f6b2a, 0x3a7a30, 0x285c2a, 0x44853a];
    instanciar(tronco, 0x6b4a2b, arvores, function () { return 0; }, function (p) { return [p.esc * 1.1, p.esc * (1.2 + p.cor * 0.5), p.esc * 1.1]; });
    var cone1 = new T.ConeGeometry(2.1, 3.6, 7); cone1.translate(0, 4.0, 0);
    var cone2 = new T.ConeGeometry(1.6, 3.0, 7); cone2.translate(0, 5.6, 0);
    var cone3 = new T.ConeGeometry(1.1, 2.4, 7); cone3.translate(0, 7.1, 0);
    [cone1, cone2, cone3].forEach(function (g) { instanciar(g, 0x2f6b2a, conif, function () { return 0; }, function (p) { return [p.esc * 1.15, p.esc * 1.15, p.esc * 1.15]; }, function (p) { return verdes[(p.cor * 40 | 0) % 4]; }); });
    var copa = new T.IcosahedronGeometry(2.4, 1); copa.translate(0, 4.6, 0);
    instanciar(copa, 0x4a8a38, redond, function () { return 0; }, function (p) { return [p.esc * 1.2, p.esc * 1.05, p.esc * 1.2]; }, function (p) { return [0x4f8f3a, 0x5a9a40, 0x6aa046, 0xb8862e][(p.cor * 97 | 0) % 4]; });   // algumas copas outonais

    // ── COLINAS E MONTANHAS DISTANTES (dão profundidade; a névoa as deixa azuladas) ──
    var colinas = espalhar(22, R + 70, R + 120, 0);
    instanciar(new T.IcosahedronGeometry(1, 1), 0x4c7f3a, colinas, function () { return -4; }, function (p) { return [18 + p.esc * 16, 9 + p.esc * 8, 18 + p.esc * 16]; });
    var montanhas = espalhar(12, R + 110, R + 150, 0);
    instanciar(new T.ConeGeometry(1, 1, 5), 0x7d8fa0, montanhas, function () { return 0; }, function (p) { return [30 + p.esc * 26, 40 + p.esc * 40, 30 + p.esc * 26]; });

    // ── DENTRO DA ARENA: pedras, arbustos, tocos, flores ──
    var pedras = espalhar(46, 7, R - 2, 0);
    instanciar(new T.DodecahedronGeometry(1, 0), 0x8d9096, pedras, function (p) { return p.esc * 0.35; }, function (p) { return [p.esc * 0.9, p.esc * 0.6, p.esc * 0.8]; }, function (p) { return [0x8d9096, 0x7b7f86, 0x9a9a92, 0x6f737a][(p.cor * 31 | 0) % 4]; });
    var arbustos = espalhar(60, 6, R - 2, 0);
    instanciar(new T.IcosahedronGeometry(0.9, 1), 0x3f7a30, arbustos, function (p) { return p.esc * 0.45; }, function (p) { return [p.esc * 1.1, p.esc * 0.8, p.esc * 1.1]; }, function (p) { return [0x3f7a30, 0x4d8a36, 0x356d2a][(p.cor * 13 | 0) % 3]; });
    var tocos = espalhar(14, 8, R - 3, 0), tc = new T.CylinderGeometry(0.55, 0.65, 0.7, 8); tc.translate(0, 0.35, 0);
    instanciar(tc, 0x7a5a36, tocos, function () { return 0; });
    var flores = espalhar(260, 3, R - 1, 0), fl = new T.SphereGeometry(0.11, 5, 4);
    instanciar(fl, 0xffffff, flores, function () { return 0.14; }, function (p) { return [1, 1, 1]; }, function (p) { return [0xfff7d0, 0xffd23d, 0xff6a6a, 0xc58cff, 0xffffff][(p.cor * 53 | 0) % 5]; });
    // pedras do círculo da clareira
    var cir = []; for (var k = 0; k < 18; k++) { var aa = k / 18 * 6.283; cir.push({ x: Math.cos(aa) * 13.2, z: Math.sin(aa) * 13.2, rot: aa, esc: 0.8 + r() * 0.4, cor: r() }); }
    instanciar(new T.DodecahedronGeometry(1, 0), 0x9a9a92, cir, function (p) { return p.esc * 0.3; }, function (p) { return [p.esc * 0.8, p.esc * 0.5, p.esc * 0.8]; });

    // ── NUVENS: sombras suaves passando pelo chão (dão vida ao campo) ──
    var nuvens = [];
    for (var n = 0; n < 6; n++) {
      var cm = new T.Mesh(new T.CircleGeometry(1, 20), new T.MeshBasicMaterial({ color: 0x1d3a14, transparent: true, opacity: 0.1, depthWrite: false }));
      cm.rotation.x = -Math.PI / 2; cm.position.y = 0.05; cm.scale.set(10 + r() * 12, 7 + r() * 8, 1); cm.position.set((r() - 0.5) * 120, 0.05, (r() - 0.5) * 120); scene.add(cm); nuvens.push({ m: cm, v: 1.2 + r() * 1.5 });
    }
    return {
      atualizar: function (dt, t, fx, fz) { for (var i = 0; i < nuvens.length; i++) { var c = nuvens[i]; c.m.position.x += c.v * dt; if (c.m.position.x > fx + 70) c.m.position.x = fx - 70; c.m.rotation.z += 0; } },
      chuva: false,
    };
  }

  window.NRNatureza = { construir: construir };
})();
