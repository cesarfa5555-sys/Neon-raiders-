// ══════════════════════════════════════════════════════════════════
// PLASMA.JS — a NAVE DE PLASMA (tiro carregado) + o PILOTO
// Carregado ANTES do boss3d.js (game3d.html), igual ao vanguard3d.js.
//
// COMO A NAVE FUNCIONA
//   • Ela NÃO tem tiro comum. Para atirar, o jogador SEGURA o botão de atirar por 3 segundos.
//   • Enquanto segura, um som de plasma carregando vai ficando mais agudo, mais forte e mais rápido, uma bola de plasma
//     cresce na frente da nave e um anel enche em volta do botão de atirar.
//   • Aos 3 s o tiro de plasma sai ("tuUuUUUuU"): atinge METADE dos inimigos que estão na tela (sorteados) com dano
//     absurdo, e a nave se CURA a cada disparo. Se continuar segurando, já começa a carregar o próximo.
//   • Soltou antes de 3 s? A carga se perde (um "fiuuu" curtinho avisa).
//   • No PvP a habilidade fica desligada (lá só existem tiros normais, decididos pelo servidor): a nave vira uma nave comum.
//
// COMO MEXER NO EQUILÍBRIO: é só mudar os números de PLASMA_CFG logo abaixo.
//
// MODELOS 3D (coloque os arquivos na pasta do jogo; enquanto não existirem, aparece uma nave provisória):
//   nave-plasma.glb     → o modelo da nave (se ficar torto/gigante/pequeno, ajuste tamanho e giroY em PLASMA_CFG)
//   pilot_low_poly_character.glb → o piloto (com esqueleto): aparece SENTADO na nave durante a partida e em pé no cartão do hangar
// ══════════════════════════════════════════════════════════════════
var PLASMA_CFG = {
  id: 'plasma',               // id da nave (o mesmo usado no loja.js e na naveAtual)
  tempoCarga: 3.0,            // segundos segurando o botão para o tiro sair
  danoMult: 60,               // dano em cada alvo = dano da nave × este número ("dano absurdo")
  danoBossMaxPct: 0.15,       // o CHEFE leva no máximo esta parte da vida máxima dele por tiro (0.15 = 15%)
  fracaoAlvos: 0.5,           // atinge esta fração dos inimigos na tela (0.5 = metade, arredondando para cima)
  curaBasePct: 0.08,          // cura a cada tiro: 8% da vida máxima...
  curaPorAlvoPct: 0.01,       // ...mais 1% por inimigo atingido...
  curaMaxPct: 0.20,           // ...até no máximo 20% por tiro
  cor: 0xb26bff,              // cor do plasma
  modeloGlb: 'nave-plasma.glb', tamanho: 3.0, giroY: 0,    // modelo da nave: tamanho (largura em unidades) e giro (radianos; Math.PI = de costas)
  // ── PILOTO (pilot_low_poly_character.glb) — vem junto com a nave no pacote "NAVE + PILOTO" ──
  pilotoGlb: 'pilot_low_poly_character.glb',
  pilotoEscalaNave: 0.0085,                          // tamanho do piloto dentro da nave (o modelo tem 187 de altura; × este número = unidades do jogo)
  pilotoPosNave: { x: 0, y: 0.12, z: 0.3 },          // onde fica o QUADRIL do piloto sentado, dentro da nave (x lado, y altura, z frente/trás)
  pilotoGiroNave: Math.PI,                           // o modelo olha para +Z; a nave anda para -Z, então vira meia-volta
};

