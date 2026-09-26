// ════════════════════════════════════════════════════════════════
// NEON RAIDERS — JOIA NOVA
// Substitui as 4 joias antigas (gemas3d.js) por UMA joia só —
// modelo portado do design em new-joia.html (Three.js r160/ESM) pra
// r128 sem módulos, mesma regra do resto do jogo (Spck/WebView).
//
// Diferença de abordagem pro gemas3d.js: aquele evitava manter um
// contexto WebGL vivo (tinha 4 joias, cada uma podendo aparecer em
// vários lugares ao mesmo tempo — mochila, grid, modal — e o WebView
// só aguenta poucos contextos). Aqui só existe UMA joia, num único
// lugar (a vitrine da loja), sempre girando de verdade — não precisa
// da técnica de "filme quadro a quadro" do arquivo antigo.
//
// Uso:
//   NRJoiaNova.montar(canvasEl)  → cria a cena, a joia, as luzes, e
//                                   começa a girar sozinha. Devolve
//                                   um handle com .parar().
//
// Qualidade: por padrão usa o preset MEDIA (ver QUALIDADE abaixo) —
// o mesmo new-joia.html já vinha com 3 níveis prontos (alta/média/
// baixa) pensados pra isso; se pesar no seu aparelho, troca
// QUALIDADE_PADRAO pra 'baixa' logo abaixo.
//
// Sem import/export ES module — tudo em window.NRJoiaNova, pra manter
// compatibilidade com o WebView do Spck (mesma regra do gemas3d.js).
// ════════════════════════════════════════════════════════════════

