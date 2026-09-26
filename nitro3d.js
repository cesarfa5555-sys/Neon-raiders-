// ══════════════════════════════════════════════════════════════════
// NITRO3D.JS — modelo novo do robô companheiro NITRO
//
// Porta o robô do nitro.html (Three.js r160/ESM) pro r128 sem módulos
// (mesma regra do resto do jogo). Troca só a APARÊNCIA: o hexágono +
// anel antigo vira este robô com corpo, viseira, olhos/boca neon,
// asas com propulsores e dois braços articulados.
//
// Nada do COMPORTAMENTO do NITRO muda — ele continua desbloqueado
// pelas mesmas 15 missões, atira sozinho no inimigo mais próximo e
// segue num offset fixo ao lado da nave (boss3d.js cuida disso todo,
// não este arquivo).
//
// Carregar DEPOIS do three.js e ANTES do boss3d.js em game3d.html —
// mesma posição que vanguard3d.js já ocupa.
//
// window.criarNitroRobo()               → monta o robô (Group)
// window.atualizarVisualNitro(m, dt, t)  → flutuação + luzes
//                                          pulsando (chamar TODO
//                                          FRAME, depois de já ter
//                                          reposicionado o grupo)
// ══════════════════════════════════════════════════════════════════

(function () {

  // ── AJUSTES RÁPIDOS ──────────────────────────────────────────────
  // O robô foi desenhado numa escala pensada pra ficar sozinho na
  // tela (praticamente do tamanho da nave). Aqui do lado da nave ele
  // precisa ser um "companheiro" pequeno — este fator encolhe tudo.
  // O hexágono antigo tinha uns 1.5 de diâmetro; 0.4 deixa o robô
  // novo numa pegada parecida. Ajusta à vontade.
  var NITRO_ESCALA = 0.4;

  function criarNitroRobo() {
    var nitroGroup = new THREE.Group();
    nitroGroup.name = 'NITRO';

    // --- MATERIAIS ---
    var matDarkMetal = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.8 });
    var matLightMetal = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.7 });
    var matPurple = new THREE.MeshStandardMaterial({ color: 0x6a0dad, roughness: 0.3, metalness: 0.6 });
    var matNeonCyanGlow = new THREE.MeshStandardMaterial({
      color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 3.0, roughness: 0.2, metalness: 0.1,
    });
    var matVisor = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.1, metalness: 0.9 });

    // --- CORPO PRINCIPAL ---
    var bodyGroup = new THREE.Group();

    var coreBody = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 16), matDarkMetal);
    coreBody.scale.set(1.2, 1.0, 1.1);
    bodyGroup.add(coreBody);

    var armorTop = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 1.0), matLightMetal);
    armorTop.position.set(0, 0.6, 0);
    armorTop.rotation.x = -0.2;
    bodyGroup.add(armorTop);

    var armorBottom = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.9), matDarkMetal);
    armorBottom.position.set(0, -0.4, 0.1);
    bodyGroup.add(armorBottom);

    // Visor / rosto
    var visor = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.6), matVisor);
    visor.position.set(0, 0.1, 0.3);
    visor.scale.set(1.1, 0.9, 0.8);
    bodyGroup.add(visor);

    // Olhos e boca (neon) — guardados pra pulsar junto com as luzes
    var eyeGeo = new THREE.PlaneGeometry(0.2, 0.15);
    var leftEye = new THREE.Mesh(eyeGeo, matNeonCyanGlow);
    leftEye.position.set(-0.25, 0.25, 0.95);
    leftEye.rotation.z = 0.2; leftEye.rotation.y = -0.1;
    bodyGroup.add(leftEye);

    var rightEye = new THREE.Mesh(eyeGeo, matNeonCyanGlow);
    rightEye.position.set(0.25, 0.25, 0.95);
    rightEye.rotation.z = -0.2; rightEye.rotation.y = 0.1;
    bodyGroup.add(rightEye);

    var mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.05), matNeonCyanGlow);
    mouth.position.set(0, 0.05, 0.95);
    mouth.rotation.x = -0.1;
    bodyGroup.add(mouth);

    // Linhas neon no corpo
    var neonLineGeo = new THREE.BoxGeometry(0.05, 0.05, 0.8);
    var neonLineL = new THREE.Mesh(neonLineGeo, matNeonCyanGlow);
    neonLineL.position.set(-0.8, 0.2, 0.2); neonLineL.rotation.y = 0.3;
    bodyGroup.add(neonLineL);

    var neonLineR = new THREE.Mesh(neonLineGeo, matNeonCyanGlow);
    neonLineR.position.set(0.8, 0.2, 0.2); neonLineR.rotation.y = -0.3;
    bodyGroup.add(neonLineR);

    nitroGroup.add(bodyGroup);

    // --- ASAS E PROPULSORES ---
    var wingsGroup = new THREE.Group();

    var leftWing = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 1.2), matDarkMetal);
    leftWing.position.set(-1.2, 0.1, -0.2); leftWing.rotation.z = 0.1; leftWing.rotation.y = 0.4;
    wingsGroup.add(leftWing);

    var leftWingPurple = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.05, 0.4), matPurple);
    leftWingPurple.position.set(-1.2, 0.16, -0.6); leftWingPurple.rotation.z = 0.1; leftWingPurple.rotation.y = 0.4;
    wingsGroup.add(leftWingPurple);

    var rightWing = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 1.2), matDarkMetal);
    rightWing.position.set(1.2, 0.1, -0.2); rightWing.rotation.z = -0.1; rightWing.rotation.y = -0.4;
    wingsGroup.add(rightWing);

    var rightWingPurple = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.05, 0.4), matPurple);
    rightWingPurple.position.set(1.2, 0.16, -0.6); rightWingPurple.rotation.z = -0.1; rightWingPurple.rotation.y = -0.4;
    wingsGroup.add(rightWingPurple);

    var thrusterGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.6, 12);
    var thrusterL = new THREE.Mesh(thrusterGeo, matLightMetal);
    thrusterL.position.set(-0.8, 0.2, -0.9); thrusterL.rotation.x = Math.PI / 2;
    wingsGroup.add(thrusterL);

    var thrusterR = new THREE.Mesh(thrusterGeo, matLightMetal);
    thrusterR.position.set(0.8, 0.2, -0.9); thrusterR.rotation.x = Math.PI / 2;
    wingsGroup.add(thrusterR);

    // Fogo dos propulsores — guardado pra "tremer" (escala) na animação,
    // dá a sensação de propulsão ativa sem custar nenhum draw call extra
    var fireGeo = new THREE.ConeGeometry(0.2, 0.8, 8);
    var fireL = new THREE.Mesh(fireGeo, matNeonCyanGlow);
    fireL.position.set(-0.8, 0.2, -1.4); fireL.rotation.x = -Math.PI / 2;
    wingsGroup.add(fireL);

    var fireR = new THREE.Mesh(fireGeo, matNeonCyanGlow);
    fireR.position.set(0.8, 0.2, -1.4); fireR.rotation.x = -Math.PI / 2;
    wingsGroup.add(fireR);

    nitroGroup.add(wingsGroup);

    // --- BRAÇOS ---
    function criarBraco(esquerdo) {
      var armGroup = new THREE.Group();
      var lado = esquerdo ? -1 : 1;

      var shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 12), matLightMetal);
      shoulder.position.set(lado * 1.0, -0.3, 0.2);
      armGroup.add(shoulder);

      var upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.6, 8), matDarkMetal);
      upperArm.position.set(lado * 1.0, -0.7, 0.2); upperArm.rotation.z = lado * 0.2;
      armGroup.add(upperArm);

      var elbow = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), matLightMetal);
      elbow.position.set(lado * 1.1, -1.0, 0.15);
      armGroup.add(elbow);

      var forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.5, 8), matDarkMetal);
      forearm.position.set(lado * 1.15, -1.3, 0.1); forearm.rotation.z = lado * 0.1; forearm.rotation.x = -0.2;
      armGroup.add(forearm);

      var handGroup = new THREE.Group();
      handGroup.position.set(lado * 1.2, -1.55, 0.05);

      var palm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.2), matLightMetal);
      handGroup.add(palm);

      for (var i = 0; i < 3; i++) {
        var finger = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.15, 0.04), matDarkMetal);
        finger.position.set((i - 1) * 0.06, -0.1, 0.05);
        finger.rotation.x = 0.3;
        handGroup.add(finger);
      }

      armGroup.add(handGroup);
      return armGroup;
    }

    nitroGroup.add(criarBraco(true));
    nitroGroup.add(criarBraco(false));

    nitroGroup.scale.set(1.2, 1.2, 1.2); // proporção original do design

    // Raiz: aplica a escala final (NITRO_ESCALA) por cima da proporção
    // original, sem mexer nela — troca só NITRO_ESCALA pra ajustar o
    // tamanho do robô no jogo.
    var raiz = new THREE.Group();
    raiz.add(nitroGroup);
    raiz.scale.setScalar(NITRO_ESCALA);
    raiz.userData.fireL = fireL;
    raiz.userData.fireR = fireR;
    raiz.userData.leftEyeMat = matNeonCyanGlow; // olhos/boca/linhas compartilham o mesmo material
    return raiz;
  }

  // Chamado TODO FRAME depois que boss3d.js já reposicionou o grupo
  // (mesh.position.set(...) ao lado da nave) — soma flutuação e leve
  // balanço por cima dessa posição, e faz o material neon pulsar.
  function atualizarVisualNitro(mesh, dt, tempo) {
    if (!mesh) return;
    mesh.position.y += Math.sin(tempo * 2) * 0.06;
    mesh.rotation.y = Math.sin(tempo * 0.5) * 0.2;
    mesh.rotation.x = Math.cos(tempo * 1.5) * 0.05;

    var pulso = 2.6 + Math.sin(tempo * 5) * 0.6;
    if (mesh.userData.leftEyeMat) mesh.userData.leftEyeMat.emissiveIntensity = pulso;

    // "chama" dos propulsores tremendo — só escala, sem custo de draw call extra
    var tremorL = 1 + Math.sin(tempo * 14) * 0.12;
    var tremorR = 1 + Math.sin(tempo * 14 + 1.3) * 0.12;
    if (mesh.userData.fireL) mesh.userData.fireL.scale.set(1, tremorL, 1);
    if (mesh.userData.fireR) mesh.userData.fireR.scale.set(1, tremorR, 1);
  }

  window.criarNitroRobo = criarNitroRobo;
  window.atualizarVisualNitro = atualizarVisualNitro;
})();
