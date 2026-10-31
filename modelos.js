// ══════════════════════════════════════════════════════════════════
// MODELOS.JS — todos os modelos 3D do jogo, CRIADOS POR CÓDIGO.
// Nenhum arquivo .glb: cada personagem é montado com formas simples
// (caixas, cilindros, cones) e unido em uma única malha, o que deixa o
// jogo leve e permite desenhar centenas de inimigos de uma vez
// (InstancedMesh = uma chamada de desenho para todos os do mesmo tipo).
//
// Cada modelo de inimigo tem 2 partes:
//   corpo   → material com luz (Lambert), cores por vértice
//   brilho  → material "aceso" (olhos, núcleos, lâminas), não recebe sombra
//
// Para mudar a aparência de um inimigo: edite a função dele em INIMIGOS_MODELOS.
// ══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var T = window.THREE;

  // ── CONSTRUTOR DE MALHAS (junta várias formas numa geometria só) ──
  function Construtor() { this.partes = []; }
  Construtor.prototype.add = function (geo, cor, x, y, z, rx, ry, rz, sx, sy, sz) {
    var m = new T.Matrix4();
    m.compose(new T.Vector3(x || 0, y || 0, z || 0),
      new T.Quaternion().setFromEuler(new T.Euler(rx || 0, ry || 0, rz || 0)),
      new T.Vector3(sx || 1, sy || 1, sz || 1));
    this.partes.push({ geo: geo, cor: new T.Color(cor), m: m });
    return this;
  };
  Construtor.prototype.caixa = function (w, h, d, cor, x, y, z, rx, ry, rz) { return this.add(new T.BoxGeometry(w, h, d), cor, x, y, z, rx, ry, rz); };
  Construtor.prototype.cil = function (rt, rb, h, seg, cor, x, y, z, rx, ry, rz) { return this.add(new T.CylinderGeometry(rt, rb, h, seg || 8), cor, x, y, z, rx, ry, rz); };
  Construtor.prototype.esf = function (r, cor, x, y, z, sx, sy, sz) { return this.add(new T.SphereGeometry(r, 8, 6), cor, x, y, z, 0, 0, 0, sx, sy, sz); };
  Construtor.prototype.cone = function (r, h, seg, cor, x, y, z, rx, ry, rz) { return this.add(new T.ConeGeometry(r, h, seg || 6), cor, x, y, z, rx, ry, rz); };
  Construtor.prototype.octa = function (r, cor, x, y, z, sx, sy, sz, rx, ry, rz) { return this.add(new T.OctahedronGeometry(r, 0), cor, x, y, z, rx, ry, rz, sx, sy, sz); };
  Construtor.prototype.tetra = function (r, cor, x, y, z, rx, ry, rz) { return this.add(new T.TetrahedronGeometry(r, 0), cor, x, y, z, rx, ry, rz); };
  Construtor.prototype.geometria = function () {
    var pos = [], nor = [], col = [];
    this.partes.forEach(function (p) {
      var g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
      g.applyMatrix4(p.m);
      g.computeVertexNormals();                       // normais "chapadas" = visual low-poly facetado
      var a = g.attributes.position.array, n = g.attributes.normal.array;
      for (var i = 0; i < a.length; i++) { pos.push(a[i]); nor.push(n[i]); }
      for (var j = 0; j < a.length / 3; j++) col.push(p.cor.r, p.cor.g, p.cor.b);
      g.dispose(); p.geo.dispose();
    });
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    geo.computeBoundingSphere();
    return geo;
  };

  // textura de brilho redondo (halo de tiros, partículas, luzes)
  function texturaGlow(tam, forma) {
    var c = document.createElement('canvas'); c.width = c.height = tam || 64;
    var g = c.getContext('2d'), r = c.width / 2;
    var gr = g.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    gr.addColorStop(0.6, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
    var t = new T.CanvasTexture(c); return t;
  }

  // ══════════════════════════════════════════════════════════════
  //  INIMIGOS (um modelo por tipo; ordem = INIMIGOS em data.js)
  // ══════════════════════════════════════════════════════════════
  // devolve { corpo: Geometry, brilho: Geometry, y: altura do chão, escala: tamanho }
  var INIMIGOS_MODELOS = {
    // 0 — GLITCH WALKER: ciborgue zumbi de braços esticados, olho verde e coluna exposta
    zumbi: function () {
      var c = new Construtor(), b = new Construtor();
      c.caixa(0.22, 0.6, 0.26, 0x1f2b25, -0.16, 0.3, 0).caixa(0.22, 0.6, 0.26, 0x1f2b25, 0.16, 0.3, 0);       // pernas
      c.caixa(0.62, 0.72, 0.36, 0x2f4338, 0, 0.98, 0, 0.18, 0, 0);                                              // tronco curvado
      c.caixa(0.34, 0.32, 0.34, 0x41604e, 0, 1.52, 0.1);                                                         // cabeça
      c.caixa(0.28, 0.1, 0.3, 0x2a3a31, 0, 1.38, 0.1);                                                           // mandíbula
      c.caixa(0.16, 0.16, 0.7, 0x35503f, -0.4, 1.12, 0.38, 0.1, 0, 0).caixa(0.16, 0.16, 0.7, 0x35503f, 0.4, 1.12, 0.38, 0.1, 0, 0); // braços esticados
      c.caixa(0.12, 0.5, 0.12, 0x1b241f, 0, 1.15, -0.28, 0.4, 0, 0);                                             // espinhos
      c.cone(0.07, 0.3, 4, 0x1b241f, -0.2, 1.45, -0.2, -0.5, 0, 0).cone(0.07, 0.3, 4, 0x1b241f, 0.2, 1.45, -0.2, -0.5, 0, 0);
      b.caixa(0.09, 0.06, 0.04, 0x39ff88, -0.08, 1.55, 0.28).caixa(0.09, 0.06, 0.04, 0x39ff88, 0.08, 1.55, 0.28); // olhos
      b.caixa(0.2, 0.2, 0.05, 0x39ff88, 0, 1.02, 0.2, 0.18, 0, 0);                                               // núcleo no peito
      b.caixa(0.05, 0.55, 0.05, 0x39ff88, 0, 1.12, -0.33, 0.4, 0, 0);                                            // coluna acesa
      return { corpo: c.geometria(), brilho: b.geometria(), y: 0, escala: 1.05 };
    },
    // 1 — NEON STRIDER: corredor magro e inclinado, lâminas rosa nos antebraços
    corredor: function () {
      var c = new Construtor(), b = new Construtor();
      c.caixa(0.16, 0.62, 0.2, 0x2a1830, -0.14, 0.32, 0.1, -0.4, 0, 0).caixa(0.16, 0.62, 0.2, 0x2a1830, 0.14, 0.32, -0.1, 0.4, 0, 0);
      c.caixa(0.4, 0.62, 0.26, 0x4a2a52, 0, 0.88, 0.1, 0.55, 0, 0);
      c.caixa(0.26, 0.26, 0.3, 0x5b3463, 0, 1.28, 0.34);
      c.caixa(0.1, 0.1, 0.5, 0x3a2142, -0.28, 0.95, 0.4, 0.5, 0, 0).caixa(0.1, 0.1, 0.5, 0x3a2142, 0.28, 0.95, 0.4, 0.5, 0, 0);
      c.cone(0.08, 0.4, 4, 0x2a1830, 0, 1.36, 0.0, -1.2, 0, 0);                                                  // crista
      b.caixa(0.04, 0.04, 0.55, 0xff3da6, -0.28, 0.82, 0.72, 0.5, 0, 0).caixa(0.04, 0.04, 0.55, 0xff3da6, 0.28, 0.82, 0.72, 0.5, 0, 0); // lâminas
      b.caixa(0.2, 0.05, 0.04, 0xff3da6, 0, 1.3, 0.5);                                                           // visor
      b.caixa(0.04, 0.4, 0.04, 0xff3da6, 0, 0.9, -0.1, 0.55, 0, 0);
      return { corpo: c.geometria(), brilho: b.geometria(), y: 0, escala: 1.0 };
    },
    // 2 — NANO SWARM: inseto-robô minúsculo que voa baixo
    enxame: function () {
      var c = new Construtor(), b = new Construtor();
      c.octa(0.22, 0x4a3d10, 0, 0.3, 0, 1, 0.8, 1.3);
      c.caixa(0.5, 0.02, 0.18, 0x6b5a18, 0.28, 0.4, 0, 0, 0, 0.5).caixa(0.5, 0.02, 0.18, 0x6b5a18, -0.28, 0.4, 0, 0, 0, -0.5);   // asas
      c.cone(0.06, 0.2, 4, 0x2c2508, 0, 0.28, 0.3, 1.57, 0, 0);
      b.octa(0.1, 0xffd23d, 0, 0.3, 0.05); b.caixa(0.05, 0.05, 0.02, 0xffffff, -0.07, 0.34, 0.26).caixa(0.05, 0.05, 0.02, 0xffffff, 0.07, 0.34, 0.26);
      return { corpo: c.geometria(), brilho: b.geometria(), y: 0.35, escala: 1.0 };
    },
    // 3 — DRONE BOMBER: esfera blindada com 4 hélices e núcleo laranja
    kamikaze: function () {
      var c = new Construtor(), b = new Construtor();
      c.esf(0.4, 0x4a3a35, 0, 0, 0, 1, 0.85, 1);
      [[0.5, 0.5], [-0.5, 0.5], [0.5, -0.5], [-0.5, -0.5]].forEach(function (p) {
        c.caixa(0.5, 0.06, 0.06, 0x2a2220, p[0] * 0.5, 0.1, p[1] * 0.5, 0, Math.atan2(p[0], p[1]) + 1.57, 0);
        c.cil(0.26, 0.26, 0.03, 10, 0x6a5550, p[0], 0.18, p[1]);
      });
      c.cone(0.12, 0.3, 4, 0x2a2220, 0, -0.38, 0, Math.PI, 0, 0);
      b.esf(0.2, 0xff6a1a, 0, -0.08, 0.18); b.caixa(0.5, 0.03, 0.03, 0xff3300, 0, 0.12, 0.36);
      return { corpo: c.geometria(), brilho: b.geometria(), y: 1.5, escala: 1.0 };
    },
    // 4 — SNIPER BOT: torre andante de 3 pernas com lente ciano e cano longo
    atirador: function () {
      var c = new Construtor(), b = new Construtor();
      for (var i = 0; i < 3; i++) { var a = i * 2.094; c.cone(0.1, 1.0, 5, 0x1c3a44, Math.cos(a) * 0.35, 0.45, Math.sin(a) * 0.35, Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3); }
      c.cil(0.34, 0.4, 0.5, 8, 0x28505e, 0, 1.15, 0);
      c.caixa(0.55, 0.4, 0.6, 0x1f4452, 0, 1.6, 0);
      c.caixa(0.1, 0.1, 1.1, 0x14303a, 0, 1.6, 0.7);
      c.cone(0.18, 0.3, 6, 0x14303a, 0, 1.95, -0.1, 0, 0, 0);
      b.cil(0.18, 0.18, 0.1, 12, 0x2ee6ff, 0, 1.62, 0.32, 1.57, 0, 0); b.caixa(0.06, 0.06, 0.08, 0x2ee6ff, 0, 1.6, 1.28);
      b.caixa(0.5, 0.04, 0.04, 0x2ee6ff, 0, 1.38, 0.31);
      return { corpo: c.geometria(), brilho: b.geometria(), y: 0, escala: 1.0 };
    },
    // 5 — ENFORCER MECH: tanque bípede gigante, canhões nos ombros e fendas roxas
    bruto: function () {
      var c = new Construtor(), b = new Construtor();
      c.caixa(0.5, 0.9, 0.55, 0x2a2140, -0.4, 0.45, 0).caixa(0.5, 0.9, 0.55, 0x2a2140, 0.4, 0.45, 0);          // pernas grossas
      c.caixa(0.62, 0.22, 0.9, 0x1b1530, -0.4, 0.11, 0.1).caixa(0.62, 0.22, 0.9, 0x1b1530, 0.4, 0.11, 0.1);   // pés
      c.caixa(1.5, 1.1, 0.95, 0x3a2d5a, 0, 1.45, 0);                                                           // tronco
      c.caixa(0.5, 0.4, 0.5, 0x2a2140, 0, 2.2, 0.1);                                                           // cabeça pequena
      c.caixa(0.5, 1.0, 0.5, 0x2a2140, -1.0, 1.5, 0.15).caixa(0.5, 1.0, 0.5, 0x2a2140, 1.0, 1.5, 0.15);       // braços
      c.caixa(0.7, 0.65, 0.7, 0x1b1530, -1.0, 0.85, 0.3).caixa(0.7, 0.65, 0.7, 0x1b1530, 1.0, 0.85, 0.3);     // punhos
      c.cil(0.16, 0.16, 0.9, 8, 0x1b1530, -0.55, 2.2, 0.4, 1.4, 0, 0).cil(0.16, 0.16, 0.9, 8, 0x1b1530, 0.55, 2.2, 0.4, 1.4, 0, 0); // canhões
      c.caixa(0.3, 0.6, 0.3, 0x1b1530, 0, 2.2, -0.5);
      b.caixa(0.35, 0.08, 0.05, 0xb04dff, 0, 2.22, 0.37); b.caixa(0.6, 0.6, 0.06, 0xb04dff, 0, 1.5, 0.5);
      b.caixa(0.06, 0.6, 0.06, 0xb04dff, -0.9, 1.5, 0.42).caixa(0.06, 0.6, 0.06, 0xb04dff, 0.9, 1.5, 0.42);
      b.cil(0.1, 0.1, 0.05, 8, 0xb04dff, -0.55, 2.2, 0.88, 1.57, 0, 0).cil(0.1, 0.1, 0.05, 8, 0xb04dff, 0.55, 2.2, 0.88, 1.57, 0, 0);
      return { corpo: c.geometria(), brilho: b.geometria(), y: 0, escala: 0.95 };
    },
  };

  // ══════════════════════════════════════════════════════════════
  //  GEMAS DE XP, PROJÉTEIS
  // ══════════════════════════════════════════════════════════════
  function geoGema() { return new T.OctahedronGeometry(0.26, 0); }
  function geoPlasma() { var g = new T.OctahedronGeometry(0.22, 0); g.scale(0.55, 0.55, 2.4); return g; }

  // ══════════════════════════════════════════════════════════════
  //  ARMAS (peças independentes: servem para o herói de blocos e para qualquer modelo 3D importado)
  //  Convenção: a arma aponta para +z; "pos" = onde ela fica em relação à cintura do personagem (unidades do herói de blocos).
  // ══════════════════════════════════════════════════════════════
  function criarArma(op, m) {
    // arma 3D importada (.glb) configurada em heroi-config.js? usa ela; se não, cai nas peças de blocos abaixo
    var tipoArma = op.katana ? 'katana' : 'rifle';
    if (window.NRArmasGLB && window.NRArmasGLB.disponivel(tipoArma)) { try { return window.NRArmasGLB.criar(tipoArma); } catch (e) { console.warn('[armas-glb] falhou, usando arma de blocos:', e); } }
    var g = new T.Group(), interno = new T.Group(), celula = null, pos = { x: 0.1, y: 0.34, z: 0.52 }, grips = null;
    g.add(interno);
    function caixa(w, h, d, mat, x, y, z) { var o = new T.Mesh(new T.BoxGeometry(w, h, d), mat); o.position.set(x || 0, y || 0, z || 0); interno.add(o); return o; }
    if (op.katana) {
      var mRubi = new T.MeshBasicMaterial({ color: 0xff2a55 }), mFio = new T.MeshBasicMaterial({ color: 0xffd0da }), mOuro = new T.MeshPhongMaterial({ color: 0xd4a017, shininess: 100, specular: 0xffee99 });
      pos = { x: -0.3, y: 0.28, z: 0.4 };
      caixa(0.07, 0.07, 0.36, m.mJunta, 0, 0, -0.08);
      caixa(0.075, 0.075, 0.07, mRubi, 0, 0, -0.14); caixa(0.075, 0.075, 0.07, mRubi, 0, 0, 0.02);
      caixa(0.22, 0.04, 0.2, mOuro, 0, 0, 0.14);
      caixa(0.05, 0.11, 1.55, mRubi, 0, 0, 0.98); caixa(0.02, 0.02, 1.55, mFio, 0, 0.05, 0.98);
      caixa(0.04, 0.09, 0.14, mRubi, 0, 0, 1.8).rotation.x = 0.5;
      interno.position.z = 0.08;                                              // origem = centro do cabo
      grips = { dir: { x: 0, y: 0, z: 0.16 }, esq: { x: 0, y: 0, z: -0.14 } };
    } else {
      caixa(0.13, 0.2, 0.9, m.mArm2, 0, 0, 0.1); caixa(0.1, 0.1, 0.5, m.mJunta, 0, 0.0, 0.7);
      caixa(0.06, 0.06, 0.18, m.mNeon, 0, 0.0, 1.05); caixa(0.1, 0.14, 0.22, m.mJunta, 0, -0.14, -0.1);
      if (op.rifle) {
        celula = caixa(0.17, 0.24, 0.28, m.mAcento, 0, 0.0, 0.18);
        caixa(0.04, 0.04, 0.8, m.mNeon, -0.09, 0.07, 0.62); caixa(0.04, 0.04, 0.8, m.mNeon, 0.09, 0.07, 0.62); caixa(0.12, 0.1, 0.16, m.mNeon, 0, 0.17, 0.3);
      } else caixa(0.1, 0.08, 0.1, m.mNeon, 0, 0.12, 0.3);
      caixa(0.06, 0.1, 0.1, m.mAcento, 0, 0.14, 0.52);
      interno.scale.setScalar(0.72); interno.position.z = -0.37 * 0.72;      // menor (≈1,05) e centrada, como o rifle .glb
      pos = { x: -0.1, y: 0.45, z: 0.5 };
      grips = { dir: { x: 0, y: -0.14, z: -0.3 }, esq: { x: 0, y: -0.04, z: 0.2 } };
    }
    return { grupo: g, celula: celula, pos: pos, grips: grips };
  }

  // ══════════════════════════════════════════════════════════════
  //  CAÇADOR CYBER (herói, articulado e animado)
  // ══════════════════════════════════════════════════════════════
  // opcoes: { cor: cor do neon (por slot), basico: true = Operador Padrão (cinza, sem neon),
  //           rifle: true = arma plasma comprada }
  function criarCacador(op) {
    op = op || {};
    // se houver um modelo 3D importado (.glb) configurado em heroi-config.js para este personagem, usa ele com a mesma animação
    if (window.NRHeroiGLB && op.persona && window.NRHeroiGLB.disponivel(op.persona)) { try { var g3 = window.NRHeroiGLB.criar(op); if (g3) return g3; } catch (e) { console.warn('[heroi-glb] falhou, usando herói de blocos:', e); } }
    var basico = !!op.basico, fem = !!op.fem, katana = !!op.katana;
    var neon = basico ? 0x7d8794 : (op.cor || 0x2ee6ff), acento = basico ? 0x59616c : (fem ? 0xff2a55 : 0xff3da6);
    var armadura = basico ? 0x4b5360 : (fem ? 0x1c0f22 : 0x141a2e), armadura2 = basico ? 0x626b78 : (fem ? 0x341a3c : 0x1e2742), junta = 0x0c0f1a;
    var mArm = new T.MeshPhongMaterial({ color: armadura, shininess: 70, specular: 0x556677 });
    var mArm2 = new T.MeshPhongMaterial({ color: armadura2, shininess: 60, specular: 0x445566 });
    var mJunta = new T.MeshPhongMaterial({ color: junta, shininess: 10 });
    var mNeon = new T.MeshBasicMaterial({ color: neon });
    var mAcento = new T.MeshBasicMaterial({ color: acento });
    var mVisor = new T.MeshBasicMaterial({ color: basico ? 0xb8c4d0 : 0xffffff });
    function caixa(w, h, d, mat, x, y, z, pai) { var m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x || 0, y || 0, z || 0); pai.add(m); return m; }

    // ═══ ESQUELETO ═══   raiz → corpo → quadril → { coxas → canelas → pés,  tronco → { cabeça, braços, arma, mochila } }
    // (cada junta é um Group: o animador.js só gira as juntas, não sabe nada de caixas)
    var L1 = 0.5, L2 = 0.5, FH = 0.1, HW = fem ? 0.16 : 0.19;
    var raiz = new T.Group(), corpo = new T.Group(); raiz.add(corpo);
    var quadril = new T.Group(); quadril.rotation.order = 'YXZ'; quadril.position.y = 1.05; corpo.add(quadril);
    caixa(0.6, 0.22, 0.38, mArm, 0, -0.04, 0, quadril); caixa(0.62, 0.05, 0.4, mNeon, 0, 0.07, 0, quadril);   // pelve + cinto neon

    // pernas: coxa ('ZXY': roll, pitch, torção) → canela (dobra o joelho) → pé (ângulo do tornozelo)
    function perna(lado) {
      var coxa = new T.Group(); coxa.rotation.order = 'ZXY'; coxa.position.set(lado * HW, -0.02, 0); quadril.add(coxa);
      caixa(0.27, 0.5, 0.3, mArm, 0, -0.26, 0, coxa); caixa(0.29, 0.06, 0.32, mNeon, 0, -0.1, 0.01, coxa);
      var j = new T.Group(); j.position.set(0, -L1, 0); coxa.add(j);
      caixa(0.23, 0.46, 0.26, mArm2, 0, -0.22, -0.02, j); caixa(0.2, 0.16, 0.12, mJunta, 0, -0.04, 0.12, j);
      var pe = new T.Group(); pe.position.set(0, -L2, 0); j.add(pe);                                          // tornozelo
      caixa(0.3, 0.2, 0.44, mArm, 0, 0, 0.06, pe); caixa(0.31, 0.04, 0.46, mNeon, 0, 0.07, 0.06, pe);
      return { coxa: coxa, joelho: j, pe: pe };
    }
    var pernas = [perna(1), perna(-1)];                                                                         // 0 = esquerda (+x), 1 = direita (-x)

    // tronco (coluna): pivô na cintura
    var tronco = new T.Group(); tronco.rotation.order = 'YXZ'; quadril.add(tronco);
    caixa(0.62, 0.34, 0.4, mArm, 0, 0.18, 0, tronco);                 // abdômen
    caixa(0.7, 0.46, 0.46, mArm, 0, 0.6, 0, tronco);                  // peito
    caixa(0.5, 0.3, 0.1, mArm2, 0, 0.64, 0.26, tronco);               // placa do peito
    caixa(0.34, 0.05, 0.04, mNeon, 0, 0.7, 0.32, tronco); caixa(0.34, 0.05, 0.04, mNeon, 0, 0.58, 0.32, tronco);
    var nucleo = caixa(0.14, 0.14, 0.05, mAcento, 0, 0.64, 0.31, tronco); // núcleo no peito (pulsa)
    // mochila com reator (grupo próprio: balança por inércia)
    var mochila = new T.Group(); mochila.position.set(0, 0.55, -0.3); tronco.add(mochila);
    caixa(0.44, 0.52, 0.22, mArm2, 0, 0, -0.04, mochila);
    caixa(0.1, 0.4, 0.06, mNeon, -0.12, 0, -0.16, mochila); caixa(0.1, 0.4, 0.06, mNeon, 0.12, 0, -0.16, mochila);
    caixa(0.06, 0.2, 0.06, mAcento, -0.2, 0.35, -0.04, mochila); caixa(0.06, 0.2, 0.06, mAcento, 0.2, 0.35, -0.04, mochila);

    // cabeça (com pescoço): capacete e visor (Caçador) ou rosto + cabelo + rabo de cavalo (Kunoichi)
    var cabeca = new T.Group(); cabeca.rotation.order = 'YXZ'; cabeca.position.set(0, 0.9, 0); tronco.add(cabeca);
    caixa(0.14, 0.14, 0.14, mJunta, 0, 0.0, 0, cabeca);                                                        // pescoço
    var cola = [];
    if (fem) {
      var mPele = new T.MeshPhongMaterial({ color: 0xf0c8a6, shininess: 20 }), mCabelo = new T.MeshPhongMaterial({ color: 0x24102c, shininess: 70, specular: 0x6a3a8a }), mCabelo2 = new T.MeshBasicMaterial({ color: 0x7a2a8a });
      caixa(0.34, 0.34, 0.34, mPele, 0, 0.12, 0.02, cabeca);
      caixa(0.38, 0.2, 0.4, mCabelo, 0, 0.27, -0.03, cabeca); caixa(0.38, 0.14, 0.1, mCabelo, 0, 0.2, 0.2, cabeca);
      caixa(0.08, 0.3, 0.3, mCabelo, -0.2, 0.12, -0.04, cabeca); caixa(0.08, 0.3, 0.3, mCabelo, 0.2, 0.12, -0.04, cabeca);
      caixa(0.3, 0.07, 0.04, mNeon, 0, 0.21, 0.23, cabeca); caixa(0.28, 0.06, 0.04, mVisor, 0, 0.1, 0.2, cabeca);
      caixa(0.12, 0.12, 0.1, mAcento, 0, 0.3, -0.24, cabeca);                                                  // laço do rabo
      var prevC = cabeca;
      for (var ci = 0; ci < 6; ci++) {                                                                         // rabo de cavalo LONGO: 6 segmentos com física
        var sg = new T.Group(); sg.position.set(0, ci === 0 ? 0.28 : -0.2, ci === 0 ? -0.3 : -0.04); prevC.add(sg);
        caixa(0.16 - ci * 0.015, 0.24, 0.14 - ci * 0.012, ci % 2 ? mCabelo : mCabelo2, 0, -0.1, 0, sg); cola.push(sg); prevC = sg;
      }
    } else {
      caixa(0.4, 0.4, 0.42, mArm, 0, 0.12, 0, cabeca); caixa(0.36, 0.13, 0.06, mVisor, 0, 0.14, 0.22, cabeca);
      caixa(0.42, 0.04, 0.3, mNeon, 0, 0.3, 0.02, cabeca); caixa(0.07, 0.2, 0.34, mNeon, 0, 0.36, -0.04, cabeca);
      caixa(0.06, 0.3, 0.06, mAcento, -0.24, 0.1, -0.06, cabeca); caixa(0.06, 0.3, 0.06, mAcento, 0.24, 0.1, -0.06, cabeca);
      if (!basico) caixa(0.05, 0.4, 0.05, mNeon, 0.26, 0.4, -0.12, cabeca);
    }

    // ombros e braços (ombro 'ZXY': pitch + abertura; cotovelo dobra a antebraço)
    function ombro(lado) {
      var o = new T.Group(); o.position.set(lado * 0.46, 0.84, 0); tronco.add(o);
      caixa(0.3, 0.22, 0.38, mArm2, 0, 0.04, 0, o); caixa(0.32, 0.04, 0.4, mNeon, 0, 0.16, 0, o);
      if (!basico) { var f = caixa(0.04, 0.3, 0.2, mNeon, lado * 0.12, 0.28, -0.04, o); f.rotation.z = -lado * 0.5; }
    }
    ombro(-1); ombro(1);
    function braco(lado) {
      var b = new T.Group(); b.rotation.order = 'ZXY'; b.position.set(lado * 0.46, 0.78, 0.02); tronco.add(b);
      caixa(0.2, 0.4, 0.22, mArm, 0, -0.18, 0, b);
      var ant = new T.Group(); ant.position.set(0, -0.38, 0); b.add(ant);
      caixa(0.18, 0.36, 0.2, mArm2, 0, -0.16, 0, ant); caixa(0.2, 0.18, 0.22, mJunta, 0, -0.38, 0, ant); caixa(0.2, 0.04, 0.22, mNeon, 0, -0.04, 0, ant);
      return { b: b, ant: ant, lado: lado };
    }
    var bracos = [braco(1), braco(-1)];                                                                         // 0 = esquerda, 1 = direita

    // ARMA (presa ao tronco, então acompanha a inclinação e o recuo): KATANA RUBI | RIFLE PLASMA — ver criarArma()
    var armaObj = criarArma({ katana: katana, rifle: !!op.rifle, fem: fem }, { mArm2: mArm2, mJunta: mJunta, mNeon: mNeon, mAcento: mAcento });
    var arma = armaObj.grupo, celula = armaObj.celula;
    tronco.add(arma); arma.position.set(armaObj.pos.x, armaObj.pos.y, armaObj.pos.z);
    if (katana) caixa(0.1, 0.5, 0.1, mJunta, 0.34, -0.15, -0.2, tronco).rotation.z = -0.5;                      // bainha vazia na cintura
    else if (fem) caixa(0.1, 0.5, 0.1, mJunta, -0.34, 0.1, -0.1, tronco).rotation.z = 0.5;

    // CACHECOL neon (só do Caçador): corrente com física presa às costas
    var cachecol = [];
    if (!basico && !fem) {
      var prev = tronco;
      for (var i = 0; i < 4; i++) {
        var seg = new T.Group(); seg.position.set(0, i === 0 ? 0.88 : 0, i === 0 ? -0.3 : -0.2); prev.add(seg);
        caixa(0.3 - i * 0.03, 0.06, 0.24, i % 2 ? mAcento : mNeon, 0, 0, -0.1, seg); cachecol.push(seg); prev = seg;
      }
    }

    // anel de brilho e sombra no chão (ficam na raiz, não acompanham o salto do quadril)
    var anel = new T.Mesh(new T.RingGeometry(0.75, 0.95, 28), new T.MeshBasicMaterial({ color: neon, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    anel.rotation.x = -Math.PI / 2; anel.position.y = 0.04; raiz.add(anel);
    var sombra = new T.Mesh(new T.CircleGeometry(0.8, 16), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }));
    sombra.rotation.x = -Math.PI / 2; sombra.position.y = 0.03; raiz.add(sombra);
    if (fem) tronco.scale.x = 0.86;
    raiz.scale.setScalar(1.18);

    // ═══ ANIMAÇÃO: o NRAnimador calcula a pose; aqui só aplicamos nas juntas ═══
    var anim = window.NRAnimador.criar({ L1: L1, L2: L2, fh: FH, hw: HW, nCola: cola.length, nCachecol: cachecol.length, arma: katana ? 'katana' : 'rifle', grips: armaObj.grips, bracoDims: { A1: 0.38, A2: 0.38, SW: 0.46, SY: 0.78, SZ: 0.02 } });
    var est = { giro: 0, neon: neon, pose: anim.pose };
    var vAnt = { x: 0, z: 0 }, pv = new T.Vector3(), mBase = new T.Matrix4(), bx = new T.Vector3(), by = new T.Vector3(), bz = new T.Vector3();

    // dt, t = tempo; vel = velocidade escalar; fx/fz = mira; dashando; vx/vz = velocidade no mundo (opcional)
    function animar(dt, t, vel, fx, fz, dashando, vx, vz, alvo) {
      if (vx === undefined) { vx = 0; vz = 0; }
      var vl = Math.sqrt(vx * vx + vz * vz), dd = dashando && vl > 0.1;
      var p = anim.atualizar(dt, { vx: vx, vz: vz, fx: fx, fz: fz, dash: !!dashando, dashDx: dd ? vx / vl : 0, dashDz: dd ? vz / vl : 0, alvo: alvo || null });
      raiz.rotation.y = p.yawCorpo; est.giro = p.yawCorpo;
      corpo.scale.set(p.escala.x, p.escala.y, p.escala.z);
      var q = p.quadril; quadril.position.set(0, q.y, q.z || 0); quadril.rotation.set(q.pitch, q.yaw, q.roll);
      var c = p.coluna; tronco.rotation.set(c.pitch, c.yaw, c.roll);
      var h = p.cabeca; cabeca.rotation.set(h.pitch, h.yaw, h.roll);
      for (var k = 0; k < 2; k++) {
        var pl = p.perna[k], pj = pernas[k];
        pj.coxa.rotation.set(-pl.pitch, pl.yaw, pl.roll); pj.joelho.rotation.x = pl.joelho; pj.pe.rotation.x = pl.pe;
        var ar = p.braco[k], bj = bracos[k];                                                  // braço: mesma convenção da perna (cinemática inversa até a arma)
        bj.b.rotation.set(-ar.pitch, ar.yaw, ar.roll); bj.ant.rotation.x = ar.flex;
      }
      // arma: posição e orientação vêm da pose (as mãos já foram levadas até ela pela cinemática inversa)
      var wa = p.arma; arma.position.set(wa.x, wa.y, wa.z);
      bx.fromArray(wa.base.x); by.fromArray(wa.base.y); bz.fromArray(wa.base.z); mBase.makeBasis(bx, by, bz); arma.quaternion.setFromRotationMatrix(mBase);
      mochila.rotation.x = p.mochila;
      for (var i = 0; i < cola.length; i++) { cola[i].rotation.x = p.cola[i].x; cola[i].rotation.y = p.cola[i].y; }
      for (var j = 0; j < cachecol.length; j++) { cachecol[j].rotation.x = p.cachecol[j].x; cachecol[j].rotation.y = p.cachecol[j].y; }
      nucleo.scale.setScalar(1 + Math.sin(t * 5) * 0.25);
      if (celula) celula.scale.set(1, 1 + Math.sin(t * 9) * 0.2, 1 + Math.sin(t * 9) * 0.2);
      anel.rotation.z = t * 0.8; anel.material.opacity = 0.4 + Math.sin(t * 3) * 0.12;
      return p;
    }
    // posição no mundo do pé k (para poeira/passos)
    function posPe(k, out) { pernas[k].pe.getWorldPosition(pv); out.x = pv.x; out.y = pv.y - FH * 1.18; out.z = pv.z; return out; }
    return { grupo: raiz, animar: animar, estado: est, anel: anel, cor: neon, posPe: posPe,
      impulso: anim.impulso, recuar: function () { anim.impulso('tiro'); }, golpear: function () { anim.impulso('golpe'); },
      materiais: [mArm, mArm2, mJunta, mNeon, mAcento, mVisor] };
  }

  // ══════════════════════════════════════════════════════════════
  //  CHEFES (grupos animados, poucos na tela, por isso detalhados)
  // ══════════════════════════════════════════════════════════════
  function criarChefe(idx) {
    var g = new T.Group();
    function mat(c, s) { return new T.MeshPhongMaterial({ color: c, shininess: s || 50, specular: 0x667788 }); }
    function glow(c) { return new T.MeshBasicMaterial({ color: c }); }
    function caixa(w, h, d, m, x, y, z, pai) { var o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x || 0, y || 0, z || 0); (pai || g).add(o); return o; }
    var anim = null;

    if (idx === 0) {           // ── TITAN GOLIATH: mecha colossal de punhos gigantes
      var mA = mat(0x3a1a22), mB = mat(0x1d0d12), mG = glow(0xff3344);
      var pernaE = caixa(1.0, 2.0, 1.0, mA, -1.0, 1.0, 0), pernaD = caixa(1.0, 2.0, 1.0, mA, 1.0, 1.0, 0);
      caixa(1.3, 0.4, 1.7, mB, -1.0, 0.2, 0.3); caixa(1.3, 0.4, 1.7, mB, 1.0, 0.2, 0.3);
      var tr = new T.Group(); tr.position.y = 2.6; g.add(tr);
      caixa(3.0, 2.2, 1.9, mA, 0, 0, 0, tr); caixa(1.6, 1.4, 0.2, mB, 0, 0.1, 1.0, tr);
      var nucleo = caixa(0.9, 0.9, 0.25, mG, 0, 0.1, 1.12, tr);
      caixa(0.9, 0.7, 0.9, mB, 0, 1.4, 0.2, tr); caixa(0.7, 0.14, 0.1, mG, 0, 1.45, 0.68, tr);
      caixa(0.4, 1.3, 0.4, mB, -1.0, 1.7, -0.7, tr); caixa(0.4, 1.3, 0.4, mB, 1.0, 1.7, -0.7, tr);   // chaminés
      var bE = new T.Group(); bE.position.set(-2.0, 0.6, 0.1); tr.add(bE);
      var bD = new T.Group(); bD.position.set(2.0, 0.6, 0.1); tr.add(bD);
      [bE, bD].forEach(function (b, i) { var l = i ? 1 : -1; caixa(0.9, 1.7, 0.9, mA, 0, -0.8, 0, b); caixa(1.5, 1.3, 1.5, mB, 0, -2.0, 0.2, b); caixa(1.3, 0.1, 1.3, mG, 0, -1.4, 0.2, b); });
      g.userData.nucleo = nucleo;
      anim = function (dt, t, e) {
        var A = Math.sin(t * 3.2);
        pernaE.rotation.x = A * 0.35; pernaD.rotation.x = -A * 0.35;
        tr.position.y = 2.6 + Math.abs(A) * 0.15; tr.rotation.y = A * 0.08;
        bE.rotation.x = -A * 0.5; bD.rotation.x = A * 0.5;
        if (e.prep) { bE.rotation.x = -2.2; bD.rotation.x = -2.2; tr.rotation.x = 0.25; } else tr.rotation.x = e.carga ? 0.35 : 0;
        nucleo.scale.setScalar(1 + Math.sin(t * 8) * 0.18);
      };
    } else if (idx === 1) {    // ── NEURAL HYDRA: núcleo verde com 3 cabeças-serpente e tentáculos
      var mC = mat(0x16301f), mD = mat(0x0b1a10), mV = glow(0x39ff88);
      var base = caixa(2.2, 0.8, 2.2, mD, 0, 0.4, 0);
      var core = new T.Mesh(new T.OctahedronGeometry(1.0, 0), mV); core.position.y = 1.6; g.add(core);
      var cabecas = [];
      for (var i = 0; i < 3; i++) {
        var pv = new T.Group(); pv.rotation.y = i * 2.094; g.add(pv);
        var seg = [];
        for (var k = 0; k < 5; k++) { var s = caixa(0.5 - k * 0.04, 0.5, 0.5 - k * 0.04, k % 2 ? mC : mD, 0, 0, 0, pv); seg.push(s); }
        var head = new T.Group(); pv.add(head);
        caixa(0.9, 0.55, 1.0, mC, 0, 0, 0.3, head); caixa(0.7, 0.12, 0.2, mV, 0, 0.1, 0.8, head);
        caixa(0.18, 0.4, 0.1, mV, -0.3, 0.0, 0.75, head); caixa(0.18, 0.4, 0.1, mV, 0.3, 0.0, 0.75, head);
        cabecas.push({ pv: pv, seg: seg, head: head, f: i * 2.1 });
      }
      for (var j = 0; j < 6; j++) { var te = new T.Mesh(new T.ConeGeometry(0.22, 2.2, 5), mD); te.position.set(Math.cos(j) * 1.4, 0.4, Math.sin(j) * 1.4); te.rotation.z = Math.cos(j) * 1.1; te.rotation.x = -Math.sin(j) * 1.1; g.add(te); }
      anim = function (dt, t) {
        core.rotation.y = t * 1.4; core.rotation.x = t * 0.7; core.scale.setScalar(1 + Math.sin(t * 6) * 0.12); core.position.y = 1.6 + Math.sin(t * 2) * 0.12;
        cabecas.forEach(function (c) {
          for (var k = 0; k < c.seg.length; k++) {
            var u = k / 4, w = Math.sin(t * 2.5 + c.f + k * 0.7);
            c.seg[k].position.set(w * 0.35 * u, 1.3 + k * 0.55, 0.5 + k * 0.5);
          }
          c.head.position.set(Math.sin(t * 2.5 + c.f + 2.8) * 0.35, 1.3 + 5 * 0.55 - 0.2, 0.5 + 5 * 0.5);
          c.head.rotation.x = 0.4 + Math.sin(t * 3 + c.f) * 0.2;
        });
      };
    } else {                   // ── GLITCH WRAITH: máscara roxa flutuando entre estilhaços orbitando
      var mP = mat(0x1d1033, 80), mM = glow(0xb04dff), mW = glow(0xffffff);
      var mask = new T.Group(); mask.position.y = 2.3; g.add(mask);
      caixa(1.5, 1.8, 0.7, mP, 0, 0, 0, mask);
      caixa(1.0, 0.18, 0.2, mM, 0, 0.35, 0.4, mask); caixa(0.12, 0.8, 0.2, mM, 0, -0.35, 0.4, mask);
      caixa(0.3, 0.3, 0.1, mW, -0.38, 0.35, 0.42, mask); caixa(0.3, 0.3, 0.1, mW, 0.38, 0.35, 0.42, mask);
      var capa = []; for (var q = 0; q < 6; q++) { var cp = caixa(0.9 - q * 0.1, 0.3, 0.12, mP, 0, 1.2 - q * 0.38, -0.2 - q * 0.05, g); capa.push(cp); cp.position.y = 1.6 - q * 0.38; }
      var shards = []; for (var s2 = 0; s2 < 9; s2++) { var sh = new T.Mesh(new T.TetrahedronGeometry(0.34, 0), s2 % 2 ? mM : mP); g.add(sh); shards.push(sh); }
      var halo = new T.Mesh(new T.TorusGeometry(1.5, 0.05, 6, 28), mM); halo.rotation.x = Math.PI / 2; halo.position.y = 2.3; g.add(halo);
      anim = function (dt, t) {
        mask.position.y = 2.3 + Math.sin(t * 2) * 0.25; mask.rotation.y = Math.sin(t * 1.3) * 0.25;
        halo.position.y = mask.position.y; halo.rotation.z = t * 1.5;
        for (var i = 0; i < shards.length; i++) { var a = t * (1.2 + i * 0.06) + i * 0.7; shards[i].position.set(Math.cos(a) * (1.8 + (i % 3) * 0.4), 1.2 + Math.sin(a * 1.7) * 0.8 + i * 0.12, Math.sin(a) * (1.8 + (i % 3) * 0.4)); shards[i].rotation.set(a, a * 1.3, 0); }
        for (var k = 0; k < capa.length; k++) { capa[k].position.x = Math.sin(t * 3 - k * 0.6) * 0.25; }
      };
    }
    return { grupo: g, animar: anim };
  }

  // ══════════════════════════════════════════════════════════════
  //  DRONE ORBITAL do jogador e ITENS DO CHÃO
  // ══════════════════════════════════════════════════════════════
  function criarDrone(cor) {
    var g = new T.Group();
    var m1 = new T.MeshPhongMaterial({ color: 0x222a3a, shininess: 80 }), m2 = new T.MeshBasicMaterial({ color: cor || 0xffd23d });
    var corpo = new T.Mesh(new T.OctahedronGeometry(0.34, 0), m1); corpo.scale.set(1, 0.6, 1); g.add(corpo);
    var olho = new T.Mesh(new T.SphereGeometry(0.13, 8, 6), m2); olho.position.set(0, -0.05, 0.22); g.add(olho);
    var aro = new T.Mesh(new T.TorusGeometry(0.42, 0.035, 6, 16), m2); aro.rotation.x = Math.PI / 2; g.add(aro);
    g.userData.aro = aro;
    return g;
  }
  // kind: 1 cura, 2 ímã, 3 bomba, 4 cápsula
  function criarItem(kind) {
    var g = new T.Group();
    function m(c) { return new T.MeshBasicMaterial({ color: c }); }
    if (kind === 1) {          // cura: cruz verde
      g.add(new T.Mesh(new T.BoxGeometry(0.7, 0.22, 0.22), m(0x39ff88))); g.add(new T.Mesh(new T.BoxGeometry(0.22, 0.7, 0.22), m(0x39ff88)));
      var b = new T.Mesh(new T.BoxGeometry(0.9, 0.9, 0.12), new T.MeshBasicMaterial({ color: 0x0a3a1a })); b.position.z = -0.12; g.add(b);
    } else if (kind === 2) {   // ímã: ferradura
      var t = new T.Mesh(new T.TorusGeometry(0.34, 0.13, 6, 12, Math.PI), m(0xb04dff)); g.add(t);
      var a = new T.Mesh(new T.BoxGeometry(0.26, 0.2, 0.26), m(0xffffff)); a.position.set(-0.34, 0, 0); g.add(a);
      var c = a.clone(); c.position.x = 0.34; g.add(c);
    } else if (kind === 3) {   // bomba
      g.add(new T.Mesh(new T.SphereGeometry(0.4, 10, 8), m(0xff6a1a)));
      var p = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 0.25, 6), m(0xffffff)); p.position.y = 0.45; g.add(p);
    } else {                   // cápsula de suprimentos: caixa dourada com feixe de luz
      var cx = new T.Mesh(new T.BoxGeometry(0.9, 0.7, 0.9), new T.MeshPhongMaterial({ color: 0xc89b1e, shininess: 90, specular: 0xffee99 })); g.add(cx);
      var f = new T.Mesh(new T.BoxGeometry(0.95, 0.12, 0.95), m(0xffd23d)); f.position.y = 0.2; g.add(f);
      var l = new T.Mesh(new T.BoxGeometry(0.2, 0.2, 0.2), m(0xffffff)); l.position.y = 0.45; g.add(l);
      var feixe = new T.Mesh(new T.CylinderGeometry(0.35, 0.6, 9, 10, 1, true), new T.MeshBasicMaterial({ color: 0xffd23d, transparent: true, opacity: 0.22, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
      feixe.position.y = 4.5; g.add(feixe);
    }
    return g;
  }

  // InstancedMesh com cor por instância. ATENÇÃO: o buffer de cores precisa nascer com o tamanho MÁXIMO
  // (se criado depois de count=0, ele nasce vazio e tudo sai preto/invisível — foi o bug dos inimigos/balas/gemas).
  function instanciado(geo, mat, max, comCor) {
    var m = new T.InstancedMesh(geo, mat, max);
    if (comCor) m.instanceColor = new T.InstancedBufferAttribute(new Float32Array(max * 3).fill(1), 3);
    m.frustumCulled = false; m.count = 0;
    return m;
  }

  window.NRModelos = {
    instanciado: instanciado, Construtor: Construtor, INIMIGOS_MODELOS: INIMIGOS_MODELOS, geoGema: geoGema, geoPlasma: geoPlasma,
    criarCacador: criarCacador, criarArma: criarArma, criarChefe: criarChefe, criarDrone: criarDrone, criarItem: criarItem, texturaGlow: texturaGlow,
  };
})();
