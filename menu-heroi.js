// ══════════════════════════════════════════════════════════════════
// MENU-HEROI.JS — o Caçador Cyber girando no menu (3D de verdade, o mesmo
// modelo da partida). Se o aparelho não tiver WebGL, a página segue sem ele.
//   NRMenuHeroi.iniciar({ cacador: bool, rifle: bool })
// ══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  window.NRMenuHeroi = {
    iniciar: function (lo) {
      var go = function () { window.NRMenuHeroi._cena(lo); };
      if (window.NRHeroiGLB) window.NRHeroiGLB.precarregar().then(go, go); else go();
    },
    _cena: function (lo) {
      var T = window.THREE, cv = document.getElementById('heroi');
      if (!T || !cv || !window.NRModelos) return;
      var renderer;
      try { renderer = new T.WebGLRenderer({ canvas: cv, alpha: true, antialias: true }); } catch (e) { return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setClearColor(0x000000, 0);
      var scene = new T.Scene(), cam = new T.PerspectiveCamera(32, 1, 0.1, 60);
      scene.add(new T.HemisphereLight(0x8899ff, 0x220044, 1.0));
      var key = new T.DirectionalLight(0xffffff, 0.9); key.position.set(3, 6, 5); scene.add(key);
      var rimC = new T.PointLight(0x2ee6ff, 2.2, 14); rimC.position.set(-3, 2.5, -2.5); scene.add(rimC);
      var rimR = new T.PointLight(0xff3da6, 2.0, 14); rimR.position.set(3.2, 1.5, -2); scene.add(rimR);
      var eq = window.NRData.resolverEquip(lo);
      var m = window.NRModelos.criarCacador({ persona: eq.persona, cor: eq.persona === 'kunoichi' ? 0xff3da6 : 0x2ee6ff, basico: eq.persona === 'padrao', fem: eq.persona === 'kunoichi', rifle: eq.arma === 'rifle', katana: eq.arma === 'katana' });
      m.grupo.scale.setScalar(1.35); scene.add(m.grupo);
      // plataforma holográfica sob os pés
      var plat = new T.Mesh(new T.CylinderGeometry(1.5, 1.7, 0.12, 36), new T.MeshPhongMaterial({ color: 0x0c1230, shininess: 90 })); plat.position.y = -0.06; scene.add(plat);
      var aneis = [];
      [1.55, 1.2].forEach(function (r, i) { var a = new T.Mesh(new T.RingGeometry(r - 0.05, r, 48), new T.MeshBasicMaterial({ color: i ? 0xff3da6 : 0x2ee6ff, transparent: true, opacity: 0.8, side: T.DoubleSide, blending: T.AdditiveBlending })); a.rotation.x = -Math.PI / 2; a.position.y = 0.01; scene.add(a); aneis.push(a); });
      function ajustar() {
        var w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
        var d = Math.max(7.5, 9.4 / Math.min(1, cam.aspect * 1.3)); cam.position.set(0, 2.3, d); cam.lookAt(0, 1.55, 0);
      }
      ajustar(); window.addEventListener('resize', ajustar);
      var t = 0, ult = performance.now(), ang = 0.5;
      function q(now) {
        requestAnimationFrame(q); var dt = Math.min(0.05, (now - ult) / 1000); ult = now; t += dt; ang += dt * 0.55;
        var corre = (t % 9) > 5 ? 4.8 : 0;                                          // a cada alguns segundos o herói corre no lugar
        m.animar(dt, t, corre, Math.sin(ang), Math.cos(ang), false, Math.sin(ang) * corre, Math.cos(ang) * corre);
        m.grupo.position.y = Math.sin(t * 1.6) * 0.04;
        aneis[0].rotation.z = t * 0.6; aneis[1].rotation.z = -t * 0.9; rimC.intensity = 2 + Math.sin(t * 2) * 0.5;
        if (!document.hidden) renderer.render(scene, cam);
      }
      requestAnimationFrame(q);
    },
  };
})();