// ── PILOTO: carregar o .glb e posar o esqueleto ─────────────────
// O modelo tem esqueleto (Mixamo). Em vez de usar a animação dele, giramos os ossos direto:
//   SENTADO: coxas para a frente (+90°), canelas para baixo (-85°), braços para a frente segurando os controles.
//   EM PÉ  : pose original do modelo (braços um pouco abertos).
// Os ângulos foram conferidos desenhando o modelo posado (coxa na horizontal, joelho dobrado em 90°).
var NRPlasmaPiloto = (function () {
  function achar(raiz, parte) { var r = null; raiz.traverse(function (o) { if (!r && o.name && o.name.indexOf(parte) >= 0) r = o; }); return r; }
  function girar(raiz, parte, eixo, graus) { var o = achar(raiz, parte); if (o) o['rotate' + eixo](graus * Math.PI / 180); }
  function sentar(raiz) {
    ['Left', 'Right'].forEach(function (lado) {
      var s = lado === 'Left' ? 1 : -1;
      girar(raiz, lado + 'UpLeg', 'X', 90); girar(raiz, lado + 'Leg_', 'X', -85);          // pernas
      girar(raiz, lado + 'Arm_', 'X', -40); girar(raiz, lado + 'Arm_', 'Z', 90 * s); girar(raiz, lado + 'ForeArm_', 'X', 60); // braços nos controles
    });
  }
  // ── Avisos na tela (se algo der errado com o piloto, você VÊ o motivo em vez de ele simplesmente não aparecer) ──
  var AVISO = null;
  function aviso(txt, cor, ms) {
    try {
      if (!AVISO) { AVISO = document.createElement('div'); AVISO.style.cssText = 'position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:99999;max-width:92vw;padding:6px 12px;border-radius:8px;font:11px/1.4 monospace;text-align:center;pointer-events:none;background:#06081ad9;border:1px solid;'; document.body.appendChild(AVISO); }
      AVISO.style.color = cor; AVISO.style.borderColor = cor; AVISO.textContent = txt; AVISO.style.display = 'block'; clearTimeout(AVISO._t); AVISO._t = setTimeout(function () { AVISO.style.display = 'none'; }, ms || 8000);
    } catch (e) {}
  }
  // Piloto SIMPLES (caixas + esfera), usado se o .glb não carregar: assim a nave nunca fica sem piloto e dá para ver se o problema é só o arquivo.
  // Mesmas medidas do modelo real: 187 de altura, pés no chão, olhando para +Z, quadril a 96,5.
  function procedural(opc) {
    var g = new THREE.Group(), roupa = new THREE.MeshBasicMaterial({ color: 0x5f7f96 }), claro = new THREE.MeshBasicMaterial({ color: 0xe8eef5 }), pele = new THREE.MeshBasicMaterial({ color: 0xd9a27c }), Q = 96.5;
    function caixa(w, h, d, mat, x, y, z) { var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); g.add(m); }
    caixa(38, 52, 22, roupa, 0, Q + 26, 0);                                              // tronco
    var cab = new THREE.Mesh(new THREE.SphereGeometry(11, 12, 10), pele); cab.position.set(0, Q + 66, 0); g.add(cab);
    var cap = new THREE.Mesh(new THREE.SphereGeometry(12.5, 12, 10, 0, Math.PI * 2, 0, Math.PI / 1.7), claro); cap.position.set(0, Q + 67, 0); g.add(cap); // capacete
    if (opc && opc.sentado) { [-1, 1].forEach(function (s) { caixa(14, 14, 44, roupa, s * 10, Q, 22); caixa(12, 44, 12, roupa, s * 10, Q - 22, 44); caixa(10, 10, 42, roupa, s * 24, Q + 40, 22); }); }
    else { [-1, 1].forEach(function (s) { caixa(14, 90, 14, roupa, s * 10, 45, 0); caixa(9, 50, 9, roupa, s * 26, Q + 28, 0); }); }
    return g;
  }
  function nomesDoArquivo() { var l = [PLASMA_CFG.pilotoGlb]; ['piloto-plasma.glb', 'pilot_low_poly_character.glb'].forEach(function (n) { if (l.indexOf(n) < 0) l.push(n); }); return l; }

  // criar({ sentado: true|false, semFallback: true|false }, callback(grupo)) — o grupo vem com o modelo na escala original (187 de altura, pés no chão)
  function criar(opc, cb) {
    var fallback = !(opc && opc.semFallback);
    var entregar = function (grupo) { try { cb && cb(grupo); } catch (e) { aviso('PILOTO: erro ao encaixar na nave — ' + (e && e.message), '#ff8a8a', 12000); } };
    if (typeof THREE === 'undefined' || typeof THREE.GLTFLoader !== 'function') {
      aviso('PILOTO: o carregador de modelos 3D (GLTFLoader) não está disponível — usando piloto simples', '#ffd24d', 12000);
      if (fallback) entregar(procedural(opc)); return;
    }
    var lista = nomesDoArquivo(), i = 0;
    (function tentar() {
      if (i >= lista.length) {
        aviso('PILOTO: não achei o arquivo ' + lista[0] + ' — coloque na MESMA pasta do game3d.html. Usando piloto simples.', '#ffd24d', 14000);
        if (fallback) entregar(procedural(opc)); return;
      }
      var arq = lista[i++];
      try {
        new THREE.GLTFLoader().load(arq, function (g) {
          try {
            var raiz = g.scene; raiz.traverse(function (o) { if (o.isSkinnedMesh) o.frustumCulled = false; });
            raiz.updateMatrixWorld(true);
            if (opc && opc.sentado) sentar(raiz);
            var grupo = new THREE.Group(); grupo.add(raiz);
            aviso('PILOTO ✓ carregado (' + arq + ')', '#7dffb0', 2500);
            entregar(grupo);
          } catch (e) { aviso('PILOTO: erro ao montar o modelo — ' + (e && e.message), '#ff8a8a', 14000); if (fallback) entregar(procedural(opc)); }
        }, undefined, function () { tentar(); }); // não achou esse nome: tenta o próximo
      } catch (e) { tentar(); }
    })();
  }
  return { criar: criar, sentar: sentar };
})();