(function () {

  var THREE_CDN_URL = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
  var _pronto = false;
  var _falhou = false;
  var _callbacksEsperando = [];

  function avisarProntos() {
    _pronto = true;
    var lista = _callbacksEsperando;
    _callbacksEsperando = [];
    lista.forEach(function (cb) { try { cb(); } catch (e) {} });
  }

  function carregarThree() {
    if (window.THREE) { avisarProntos(); return; } // já tinha carregado (outra tela, cache)
    var script = document.createElement("script");
    script.src = THREE_CDN_URL;
    script.onload = avisarProntos;
    script.onerror = function () {
      _falhou = true;
      console.error("[joia-nova] Não consegui carregar o Three.js do CDN — a vitrine fica sem a joia.");
      var lista = _callbacksEsperando;
      _callbacksEsperando = [];
      lista.forEach(function (cb) { try { cb(); } catch (e) {} });
    };
    document.head.appendChild(script);
  }
  carregarThree();

  function pronto(callback) {
    if (_pronto || _falhou) { callback(); return; }
    _callbacksEsperando.push(callback);
  }

  // ── QUALIDADE — os 3 presets já vinham prontos no design original ──
  var QUALIDADE_PADRAO = 'media';
  var QUALIDADE = {
    alta:  { seg: 16, dpr: 2.0, coreDetail: 1, torusSeg: 56, envSize: 1024, innerRings: 3, spokes: 8, micro: 8, frags: 12 },
    media: { seg: 16, dpr: 1.5, coreDetail: 0, torusSeg: 34, envSize: 512,  innerRings: 2, spokes: 6, micro: 6, frags: 7 },
    baixa: { seg: 12, dpr: 1.0, coreDetail: 0, torusSeg: 20, envSize: 256,  innerRings: 2, spokes: 4, micro: 4, frags: 4 },
  };

  // Perfil do corte do diamante (coroa curta, girdle largo, pavilhão
  // longo até a ponta) — mesmos pontos do design original
  var DIAMOND_RINGS = [
    { y: 0.95,  r: 0.78, twist: 0.0 },
    { y: 0.88,  r: 0.92, twist: 0.5 },
    { y: 0.60,  r: 1.15, twist: 0.1 },
    { y: 0.40,  r: 1.30, twist: 0.1 },
    { y: 0.10,  r: 1.50, twist: 0.1 },
    { y: -0.25, r: 1.18, twist: 0.0 },
    { y: -0.50, r: 0.95, twist: 0.0 },
    { y: -0.80, r: 0.68, twist: 0.0 },
    { y: -1.15, r: 0.38, twist: 0.0 },
    { y: -1.50, r: 0.00, twist: 0.0 },
  ];

  function construirGeometriaDiamante(segments, rings, capTop) {
    var positions = [];
    function ringPoint(ring, i) {
      var a = ((i + (ring.twist || 0)) / segments) * Math.PI * 2;
      var r = ring.r;
      return [Math.cos(a) * r, ring.y, Math.sin(a) * r];
    }
    if (capTop && rings[0].r > 1e-6) {
      var A0 = rings[0];
      for (var i0 = 0; i0 < segments; i0++) {
        var a1_ = ringPoint(A0, i0), a2_ = ringPoint(A0, (i0 + 1) % segments);
        positions.push(0, A0.y, 0, a2_[0], a2_[1], a2_[2], a1_[0], a1_[1], a1_[2]);
      }
    }
    for (var ri = 0; ri < rings.length - 1; ri++) {
      var A = rings[ri], B = rings[ri + 1];
      var aIsPoint = A.r < 1e-6, bIsPoint = B.r < 1e-6;
      if (aIsPoint && bIsPoint) continue;
      if (aIsPoint) {
        var tipA = [0, A.y, 0];
        for (var i1 = 0; i1 < segments; i1++) {
          var p1 = ringPoint(B, i1), p2 = ringPoint(B, (i1 + 1) % segments);
          positions.push(tipA[0], tipA[1], tipA[2], p2[0], p2[1], p2[2], p1[0], p1[1], p1[2]);
        }
      } else if (bIsPoint) {
        var tipB = [0, B.y, 0];
        for (var i2 = 0; i2 < segments; i2++) {
          var q1 = ringPoint(A, i2), q2 = ringPoint(A, (i2 + 1) % segments);
          positions.push(q1[0], q1[1], q1[2], q2[0], q2[1], q2[2], tipB[0], tipB[1], tipB[2]);
        }
      } else {
        for (var i3 = 0; i3 < segments; i3++) {
          var i4 = (i3 + 1) % segments;
          var a1 = ringPoint(A, i3), a2 = ringPoint(A, i4);
          var b1 = ringPoint(B, i3), b2 = ringPoint(B, i4);
          positions.push(a1[0], a1[1], a1[2], b2[0], b2[1], b2[2], b1[0], b1[1], b1[2]);
          positions.push(a1[0], a1[1], a1[2], a2[0], a2[1], a2[2], b2[0], b2[1], b2[2]);
        }
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }

  // Ambiente procedural (gradiente + manchas de cor), usado só pra dar
  // reflexo no material físico do cristal — gerado 1x, não por frame
  function criarTexturaAmbiente(renderer, size) {
    var canvas = document.createElement('canvas');
    canvas.width = size * 2; canvas.height = size;
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0.0, '#0f1a30'); g.addColorStop(0.42, '#080e1c');
    g.addColorStop(0.68, '#03050c'); g.addColorStop(1.0, '#010205');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    function blob(x, y, r, col) {
      var rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, col);
      rg.addColorStop(0.45, col.replace(/[\d.]+\)$/, '0.28)'));
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    blob(W * 0.18, H * 0.28, size * 0.55, 'rgba(180,235,255,1)');
    blob(W * 0.72, H * 0.22, size * 0.50, 'rgba(200,130,255,0.85)');
    blob(W * 0.50, H * 0.92, size * 0.55, 'rgba(70,140,255,0.6)');
    blob(W * 0.92, H * 0.58, size * 0.30, 'rgba(100,255,240,0.55)');
    blob(W * 0.05, H * 0.62, size * 0.26, 'rgba(255,160,210,0.35)');
    blob(W * 0.30, H * 0.20, size * 0.14, 'rgba(255,255,255,0.9)');
    blob(W * 0.62, H * 0.34, size * 0.10, 'rgba(220,245,255,0.85)');

    var tex = new THREE.CanvasTexture(canvas);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    if (THREE.SRGBColorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
    else tex.encoding = THREE.sRGBEncoding; // r128 usa a API antiga (encoding, não colorSpace)
    tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;

    var pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    var rt = pmrem.fromEquirectangular(tex);
    tex.dispose(); pmrem.dispose();
    return rt.texture;
  }

  // Monta a joia (cristal + núcleo pulsante + estruturas internas
  // orbitando). Devolve { root, refs } — root é o THREE.Group pra
  // adicionar na cena, refs são os pedaços que a animação usa.
  function construirJoia(p) {
    var root = new THREE.Group();
    root.name = 'joiaNovaRoot';
    var refs = {};

    var diamondGeo = construirGeometriaDiamante(p.seg, DIAMOND_RINGS, true);
    var crystalMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, metalness: 1.0, roughness: 0.02,
      transmission: 1.0, thickness: 1.6, ior: 2.42,
      envMapIntensity: 2.4, clearcoat: 1.0, clearcoatRoughness: 0.02,
      specularIntensity: 1.0, specularColor: 0xffffff,
      attenuationColor: new THREE.Color(0xdceeff), attenuationDistance: 6.0,
      flatShading: true, side: THREE.FrontSide,
      // iridescence/dispersion não existem no r128 (chegaram em versões
      // mais novas do Three.js) — sem efeito aqui, mas não quebra nada
    });
    var crystal = new THREE.Mesh(diamondGeo, crystalMat);
    crystal.renderOrder = 10;
    root.add(crystal);

    var innerGeo = construirGeometriaDiamante(p.seg, DIAMOND_RINGS, true);
    innerGeo.scale(0.62, 0.62, 0.62);
    innerGeo.translate(0, -0.30, 0);
    var innerMat = new THREE.MeshPhysicalMaterial({
      color: 0xbfe0ff, metalness: 0.0, roughness: 0.06, transmission: 0.0,
      transparent: true, opacity: 0.22, emissive: 0x2c5fa8, emissiveIntensity: 0.7,
      clearcoat: 1.0, clearcoatRoughness: 0.06, envMapIntensity: 1.4,
      flatShading: true, side: THREE.DoubleSide, depthWrite: false,
    });
    var innerShell = new THREE.Mesh(innerGeo, innerMat);
    innerShell.renderOrder = 9;
    innerShell.rotation.y = Math.PI / 16;
    root.add(innerShell);
    refs.innerShell = innerShell;

    var coreGroup = new THREE.Group();
    coreGroup.position.y = -0.75;
    var coreGeo = new THREE.IcosahedronGeometry(0.22, p.coreDetail);
    var coreMat = new THREE.MeshStandardMaterial({
      color: 0xbff4ff, emissive: 0x4fd8ff, emissiveIntensity: 3.2,
      metalness: 0.4, roughness: 0.15, flatShading: true,
    });
    coreGroup.add(new THREE.Mesh(coreGeo, coreMat));
    var coreShellGeo = new THREE.IcosahedronGeometry(0.34, p.coreDetail);
    var coreShellMat = new THREE.MeshPhysicalMaterial({
      color: 0xcdeeff, metalness: 0.0, roughness: 0.04, transparent: true, opacity: 0.24,
      emissive: 0x2a90d0, emissiveIntensity: 0.8, clearcoat: 1.0, clearcoatRoughness: 0.05,
      envMapIntensity: 1.6, flatShading: true, side: THREE.DoubleSide, depthWrite: false,
    });
    coreGroup.add(new THREE.Mesh(coreShellGeo, coreShellMat));
    root.add(coreGroup);

    var coreLight = new THREE.PointLight(0x7feaff, 6.5, 6.0, 2.0);
    coreLight.position.set(0, -0.75, 0);
    root.add(coreLight);

    refs.coreGroup = coreGroup; refs.coreMat = coreMat;
    refs.coreShellMat = coreShellMat; refs.coreLight = coreLight;

    var internalGroup = new THREE.Group();
    internalGroup.position.y = -0.75;
    var ringMatA = new THREE.MeshStandardMaterial({ color: 0x4fe0ff, emissive: 0x4fe0ff, emissiveIntensity: 2.0, metalness: 0.85, roughness: 0.25, transparent: true, opacity: 0.85 });
    var ringMatB = new THREE.MeshStandardMaterial({ color: 0xb08cff, emissive: 0xb08cff, emissiveIntensity: 1.4, metalness: 0.85, roughness: 0.25, transparent: true, opacity: 0.75 });
    var frameMat = new THREE.MeshStandardMaterial({ color: 0x99aacc, emissive: 0x1a4466, emissiveIntensity: 0.6, metalness: 0.95, roughness: 0.35 });

    var ringConfigs = [
      { r: 0.46, tube: 0.009, mat: ringMatA, rx: Math.PI / 2,     ry: 0.0, speed: 0.35 },
      { r: 0.56, tube: 0.007, mat: ringMatB, rx: Math.PI / 2.6,   ry: 0.7, speed: -0.26 },
      { r: 0.38, tube: 0.008, mat: ringMatA, rx: Math.PI / 1.7,   ry: 1.3, speed: 0.44 },
    ];
    var innerRings = [];
    for (var ir = 0; ir < Math.min(p.innerRings, ringConfigs.length); ir++) {
      var cfg = ringConfigs[ir];
      var m = new THREE.Mesh(new THREE.TorusGeometry(cfg.r, cfg.tube, 6, p.torusSeg), cfg.mat);
      m.rotation.x = cfg.rx; m.rotation.y = cfg.ry; m.userData.speed = cfg.speed;
      internalGroup.add(m); innerRings.push(m);
    }
    refs.innerRings = innerRings;

    for (var sp = 0; sp < p.spokes; sp++) {
      var aS = (sp / p.spokes) * Math.PI * 2, lenS = 0.50;
      var mS = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, lenS, 4), sp % 2 === 0 ? ringMatA : frameMat);
      mS.position.set(Math.cos(aS) * lenS * 0.5, 0, Math.sin(aS) * lenS * 0.5);
      mS.rotation.set(0, -aS, Math.PI / 2);
      internalGroup.add(mS);
    }
    for (var mi = 0; mi < p.micro; mi++) {
      var aM = (mi / p.micro) * Math.PI * 2 + 0.3;
      var yM = (mi % 2 === 0) ? 0.32 : -0.32;
      var mM = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.038, 0.038), mi % 3 === 0 ? ringMatB : frameMat);
      mM.position.set(Math.cos(aM) * 0.44, yM, Math.sin(aM) * 0.44);
      mM.rotation.set(aM, aM * 1.5, 0);
      internalGroup.add(mM);
    }
    for (var fr = 0; fr < p.frags; fr++) {
      var aF = (fr / p.frags) * Math.PI * 2 + 0.7;
      var radF = 0.24 + (fr % 3) * 0.10;
      var yF = Math.sin(fr * 2.1) * 0.48;
      var mF = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.022 + (fr % 4) * 0.006, 0),
        new THREE.MeshStandardMaterial({ color: 0x9fecff, emissive: 0x3fb0ff, emissiveIntensity: 1.2, metalness: 0.2, roughness: 0.15, flatShading: true })
      );
      mF.position.set(Math.cos(aF) * radF, yF, Math.sin(aF) * radF);
      internalGroup.add(mF);
    }
    root.add(internalGroup);
    refs.internalGroup = internalGroup;

    return { root: root, refs: refs };
  }

  function configurarLuzes(scene) {
    scene.add(new THREE.HemisphereLight(0x2a4a7a, 0x080810, 0.45));
    var key = new THREE.DirectionalLight(0xdff2ff, 3.6); key.position.set(5, 8, 6); scene.add(key);
    var rim = new THREE.DirectionalLight(0x5ff0ff, 2.2); rim.position.set(-6, 3, -5); scene.add(rim);
    var top = new THREE.PointLight(0xeaf6ff, 9, 12, 2.0); top.position.set(0, 6, 2); scene.add(top);
    var back = new THREE.PointLight(0xff5fd0, 3.5, 9, 2.0); back.position.set(-3, -2, -4); scene.add(back);
  }

  // ── MONTAGEM NUM CANVAS ─────────────────────────────────────────
  // Cria cena/câmera/renderer PRÓPRIOS, escopados só a esse canvas —
  // não interfere (nem é afetado) pelo jogo, que é outra página.
  // Devolve { parar } pra desligar o loop quando a aba/loja fechar.
  function montar(canvasEl, opcoes) {
    var handle = { parar: function () {} };
    if (!canvasEl) return handle;

    pronto(function () {
      if (_falhou || !window.THREE) return; // sem Three.js, a vitrine fica só com o "EM BREVE"
      try {
        var p = QUALIDADE[(opcoes && opcoes.qualidade) || QUALIDADE_PADRAO] || QUALIDADE.media;

        var renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true, powerPreference: 'low-power' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, p.dpr));
        if (renderer.outputColorSpace !== undefined) renderer.outputColorSpace = THREE.SRGBColorSpace;
        else renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;

        var scene = new THREE.Scene();
        var camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
        camera.position.set(0, 0.15, 4.6);
        camera.lookAt(0, -0.15, 0);

        scene.environment = criarTexturaAmbiente(renderer, p.envSize);
        configurarLuzes(scene);

        var joia = construirJoia(p);
        scene.add(joia.root);

        function redimensionar() {
          var rect = canvasEl.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          renderer.setSize(rect.width, rect.height, false);
          camera.aspect = rect.width / rect.height;
          camera.updateProjectionMatrix();
        }
        redimensionar();
        window.addEventListener('resize', redimensionar);

        var clock = new THREE.Clock();
        var raf = 0;
        function animar() {
          raf = requestAnimationFrame(animar);
          var dt = Math.min(clock.getDelta(), 0.05);
          var t = clock.getElapsedTime();

          // gira sozinha, sem precisar de dedo nenhum no toque
          joia.root.rotation.y += dt * 0.18;

          joia.refs.coreGroup.rotation.y -= dt * 0.55;
          joia.refs.coreGroup.rotation.x += dt * 0.22;
          joia.refs.coreGroup.scale.setScalar(1 + Math.sin(t * 2.1) * 0.07);
          joia.refs.coreMat.emissiveIntensity = 2.8 + Math.sin(t * 2.1) * 0.8;
          joia.refs.coreShellMat.opacity = 0.20 + (Math.sin(t * 1.7) * 0.5 + 0.5) * 0.08;
          joia.refs.coreLight.intensity = 5.5 + Math.sin(t * 2.1) * 2.2;
          joia.refs.innerShell.rotation.y = Math.PI / 16 - t * 0.06;
          for (var i = 0; i < joia.refs.innerRings.length; i++) {
            joia.refs.innerRings[i].rotation.z += dt * joia.refs.innerRings[i].userData.speed;
          }
          joia.refs.internalGroup.rotation.y += dt * 0.09;
          joia.refs.internalGroup.rotation.x = Math.sin(t * 0.35) * 0.06;

          renderer.render(scene, camera);
        }
        animar();

        handle.parar = function () {
          cancelAnimationFrame(raf);
          window.removeEventListener('resize', redimensionar);
          renderer.dispose();
        };
      } catch (e) {
        console.error('[joia-nova] falhou ao montar a vitrine', e);
      }
    });

    return handle;
  }

  window.NRJoiaNova = { montar: montar, pronto: pronto };
})();
