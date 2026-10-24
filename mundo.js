// ══════════════════════════════════════════════════════════════════
// MUNDO.JS — o cenário 3D: arena cyberpunk "NEON DISTRICT", câmera vista
// de cima (top-down), luzes, prédios com janelas acesas, chuva e névoa.
//
// Tudo é gerado por código (texturas desenhadas num <canvas>), sem imagens.
// O MAPA É UM SÓ: uma praça circular de raio CFG.arenaRaio cercada por
// uma barreira de energia e pela cidade ao fundo.
//
// Ajustes rápidos no objeto AJUSTES logo abaixo.
// ══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var T = window.THREE, D = window.NRData, R = D.CFG.arenaRaio;

  var AJUSTES = {
    ambiente: 'cyberpunk',  // 'cyberpunk' = cidade neon com chuva (padrão)  |  'natural' = campo de dia (natureza.js)
    camAngulo: 62,          // inclinação da câmera em graus (90 = totalmente de cima)
    camLarguraVista: 26,    // quantas unidades cabem na LARGURA da tela (zoom) — o jogo é sempre deitado
    camDistMin: 17, camDistMax: 36,
    neblina: 0.0125,        // densidade da névoa
    chuva: 520,             // gotas de chuva (0 desliga)
    predios: 150,           // prédios ao redor da arena
  };

  // gerador de números repetível: todo mundo vê o MESMO cenário
  function rng(seed) { var a = seed | 0; return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // ── TEXTURAS DESENHADAS NO CANVAS ───────────────────────────────
  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function texChao() {   // asfalto escuro com poeira, rachaduras e manchas de óleo
    var c = canvas(512, 512), g = c.getContext('2d'), r = rng(7);
    g.fillStyle = '#0a0b14'; g.fillRect(0, 0, 512, 512);
    for (var i = 0; i < 5000; i++) { var v = 12 + (r() * 22) | 0; g.fillStyle = 'rgba(' + v + ',' + v + ',' + (v + 10) + ',' + (0.2 + r() * 0.5) + ')'; g.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2); }
    for (var k = 0; k < 14; k++) { var gr = g.createRadialGradient(r() * 512, r() * 512, 2, r() * 512, r() * 512, 40 + r() * 60); gr.addColorStop(0, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512); }
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.4;
    for (var j = 0; j < 9; j++) { g.beginPath(); var x = r() * 512, y = r() * 512; g.moveTo(x, y); for (var s = 0; s < 6; s++) { x += (r() - 0.5) * 70; y += (r() - 0.5) * 70; g.lineTo(x, y); } g.stroke(); }
    var t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set((R + 60) / 4, (R + 60) / 4); t.anisotropy = 4; return t;
  }
  function texGrade() {  // linhas de neon do piso (aditivo)
    var c = canvas(256, 256), g = c.getContext('2d');
    g.clearRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(46,230,255,0.55)'; g.lineWidth = 2; g.strokeRect(1, 1, 254, 254);
    g.strokeStyle = 'rgba(176,77,255,0.18)'; g.lineWidth = 1; g.beginPath(); g.moveTo(128, 0); g.lineTo(128, 256); g.moveTo(0, 128); g.lineTo(256, 128); g.stroke();
    g.fillStyle = 'rgba(46,230,255,0.8)'; g.fillRect(0, 0, 6, 6);
    var t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(R / 3, R / 3); t.anisotropy = 4; return t;
  }
  function texPraca() {  // símbolo no centro da arena
    var c = canvas(512, 512), g = c.getContext('2d');
    g.translate(256, 256); g.strokeStyle = 'rgba(46,230,255,0.9)';
    [240, 200, 120, 60].forEach(function (r, i) { g.lineWidth = i === 0 ? 5 : 2.5; g.beginPath(); g.arc(0, 0, r, 0, 6.2832); g.stroke(); });
    g.strokeStyle = 'rgba(255,61,166,0.8)'; g.lineWidth = 3;
    for (var i = 0; i < 6; i++) { g.save(); g.rotate(i * Math.PI / 3); g.beginPath(); g.moveTo(60, 0); g.lineTo(200, 0); g.stroke(); g.strokeRect(150, -9, 22, 18); g.restore(); }
    g.beginPath(); for (var k = 0; k < 6; k++) { var a = k * Math.PI / 3; g.lineTo(Math.cos(a) * 100, Math.sin(a) * 100); } g.closePath(); g.stroke();
    return new T.CanvasTexture(c);
  }
  function texPredio(h) { // fachada escura com janelas acesas aleatórias
    var c = canvas(128, 256), g = c.getContext('2d'), r = rng(31 + h);
    g.fillStyle = '#0b0c18'; g.fillRect(0, 0, 128, 256);
    var cores = ['#2ee6ff', '#ff3da6', '#ffd23d', '#b04dff', '#e8f6ff'];
    for (var y = 6; y < 250; y += 12) for (var x = 6; x < 122; x += 10) {
      if (r() < 0.42) { g.fillStyle = cores[(r() * cores.length) | 0]; g.globalAlpha = 0.35 + r() * 0.65; g.fillRect(x, y, 6, 7); }
    }
    g.globalAlpha = 1; g.fillStyle = 'rgba(255,255,255,0.05)'; for (var l = 0; l < 4; l++) g.fillRect(l * 32 + 2, 0, 1, 256);
    var t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; return t;
  }
  function texLetreiro(i) {  // letreiros de neon (japonês-cyberpunk simplificado)
    var c = canvas(256, 96), g = c.getContext('2d');
    var cor = ['#ff3da6', '#2ee6ff', '#ffd23d', '#b04dff'][i % 4], txt = ['NEON', 'RAIDERS', 'CYBER', 'ネオン', 'BAR 24', 'HYPER'][i % 6];
    g.shadowColor = cor; g.shadowBlur = 14; g.strokeStyle = cor; g.lineWidth = 4; g.strokeRect(6, 6, 244, 84);
    g.fillStyle = cor; g.font = 'bold 44px Orbitron, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 128, 50);
    return new T.CanvasTexture(c);
  }
  function texBarreira() {
    var c = canvas(64, 256), g = c.getContext('2d');
    var gr = g.createLinearGradient(0, 256, 0, 0); gr.addColorStop(0, 'rgba(46,230,255,0.9)'); gr.addColorStop(1, 'rgba(46,230,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2;
    for (var y = 0; y < 256; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(64, y); g.stroke(); }
    g.beginPath(); g.moveTo(32, 0); g.lineTo(32, 256); g.stroke();
    var t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(70, 1); return t;
  }

  // ══════════════════════════════════════════════════════════════════
  function criar(canvasEl) {
    var renderer = new T.WebGLRenderer({ canvas: canvasEl, antialias: false, powerPreference: 'high-performance', alpha: false });
    var pr = Math.min(window.devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(pr);
    renderer.setClearColor(0x05050c, 1);
    var scene = new T.Scene();
    scene.fog = new T.FogExp2(0x080618, AJUSTES.neblina);
    var camera = new T.PerspectiveCamera(46, 1, 0.5, 260);
    var glowTex = window.NRModelos.texturaGlow(64);
    var r = rng(2026);

    var natural = AJUSTES.ambiente === 'natural' && window.NRNatureza, natureza = null;
    var luzHeroi = new T.PointLight(natural ? 0xffffff : 0x2ee6ff, natural ? 0 : 1.35, 15, 2); luzHeroi.position.set(0, 3.5, 0); scene.add(luzHeroi);
    var luzFlash = new T.PointLight(0xffffff, 0, 24, 2); luzFlash.position.set(0, 4, 0); scene.add(luzFlash);   // clarão de explosões
    var grade, praca, texB, letreiros = [], chuva = null, chuvaPos = null, N = 0;
    if (natural) {
      natureza = window.NRNatureza.construir({ scene: scene, renderer: renderer, R: R });                 // campo de dia (natureza.js)
    } else {
    // ═══ CENÁRIO CYBERPUNK (cidade neon com chuva) ═══
    scene.add(new T.HemisphereLight(0x6f7fff, 0x1a0630, 0.95));
    var sol = new T.DirectionalLight(0xaac6ff, 0.55); sol.position.set(-14, 34, 12); scene.add(sol);

    // ── CHÃO ──
    var chao = new T.Mesh(new T.CircleGeometry(R + 60, 48), new T.MeshLambertMaterial({ map: texChao(), color: 0xb8bcd6 }));
    chao.rotation.x = -Math.PI / 2; scene.add(chao);
    grade = new T.Mesh(new T.CircleGeometry(R, 64), new T.MeshBasicMaterial({ map: texGrade(), transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.5 }));
    grade.rotation.x = -Math.PI / 2; grade.position.y = 0.02; scene.add(grade);
    praca = new T.Mesh(new T.PlaneGeometry(26, 26), new T.MeshBasicMaterial({ map: texPraca(), transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.55 }));
    praca.rotation.x = -Math.PI / 2; praca.position.y = 0.03; scene.add(praca);

    // ── BARREIRA DE ENERGIA + PILARES NO LIMITE DA ARENA ──
    texB = texBarreira();
    var barreira = new T.Mesh(new T.CylinderGeometry(R + 0.5, R + 0.5, 7, 96, 1, true), new T.MeshBasicMaterial({ map: texB, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, opacity: 0.55 }));
    barreira.position.y = 3.5; scene.add(barreira);
    var pilares = new T.InstancedMesh(new T.BoxGeometry(1.2, 9, 1.2), new T.MeshLambertMaterial({ color: 0x1a1d33 }), 48);
    var topos = new T.InstancedMesh(new T.BoxGeometry(0.7, 0.7, 0.7), new T.MeshBasicMaterial({ color: 0x2ee6ff }), 48);
    var dm = new T.Object3D();
    for (var i = 0; i < 48; i++) {
      var a = i / 48 * Math.PI * 2; dm.position.set(Math.cos(a) * (R + 0.6), 4.5, Math.sin(a) * (R + 0.6)); dm.rotation.y = -a; dm.updateMatrix(); pilares.setMatrixAt(i, dm.matrix);
      dm.position.y = 9.2; dm.updateMatrix(); topos.setMatrixAt(i, dm.matrix);
    }
    scene.add(pilares); scene.add(topos);

    // ── CIDADE AO FUNDO (3 classes de prédio, cada uma com sua textura) ──
    var predios = [];
    var cls = [{ w: 9, h: 26, n: 0 }, { w: 12, h: 42, n: 0 }, { w: 7, h: 60, n: 0 }];
    var total = AJUSTES.predios, lista = [];
    for (var p = 0; p < total; p++) {
      var ang = r() * Math.PI * 2, dist = R + 8 + r() * 48, c = (r() * 3) | 0;
      lista.push({ x: Math.cos(ang) * dist, z: Math.sin(ang) * dist, c: c, s: 0.8 + r() * 0.6, rot: r() * 3.14 }); cls[c].n++;
    }
    cls.forEach(function (k, idx) {
      var geo = new T.BoxGeometry(k.w, k.h, k.w); // texturas esticam por classe: ok para silhueta distante
      var mat = new T.MeshLambertMaterial({ map: texPredio(idx), emissive: 0xffffff, emissiveMap: null, color: 0xdddddd });
      mat.emissive.setScalar(0.18); mat.emissiveMap = mat.map;
      var m = new T.InstancedMesh(geo, mat, Math.max(1, k.n)); var n = 0;
      lista.forEach(function (b) { if (b.c !== idx) return; dm.position.set(b.x, k.h * b.s / 2, b.z); dm.rotation.set(0, b.rot, 0); dm.scale.set(b.s, b.s, b.s); dm.updateMatrix(); m.setMatrixAt(n++, dm.matrix); });
      dm.scale.set(1, 1, 1); scene.add(m);
    });
    // letreiros de neon encostados nos prédios mais próximos
    for (var s = 0; s < 14; s++) {
      var b = lista[(r() * 40) | 0]; var cx = b.x * 0.9, cz = b.z * 0.9;
      var pl = new T.Mesh(new T.PlaneGeometry(9, 3.4), new T.MeshBasicMaterial({ map: texLetreiro(s), transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }));
      pl.position.set(cx, 8 + r() * 14, cz); pl.lookAt(0, pl.position.y, 0); scene.add(pl); letreiros.push(pl);
    }

    // ── PROPS DENTRO DA ARENA ──
    function espalhar(n, rmin, rmax) { var l = []; for (var i = 0; i < n; i++) { var a = r() * Math.PI * 2, d = rmin + r() * (rmax - rmin); l.push([Math.cos(a) * d, Math.sin(a) * d, r() * 3.14]); } return l; }
    // barreiras de concreto com listra neon
    var bar = espalhar(26, 9, R - 3), bm = new T.InstancedMesh(new T.BoxGeometry(3.4, 1.1, 0.9), new T.MeshLambertMaterial({ color: 0x242840 }), bar.length);
    var bl = new T.InstancedMesh(new T.BoxGeometry(3.42, 0.08, 0.92), new T.MeshBasicMaterial({ color: 0xff3da6 }), bar.length);
    bar.forEach(function (q, i) { dm.position.set(q[0], 0.55, q[1]); dm.rotation.set(0, q[2], 0); dm.updateMatrix(); bm.setMatrixAt(i, dm.matrix); dm.position.y = 1.0; dm.updateMatrix(); bl.setMatrixAt(i, dm.matrix); });
    scene.add(bm); scene.add(bl);
    // postes de luz com poça de luz no chão (cores variadas)
    var postes = espalhar(18, 6, R - 5), pm = new T.InstancedMesh(new T.CylinderGeometry(0.1, 0.14, 5.5, 6), new T.MeshLambertMaterial({ color: 0x20243a }), postes.length);
    var cabos = new T.InstancedMesh(new T.BoxGeometry(0.9, 0.18, 0.5), new T.MeshBasicMaterial({ color: 0xffffff }), postes.length);
    var poca = new T.InstancedMesh(new T.PlaneGeometry(9, 9), new T.MeshBasicMaterial({ map: glowTex, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.55 }), postes.length);
    var cp = [new T.Color(0x2ee6ff), new T.Color(0xff3da6), new T.Color(0xffd23d), new T.Color(0xb04dff)];
    postes.forEach(function (q, i) {
      dm.rotation.set(0, q[2], 0); dm.position.set(q[0], 2.75, q[1]); dm.updateMatrix(); pm.setMatrixAt(i, dm.matrix);
      dm.position.set(q[0], 5.5, q[1]); dm.updateMatrix(); cabos.setMatrixAt(i, dm.matrix);
      dm.rotation.set(-Math.PI / 2, 0, 0); dm.position.set(q[0], 0.05, q[1]); dm.updateMatrix(); poca.setMatrixAt(i, dm.matrix);
      var col = cp[i % 4]; cabos.setColorAt(i, col); poca.setColorAt(i, col);
    });
    scene.add(pm); scene.add(cabos); scene.add(poca);
    // carros destruídos
    var carros = espalhar(9, 14, R - 6), cm = new T.InstancedMesh(new T.BoxGeometry(4, 1.0, 1.9), new T.MeshLambertMaterial({ color: 0x1b1f33 }), carros.length);
    var cm2 = new T.InstancedMesh(new T.BoxGeometry(2.1, 0.8, 1.7), new T.MeshLambertMaterial({ color: 0x2a3050 }), carros.length);
    carros.forEach(function (q, i) { dm.rotation.set(0, q[2], 0.05); dm.position.set(q[0], 0.55, q[1]); dm.updateMatrix(); cm.setMatrixAt(i, dm.matrix); dm.position.set(q[0], 1.3, q[1]); dm.updateMatrix(); cm2.setMatrixAt(i, dm.matrix); });
    scene.add(cm); scene.add(cm2);

    // ── CHUVA ──
    N = AJUSTES.chuva;
    if (N > 0) {
      chuvaPos = new Float32Array(N * 6);
      for (var d = 0; d < N; d++) { var x = (r() - 0.5) * 60, z = (r() - 0.5) * 60, y = r() * 30; chuvaPos.set([x, y, z, x - 0.12, y - 1.1, z], d * 6); }
      var cg = new T.BufferGeometry(); cg.setAttribute('position', new T.BufferAttribute(chuvaPos, 3));
      chuva = new T.LineSegments(cg, new T.LineBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.32 }));
      chuva.frustumCulled = false; scene.add(chuva);
    }
    }   // fim do cenário cyberpunk

    // ── CÂMERA TOP-DOWN ──
    var cam = { foco: new T.Vector3(), dist: 30, tremor: 0, zoomExtra: 0, ang: AJUSTES.camAngulo * Math.PI / 180 };
    function redimensionar() {
      var w = canvasEl.clientWidth || window.innerWidth, h = canvasEl.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      // distância pra caber a largura desejada (retrato = câmera mais longe)
      var meiaFov = Math.tan(camera.fov * Math.PI / 360);
      cam.dist = Math.max(AJUSTES.camDistMin, Math.min(AJUSTES.camDistMax, AJUSTES.camLarguraVista / (2 * meiaFov * camera.aspect)));
    }
    redimensionar();
    window.addEventListener('resize', redimensionar);

    function atualizar(dt, t, fx, fz) {
      // câmera segue o foco com suavização
      var k = Math.min(1, dt * 7);
      cam.foco.x += (fx - cam.foco.x) * k; cam.foco.z += (fz - cam.foco.z) * k;
      cam.tremor = Math.max(0, cam.tremor - dt * 2.2); cam.zoomExtra *= Math.exp(-dt * 3);
      var dist = cam.dist + cam.zoomExtra, sh = cam.tremor * cam.tremor;
      var ox = (Math.random() - 0.5) * sh * 1.6, oz = (Math.random() - 0.5) * sh * 1.6;
      camera.position.set(cam.foco.x + ox, Math.sin(cam.ang) * dist, cam.foco.z + Math.cos(cam.ang) * dist + oz);
      camera.lookAt(cam.foco.x + ox, 0, cam.foco.z + oz - 1.2);
      luzHeroi.position.set(fx, 3.5, fz);
      luzFlash.intensity *= Math.exp(-dt * 7);
      // cenário vivo
      if (natureza) natureza.atualizar(dt, t, fx, fz);
      else {
      grade.material.opacity = 0.42 + Math.sin(t * 1.6) * 0.1; praca.rotation.z = t * 0.05;
      texB.offset.x = t * 0.04;
      for (var i = 0; i < letreiros.length; i++) letreiros[i].material.opacity = 0.75 + Math.sin(t * 3 + i * 1.7) * 0.2 + (Math.sin(t * 13 + i * 5) > 0.97 ? -0.4 : 0);
      if (chuva) { // gotas caem e reaparecem ao redor da câmera
        var p = chuvaPos, vy = 34 * dt;
        for (var d = 0; d < N; d++) {
          var o = d * 6; p[o + 1] -= vy; p[o + 4] -= vy;
          if (p[o + 1] < 0) { var x = fx + (Math.random() - 0.5) * 60, z = fz + (Math.random() - 0.5) * 60, y = 22 + Math.random() * 10; p[o] = x; p[o + 1] = y; p[o + 2] = z; p[o + 3] = x - 0.12; p[o + 4] = y - 1.1; p[o + 5] = z; }
        }
        chuva.geometry.attributes.position.needsUpdate = true;
      }
      }
    }
    // converte posição do mundo em pixels da tela (para barras de vida e números de dano)
    var v3 = new T.Vector3();
    function projetar(x, y, z, saida) {
      v3.set(x, y, z).project(camera);
      saida.x = (v3.x * 0.5 + 0.5) * canvasEl.clientWidth; saida.y = (-v3.y * 0.5 + 0.5) * canvasEl.clientHeight; saida.visivel = v3.z < 1;
      return saida;
    }
    return {
      renderer: renderer, scene: scene, camera: camera, cam: cam, glowTex: glowTex, luzHeroi: luzHeroi, luzFlash: luzFlash,
      atualizar: atualizar, projetar: projetar, redimensionar: redimensionar,
      tremer: function (a) { cam.tremor = Math.min(1.2, Math.max(cam.tremor, a)); },
      zoomPulso: function (v) { cam.zoomExtra = v; },
      flash: function (x, z, cor, forca) { luzFlash.color.setHex(cor); luzFlash.position.set(x, 4, z); luzFlash.intensity = Math.max(luzFlash.intensity, forca); },
      baixarQualidade: function () { var pr2 = Math.max(1, renderer.getPixelRatio() - 0.25); renderer.setPixelRatio(pr2); redimensionar(); if (chuva && pr2 <= 1) chuva.visible = false; return pr2; },
    };
  }

  window.NRMundo = { criar: criar, AJUSTES: AJUSTES };
})();
