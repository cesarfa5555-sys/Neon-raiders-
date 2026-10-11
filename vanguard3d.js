// ══════════════════════════════════════════════════════════════════
// VANGUARD3D.JS — modelo 3D da NR-01 Vanguard + fogo das turbinas
//
// Portado do new-vanguard.html (o visualizador do modelo). Usado por
// boss3d.js e boss3d-evento.js: os dois chamam createShipVanguard()
// quando a nave equipada é a "vanguard" (via NAVES_MODELOS_3D) e
// atualizarFogoVanguard() a cada frame do loop principal.
//
// PEÇAS CUSTOMIZÁVEIS: cada uma das 5 peças (bico, asas, pontaAsa,
// cauda, casco) tem materiais próprios. createShipVanguard() já aplica
// as skins equipadas (lidas do vanguard-core.js): a paleta da skin
// recolore só a peça dela, `transformar` estica a peça (Ogiva Sniper
// alonga o bico, asas Turbo alargam, casco Titânio engrossa) e a
// paleta da cauda também pinta o fogo das turbinas.
//
// Carregar DEPOIS do three.js e ANTES do boss3d*.js (game3d.html e
// game3d-evento.html). Não usa type="module" (mesma regra do resto
// do jogo — Spck Editor precisa de tudo em escopo global).
//
// ORIENTAÇÃO: no visualizador o bico apontava pra +Z. No jogo a frente
// é -Z (tiros, inimigos e escudo vão pra -Z, a câmera fica em +Z), então
// o modelo é girado 180° dentro de um grupo-raiz. As chamas saem por
// trás do modelo, ou seja, na direção da câmera. Se a nave aparecer
// de costas no aparelho, é só trocar VG3D_VIRAR_FRENTE pra false.
// ══════════════════════════════════════════════════════════════════

