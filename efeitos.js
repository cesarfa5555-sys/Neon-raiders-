// ══════════════════════════════════════════════════════════════════
// EFEITOS.JS — tudo que dá "vida" visual ao jogo (game juice):
//   • partículas aditivas (faíscas, fumaça de neon, estilhaços)
//   • ondas de choque no chão (EMP, explosões, morte de chefe)
//   • raios elétricos (Arco Tesla) e feixes orbitais
//   • números de dano flutuantes (desenhados num canvas 2D por cima do 3D)
//
// Tudo usa "pools" (peças reaproveitadas): nada é criado durante a partida,
// por isso não há travadas por coleta de lixo no celular.
// ══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var T = window.THREE;

  function criar(mundo, overlayCanvas) {
    var scene = mundo.scene, cam = mundo.camera;
    var dummy = new T.Object3D(), cor = new T.Color();

    // ── PARTÍCULAS (um único InstancedMesh de quadrados que olham pra câmera) ──
    var MAXP = 900;
    var pm = window.NRModelos.instanciado(new T.PlaneGeometry(1, 1),
      new T.MeshBasicMaterial({ map: mundo.glowTex, transparent: true, blending: T.AdditiveBlending, depthWrite: false }), MAXP, true);
    scene.add(pm);
    var P = [];                                       // partículas vivas
    function particula(x, y, z, vx, vy, vz, vida, tam, c, grav, arrasto, cresce) {
      if (P.length >= MAXP) P.shift();
      cor.setHex(c);
      P.push({ x: x, y: y, z: z, vx: vx, vy: vy, vz: vz, vida: vida, max: vida, tam: tam, r: cor.r, g: cor.g, b: cor.b, grav: grav || 0, arr: arrasto || 0, cresce: cresce || 0 });
    }
    // explosão de faíscas: n partículas saindo em todas as direções
    function faiscas(x, y, z, n, c, vel, vida, tam, grav) {
      for (var i = 0; i < n; i++) {
        var a = Math.random() * 6.283, e = Math.random() * 1.2 - 0.1, v = vel * (0.4 + Math.random() * 0.8);
        particula(x, y, z, Math.cos(a) * v, Math.sin(e) * v * 0.9 + vel * 0.25, Math.sin(a) * v, vida * (0.6 + Math.random() * 0.7), tam * (0.6 + Math.random() * 0.8), c, grav === undefined ? 9 : grav, 1.5, 0);
      }
    }
    function fumaca(x, y, z, n, c, tam, vida) {
      for (var i = 0; i < n; i++) particula(x + (Math.random() - 0.5) * 0.6, y, z + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 1.2, 0.8 + Math.random(), (Math.random() - 0.5) * 1.2, vida * (0.7 + Math.random() * 0.6), tam, c, -0.5, 1.5, 1.4);
    }

    // ── ONDAS DE CHOQUE (anéis no chão) ──
    var rings = [];
    for (var i = 0; i < 20; i++) {
      var m = new T.Mesh(new T.RingGeometry(0.88, 1, 48), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, opacity: 0 }));
      m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); rings.push({ m: m, t: 0, dur: 1, r0: 0, r1: 1, ativo: false, op: 1 });
    }
    function anel(x, z, r0, r1, dur, c, op) {
      var a = null; for (var i = 0; i < rings.length; i++) if (!rings[i].ativo) { a = rings[i]; break; } if (!a) a = rings[0];
      a.ativo = true; a.t = 0; a.dur = dur; a.r0 = r0; a.r1 = r1; a.op = op || 0.9; a.m.material.color.setHex(c); a.m.position.set(x, 0.08, z); a.m.visible = true;
    }
    // disco preenchido (clarão no chão)
    var discos = [];
    for (var d = 0; d < 10; d++) {
      var dm = new T.Mesh(new T.CircleGeometry(1, 32), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0 }));
      dm.rotation.x = -Math.PI / 2; dm.visible = false; scene.add(dm); discos.push({ m: dm, t: 0, dur: 1, r: 1, ativo: false, op: 1 });
    }
    function disco(x, z, r, dur, c, op) {
      var a = null; for (var i = 0; i < discos.length; i++) if (!discos[i].ativo) { a = discos[i]; break; } if (!a) a = discos[0];
      a.ativo = true; a.t = 0; a.dur = dur; a.r = r; a.op = op || 0.6; a.m.material.color.setHex(c); a.m.position.set(x, 0.06, z); a.m.visible = true;
    }

    // ── CORTES DA KATANA (crescente rubi no chão; nível 8 = círculo completo) ──
    var cortes = [];
    for (var cq = 0; cq < 8; cq++) {
      var cheio = cq >= 6;
      var cg = new T.RingGeometry(0.45, 1, cheio ? 48 : 24, 1, cheio ? 0 : -1.15, cheio ? Math.PI * 2 : 2.3);
      var cm = new T.Mesh(cg, new T.MeshBasicMaterial({ color: 0xff2a55, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, opacity: 0 }));
      var ci2 = new T.Mesh(new T.RingGeometry(0.78, 1, cheio ? 48 : 24, 1, cheio ? 0 : -1.15, cheio ? Math.PI * 2 : 2.3), new T.MeshBasicMaterial({ color: 0xffe0e6, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, opacity: 0 }));
      var cgp = new T.Group(); cgp.add(cm); cgp.add(ci2); cgp.visible = false; cgp.rotation.order = 'YXZ'; cm.rotation.x = ci2.rotation.x = -Math.PI / 2; ci2.position.y = 0.02;
      scene.add(cgp); cortes.push({ g: cgp, a: cm, b: ci2, t: 0, dur: 0.22, r: 1, ativo: false, cheio: cheio });
    }
    function corte(x, z, ux, uz, arco, alcance) {
      var cheio = arco > 6, a = null;
      for (var i = 0; i < cortes.length; i++) if (!cortes[i].ativo && cortes[i].cheio === cheio) { a = cortes[i]; break; }
      if (!a) return;
      a.ativo = true; a.t = 0; a.r = alcance; a.g.visible = true; a.g.position.set(x, 0.12, z); a.g.rotation.y = -Math.atan2(uz, ux);
    }

    // ── FEIXES VERTICAIS (ataque orbital) ──
    var feixes = [];
    for (var f = 0; f < 6; f++) {
      var fm = new T.Mesh(new T.CylinderGeometry(1, 1, 60, 14, 1, true), new T.MeshBasicMaterial({ color: 0xff3da6, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, opacity: 0 }));
      fm.visible = false; scene.add(fm); feixes.push({ m: fm, t: 0, dur: 0.5, r: 1, ativo: false });
    }
    function feixe(x, z, r, dur, c) {
      var a = null; for (var i = 0; i < feixes.length; i++) if (!feixes[i].ativo) { a = feixes[i]; break; } if (!a) a = feixes[0];
      a.ativo = true; a.t = 0; a.dur = dur; a.r = r; a.m.material.color.setHex(c); a.m.position.set(x, 30, z); a.m.visible = true;
    }

    // ── RAIOS ELÉTRICOS (segmentos retos em zigue-zague) ──
    var MAXS = 160;
    var sNucleo = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial({ color: 0xffffff }), MAXS);
    var sBrilho = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial({ color: 0x66aaff, transparent: true, opacity: 0.45, blending: T.AdditiveBlending, depthWrite: false }), MAXS);
    sNucleo.frustumCulled = sBrilho.frustumCulled = false; sNucleo.count = sBrilho.count = 0; scene.add(sNucleo); scene.add(sBrilho);
    var S = [];
    function raio(pontos, c, larg) {   // pontos = [x0,z0,x1,z1,...]
      for (var i = 0; i + 3 < pontos.length; i += 2) {
        var x0 = pontos[i], z0 = pontos[i + 1], x1 = pontos[i + 2], z1 = pontos[i + 3], n = 7;
        var dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz) || 1, px = -dz / len, pz = dx / len, ax = x0, az = z0;
        for (var k = 1; k <= n; k++) {
          var u = k / n, off = k === n ? 0 : (Math.random() - 0.5) * Math.min(1.6, len * 0.25);
          var bx = x0 + dx * u + px * off, bz = z0 + dz * u + pz * off;
          if (S.length < MAXS) S.push({ x0: ax, z0: az, x1: bx, z1: bz, t: 0, dur: 0.22, w: larg || 0.11 });
          ax = bx; az = bz;
        }
      }
      sBrilho.material.color.setHex(c || 0x66aaff);
    }
    // linha de aviso no chão (investida do chefe)
    var linhas = [];
    for (var l = 0; l < 4; l++) {
      var lm = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: 0xff3344, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0, side: T.DoubleSide }));
      lm.rotation.x = -Math.PI / 2; lm.visible = false; scene.add(lm); linhas.push({ m: lm, t: 0, dur: 1, ativo: false });
    }
    function linha(x0, z0, x1, z1, larg, dur) {
      var a = null; for (var i = 0; i < linhas.length; i++) if (!linhas[i].ativo) { a = linhas[i]; break; } if (!a) a = linhas[0];
      var dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz) || 1;
      a.ativo = true; a.t = 0; a.dur = dur; a.m.visible = true; a.larg = larg;
      // o plano fica deitado (X) e depois gira no chão (Y) para apontar na direção da investida
      a.m.position.set((x0 + x1) / 2, 0.09, (z0 + z1) / 2); a.m.rotation.order = 'YXZ'; a.m.rotation.set(-Math.PI / 2, -Math.atan2(dz, dx), 0);
      a.m.scale.set(len, larg, 1);
    }

    // ── NÚMEROS DE DANO (canvas 2D por cima) ──
    var oc = overlayCanvas, o2 = oc.getContext('2d'), N = [], tmp = { x: 0, y: 0, visivel: true };
    function numero(x, z, txt, c, tam, vida) {
      if (N.length > 70) N.shift();
      N.push({ x: x + (Math.random() - 0.5) * 0.8, y: 1.6, z: z, txt: txt, c: c, tam: tam || 15, t: 0, vida: vida || 0.7 });
    }
    function ajustarOverlay() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2), w = oc.clientWidth, h = oc.clientHeight;
      if (oc.width !== Math.round(w * dpr) || oc.height !== Math.round(h * dpr)) { oc.width = Math.round(w * dpr); oc.height = Math.round(h * dpr); }
      o2.setTransform(oc.width / w, 0, 0, oc.height / h, 0, 0);
      return { w: w, h: h };
    }

    // ── ATUALIZAÇÃO (todo frame) ──
    function atualizar(dt) {
      // partículas
      var n = 0;
      for (var i = P.length - 1; i >= 0; i--) {
        var p = P[i]; p.vida -= dt;
        if (p.vida <= 0) { P[i] = P[P.length - 1]; P.pop(); continue; }
        p.vy -= p.grav * dt; var ar = Math.max(0, 1 - p.arr * dt); p.vx *= ar; p.vz *= ar; if (p.arr) p.vy *= ar;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.y < 0.05) { p.y = 0.05; p.vy *= -0.3; }
      }
      for (var j = 0; j < P.length; j++) {
        var q = P[j], u = q.vida / q.max, s = q.tam * (q.cresce ? 1 + (1 - u) * q.cresce : u * 0.6 + 0.4);
        dummy.position.set(q.x, q.y, q.z); dummy.quaternion.copy(cam.quaternion); dummy.scale.set(s, s, s); dummy.updateMatrix();
        pm.setMatrixAt(j, dummy.matrix); cor.setRGB(q.r * u, q.g * u, q.b * u); pm.setColorAt(j, cor); n++;
      }
      pm.count = n; pm.instanceMatrix.needsUpdate = true; if (pm.instanceColor) pm.instanceColor.needsUpdate = true;
      // anéis, discos, feixes, linhas
      for (var a = 0; a < rings.length; a++) { var r = rings[a]; if (!r.ativo) continue; r.t += dt; var u2 = r.t / r.dur; if (u2 >= 1) { r.ativo = false; r.m.visible = false; continue; } var e = 1 - Math.pow(1 - u2, 3), rr = r.r0 + (r.r1 - r.r0) * e; r.m.scale.set(rr, rr, 1); r.m.material.opacity = r.op * (1 - u2); }
      for (var b = 0; b < discos.length; b++) { var di = discos[b]; if (!di.ativo) continue; di.t += dt; var u3 = di.t / di.dur; if (u3 >= 1) { di.ativo = false; di.m.visible = false; continue; } di.m.scale.set(di.r * (0.5 + u3 * 0.5), di.r * (0.5 + u3 * 0.5), 1); di.m.material.opacity = di.op * (1 - u3) * (1 - u3); }
      for (var cz = 0; cz < cortes.length; cz++) { var ct = cortes[cz]; if (!ct.ativo) continue; ct.t += dt; var uc = ct.t / ct.dur; if (uc >= 1) { ct.ativo = false; ct.g.visible = false; continue; } var rc = ct.r * (0.55 + 0.45 * (1 - Math.pow(1 - uc, 3))); ct.g.scale.set(rc, 1, rc); ct.a.material.opacity = 0.85 * (1 - uc); ct.b.material.opacity = 1 - uc * uc; }
      for (var c = 0; c < feixes.length; c++) { var fx = feixes[c]; if (!fx.ativo) continue; fx.t += dt; var u4 = fx.t / fx.dur; if (u4 >= 1) { fx.ativo = false; fx.m.visible = false; continue; } var w = fx.r * (1 - u4 * 0.7); fx.m.scale.set(w, 1, w); fx.m.material.opacity = 0.85 * (1 - u4); }
      for (var d = 0; d < linhas.length; d++) { var li = linhas[d]; if (!li.ativo) continue; li.t += dt; var u5 = li.t / li.dur; if (u5 >= 1) { li.ativo = false; li.m.visible = false; continue; } li.m.material.opacity = 0.25 + 0.45 * Math.abs(Math.sin(li.t * 14)); }
      // raios
      var ns = 0;
      for (var k = S.length - 1; k >= 0; k--) { var sg = S[k]; sg.t += dt; if (sg.t >= sg.dur) { S[k] = S[S.length - 1]; S.pop(); } }
      for (var m = 0; m < S.length; m++) {
        var s2 = S[m], dx = s2.x1 - s2.x0, dz = s2.z1 - s2.z0, len = Math.hypot(dx, dz) || 0.01, fade = 1 - s2.t / s2.dur;
        dummy.position.set((s2.x0 + s2.x1) / 2, 1.3, (s2.z0 + s2.z1) / 2); dummy.rotation.set(0, Math.atan2(dx, dz), 0); dummy.scale.set(s2.w * fade, s2.w * fade, len); dummy.updateMatrix(); sNucleo.setMatrixAt(ns, dummy.matrix);
        dummy.scale.set(s2.w * 4 * fade, s2.w * 4 * fade, len); dummy.updateMatrix(); sBrilho.setMatrixAt(ns, dummy.matrix); ns++;
      }
      dummy.rotation.set(0, 0, 0);
      sNucleo.count = sBrilho.count = ns; sNucleo.instanceMatrix.needsUpdate = sBrilho.instanceMatrix.needsUpdate = true;
    }

    // desenha números flutuantes; `extra(ctx, proj)` deixa o jogo desenhar barras de vida etc. no mesmo canvas
    function desenharOverlay(dt, extra) {
      var tam = ajustarOverlay();
      o2.clearRect(0, 0, tam.w, tam.h);
      if (extra) extra(o2, mundo.projetar);
      o2.textAlign = 'center'; o2.lineJoin = 'round';
      for (var i = N.length - 1; i >= 0; i--) {
        var n = N[i]; n.t += dt;
        if (n.t >= n.vida) { N[i] = N[N.length - 1]; N.pop(); continue; }
        var u = n.t / n.vida; mundo.projetar(n.x, n.y + u * 1.8, n.z, tmp);
        if (!tmp.visivel) continue;
        var pop = u < 0.15 ? 1 + (0.15 - u) * 5 : 1;
        o2.font = '900 ' + Math.round(n.tam * pop) + 'px Orbitron, Arial, sans-serif';
        o2.globalAlpha = u > 0.65 ? 1 - (u - 0.65) / 0.35 : 1;
        o2.lineWidth = 3.5; o2.strokeStyle = 'rgba(0,0,0,0.85)'; o2.strokeText(n.txt, tmp.x, tmp.y);
        o2.fillStyle = n.c; o2.fillText(n.txt, tmp.x, tmp.y);
      }
      o2.globalAlpha = 1;
    }

    return {
      corte: corte, faiscas: faiscas, fumaca: fumaca, particula: particula, anel: anel, disco: disco, feixe: feixe, raio: raio, linha: linha,
      numero: numero, atualizar: atualizar, desenharOverlay: desenharOverlay,
    };
  }

  window.NREfeitos = { criar: criar };
})();
