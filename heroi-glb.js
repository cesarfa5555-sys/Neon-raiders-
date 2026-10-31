// ══════════════════════════════════════════════════════════════════
// HEROI-GLB.JS — personagens 3D (Kenney "Mini Characters", CC0) com as animações DO PRÓPRIO ARQUIVO:
// idle, walk, sprint (a corrida), jump, fall, holding-right (segurar arma), holding-right-shoot (tiro) e attack-melee-right (golpe).
//
// COMO FUNCIONA
//  • A animação vem dos clips do .glb. Cada clip é fatiado por partes do corpo (pernas / tronco / cabeça / braço E / braço D)
//    e os pesos de cada fatia são calculados todo quadro. Assim dá para misturar "correr com as pernas" + "segurar a arma com o braço direito"
//    + "golpe de katana" + "pulo" sem as animações brigarem entre si (o peso total de cada osso sempre soma 1).
//  • A passada é sincronizada com a velocidade real do jogador (o pé de apoio recua na velocidade do chão → não escorrega):
//    parado → idle · devagar → walk · rápido → sprint, misturados de forma contínua.
//  • Por cima do clip, só o mínimo em código: o corpo vira para onde corre, o tronco e a cabeça giram para o inimigo mais próximo,
//    agachada no pouso, esticada no pulo, inclinação no dash e tremida ao levar dano.
//  • A arma (.glb) fica presa ao osso do braço direito: acompanha o corpo, o recuo do tiro e o arco do golpe.
//
// MESMA INTERFACE do modelo antigo (modelos.js / desenhista.js / loja.js / menu-heroi.js não precisaram mudar):
//   NRHeroiGLB.precarregar() · .disponivel(persona) · .criar(op)  →  { grupo, animar, estado, anel, cor, posPe, impulso, recuar, golpear, pular }
// Se algo falhar, devolve null e o jogo usa o herói de blocos (modelos.js), como antes.
// ══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var T = window.THREE;
  var cache = {};                    // persona → { cena, animacoes, promessa }
  var PI = Math.PI, TAU = Math.PI * 2;

  // ── medidas do esqueleto Kenney (iguais para todos os 12 personagens) ──
  var V_SPRINT = 1.30, V_WALK = 0.67;   // quanto o pé de apoio percorre por segundo (unidades do modelo) com o clip em velocidade 1
  var D_SPRINT = 0.5, D_WALK = 2 / 3;   // duração de um ciclo completo (2 passos) de cada clip, em segundos
  var PUNHO = { x: -0.258, y: 0, z: 0.076 };                          // centro do punho no espaço do osso "arm-right"
  var ENCAIXE = { rifle: [-0.0177, -0.4561, -0.0091, 0.8897],         // rotação da arma em relação ao osso do braço direito (quaternion x,y,z,w):
                  katana: [-0.275, -0.4223, -0.1816, 0.8445] };       //   rifle = cano para frente · katana = lâmina para frente e para cima
  var GRUPOS = { L: ['root', 'leg-left', 'leg-right'], T: ['torso'], H: ['head'], AL: ['arm-left'], AR: ['arm-right'] };
  var LOCOG = ['L', 'T', 'H', 'AL'];                                  // partes controladas pela locomoção (o braço direito segura a arma)
  var GRAV = 28, PULO_V = 9;                                          // pulo visual: ~1,45 de altura, ~0,64 s no ar

  function sm(a, b, x) { var t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function angDif(a, b) { var d = (b - a) % TAU; if (d > PI) d -= TAU; if (d < -PI) d += TAU; return d; }

  function cfgGeral() { return window.NR_HEROI_GLB || { ativo: false, herois: {} }; }
  function cfgDe(persona) { var c = cfgGeral(); return c.ativo && c.herois && c.herois[persona] && c.herois[persona].arquivo ? c.herois[persona] : null; }

  // Baixa os .glb configurados (chamar antes de montar a cena). Nunca rejeita: em caso de erro, o herói de blocos é usado.
  function precarregar() {
    return Promise.race([precarregarTudo(), new Promise(function (res) { setTimeout(res, 12000); })]);       // trava de segurança: nunca espera mais que 12 s
  }
  function precarregarTudo() {
    var armas = window.NRArmasGLB ? window.NRArmasGLB.precarregar() : Promise.resolve();      // as armas .glb carregam junto
    var c = cfgGeral(); if (!c.ativo) return armas;
    var preparo = window.NRCarregarLoader ? window.NRCarregarLoader() : Promise.resolve();
    return Promise.all([armas, preparo.then(function () {
      var tarefas = Object.keys(c.herois || {}).filter(function (k) { return cfgDe(k); }).map(function (persona) {
        if (cache[persona] && cache[persona].promessa) return cache[persona].promessa;
        var cf = cfgDe(persona), loader = new T.GLTFLoader(), entrada = cache[persona] = { cena: null, animacoes: [], promessa: null };
        entrada.promessa = new Promise(function (res) {
          loader.load(cf.arquivo, function (g) { entrada.cena = g.scene; entrada.animacoes = g.animations || []; console.log('[heroi-glb] carregado:', cf.arquivo, '| animações:', entrada.animacoes.length); res(); },
            undefined, function (e) { console.warn('[heroi-glb] não foi possível carregar', cf.arquivo, e); res(); });
        });
        return entrada.promessa;
      });
      return Promise.all(tarefas);
    })]).catch(function (e) { console.warn('[heroi-glb] desativado:', e.message); });
  }
  function disponivel(persona) { return !!(cfgDe(persona) && cache[persona] && cache[persona].cena); }

  // fatia um clip: só as trilhas dos ossos pedidos
  function fatia(clip, nomes, tag) {
    var tr = clip.tracks.filter(function (k) { return nomes.indexOf(k.name.split('.')[0]) >= 0; });
    return tr.length ? new T.AnimationClip(clip.name + ':' + tag, clip.duration, tr) : null;
  }

  // ══════════════════════════════════════════════════════════════
  function criar(op) {
    var persona = op.persona || 'cacador', cf = cfgDe(persona), dados = cache[persona];
    if (!cf || !dados || !dados.cena || !T.SkeletonUtils || !T.AnimationMixer) return null;
    var clips = {}; dados.animacoes.forEach(function (c) { clips[c.name] = c; });
    var precisa = ['idle', 'walk', 'sprint', 'jump', 'fall', 'holding-right', 'holding-right-shoot', 'attack-melee-right'];
    for (var pi = 0; pi < precisa.length; pi++) if (!clips[precisa[pi]]) { console.warn('[heroi-glb] falta a animação "' + precisa[pi] + '" em ' + cf.arquivo); return null; }

    var clone = T.SkeletonUtils.clone(dados.cena);
    var B = {};
    ['root', 'torso', 'head', 'arm-left', 'arm-right', 'leg-left', 'leg-right'].forEach(function (n) { B[n] = clone.getObjectByName(n); });
    for (var bk in B) if (!B[bk]) { console.warn('[heroi-glb] osso não encontrado:', bk); return null; }
    clone.traverse(function (o) { if (o.isMesh) o.frustumCulled = false; });

    // ── hierarquia: raiz (giro) → cont (o desenhista deita aqui quando cai) → inc (inclinação) → pulo (altura) → esc (escala) → modelo ──
    var raiz = new T.Group(), cont = new T.Group(), inc = new T.Group(), pulo = new T.Group(), esc = new T.Group();
    raiz.add(cont); cont.add(inc); inc.add(pulo); pulo.add(esc); esc.add(clone);
    clone.rotation.y = cf.rotY || 0;
    clone.updateMatrixWorld(true);
    var caixa = new T.Box3().setFromObject(clone), alt = caixa.max.y - Math.min(0, caixa.min.y);
    if (!(alt > 0.2)) alt = 0.79;
    var fit = (cf.altura || 2.7) / alt;                // unidades do jogo por unidade do modelo
    esc.scale.setScalar(fit);

    // ── animações: fatiadas por parte do corpo, todas com tempo controlado por código (timeScale 0) ──
    var mixer = new T.AnimationMixer(clone);
    function acao(clip, nomes, tag) {
      var c = fatia(clip, nomes, tag); if (!c) return null;
      var a = mixer.clipAction(c); a.timeScale = 0; a.weight = 0; a.play(); return { a: a, dur: c.duration };
    }
    var LOCO = { idle: {}, walk: {}, sprint: {} }, AIR = { jump: {}, fall: {} }, UPP = { shoot: {}, atk: {} };
    ['idle', 'walk', 'sprint'].forEach(function (n) { LOCOG.forEach(function (g) { LOCO[n][g] = acao(clips[n], GRUPOS[g], n + g); }); });
    ['jump', 'fall'].forEach(function (n) { LOCOG.forEach(function (g) { AIR[n][g] = acao(clips[n], GRUPOS[g], n + g); }); });
    var UPG = ['T', 'H', 'AL', 'AR'];
    UPG.forEach(function (g) { UPP.shoot[g] = acao(clips['holding-right-shoot'], GRUPOS[g], 'tiro' + g); UPP.atk[g] = acao(clips['attack-melee-right'], GRUPOS[g], 'golpe' + g); });
    var SEG = acao(clips['holding-right'], GRUPOS.AR, 'segura');               // braço direito segurando a arma
    var DUR_TIRO = UPP.shoot.AR ? UPP.shoot.AR.dur : 0.2, DUR_GOLPE = UPP.atk.AR ? UPP.atk.AR.dur : 0.4167;

    function pesar(r, w) { if (r) r.a.weight = w; }
    function marcar(r, t, laco) { if (r) r.a.time = laco ? ((t % r.dur) + r.dur) % r.dur : clamp(t, 0, r.dur - 0.001); }

    // ── arma presa ao osso do braço direito ──
    var tipoArma = op.katana ? 'katana' : 'rifle';
    var arma3 = window.NRModelos.criarArma({ katana: !!op.katana, rifle: !!op.rifle, fem: !!op.fem }, {
      mArm2: new T.MeshPhongMaterial({ color: 0x1e2742, shininess: 60 }), mJunta: new T.MeshPhongMaterial({ color: 0x0c0f1a }), mNeon: new T.MeshBasicMaterial({ color: op.cor || 0x2ee6ff }), mAcento: new T.MeshBasicMaterial({ color: 0xff3da6 }) });
    var arma = arma3.grupo, seguro = new T.Group();
    var gp = (tipoArma === 'rifle' && arma3.grips && arma3.grips.dir) ? arma3.grips.dir : { x: 0, y: 0, z: 0 };       // rifle: a mão fica na empunhadura do gatilho · katana: a origem já é a empunhadura
    arma.position.set(-gp.x, -gp.y, -gp.z); seguro.add(arma);
    seguro.position.set(PUNHO.x, PUNHO.y, PUNHO.z);
    seguro.quaternion.set(ENCAIXE[tipoArma][0], ENCAIXE[tipoArma][1], ENCAIXE[tipoArma][2], ENCAIXE[tipoArma][3]);
    seguro.scale.setScalar((cf.armaEscala || 1) / fit);                      // a arma é medida em unidades do jogo; o osso está na escala do modelo
    B['arm-right'].add(seguro);

    // anel de brilho no chão (igual ao herói de blocos)
    var cor = op.cor || 0x2ee6ff;
    var anel = new T.Mesh(new T.RingGeometry(0.75, 0.95, 28), new T.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    anel.rotation.x = -PI / 2; anel.position.y = 0.04; cont.add(anel);

    // ── estado ──
    var P = { eventos: [], corrida: 0, andando: 0, yawCorpo: 0 };
    var est = { giro: 0, neon: cor, pose: P, info: { tipo: 'kenney', ossos: 7 } };
    var vs = 0, fase = 0, tIdle = 0, tQueda = 0, tPulo = 0, ultimoPasso = 0;
    var ar = 'chao', tAr = 0, aw = 0, jfUlt = 0, sq = 0, st = 0, hit = 0, sT = 0, aT = 0, eng = 0, yaw = 0, avisou = false;
    var AY = new T.Vector3(0, 1, 0), qa = new T.Quaternion(), V2 = new T.Vector3();
    var alcance = op.katana ? 7.2 : 14.5;

    function aterrissar() { P.eventos.push('pouso'); sq = 0.3; }

    function passo(dt, vel, fx, fz, dashando, vx, vz, alvo) {
      dt = clamp(dt || 0.016, 0.0001, 0.05); vx = vx || 0; vz = vz || 0; vel = vel || 0;
      P.eventos.length = 0;
      // velocidade suavizada → pesos de parado / andando / correndo
      vs += (vel - vs) * Math.min(1, dt * 9); if (vel === 0 && vs < 0.05) vs = 0;
      var mS = sm(0.3, 1.3, vs), rS = sm(2.6, 4.2, vs);
      P.corrida = mS * rS; P.andando = mS;
      // fase da passada: o ritmo acompanha a velocidade do chão (sem patinar)
      if (vs > 0.3) {
        var fW = vs / (V_WALK * fit * D_WALK), fR = vs / (V_SPRINT * fit * D_SPRINT);
        fase += clamp(fW + (fR - fW) * rS, 0.9, 3.4) * dt;
      }
      tIdle += dt;

      // pulo (botão) e dash
      if (dashando && ar !== 'dash') { ar = 'dash'; tAr = 0; }
      else if (!dashando && ar === 'dash') { ar = 'chao'; aterrissar(); }
      var altura = 0;
      if (ar === 'pulo') { tAr += dt; altura = PULO_V * tAr - 0.5 * GRAV * tAr * tAr; if (altura <= 0 && tAr > 0.08) { altura = 0; ar = 'chao'; aterrissar(); } }
      else if (ar === 'dash') tAr += dt;
      pulo.position.y = Math.max(0, altura);
      aw += Math.max(-dt / 0.14, Math.min(dt / 0.06, (ar === 'chao' ? 0 : 1) - aw));
      var jf = ar === 'dash' ? 1 : ar === 'pulo' ? 1 - sm(0.36, 0.5, tAr) : jfUlt; jfUlt = jf;
      var jW = aw * jf, fW2 = aw * (1 - jf);
      if (ar !== 'chao') tPulo = ar === 'dash' ? tAr * 2.8 : tAr;                     // o dash (0,18 s) percorre o clip de pulo inteiro
      tQueda += dt;

      // tiro e golpe (cada um um clip curto que sobe, segura e desce)
      if (sT > 0) sT -= dt; if (aT > 0) aT -= dt;
      var pS = sT > 0 ? 1 - sT / DUR_TIRO : 1, pA = aT > 0 ? 1 - aT / DUR_GOLPE : 1;
      var eS = sT > 0 ? sm(0, 0.12, pS) * (1 - sm(0.65, 1, pS)) : 0, eA = aT > 0 ? sm(0, 0.1, pA) * (1 - sm(0.7, 1, pA)) : 0;
      if (eS + eA > 1) { var tt = eS + eA; eS /= tt; eA /= tt; }
      var sW = eS * (1 - aw), aW = eA * (1 - aw);

      // pesos: em cada parte do corpo, locomoção + pulo + tiro/golpe somam exatamente 1
      var wI = 1 - mS, wW = mS * (1 - rS), wR = mS * rS, g, i;
      for (i = 0; i < LOCOG.length; i++) {
        g = LOCOG[i];
        var sobra = 1 - (AIR.jump[g] ? jW : 0) - (AIR.fall[g] ? fW2 : 0) - (UPP.shoot[g] ? sW : 0) - (UPP.atk[g] ? aW : 0); if (sobra < 0) sobra = 0;
        pesar(LOCO.idle[g], wI * sobra); pesar(LOCO.walk[g], wW * sobra); pesar(LOCO.sprint[g], wR * sobra);
        pesar(AIR.jump[g], jW); pesar(AIR.fall[g], fW2);
        marcar(LOCO.idle[g], tIdle, true); marcar(LOCO.walk[g], (fase % 1) * D_WALK, true); marcar(LOCO.sprint[g], (fase % 1) * D_SPRINT, true);
        marcar(AIR.jump[g], tPulo, false); marcar(AIR.fall[g], tQueda, true);
      }
      for (i = 0; i < UPG.length; i++) {
        g = UPG[i]; pesar(UPP.shoot[g], sW); pesar(UPP.atk[g], aW);
        marcar(UPP.shoot[g], pS * DUR_TIRO, false); marcar(UPP.atk[g], pA * DUR_GOLPE, false);
      }
      pesar(SEG, Math.max(0, 1 - sW - aW)); marcar(SEG, 0, false);
      mixer.update(dt);                                                          // tempo parado (timeScale 0): só avalia os clips nos tempos e pesos acima

      // direção do corpo: para onde corre; parado, para o inimigo (ou para onde mirava)
      var vl = Math.sqrt(vx * vx + vz * vz), engajado = !!(alvo && alvo.d <= alcance);
      var aimYaw = engajado ? Math.atan2(alvo.dx, alvo.dz) : Math.atan2(fx || 0, fz === undefined ? 1 : fz);
      var alvoYaw = vl > 0.7 ? Math.atan2(vx, vz) : aimYaw;
      yaw += angDif(yaw, alvoYaw) * Math.min(1, dt * (vl > 0.7 ? 12 : 9));
      raiz.rotation.y = yaw; raiz.scale.setScalar(1); est.giro = yaw; P.yawCorpo = yaw;
      // tronco e cabeça acompanham o inimigo mais próximo mesmo correndo para outro lado
      eng += ((engajado ? 1 : 0) - eng) * Math.min(1, dt * 8);
      var dif = angDif(yaw, aimYaw), tw = clamp(dif, -1.0, 1.0) * 0.75 * eng, hy = clamp(dif - tw, -0.6, 0.6) * 0.9 * eng;
      if (Math.abs(tw) > 0.001) B.torso.quaternion.premultiply(qa.setFromAxisAngle(AY, tw));
      if (Math.abs(hy) > 0.001) B.head.quaternion.premultiply(qa.setFromAxisAngle(AY, hy));

      // passos (poeira + som): contatos a cada meio ciclo
      var pIdx = Math.floor(fase * 2);
      if (pIdx !== ultimoPasso) { if (ar === 'chao' && mS > 0.5 && vs > 1.1 && aw < 0.3) P.eventos.push((pIdx & 1) ? 'passoD' : 'passoE'); ultimoPasso = pIdx; }

      // extras: inclinação no dash, agachada/esticada, tremida de dano
      hit = Math.max(0, hit - dt * 4);
      var incAlvo = (ar === 'dash' ? 0.55 : 0) - hit * 0.3;
      inc.rotation.x += (incAlvo - inc.rotation.x) * Math.min(1, dt * 14);
      sq += (0 - sq) * Math.min(1, dt * 10);
      st += (((ar === 'pulo' && tAr < 0.3) ? 0.09 : 0) - st) * Math.min(1, dt * 12);
      var sy = 1 - sq + st + hit * 0.06, sx = 1 + sq * 0.5 - st * 0.4;
      esc.scale.set(fit * sx, fit * sy, fit * sx);
      return P;
    }
    function animar(dt, t, vel, fx, fz, dashando, vx, vz, alvo) {
      try { return passo(dt, vel, fx, fz, dashando, vx, vz, alvo); }
      catch (e) { if (!avisou) { avisou = true; console.warn('[heroi-glb] erro na animação:', e); } P.eventos.length = 0; return P; }
    }
    function posPe(k, out) {
      var o = B[k === 0 ? 'leg-left' : 'leg-right']; o.getWorldPosition(V2);
      out.x = V2.x; out.z = V2.z; out.y = raiz.position.y; return out;
    }
    function impulso(tipo, forca) {
      if (tipo === 'tiro') sT = DUR_TIRO; else if (tipo === 'golpe') aT = DUR_GOLPE; else if (tipo === 'dano') hit = Math.min(1, forca || 1);
    }
    function pular() { if (ar !== 'chao') return false; ar = 'pulo'; tAr = 0; sq = -0.12; return true; }

    console.log('[heroi-glb] ' + persona + ': ' + cf.arquivo + ' · altura ' + (cf.altura || 2.7) + ' · fit ' + fit.toFixed(2));
    return { grupo: raiz, animar: animar, estado: est, anel: anel, cor: cor, posPe: posPe, impulso: impulso,
      recuar: function () { impulso('tiro'); }, golpear: function () { impulso('golpe'); }, pular: pular, materiais: [] };
  }

  window.NRHeroiGLB = { precarregar: precarregar, disponivel: disponivel, criar: criar };
})();