// ── NAVE (modelo) ───────────────────────────────────────────────
// Devolve já uma nave PROVISÓRIA (agulha violeta com anel de plasma) e, se existir nave-plasma.glb, troca pelo modelo real.
function createShipPlasma(opcoes) { // opcoes.semPiloto = true → só a nave (o cartão do hangar mostra o piloto separado)
  var group = new THREE.Group();
  var modelo = new THREE.Group();            // só este grupo é trocado quando o .glb chega (o resto, como a bola de carga, fica)
  var violeta = new THREE.MeshStandardMaterial({ color: 0x3a1a7a, metalness: 0.7, roughness: 0.3, emissive: 0x2a0f66, emissiveIntensity: 0.6 });
  var brilho = new THREE.MeshBasicMaterial({ color: PLASMA_CFG.cor });
  var corpo = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.2, 8), violeta); corpo.rotation.x = -Math.PI / 2; corpo.position.z = -0.2; modelo.add(corpo);
  var asaG = new THREE.BoxGeometry(2.6, 0.08, 1.0);
  var asa = new THREE.Mesh(asaG, violeta); asa.position.set(0, 0, 0.7); modelo.add(asa);
  var anel = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.07, 8, 24), brilho); anel.position.z = -1.3; modelo.add(anel);
  [-1, 1].forEach(function (s) { var p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 1.2), brilho); p.position.set(s * 1.25, 0, 0.7); modelo.add(p); });
  // capota de vidro (cabine) por cima do piloto
  var vidro = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.22, depthWrite: false }));
  vidro.position.set(PLASMA_CFG.pilotoPosNave.x, PLASMA_CFG.pilotoPosNave.y + 0.1, PLASMA_CFG.pilotoPosNave.z); vidro.scale.set(1, 1.15, 1.35); modelo.add(vidro);
  group.add(modelo);
  group.userData.plasmaModelo = modelo;
  group.scale.set(0.5, 0.5, 0.5);
  if (!(opcoes && opcoes.semPiloto)) { // piloto SENTADO dentro da nave (carrega o .glb; se o arquivo não existir, a nave segue sem piloto)
    NRPlasmaPiloto.criar({ sentado: true }, function (piloto) {
      var c = PLASMA_CFG, k = c.pilotoEscalaNave; piloto.scale.setScalar(k);
      piloto.rotation.y = c.pilotoGiroNave;
      piloto.position.set(c.pilotoPosNave.x, c.pilotoPosNave.y - 96.5 * k, c.pilotoPosNave.z); // o quadril do modelo fica a 96,5 de altura: desce para o quadril cair no assento
      group.add(piloto); group.userData.piloto = piloto;
    });
  }
  try { // modelo real (opcional)
    if (typeof THREE.GLTFLoader === 'function') {
      new THREE.GLTFLoader().load(PLASMA_CFG.modeloGlb, function (gltf) {
        var obj = gltf.scene, caixa = new THREE.Box3().setFromObject(obj), tam = caixa.getSize(new THREE.Vector3()), c = caixa.getCenter(new THREE.Vector3());
        var k = PLASMA_CFG.tamanho / (Math.max(tam.x, tam.z) || 1);        // ajusta o tamanho
        obj.scale.setScalar(k); obj.position.set(-c.x * k, -c.y * k, -c.z * k); // centraliza
        var pivo = new THREE.Group(); pivo.add(obj); pivo.rotation.y = PLASMA_CFG.giroY;
        while (modelo.children.length) modelo.remove(modelo.children[0]);
        modelo.add(pivo);
      }, undefined, function () { /* sem o arquivo: fica a nave provisória */ });
    }
  } catch (e) { /* sem GLTFLoader: nave provisória */ }
  return group;
}