(function () {

  // ── AJUSTES RÁPIDOS ──────────────────────────────────────────────
  const VG3D_ESCALA = 0.75;        // tamanho no jogo (as outras naves usam 0.5 a 0.85)
  const VG3D_VIRAR_FRENTE = true;  // gira o modelo 180° pro bico apontar pra -Z

  // ╔══════════════════════════════════════════════════════════════╗
  // ║  MODO TESTE — pra VER o bico e as peças na partida.          ║
  // ║  A câmera fica atrás da nave e o bico aponta pra longe, então ║
  // ║  ele some atrás da cabine. Com o modo ligado a nave é         ║
  // ║  "deitada" pra mostrar o topo pra câmera (vista de cima, como ║
  // ║  na arte 2D). Só o visual muda — hitbox e controles são os    ║
  // ║  mesmos.                                                      ║
  // ║                                                               ║
  // ║  >>> PRA VOLTAR AO NORMAL: troque `true` por `false` <<<      ║
  // ╚══════════════════════════════════════════════════════════════╝
  const VG3D_MODO_TESTE = false;
  const VG3D_TESTE_INCLINACAO = 1.05;  // ~60°: topo da nave virado pra câmera

  // Fogo: no visualizador eram 180 partículas (180 draw calls por
  // frame). No jogo, com inimigos, tiros e escudo, isso pesa no
  // celular — por isso o padrão aqui é 60 (30 por turbina). Se
  // sobrar FPS no seu aparelho, é só aumentar `quantidade`.
  const FOGO = {
    quantidade: 60, velocidade: 3.5,
    dispersao: 0.38, turbulencia: 1.8, gravidade: 0.12,
    vidaMin: 0.35, vidaMax: 0.75, tamanhoMin: 0.035,
    tamanhoMax: 0.11, variacaoVelocidade: 0.7,
  };
  // Degradê padrão do fogo (roxo → magenta). Uma skin de cauda troca as
  // duas pontas pelas cores dela (paleta.cyan = ponta fria, paleta.magenta = quente)
  const FOGO_FRIA_PADRAO = 0x6600ff;
  const FOGO_QUENTE_PADRAO = 0xf000ff;
  const FOGO_TONS = 4;

  const PARTES = ['bico', 'asas', 'pontaAsa', 'cauda', 'casco'];

  // Skins que só têm cores brilhantes (cyan/magenta) pintavam só os
  // detalhes. Aqui a peça INTEIRA é puxada pra cor da paleta:
  // [chave da paleta, força 0..1]. A cauda fica de fora de propósito.
  const TINGE = {
    bico: { casco: ['magenta', 0.70] },
    asas: { casco: ['magenta', 0.65], claro: ['cyan', 0.60] },
  };

  // Visual 3D dos cascos: as cores 2D (#3a3a45 / #7d8899) quase não se
  // distinguem do casco padrão numa nave pequena vista de trás, então o
  // 3D usa cores bem mais fortes + chapas de blindagem nas laterais.
  const VISUAL3D = {
    casco_blindado: { casco: '#66788c', claro: '#b8c6d6', ciano: '#ffb020', magenta: '#ffb020', placas: 'blindado' },
    casco_titanio:  { casco: '#a9b8c9', claro: '#f0f6ff', ciano: '#7fd4ff', magenta: '#7fd4ff', placas: 'titanio' },
  };

  // Ponto (em Z do modelo) que fica parado quando a peça é esticada.
  // Bico: a base dele encosta no casco em z≈0.6 — esticar por aí
  // alonga só a ponta em vez de afastar o bico do corpo.
  const PIVO_Z = { bico: 0.6 };

  // ── MATERIAIS (um conjunto por peça — assim a skin de uma peça
  //    nunca pinta a vizinha) ─────────────────────────────────────
  function criarMateriais() {
    return {
      casco:   new THREE.MeshStandardMaterial({ color: 0x2b2e38, roughness: 0.4, metalness: 0.2, flatShading: true }),
      claro:   new THREE.MeshStandardMaterial({ color: 0xdcdceb, roughness: 0.3, metalness: 0.1, flatShading: true }),
      vidro:   new THREE.MeshStandardMaterial({ color: 0x0033aa, roughness: 0.1, metalness: 0.8, flatShading: true }),
      magenta: new THREE.MeshStandardMaterial({ color: 0xff00cc, emissive: 0xff00cc, emissiveIntensity: 3.0, flatShading: true }),
      ciano:   new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00f0ff, emissiveIntensity: 3.0, flatShading: true }),
      motor:   new THREE.MeshBasicMaterial({ color: 0xdd00ff }),
    };
  }

  // ── PARTICULAS DO FOGO ───────────────────────────────────────────
  const fogoGeo = new THREE.IcosahedronGeometry(1, 0);

  function criarParticulaFogo(turbina, lista) {
    // material por partícula: cada uma tem a própria opacidade (some aos poucos)
    const tom = Math.floor(Math.random() * FOGO_TONS);
    const material = new THREE.MeshBasicMaterial({ color: FOGO_FRIA_PADRAO, transparent: true, opacity: 1 });
    const p = new THREE.Mesh(fogoGeo, material);
    p.userData.velocidade = new THREE.Vector3();
    p.userData.fase = Math.random() * Math.PI * 2;
    p.userData.tom = tom;
    reciclarParticula(p, true);
    turbina.add(p);
    lista.push(p);
  }

  function reciclarParticula(p, inicial) {
    p.position.set((Math.random() - 0.5) * 0.30, (Math.random() - 0.5) * 0.25, -0.62);
    p.userData.velocidade.set(
      (Math.random() - 0.5) * FOGO.dispersao,
      (Math.random() - 0.5) * FOGO.dispersao,
      -FOGO.velocidade * (inicial ? (1 - FOGO.variacaoVelocidade * 0.5 + Math.random() * FOGO.variacaoVelocidade)
                                  : (0.65 + Math.random() * 0.7))
    );
    p.userData.vida = FOGO.vidaMin + Math.random() * (FOGO.vidaMax - FOGO.vidaMin);
    p.userData.vidaMax = p.userData.vida;
    const t = FOGO.tamanhoMin + Math.random() * (FOGO.tamanhoMax - FOGO.tamanhoMin);
    p.scale.set(t, t, t * (1.5 + Math.random() * 2));
    p.material.opacity = 0.75 + Math.random() * 0.25;
  }

  // Pinta o degradê do fogo: tom 0 = corFria ... tom 3 = corQuente
  function pintarFogo(nave, corFria, corQuente) {
    const lista = nave.userData.fogo || [];
    const a = new THREE.Color(corFria), b = new THREE.Color(corQuente);
    const tons = [];
    for (let i = 0; i < FOGO_TONS; i++) tons.push(a.clone().lerp(b, i / (FOGO_TONS - 1)));
    lista.forEach(p => p.material.color.copy(tons[p.userData.tom]));
  }

  // Chamado a cada frame pelo boss3d.js / boss3d-evento.js
  function atualizarFogoVanguard(nave, delta, tempo) {
    const lista = nave && nave.userData && nave.userData.fogo;
    if (!lista) return;
    for (let i = 0; i < lista.length; i++) {
      const p = lista[i];
      const u = p.userData;
      p.position.addScaledVector(u.velocidade, delta);
      u.velocidade.x += Math.sin(tempo * 15 + u.fase) * FOGO.turbulencia * delta;
      u.velocidade.y += Math.cos(tempo * 18 + u.fase) * FOGO.turbulencia * delta;
      u.velocidade.y -= FOGO.gravidade * delta;
      u.velocidade.multiplyScalar(0.985);
      u.vida -= delta;
      const progresso = 1 - (u.vida / u.vidaMax);
      const fator = 1 - progresso * 0.75;
      const base = FOGO.tamanhoMin + (FOGO.tamanhoMax - FOGO.tamanhoMin) * fator;
      p.scale.x = base * (0.8 + Math.sin(tempo * 25 + u.fase) * 0.2);
      p.scale.y = base * (0.8 + Math.cos(tempo * 23 + u.fase) * 0.2);
      p.scale.z = base * (1.5 + Math.random() * 0.4);
      p.material.opacity = Math.max(0, 1 - progresso);
      p.rotation.x += delta * 8; p.rotation.y += delta * 11; p.rotation.z += delta * 6;
      if (u.vida <= 0) reciclarParticula(p, false);
    }
  }

  // ── TURBINA ──────────────────────────────────────────────────────
  function criarTurbina(x, m) {
    const g = new THREE.Group();
    g.userData.isEngine = true;

    const cilGeo = new THREE.CylinderGeometry(0.30, 0.32, 1.1, 8);
    cilGeo.rotateX(Math.PI / 2);
    g.add(new THREE.Mesh(cilGeo, m.casco));

    const anelGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.25, 8);
    anelGeo.rotateX(Math.PI / 2);
    const anel = new THREE.Mesh(anelGeo, m.claro);
    anel.position.z = 0.18;
    g.add(anel);

    const brilhoGeo = new THREE.CylinderGeometry(0.24, 0.1, 0.15, 8);
    brilhoGeo.rotateX(Math.PI / 2);
    const brilho = new THREE.Mesh(brilhoGeo, m.motor);
    brilho.position.z = -0.58;
    g.add(brilho);

    g.position.set(x, 0.12, -0.85);
    return g;
  }

  // ── ASA + PONTA DE ASA ───────────────────────────────────────────
  // Devolve dois grupos (mesmo deslocamento em Z): a asa em si (peça
  // "asas") e a ponta (peça "pontaAsa": faixa ciano + lâmina na ponta).
  function criarAsa(lado, mAsa, mPonta) {
    const g = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.2); shape.lineTo(1.4 * lado, -0.4);
    shape.lineTo(1.3 * lado, -1.0); shape.lineTo(0, -0.5); shape.closePath();

    const asaGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 });
    asaGeo.rotateX(Math.PI / 2);
    g.add(new THREE.Mesh(asaGeo, mAsa.casco));

    // fio de luz ao longo da borda de ataque — é o que a paleta "cyan"
    // das skins de asa pinta (a faixa ciano original foi pra ponta de asa)
    const borda = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.03, 0.05), mAsa.ciano);
    borda.position.set(0.7 * lado, 0.035, -0.13); borda.rotation.y = 0.405 * lado;
    g.add(borda);

    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.55), mAsa.magenta);
    mag.position.set(0.65 * lado, 0.02, -0.4); mag.rotation.y = -0.32 * lado;
    g.add(mag);

    const fin = (function () {
      const finShape = new THREE.Shape();
      finShape.moveTo(0, 0); finShape.lineTo(0, 0.55); finShape.lineTo(-0.4, 0.45); finShape.lineTo(-0.6, 0); finShape.closePath();
      const f = new THREE.Mesh(new THREE.ExtrudeGeometry(finShape, { depth: 0.06, bevelEnabled: false }), mAsa.claro);
      f.position.set(0.48 * lado, 0.08, -0.50); f.rotation.y = Math.PI / 2;
      return f;
    })();
    g.add(fin);
    g.position.z = 0.50;

    // PONTA DE ASA
    const ponta = new THREE.Group();

    // faixa ciano (era da asa; agora é da ponta)
    const cyan = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.08), mPonta.ciano);
    cyan.position.set(1.05 * lado, 0.02, -0.7); cyan.rotation.y = -0.32 * lado;
    ponta.add(cyan);

    // garra da ponta: lâmina grande pra fora/pra trás (casco + miolo
    // ciano) e uma presa menor pra frente (claro), formando um "V"
    // aberto na quina da asa
    function lamina(pts, prof, mat, y) {
      const sh = new THREE.Shape();
      sh.moveTo(pts[0][0] * lado, pts[0][1]);
      sh.lineTo(pts[1][0] * lado, pts[1][1]);
      sh.lineTo(pts[2][0] * lado, pts[2][1]);
      sh.closePath();
      const geo = new THREE.ExtrudeGeometry(sh, { depth: prof, bevelEnabled: false });
      geo.rotateX(Math.PI / 2);
      const m = new THREE.Mesh(geo, mat);
      m.position.y = y;
      return m;
    }
    ponta.add(lamina([[1.28, -0.30], [1.80, -1.06], [1.20, -0.92]], 0.06, mPonta.casco, 0));
    ponta.add(lamina([[1.34, -0.42], [1.66, -0.92], [1.26, -0.84]], 0.04, mPonta.ciano, 0.045));
    ponta.add(lamina([[1.16, -0.32], [1.64, -0.40], [1.30, -0.55]], 0.05, mPonta.claro, 0.01));

    // conector entre a asa e a garra
    const conector = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.2), mPonta.claro);
    conector.position.set(1.30 * lado, -0.02, -0.55);
    ponta.add(conector);

    ponta.position.z = 0.50;
    return { asa: g, ponta: ponta };
  }

  // ── CHAPAS DE BLINDAGEM (casco Blindado / Titânio) ────────────────
  // Ficam escondidas no casco padrão; a skin liga o grupo certo.
  function criarPlacas(tipo, m) {
    const g = new THREE.Group();
    g.visible = false;
    const titanio = tipo === 'titanio';
    const c = titanio ? { l: 0.20, a: 0.26, comp: 1.15, x: 0.52, y: 0.12, z: 0.0 }
                      : { l: 0.16, a: 0.20, comp: 0.95, x: 0.50, y: 0.10, z: 0.05 };
    [1, -1].forEach(lado => {
      const placa = new THREE.Mesh(new THREE.BoxGeometry(c.l, c.a, c.comp), m.casco);
      placa.position.set(c.x * lado, c.y, c.z);
      g.add(placa);
      // listra de luz na face de fora
      const listra = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.035, c.comp * 0.75), m.ciano);
      listra.position.set((c.x + c.l / 2) * lado, c.y + 0.03, c.z);
      g.add(listra);
      if (titanio) {
        // segunda chapa por fora, mais baixa e mais curta
        const extra = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.12, 0.80), m.claro);
        extra.position.set((c.x + 0.16) * lado, 0.06, -0.05);
        g.add(extra);
      }
    });
    return g;
  }

  // ── SKINS (paleta + forma) ───────────────────────────────────────
  // paleta da skin (chaves do vanguard-core.js): cyan → material ciano
  // (cor + brilho), magenta → material magenta, azulClaro → material
  // "claro" (módulos brancos), casco → material do casco.
  function aplicarSkinVanguard(nave, parte, skin) {
    const ud = nave.userData;
    if (!ud.mats || !ud.mats[parte]) return;
    const m = ud.mats[parte];
    const def = ud.coresPadrao[parte];
    const pal = (skin && skin.paleta) || {};

    m.casco.color.set(pal.casco !== undefined ? pal.casco : def.casco);
    m.claro.color.set(pal.azulClaro !== undefined ? pal.azulClaro : def.claro);
    const ciano = pal.cyan !== undefined ? pal.cyan : def.ciano;
    m.ciano.color.set(ciano); m.ciano.emissive.set(ciano);
    const mag = pal.magenta !== undefined ? pal.magenta : def.magenta;
    m.magenta.color.set(mag); m.magenta.emissive.set(mag);

    // pinta a peça inteira (não só os detalhes brilhantes)
    const tg = TINGE[parte];
    if (tg) {
      Object.keys(tg).forEach(alvo => {
        const chave = tg[alvo][0], forca = tg[alvo][1];
        const chaveProprio = alvo === 'claro' ? 'azulClaro' : 'casco';
        if (pal[chave] !== undefined && pal[chaveProprio] === undefined) {
          const c = new THREE.Color(def[alvo]);
          c.lerp(new THREE.Color(pal[chave]), forca);
          m[alvo].color.copy(c);
        }
      });
    }

    // cascos: cores fortes + chapas de blindagem (só no 3D)
    if (parte === 'casco') {
      const v = skin && VISUAL3D[skin.id];
      if (v) {
        m.casco.color.set(v.casco);
        m.claro.color.set(v.claro);
        m.ciano.color.set(v.ciano); m.ciano.emissive.set(v.ciano);
        m.magenta.color.set(v.magenta); m.magenta.emissive.set(v.magenta);
      }
      Object.keys(ud.placas).forEach(tipo => { ud.placas[tipo].visible = !!(v && v.placas === tipo); });
    }

    if (parte === 'cauda') {
      m.motor.color.set(pal.magenta !== undefined ? pal.magenta : def.motor);
      pintarFogo(nave,
        pal.cyan !== undefined ? pal.cyan : FOGO_FRIA_PADRAO,
        pal.magenta !== undefined ? pal.magenta : FOGO_QUENTE_PADRAO);
    }

    // forma: escalaX = largura, escalaY = comprimento (eixo Z do modelo)
    const t = (skin && skin.transformar) || {};
    const g = ud.partes[parte];
    const sx = t.escalaX || 1, sz = t.escalaY || 1;
    g.scale.x = sx;
    g.scale.z = sz;
    const pivo = PIVO_Z[parte] || 0;
    g.position.z = pivo * (1 - sz);
  }

  // Aplica as 5 skins de uma vez. `skins` = { bico: skin, asas: skin, ... };
  // sem argumento, lê as equipadas do vanguard-core.js (localStorage).
  function aplicarSkinsVanguard(nave, skins) {
    PARTES.forEach(parte => {
      let skin = skins && skins[parte];
      if (!skin && !skins && typeof vanguardGetSkinEquipada === 'function') {
        try { skin = vanguardGetSkinEquipada(parte); } catch (e) { skin = null; }
      }
      aplicarSkinVanguard(nave, parte, skin);
    });
  }

  // ── NAVE COMPLETA ────────────────────────────────────────────────
  // Devolve o grupo-raiz que o jogo move/inclina/escala (mesmo contrato
  // das outras createShipXxx). userData.partes = grupos de cada peça,
  // userData.mats = materiais de cada peça.
  function createShipVanguard() {
    const M = {};
    PARTES.forEach(p => { M[p] = criarMateriais(); });
    const modelo = new THREE.Group();

    const partes = {};
    PARTES.forEach(p => { partes[p] = new THREE.Group(); partes[p].name = 'vanguard_' + p; });
    // a ponta de asa fica DENTRO do grupo das asas: alargar as asas
    // (skin Turbo) leva as pontas junto
    partes.asas.add(partes.pontaAsa);
    ['bico', 'casco', 'asas', 'cauda'].forEach(p => modelo.add(partes[p]));

    // BICO FRONTAL
    const mb = M.bico;
    const noseShape = new THREE.Shape();
    noseShape.moveTo(-0.25, 0); noseShape.lineTo(0.25, 0);
    noseShape.lineTo(0.45, -0.7); noseShape.lineTo(-0.45, -0.7); noseShape.closePath();
    const noseGeo = new THREE.ExtrudeGeometry(noseShape, { depth: 0.28, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 1 });
    noseGeo.rotateX(Math.PI / 2);
    const nose = new THREE.Mesh(noseGeo, mb.casco);
    nose.position.set(0, -0.05, 1.3);
    partes.bico.add(nose);

    const noseLight = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.08), mb.ciano);
    noseLight.position.set(0, -0.20, 1.39);
    partes.bico.add(noseLight);

    // CABINE / CANOPY
    const glassGeo = new THREE.BufferGeometry();
    glassGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      -0.2, 0.0, 1.2,  0.2, 0.0, 1.2,  0.0, 0.35, 0.8,
      -0.2, 0.0, 1.2,  0.0, 0.35, 0.8, -0.35, 0.0, 0.1,
      -0.0, 0.35, 0.8, -0.3, 0.45, 0.1, -0.35, 0.0, 0.1,
       0.0, 0.35, 0.8,  0.2, 0.0, 1.2,  0.35, 0.0, 0.1,
       0.0, 0.35, 0.8,  0.35, 0.0, 0.1,  0.3, 0.45, 0.1,
      -0.3, 0.45, 0.1,  0.0, 0.35, 0.8,  0.3, 0.45, 0.1,
    ]), 3));
    glassGeo.computeVertexNormals();
    const glass = new THREE.Mesh(glassGeo, mb.vidro);
    glass.position.set(0, 0, 0.1);
    partes.bico.add(glass);

    // FUSELAGEM CENTRAL
    const mc = M.casco;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.4, 1.4), mc.casco);
    body.position.set(0, 0.05, 0.0);
    partes.casco.add(body);

    // MÓDULO BRANCO DO TOPO + EMBLEMA "V"
    const topPlate = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.22, 0.7), mc.claro);
    topPlate.position.set(0, 0.3, -0.2);
    partes.casco.add(topPlate);

    const logo = new THREE.Group();
    const logoGeo = new THREE.BoxGeometry(0.05, 0.02, 0.18);
    const logoEsq = new THREE.Mesh(logoGeo, mc.magenta);
    logoEsq.position.set(-0.06, 0, 0); logoEsq.rotation.y = -0.6;
    const logoDir = new THREE.Mesh(logoGeo, mc.magenta);
    logoDir.position.set(0.06, 0, 0); logoDir.rotation.y = 0.6;
    logo.add(logoEsq); logo.add(logoDir);
    logo.position.set(0, 0.42, -0.05);
    partes.casco.add(logo);

    // chapas de blindagem (escondidas até uma skin de casco ligar)
    const placas = { blindado: criarPlacas('blindado', mc), titanio: criarPlacas('titanio', mc) };
    partes.casco.add(placas.blindado);
    partes.casco.add(placas.titanio);

    // ASAS + PONTAS
    [1, -1].forEach(lado => {
      const r = criarAsa(lado, M.asas, M.pontaAsa);
      partes.asas.add(r.asa);
      partes.pontaAsa.add(r.ponta);
    });

    // TURBINAS + FOGO
    const turbinas = [criarTurbina(-0.38, M.cauda), criarTurbina(0.38, M.cauda)];
    turbinas.forEach(t => partes.cauda.add(t));
    const fogo = [];
    const porTurbina = Math.max(1, Math.floor(FOGO.quantidade / turbinas.length));
    turbinas.forEach(t => { for (let i = 0; i < porTurbina; i++) criarParticulaFogo(t, fogo); });

    // RAIZ: gira o modelo pro bico apontar pra -Z (frente do jogo)
    if (VG3D_VIRAR_FRENTE) modelo.rotation.y = Math.PI;
    if (VG3D_MODO_TESTE) modelo.rotation.x = VG3D_TESTE_INCLINACAO; // ver o bico (apagar/false pra voltar ao normal)
    const raiz = new THREE.Group();
    raiz.add(modelo);
    raiz.scale.set(VG3D_ESCALA, VG3D_ESCALA, VG3D_ESCALA);
    raiz.userData.fogo = fogo;
    raiz.userData.partes = partes;
    raiz.userData.mats = M;
    raiz.userData.placas = placas;
    // cores de fábrica de cada peça (pra poder voltar ao padrão ao trocar de skin)
    raiz.userData.coresPadrao = {};
    PARTES.forEach(p => {
      raiz.userData.coresPadrao[p] = {
        casco: M[p].casco.color.getHex(), claro: M[p].claro.color.getHex(),
        ciano: M[p].ciano.color.getHex(), magenta: M[p].magenta.color.getHex(),
        motor: M[p].motor.color.getHex(),
      };
    });

    // fogo nasce no degradê roxo padrão; a skin da cauda (se houver) repinta
    pintarFogo(raiz, FOGO_FRIA_PADRAO, FOGO_QUENTE_PADRAO);
    // skins equipadas (se o vanguard-core.js estiver carregado na página)
    aplicarSkinsVanguard(raiz);
    return raiz;
  }

  window.createShipVanguard = createShipVanguard;
  window.atualizarFogoVanguard = atualizarFogoVanguard;
  window.aplicarSkinsVanguard = aplicarSkinsVanguard;
})();
