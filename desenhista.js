// ══════════════════════════════════════════════════════════════════
// DESENHISTA.JS — lê o ESTADO do jogo (jogadores, inimigos, tiros...) e
// atualiza o que aparece na tela. Também traduz os EVENTOS da simulação
// (tiro, morte, explosão...) em partículas, tremor de câmera e som.
//
// Ele não sabe se o jogo é solo ou online: recebe sempre o mesmo formato
// de estado. Isso mantém a simulação (sim.js) 100% separada do visual.
// ══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var T = window.THREE, D = window.NRData, M = window.NRModelos, Sim = window.NRSim, EV = Sim.EV;

  var COR_SLOT = [0x2ee6ff, 0xff3da6, 0xffd23d, 0x39ff88];     // cor do neon de cada jogador no co-op
  var MAX_INIM = D.CFG.maxInimigos + 80;

  function criar(mundo, fx, opcoes) {
    var scene = mundo.scene, cam = mundo.camera, A = window.NRAudio;
    var cb = opcoes.callbacks || {};
    var infoSlot = opcoes.infoSlot || {};                       // slot → { cacador, rifle, nome }
    var dummy = new T.Object3D(); dummy.rotation.order = 'YXZ';
    var cor = new T.Color(), tmp = { x: 0, y: 0, visivel: true };
    var glow = mundo.glowTex;

    // ── INIMIGOS COMUNS (um InstancedMesh por tipo e parte) ──
    var tipos = D.INIMIGOS.map(function (def) {
      var mod = M.INIMIGOS_MODELOS[def.id]();
      var corpo = M.instanciado(mod.corpo, new T.MeshLambertMaterial({ vertexColors: true }), MAX_INIM, true);
      var brilho = M.instanciado(mod.brilho, new T.MeshBasicMaterial({ vertexColors: true }), MAX_INIM, true);
      scene.add(corpo); scene.add(brilho);
      return { def: def, mod: mod, corpo: corpo, brilho: brilho, n: 0 };
    });
    // sombras (um círculo escuro sob cada inimigo) e anel vermelho nos elites
    var sombras = new T.InstancedMesh(new T.CircleGeometry(1, 12), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false }), MAX_INIM + 8);
    sombras.frustumCulled = false; sombras.count = 0; scene.add(sombras);
    var elitesAn = new T.InstancedMesh(new T.RingGeometry(0.8, 1, 24), new T.MeshBasicMaterial({ color: 0xff3344, transparent: true, opacity: 0.8, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }), 60);
    elitesAn.frustumCulled = false; elitesAn.count = 0; scene.add(elitesAn);
    var estInim = new Map();           // id → { x, z, ang, ph, visto }
    var estChefes = new Map();         // id → { obj, x, z, ang, visto }
    var quadro = 0;

    // ── PROJÉTEIS, GEMAS ──
    var MAXB = 500;
    var balaN = M.instanciado(M.geoPlasma(), new T.MeshBasicMaterial({ color: 0xffffff }), MAXB, true);
    var balaH = M.instanciado(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: glow, transparent: true, blending: T.AdditiveBlending, depthWrite: false }), MAXB, true);
    scene.add(balaN); scene.add(balaH);
    var COR_BALA = [[0.6, 1, 1], [1, 0.35, 0.2], [1, 0.85, 0.25], [1, 0.45, 0.55]], COR_HALO = [[0.1, 0.8, 1], [1, 0.2, 0.1], [1, 0.7, 0.1], [1, 0.1, 0.25]];
    var gemaM = M.instanciado(M.geoGema(), new T.MeshBasicMaterial({ color: 0xffffff }), 480, true);
    var gemaH = M.instanciado(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: glow, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.8 }), 480, true);
    scene.add(gemaM); scene.add(gemaH);
    var COR_GEMA = [0x2ee6ff, 0x39ff88, 0xb04dff];

    // ── JOGADORES (modelos 3D por slot) ──
    var jog = {};                      // slot → { modelo, x, z, vel, drones[] }
    function modeloJogador(slot) {
      var i = infoSlot[slot] || {};
      var m = M.criarCacador({ cor: i.persona === 'kunoichi' ? 0xff3da6 : COR_SLOT[slot % 4], basico: i.persona === 'padrao', fem: i.persona === 'kunoichi', rifle: i.arma === 'rifle', katana: i.arma === 'katana' });
      scene.add(m.grupo);
      return (jog[slot] = { modelo: m, x: 0, z: 0, vel: 0, drones: [], inicializado: false, alt: 0, fx: 0, fz: 1 });
    }

    // ── ITENS, ZONAS, GRANADAS (pools pequenos) ──
    var itensObj = [];
    var zonasObj = [];
    var granObj = [];
    function discoZona(c) {
      var g = new T.Group();
      var d = new T.Mesh(new T.CircleGeometry(1, 40), new T.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.18, blending: T.AdditiveBlending, depthWrite: false })); d.rotation.x = -Math.PI / 2; g.add(d);
      var i = new T.Mesh(new T.CircleGeometry(1, 40), new T.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.4, blending: T.AdditiveBlending, depthWrite: false })); i.rotation.x = -Math.PI / 2; i.position.y = 0.01; g.add(i);
      var r = new T.Mesh(new T.RingGeometry(0.93, 1, 40), new T.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); r.rotation.x = -Math.PI / 2; r.position.y = 0.02; g.add(r);
      g.userData = { disco: d, interno: i, anel: r }; g.visible = false; g.position.y = 0.07; scene.add(g); return g;
    }

    // ══════════════ SINCRONIZAÇÃO (todo frame) ══════════════
    function sincronizar(V, dt, t, slotLocal) {
      quadro++;
      // ---- jogadores ----
      for (var i = 0; i < V.jogadores.length; i++) {
        var p = V.jogadores[i], j = jog[p.slot] || modeloJogador(p.slot), g = j.modelo.grupo;
        if (!j.inicializado) { j.x = p.x; j.z = p.z; j.inicializado = true; }
        var dx = p.x - j.x, dz = p.z - j.z; j.vel += ((Math.hypot(dx, dz) / Math.max(dt, 0.001)) - j.vel) * Math.min(1, dt * 12);
        j.x = p.x; j.z = p.z; g.position.set(p.x, 0, p.z);
        g.visible = !p.fora;
        var caido = !p.vivo;
        // direção do olhar: mira quando atira; senão para onde anda
        j.modelo.animar(dt, t, caido ? 0 : j.vel, p.fx || 0, p.fz || 1, p.dashT > 0);
        j.caido = caido;
        // caído = deitado no chão
        var alvoDeita = caido ? 1 : 0; j.alt += (alvoDeita - j.alt) * Math.min(1, dt * 8);
        g.children[0].rotation.x = -j.alt * 1.45; g.children[0].position.y = j.alt * 0.5;
        // pisca quando está invulnerável após dano (dash não pisca)
        g.visible = !p.fora && !(p.invul > 0 && p.dashT <= 0 && p.sofreu > 0 && ((t * 18) | 0) % 2 === 0);
        if (p.dashT > 0 && p.vivo) fx.particula(p.x, 1.0, p.z, 0, 0.2, 0, 0.35, 1.6, j.modelo.cor, 0, 2, 0);   // rastro do dash
        // drones orbitais
        var nd = p.hab && p.hab.drones ? Sim.statsHab('drones', p.hab.drones) : null;
        var n = nd && p.vivo ? nd.n : 0;
        while (j.drones.length < n) { var dr = M.criarDrone(COR_SLOT[p.slot % 4] === 0x2ee6ff ? 0xffd23d : COR_SLOT[p.slot % 4]); scene.add(dr); j.drones.push(dr); }
        for (var k = 0; k < j.drones.length; k++) {
          var d = j.drones[k]; d.visible = k < n;
          if (k < n) {
            var a = p.droneAng + k * Math.PI * 2 / n;
            d.position.set(p.x + Math.cos(a) * nd.orbita, 1.2 + Math.sin(t * 3 + k) * 0.12, p.z + Math.sin(a) * nd.orbita); d.rotation.y = -a; d.userData.aro.rotation.z = t * 5;
          }
        }
      }
      // ---- inimigos comuns + chefes ----
      for (var ti = 0; ti < tipos.length; ti++) tipos[ti].n = 0;
      var ns = 0, ne = 0;
      for (var q = 0; q < V.inimigos.length; q++) {
        var e = V.inimigos[q], s = estInim.get(e.id);
        if (e.chefe) { atualizarChefe(e, dt, t); continue; }
        if (!s) { s = { x: e.x, z: e.z, ang: Math.atan2(-e.x, -e.z), ph: (e.id * 0.7) % 6.28, visto: 0 }; estInim.set(e.id, s); }
        var mx = e.x - s.x, mz = e.z - s.z;
        if (mx * mx + mz * mz > 0.0004) { var al = Math.atan2(mx, mz), da = al - s.ang; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283; s.ang += da * Math.min(1, dt * 12); }
        s.x = e.x; s.z = e.z; s.visto = quadro;
        var tp = tipos[e.t]; if (!tp || tp.n >= MAX_INIM) continue;
        var def = tp.def, fr = def.comp === 'voar' ? 14 : def.id === 'corredor' ? 14 : def.id === 'bruto' ? 4.5 : def.id === 'enxame' ? 24 : 8;
        var sn = Math.sin(t * fr + s.ph), esc = tp.mod.escala * (e.elite ? 1.35 : 1) * (e.flash ? 1.12 : 1);
        var by = tp.mod.y + (def.comp === 'voar' ? Math.sin(t * 3 + s.ph) * 0.18 : Math.abs(sn) * (def.id === 'bruto' ? 0.07 : 0.11));
        dummy.position.set(e.x, by, e.z);
        dummy.rotation.set(def.comp === 'voar' ? 0.35 : 0.08 + (def.id === 'corredor' ? 0.1 : 0), s.ang, def.comp === 'voar' ? sn * 0.12 : sn * 0.1);
        dummy.scale.setScalar(esc); dummy.updateMatrix();
        tp.corpo.setMatrixAt(tp.n, dummy.matrix); tp.brilho.setMatrixAt(tp.n, dummy.matrix);
        // cor: normal, flash de acerto (branco forte), lento (azul gelo), elite (avermelhado)
        if (e.flash) cor.setRGB(3.2, 3.2, 3.2); else if (e.lento) cor.setRGB(0.55, 0.85, 1.7); else if (e.elite) cor.setRGB(1.5, 0.6, 0.6); else cor.setRGB(1, 1, 1);
        tp.corpo.setColorAt(tp.n, cor); cor.setRGB(1, 1, 1); if (e.flash) cor.setRGB(2, 2, 2); tp.brilho.setColorAt(tp.n, cor);
        tp.n++;
        if (ns < MAX_INIM) { dummy.position.set(e.x, 0.05, e.z); dummy.rotation.set(-Math.PI / 2, 0, 0); var rs = e.raio * 1.5 || 0.8; dummy.scale.set(rs, rs, 1); dummy.updateMatrix(); sombras.setMatrixAt(ns++, dummy.matrix); dummy.rotation.order = 'YXZ'; }
        if (e.elite && ne < 60) { dummy.position.set(e.x, 0.1, e.z); dummy.rotation.set(-Math.PI / 2, 0, 0); var re = 1.3 + Math.sin(t * 6 + s.ph) * 0.12; dummy.scale.set(re, re, 1); dummy.updateMatrix(); elitesAn.setMatrixAt(ne++, dummy.matrix); }
      }
      for (var tt = 0; tt < tipos.length; tt++) {
        var x = tipos[tt]; x.corpo.count = x.brilho.count = x.n;
        x.corpo.instanceMatrix.needsUpdate = x.brilho.instanceMatrix.needsUpdate = true;
        if (x.corpo.instanceColor) x.corpo.instanceColor.needsUpdate = true; if (x.brilho.instanceColor) x.brilho.instanceColor.needsUpdate = true;
      }
      sombras.count = ns; sombras.instanceMatrix.needsUpdate = true; elitesAn.count = ne; elitesAn.instanceMatrix.needsUpdate = true;
      // limpa memória de inimigos que sumiram
      if ((quadro & 31) === 0) {
        estInim.forEach(function (v, k) { if (v.visto !== quadro && v.visto < quadro - 2) estInim.delete(k); });
      }
      estChefes.forEach(function (v, k) { if (v.visto !== quadro) { scene.remove(v.obj.grupo); estChefes.delete(k); } });

      // ---- projéteis ----
      var nb = 0;
      for (var b = 0; b < V.projeteis.length && nb < MAXB; b++) {
        var pr = V.projeteis[b], kk = Math.min(3, pr.kind);
        dummy.position.set(pr.x, 1.25, pr.z); dummy.rotation.set(0, Math.atan2(pr.vx, pr.vz), 0);
        var sb = pr.kind === 1 ? 0.8 : pr.kind === 3 ? 2.2 : 1.0; dummy.scale.set(sb, sb, sb); dummy.updateMatrix(); balaN.setMatrixAt(nb, dummy.matrix);
        cor.setRGB(COR_BALA[kk][0], COR_BALA[kk][1], COR_BALA[kk][2]); balaN.setColorAt(nb, cor);
        dummy.quaternion.copy(cam.quaternion); var sh = pr.kind === 1 ? 1.5 : 1.3; dummy.scale.set(sh, sh, sh); dummy.updateMatrix(); balaH.setMatrixAt(nb, dummy.matrix);
        cor.setRGB(COR_HALO[kk][0], COR_HALO[kk][1], COR_HALO[kk][2]); balaH.setColorAt(nb, cor);
        nb++; dummy.rotation.set(0, 0, 0);
      }
      balaN.count = balaH.count = nb; balaN.instanceMatrix.needsUpdate = balaH.instanceMatrix.needsUpdate = true;
      if (balaN.instanceColor) balaN.instanceColor.needsUpdate = balaH.instanceColor.needsUpdate = true;
      // ---- gemas ----
      var ng = 0;
      for (var g2 = 0; g2 < V.gemas.length && ng < 480; g2++) {
        var ge = V.gemas[g2], bob = 0.55 + Math.sin(t * 3 + g2) * 0.12;
        dummy.position.set(ge.x, bob, ge.z); dummy.rotation.set(0, t * 2 + g2, 0); var sg = ge.tipo === 2 ? 1.5 : ge.tipo === 1 ? 1.2 : 1; dummy.scale.set(sg, sg * 1.2, sg); dummy.updateMatrix(); gemaM.setMatrixAt(ng, dummy.matrix);
        cor.setHex(COR_GEMA[ge.tipo] || COR_GEMA[0]); gemaM.setColorAt(ng, cor);
        dummy.rotation.set(0, 0, 0); dummy.quaternion.copy(cam.quaternion); dummy.position.y = bob; dummy.scale.set(sg * 1.5, sg * 1.5, sg * 1.5); dummy.updateMatrix(); gemaH.setMatrixAt(ng, dummy.matrix); gemaH.setColorAt(ng, cor);
        ng++;
      }
      gemaM.count = gemaH.count = ng; gemaM.instanceMatrix.needsUpdate = gemaH.instanceMatrix.needsUpdate = true;
      if (gemaM.instanceColor) gemaM.instanceColor.needsUpdate = gemaH.instanceColor.needsUpdate = true;
      dummy.rotation.set(0, 0, 0);

      // ---- itens no chão ----
      for (var it = 0; it < V.itens.length; it++) {
        var itn = V.itens[it], o = itensObj[it];
        if (!o || o.kind !== itn.kind) { if (o) scene.remove(o.g); var gg = M.criarItem(itn.kind); scene.add(gg); o = itensObj[it] = { kind: itn.kind, g: gg }; }
        o.g.visible = true; o.g.position.set(itn.x, 0.9 + Math.sin(t * 3 + it) * 0.15, itn.z); o.g.rotation.y = t * 1.8; o.g.scale.setScalar(1 + Math.sin(t * 5 + it) * 0.06);
      }
      for (var ir = V.itens.length; ir < itensObj.length; ir++) if (itensObj[ir]) itensObj[ir].g.visible = false;
      // ---- zonas (avisos de chefe, ataque orbital, chamas) ----
      for (var z = 0; z < V.zonas.length; z++) {
        var zn = V.zonas[z], zo = zonasObj[z];
        var corZ = zn.tipo === 'chama' ? 0xff7a1a : zn.tipo === 'orbital' ? 0xff3da6 : 0xff2233;
        if (!zo) { zo = zonasObj[z] = discoZona(corZ); }
        zo.visible = true; zo.position.set(zn.x, 0.07, zn.z); zo.scale.set(zn.r, 1, zn.r);
        ['disco', 'interno', 'anel'].forEach(function (nm) { zo.userData[nm].material.color.setHex(corZ); });
        if (zn.tipo === 'chama') { var f = 0.85 + Math.sin(t * 20 + z) * 0.15; zo.userData.interno.scale.set(f, f, 1); zo.userData.interno.material.opacity = 0.35; if (Math.random() < 0.3) fx.fumaca(zn.x + (Math.random() - 0.5) * zn.r, 0.3, zn.z + (Math.random() - 0.5) * zn.r, 1, 0xff7a1a, 1.1, 0.5); }
        else { var pr2 = Math.max(0, Math.min(1, 1 - zn.t / 1.15)); zo.userData.interno.scale.set(pr2, pr2, 1); zo.userData.interno.material.opacity = 0.25 + pr2 * 0.4; zo.userData.anel.material.opacity = 0.5 + Math.abs(Math.sin(t * 16)) * 0.5; }
      }
      for (var zr = V.zonas.length; zr < zonasObj.length; zr++) zonasObj[zr].visible = false;
      // ---- granadas em voo ----
      for (var gi = 0; gi < V.granadas.length; gi++) {
        var gr = V.granadas[gi], go = granObj[gi];
        if (!go) { go = granObj[gi] = new T.Mesh(new T.SphereGeometry(0.28, 8, 6), new T.MeshBasicMaterial({ color: 0xff8a2a })); scene.add(go); }
        var u = gr.t / (gr.dur || 1); go.visible = true;
        go.position.set(gr.x0 + (gr.x1 - gr.x0) * u, 0.5 + Math.sin(u * Math.PI) * 4.5, gr.z0 + (gr.z1 - gr.z0) * u);
        fx.particula(go.position.x, go.position.y, go.position.z, 0, 0, 0, 0.3, 0.9, 0xff7a1a, 0, 2, 0);
      }
      for (var gx = V.granadas.length; gx < granObj.length; gx++) granObj[gx].visible = false;
    }

    function atualizarChefe(e, dt, t) {
      var s = estChefes.get(e.id);
      if (!s) { var obj = M.criarChefe(e.t); scene.add(obj.grupo); s = { obj: obj, x: e.x, z: e.z, ang: 0, visto: 0 }; estChefes.set(e.id, s); }
      var mx = e.x - s.x, mz = e.z - s.z;
      if (mx * mx + mz * mz > 0.0001) { var al = Math.atan2(mx, mz), da = al - s.ang; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283; s.ang += da * Math.min(1, dt * 6); }
      s.x = e.x; s.z = e.z; s.visto = quadro;
      var g = s.obj.grupo; g.position.set(e.x, 0, e.z); g.rotation.y = s.ang; g.scale.setScalar(e.flash ? 1.03 : 1);
      s.obj.animar(dt, t, e);
    }

    // ══════════════ EVENTOS → EFEITOS + SOM ══════════════
    function p3(slot) { var j = jog[slot]; return j ? j.modelo.grupo.position : null; }
    function processarEventos(lista, slotLocal) {
      for (var i = 0; i < lista.length; i++) {
        var e = lista[i], tipo = e[0], eu = e[1] === slotLocal;
        switch (tipo) {
          case EV.TIRO: {
            var j = jog[e[1]]; if (j) j.modelo.recuar();
            fx.faiscas(e[2] + e[4] * 1.4, 1.35, e[3] + e[5] * 1.4, 4, 0x6ff6ff, 5, 0.18, 0.55, 0);
            fx.particula(e[2] + e[4] * 1.3, 1.35, e[3] + e[5] * 1.3, 0, 0, 0, 0.09, 1.5, 0xaaffff, 0, 0, 0);
            if (eu) A.tocar('tiro'); else A.tocar('tiro', { tom: -0.15 });
            break; }
          case EV.SLASH: {
            var js = jog[e[1]]; if (js) js.modelo.golpear();
            fx.corte(e[2], e[3], e[4], e[5], e[6], e[7]);
            var lx = e[2] + e[4] * e[7] * 0.7, lz = e[3] + e[5] * e[7] * 0.7;
            fx.faiscas(lx, 1.1, lz, e[6] > 6 ? 14 : 8, 0xff2a55, 6, 0.3, 0.5, 2); A.tocar('corte');
            break; }
          case EV.HIT: {
            var dano = e[3], crit = e[4], tp = e[5], cs = tp >= 90 ? 0xff6677 : (D.INIMIGOS[tp] ? D.INIMIGOS[tp].cor : 0xffffff);
            fx.faiscas(e[1], 1.1, e[2], crit ? 7 : 3, crit ? 0xffd23d : cs, 4.5, 0.25, 0.4, 8);
            if (Math.random() < (crit ? 1 : 0.55)) fx.numero(e[1], e[2], String(dano) + (crit ? '!' : ''), crit ? '#ffd23d' : '#ffffff', crit ? 21 : 14, crit ? 0.85 : 0.6);
            A.tocar(crit ? 'crit' : 'hit');
            break; }
          case EV.MORTE: {
            var el = e[4], ch = e[5], c0 = e[3] >= 90 ? 0xff3344 : (D.INIMIGOS[e[3]] ? D.INIMIGOS[e[3]].cor : 0xffffff);
            fx.faiscas(e[1], 1.0, e[2], ch ? 70 : el ? 30 : 12, c0, ch ? 13 : 7, 0.6, ch ? 1.1 : 0.7, 9);
            fx.fumaca(e[1], 0.6, e[2], ch ? 12 : el ? 5 : 2, c0, ch ? 3 : 1.4, 0.8);
            fx.anel(e[1], e[2], 0.3, ch ? 9 : el ? 3.5 : 1.8, ch ? 0.9 : 0.4, c0, 0.8);
            if (ch) { fx.anel(e[1], e[2], 0.3, 14, 1.2, 0xffffff, 0.8); fx.disco(e[1], e[2], 8, 0.9, c0, 0.7); mundo.tremer(1); mundo.flash(e[1], e[2], c0, 6); A.tocar('explosao', { grande: true }); if (cb.chefeMorto) cb.chefeMorto(); }
            else if (el) { mundo.tremer(0.3); A.tocar('morteElite'); } else A.tocar('morte');
            break; }
          case EV.GEMA: if (eu) A.tocar('gema'); break;
          case EV.NIVEL: {
            var pj = p3(e[1]);
            if (pj) { fx.anel(pj.x, pj.z, 0.5, 6, 0.8, 0xffd23d, 0.9); fx.anel(pj.x, pj.z, 0.5, 4, 0.6, 0xffffff, 0.8); fx.faiscas(pj.x, 1.2, pj.z, 40, 0xffd23d, 9, 0.9, 0.8, -2); }
            if (eu) { A.tocar('nivel'); if (cb.nivel) cb.nivel(e[2]); }
            break; }
          case EV.DANO: {
            fx.faiscas(e[3], 1.2, e[4], 14, 0xff3344, 6, 0.4, 0.7, 6); fx.numero(e[3], e[4], '-' + e[2], '#ff4d5e', 19, 0.8);
            if (eu) { mundo.tremer(0.45); A.tocar('dano'); if (cb.dano) cb.dano(e[2]); }
            break; }
          case EV.EMP:
            fx.anel(e[1], e[2], 0.5, e[3], 0.55, 0x9a7cff, 0.95); fx.anel(e[1], e[2], 0.3, e[3] * 0.7, 0.4, 0xffffff, 0.6); fx.disco(e[1], e[2], e[3], 0.5, 0x6a4cff, 0.45);
            fx.faiscas(e[1], 1, e[2], 26, 0x9a7cff, 11, 0.5, 0.6, 2); mundo.tremer(0.25); mundo.flash(e[1], e[2], 0x7a5cff, 3); A.tocar('emp');
            break;
          case EV.RAIO: {
            var n = e[2], pts = []; for (var k = 0; k < n * 2; k++) pts.push(e[3 + k]);
            fx.raio(pts, 0x77bbff, 0.12);
            for (var k2 = 1; k2 < n; k2++) fx.faiscas(pts[k2 * 2], 1.2, pts[k2 * 2 + 1], 6, 0xcfe8ff, 6, 0.3, 0.5, 4);
            A.tocar('tesla'); break; }
          case EV.EXPLO: {
            var r = e[3], cx = [0x6ff6ff, 0x6ff6ff, 0xff8a2a, 0xff5522, 0xffaa22][e[4] | 0] || 0xff8a2a;
            fx.anel(e[1], e[2], 0.3, r, 0.45, cx, 0.9); fx.disco(e[1], e[2], r, 0.4, cx, 0.5);
            fx.faiscas(e[1], 0.9, e[2], Math.min(40, 8 + r * 5), cx, 8 + r, 0.55, 0.9, 7); fx.fumaca(e[1], 0.5, e[2], Math.min(8, r * 1.5), 0x442211, r * 0.55, 0.9);
            if (r > 2.2) { mundo.flash(e[1], e[2], cx, 3.5); mundo.tremer(0.25); } A.tocar('explosao', { grande: r > 3 });
            break; }
          case EV.ONDA: if (cb.onda) cb.onda(e[1]); break;
          case EV.CHEFE:
            mundo.tremer(0.9); mundo.zoomPulso(4); A.tocar('alertaChefe'); fx.anel(e[1], e[2], 1, 18, 1.4, 0xff2233, 0.8); if (cb.chefe) cb.chefe(e[3]);
            break;
          case EV.ORBITAL:
            fx.feixe(e[1], e[2], e[3], 0.45, 0xff6ad0); fx.anel(e[1], e[2], 0.4, e[3] * 2.2, 0.5, 0xff3da6, 0.95); fx.disco(e[1], e[2], e[3] * 1.4, 0.4, 0xffffff, 0.7);
            fx.faiscas(e[1], 1, e[2], 30, 0xff6ad0, 11, 0.6, 0.8, 4); mundo.tremer(0.35); mundo.flash(e[1], e[2], 0xff3da6, 3.5); A.tocar('orbital');
            break;
          case EV.DASH: { var pd = p3(e[1]); if (pd) fx.anel(e[2], e[3], 0.3, 2.4, 0.35, 0x9ff4ff, 0.7); if (eu) A.tocar('dash'); break; }
          case EV.CAPSULA: { var pc = p3(e[1]); if (pc) fx.faiscas(pc.x, 1.3, pc.z, 36, 0xffd23d, 9, 0.8, 0.8, -1); if (eu) A.tocar('capsula'); break; }
          case EV.CAIU: fx.anel(e[2], e[3], 0.4, 5, 0.8, 0xff3344, 0.9); fx.faiscas(e[2], 1, e[3], 30, 0xff3344, 8, 0.8, 0.8, 5); A.tocar('caiu'); mundo.tremer(0.6); if (cb.caiu) cb.caiu(e[1]); break;
          case EV.REVIVEU: fx.anel(e[2], e[3], 0.4, 6, 0.9, 0x39ff88, 0.95); fx.faiscas(e[2], 1, e[3], 40, 0x39ff88, 10, 0.9, 0.9, -1); A.tocar('reviveu'); break;
          case EV.ITEM: if (eu) A.tocar(e[2] === 1 ? 'cura' : 'item'); break;
          case EV.TIRO_INIM: A.tocar('tiroInimigo'); break;
          case EV.TELEGRAFO:
            if (e[1] === 2) fx.linha(e[2], e[3], e[6], e[7], e[4] * 1.2, e[5]);
            A.tocar('telegrafo'); break;
          case EV.HORDA: A.tocar('horda'); if (cb.horda) cb.horda(e[1]); break;
          case EV.CURA: { var ph = p3(e[1]); if (ph) { fx.numero(ph.x, ph.z, '+' + e[2], '#39ff88', 18, 0.9); fx.faiscas(ph.x, 1.2, ph.z, 12, 0x39ff88, 5, 0.6, 0.6, -2); } break; }
          case EV.TELEPORTE: fx.faiscas(e[1], 1.5, e[2], 30, 0xb04dff, 10, 0.5, 0.9, 2); fx.faiscas(e[3], 1.5, e[4], 30, 0xb04dff, 10, 0.5, 0.9, 2); fx.anel(e[3], e[4], 0.3, 4, 0.5, 0xb04dff, 0.9); A.tocar('teleporte'); break;
          case EV.DRONE_TIRO: A.tocar('drone'); break;
          case EV.LOJA: A.tocar('vitoria'); if (cb.loja) cb.loja(e[1]); break;
          case EV.FIM: if (cb.fim) cb.fim(); break;
        }
      }
    }

    // posição de tela de um jogador (para barras de vida etc.)
    function jogadorObj(slot) { return jog[slot]; }
    function destruir() { /* a página é descartada ao sair: o navegador libera a memória */ }

    return { sincronizar: sincronizar, processarEventos: processarEventos, jogador: jogadorObj, destruir: destruir, COR_SLOT: COR_SLOT };
  }

  window.NRDesenhista = { criar: criar, COR_SLOT: COR_SLOT };
})();