// ── SOM (tudo sintetizado, sem arquivo de áudio) ────────────────
var NRPlasma = (function () {
  'use strict';
  var C = PLASMA_CFG;
  var PVP = false; try { PVP = new URLSearchParams(location.search).get('modo') === 'pvp'; } catch (e) {}
  var S = { ativa: false, carga: 0, carregando: false, somCarga: null, retomaSomEm: 0, orb: null, anel: null, feixes: [], ruidoBuf: null, ultimoBotao: 0 };

  function ctx() { try { return (typeof audioCtxFx !== 'undefined' && audioCtxFx) ? audioCtxFx : null; } catch (e) { return null; } }
  function ruido(ac) { // 1 s de ruído branco reaproveitado
    if (!S.ruidoBuf) { var b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), d = b.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; S.ruidoBuf = b; }
    return S.ruidoBuf;
  }

  // Som de CARREGAR: dois osciladores que sobem de tom, uma pulsação que acelera, um filtro que abre e um chiado que sobe.
  // atualizar(p) é chamado todo quadro com p = 0..1 (quanto já carregou) e o som acompanha.
  function iniciarSomCarga() {
    var ac = ctx(); if (!ac) return null;
    try {
      if (ac.state === 'suspended') ac.resume();
      var mestre = ac.createGain(); mestre.gain.value = 0.0001; mestre.connect(ac.destination);
      var trem = ac.createGain(); trem.gain.value = 0.65; trem.connect(mestre);
      var filtro = ac.createBiquadFilter(); filtro.type = 'lowpass'; filtro.frequency.value = 300; filtro.Q.value = 5; filtro.connect(trem);
      var o1 = ac.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 80; var g1 = ac.createGain(); g1.gain.value = 0.5; o1.connect(g1); g1.connect(filtro);
      var o2 = ac.createOscillator(); o2.type = 'square'; o2.frequency.value = 160; o2.detune.value = 9; var g2 = ac.createGain(); g2.gain.value = 0.2; o2.connect(g2); g2.connect(filtro);
      var lfo = ac.createOscillator(); lfo.frequency.value = 4; var lg = ac.createGain(); lg.gain.value = 0.35; lfo.connect(lg); lg.connect(trem.gain);
      var rs = ac.createBufferSource(); rs.buffer = ruido(ac); rs.loop = true; var bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2; bp.frequency.value = 500;
      var rg = ac.createGain(); rg.gain.value = 0; rs.connect(bp); bp.connect(rg); rg.connect(mestre);
      o1.start(); o2.start(); lfo.start(); rs.start();
      return {
        atualizar: function (p) {
          var t = ac.currentTime, f = 80 * Math.pow(7, p);                       // 80 Hz → 560 Hz
          o1.frequency.setTargetAtTime(f, t, 0.06); o2.frequency.setTargetAtTime(f * 2, t, 0.06);
          lfo.frequency.setTargetAtTime(4 + 20 * p, t, 0.08);                     // a pulsação acelera
          filtro.frequency.setTargetAtTime(300 + 5500 * p * p, t, 0.06);           // o filtro abre
          mestre.gain.setTargetAtTime(0.04 + 0.5 * Math.pow(p, 1.2), t, 0.06);     // fica mais forte
          bp.frequency.setTargetAtTime(500 + 3500 * p, t, 0.08); rg.gain.setTargetAtTime(0.28 * p * p, t, 0.08);
        },
        parar: function () {
          try { var t = ac.currentTime; mestre.gain.setTargetAtTime(0.0001, t, 0.05); [o1, o2, lfo, rs].forEach(function (n) { n.stop(t + 0.3); }); } catch (e) {}
        },
      };
    } catch (e) { return null; }
  }

  // Som do TIRO: "tuUuUUUuU" — serra que despenca de agudo para grave, com um vibrato que vai ficando mais lento
  // e um filtro de "vogal" que varre (U-A-U), mais um estalo no começo e um estrondo grave.
  function tocarTiroPlasma() {
    var ac = ctx(); if (!ac) return;
    try {
      if (ac.state === 'suspended') ac.resume();
      var t = ac.currentTime, saida = ac.createGain(); saida.gain.value = 0.9; saida.connect(ac.destination);
      var o = ac.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(1800, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.12); o.frequency.exponentialRampToValueAtTime(150, t + 1.25);
      var vib = ac.createOscillator(); vib.frequency.setValueAtTime(26, t); vib.frequency.exponentialRampToValueAtTime(7, t + 1.2);
      var vg = ac.createGain(); vg.gain.setValueAtTime(380, t); vg.gain.exponentialRampToValueAtTime(30, t + 1.2); vib.connect(vg); vg.connect(o.frequency);
      var bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 5; bp.frequency.setValueAtTime(2200, t); bp.frequency.exponentialRampToValueAtTime(420, t + 1.2);
      var vl = ac.createOscillator(); vl.frequency.setValueAtTime(18, t); vl.frequency.exponentialRampToValueAtTime(5, t + 1.2); var vlg = ac.createGain(); vlg.gain.value = 500; vl.connect(vlg); vlg.connect(bp.frequency);
      var env = ac.createGain(); env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(0.7, t + 0.012); env.gain.exponentialRampToValueAtTime(0.0001, t + 1.35);
      var o2 = ac.createOscillator(); o2.type = 'square'; o2.frequency.setValueAtTime(900, t); o2.frequency.exponentialRampToValueAtTime(75, t + 1.25); var g2 = ac.createGain(); g2.gain.value = 0.25;
      o.connect(bp); o2.connect(g2); g2.connect(bp); bp.connect(env); env.connect(saida);
      var rs = ac.createBufferSource(); rs.buffer = ruido(ac); var hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
      var rg = ac.createGain(); rg.gain.setValueAtTime(0.55, t); rg.gain.exponentialRampToValueAtTime(0.001, t + 0.2); rs.connect(hp); hp.connect(rg); rg.connect(saida);
      var sub = ac.createOscillator(); sub.type = 'sine'; sub.frequency.setValueAtTime(95, t); sub.frequency.exponentialRampToValueAtTime(38, t + 0.6);
      var sg = ac.createGain(); sg.gain.setValueAtTime(0.65, t); sg.gain.exponentialRampToValueAtTime(0.001, t + 0.65); sub.connect(sg); sg.connect(saida);
      [o, vib, vl, o2, sub].forEach(function (n) { n.start(t); n.stop(t + 1.5); }); rs.start(t); rs.stop(t + 0.3);
    } catch (e) {}
  }
  function tocarFizzle() { // soltou antes da hora
    var ac = ctx(); if (!ac) return;
    try { var t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(); o.type = 'square'; o.frequency.setValueAtTime(420, t); o.frequency.exponentialRampToValueAtTime(80, t + 0.2);
      g.gain.setValueAtTime(0.14, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22); o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.25); } catch (e) {}
  }

  // ── VISUAL: anel no botão de atirar + bola de plasma na frente da nave + feixes do tiro ──
  function criarAnel() {
    if (S.anel) return S.anel;
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;z-index:95;pointer-events:none;display:none;border-radius:50%;--p:0;' +
      'background:conic-gradient(#d9b8ff calc(var(--p) * 360deg), rgba(255,255,255,.10) 0);' +
      '-webkit-mask:radial-gradient(farthest-side, transparent calc(100% - 9px), #000 calc(100% - 8px));mask:radial-gradient(farthest-side, transparent calc(100% - 9px), #000 calc(100% - 8px));' +
      'filter:drop-shadow(0 0 8px #b26bff);';
    document.body.appendChild(d); S.anel = d; return d;
  }
  function posicionarAnel() {
    var btn = (typeof shootBtnEl !== 'undefined') ? shootBtnEl : null; if (!btn || !S.anel) return;
    var r = btn.getBoundingClientRect(), m = 14, cx = r.left + r.width / 2, cy = r.top + r.height / 2, tam = Math.max(r.width, r.height) + m * 2;
    S.anel.style.width = S.anel.style.height = tam + 'px'; S.anel.style.left = (cx - tam / 2) + 'px'; S.anel.style.top = (cy - tam / 2) + 'px';
  }
  function criarOrb() {
    if (S.orb) return S.orb;
    S.orb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), new THREE.MeshBasicMaterial({ color: 0xcaa0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    S.orb.position.set(0, 0, -1.9); S.orb.visible = false; shipGroup.add(S.orb); return S.orb;
  }
  var _geoFeixe = null;
  function criarFeixe(de, para, largura, cor, duracao) {
    if (!_geoFeixe) _geoFeixe = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
    var dir = new THREE.Vector3().subVectors(para, de), L = dir.length() || 0.001; dir.normalize();
    var m = new THREE.Mesh(_geoFeixe, new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.copy(de).add(para).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); m.scale.set(largura, L, largura);
    scene.add(m); S.feixes.push({ m: m, t: 0, dur: duracao, larg: largura });
  }
  function atualizarFeixes(dt) {
    for (var i = S.feixes.length - 1; i >= 0; i--) {
      var f = S.feixes[i]; f.t += dt; var k = f.t / f.dur;
      if (k >= 1) { scene.remove(f.m); f.m.material.dispose(); S.feixes.splice(i, 1); continue; }
      f.m.material.opacity = 1 - k; var w = f.larg * (1 - 0.8 * k); f.m.scale.x = w; f.m.scale.z = w;
    }
  }

  // ── O TIRO ──────────────────────────────────────────────────────
  function alvosNaTela() {
    var zMin = (typeof ENEMY_SPAWN_Z !== 'undefined') ? ENEMY_SPAWN_Z + 4 : -60, zMax = shipGroup.position.z + 3;
    return enemies.filter(function (en) { return en && en.hp > 0 && en.mesh && en.mesh.position.z > zMin && en.mesh.position.z < zMax; });
  }
  function disparar() {
    var nariz = new THREE.Vector3(shipGroup.position.x, shipGroup.position.y, shipGroup.position.z - 1.6);
    var lista = alvosNaTela(), n = lista.length, qtd = n ? Math.max(1, Math.ceil(n * C.fracaoAlvos)) : 0;
    for (var i = lista.length - 1; i > 0; i--) { var j = (Math.random() * (i + 1)) | 0, tmp = lista[i]; lista[i] = lista[j]; lista[j] = tmp; } // sorteia
    var alvos = lista.slice(0, qtd), base = calcularDanoJogador();
    // feixe para a frente (sempre aparece) + um feixe para cada alvo
    criarFeixe(nariz, new THREE.Vector3(nariz.x, nariz.y, nariz.z - 60), 0.55, C.cor, 0.5);
    criarFeixe(nariz, new THREE.Vector3(nariz.x, nariz.y, nariz.z - 60), 0.22, 0xffffff, 0.35);
    alvos.forEach(function (en) {
      var d = base * C.danoMult, tipoBoss = en.isBoss || en.tipo === 'boss';
      if (tipoBoss) { var vmax = en.maxHp || en.hpMax || en.hpInicial || 0; if (vmax > 0) d = Math.min(d, vmax * C.danoBossMaxPct); }
      var pos = en.mesh.position;
      criarFeixe(nariz, pos.clone(), 0.38, C.cor, 0.45); criarFeixe(nariz, pos.clone(), 0.14, 0xffffff, 0.3);
      en.hp -= d; en.hitFlashTimer = 0.18;
      try { if (window.NROnline) NROnline.dano(en, d); } catch (e) {}      // co-op: os outros jogadores recebem o mesmo dano
      try { JUICE.acertoInimigo(en, pos, C.cor, true); } catch (e) {}
      if (en.hp <= 0) matarOuRessuscitar(en);
    });
    // cura a cada disparo
    var cura = Math.min(C.curaMaxPct, C.curaBasePct + C.curaPorAlvoPct * alvos.length) * playerMaxHp;
    if (!naveDestruida) { playerHp = Math.min(playerMaxHp, playerHp + cura); try { atualizarHpBar(); } catch (e) {} }
    tocarTiroPlasma();
    try { JUICE.tremer(0.55); JUICE.flashTela('#b26bff', 0.45, 420); if (alvos.length) JUICE.hitStop(0.05); } catch (e) {}
    try { navigator.vibrate && navigator.vibrate([25, 20, 45]); } catch (e) {}
    S.carga = 0; S.retomaSomEm = performance.now() + 350;
    if (S.somCarga) { S.somCarga.parar(); S.somCarga = null; }
  }

  // ── chamado todo quadro pelo boss3d.js (no lugar do tiro comum) ──
  function atualizar(dt, segurando) {
    S.ultimoQuadro = performance.now();
    atualizarFeixes(dt);
    if (!S.ativa) return;
    var anel = criarAnel(), orb = criarOrb(), agora = performance.now();
    if (segurando && !naveDestruida) {
      S.carregando = true;
      S.carga = Math.min(C.tempoCarga, S.carga + dt);
      if (!S.somCarga && agora >= S.retomaSomEm) S.somCarga = iniciarSomCarga();
      var p = S.carga / C.tempoCarga;
      if (S.somCarga) S.somCarga.atualizar(p);
      orb.visible = true; var pulso = 1 + Math.sin(agora / 70) * 0.08 * p;
      orb.scale.setScalar((0.06 + 1.15 * Math.pow(p, 1.4)) * pulso); orb.material.opacity = 0.25 + 0.7 * p;
      orb.material.color.setHex(p > 0.9 ? 0xffffff : 0xcaa0ff);
      posicionarAnel(); anel.style.display = 'block'; anel.style.setProperty('--p', p.toFixed(3));
      if (S.carga >= C.tempoCarga) { orb.visible = false; disparar(); }
    } else if (S.carregando || S.carga > 0) {
      if (S.carga > 0.3) tocarFizzle();            // soltou antes de 3 s: perde a carga
      if (S.somCarga) { S.somCarga.parar(); S.somCarga = null; }
      S.carga = 0; S.carregando = false; orb.visible = false; anel.style.display = 'none';
    }
  }
  // Vigia: se o jogo parar de chamar atualizar() (pausa, game over, aba em segundo plano), o som de carga não pode ficar tocando
  setInterval(function () {
    if (S.ultimoQuadro && performance.now() - S.ultimoQuadro > 400 && (S.somCarga || S.carga > 0)) {
      if (S.somCarga) { S.somCarga.parar(); S.somCarga = null; }
      S.carga = 0; S.carregando = false; if (S.anel) S.anel.style.display = 'none'; if (S.orb) S.orb.visible = false;
    }
  }, 250);
  function ligar(naveId) { S.ativa = (naveId === C.id) && !PVP; if (!S.ativa) { if (S.anel) S.anel.style.display = 'none'; if (S.orb) S.orb.visible = false; } return S.ativa; }

  // Pega o modelo do piloto (piloto-plasma.glb) e entrega ao callback: NRPlasma.carregarPiloto(function (grupo) { cena.add(grupo); })
  // Se o arquivo não existir, o callback nunca é chamado. O que fazer com ele (hangar, retrato, cabine) é decisão de design.
  function carregarPiloto(cb, sentado) { NRPlasmaPiloto.criar({ sentado: !!sentado }, cb); }
  return { ligar: ligar, atualizar: atualizar, carregarPiloto: carregarPiloto, cfg: C, get ativa() { return S.ativa; }, get carga() { return S.carga; }, _estado: S, _disparar: disparar };
})();
