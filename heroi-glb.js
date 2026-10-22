// ══════════════════════════════════════════════════════════════════
// HEROI-GLB.JS — coloca um modelo 3D humanoide REAL (.glb do Sketchfab, Mixamo etc.) no lugar do herói
// de blocos, usando EXATAMENTE a mesma animação física do animador.js (corrida com pés no chão, molas,
// dash de captura de movimento, rabo de cavalo...). Nada de ossos "gravados": cada quadro a pose é
// calculada e convertida para o esqueleto do modelo.
//
// COMO FUNCIONA O ENCAIXE (retarget por direção, não depende dos eixos dos ossos de cada modelo):
//  1. Acha os ossos pelo NOME (Mixamo, Sketchfab, Blender, Unity, "Bip01"...): quadril, coluna, pescoço,
//     cabeça, clavículas, braços, antebraços, mãos, coxas, canelas, pés, dedos do pé.
//  2. Guarda a pose de repouso (T-pose ou A-pose) de cada osso.
//  3. A cada quadro: para braços/pernas calcula para onde cada osso deve apontar e gira o osso do jeito
//     mais curto, do repouso até lá. Coluna/cabeça/pelve recebem as rotações da pose. O quadril sobe e
//     desce com a altura calculada pela animação (pés sempre no chão).
//  4. A arma (rifle/katana) fica presa ao tronco (acompanha a inclinação, recuo e golpe).
//
// COMO USAR: coloque o .glb na mesma pasta, edite heroi-config.js (ativo: true + nome do arquivo).
// Se o modelo não tiver esqueleto humanoide reconhecível, ele usa as animações que vêm no próprio .glb
// (idle/walk/run) ou, no pior caso, só inclinação/pulinho do corpo inteiro. O jogo nunca quebra: se algo
// falhar, volta para o herói de blocos.
// ══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var T = window.THREE;
  var cache = {};                 // persona → { cena, animacoes, carregando }
  var PI = Math.PI;

  // ── nomes de ossos → papel (tolerante a vários padrões) ──
  function limpar(n) { return String(n || '').toLowerCase().replace(/^.*[:|]/, '').replace(/mixamorig|bip001|bip01|armature|rig_|def[-_.]/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function lado(n) {                 // 'L' | 'R' | ''
    var s = ' ' + n + ' ';
    if (/ left | lt /.test(s) || /^left/.test(n) || /left$/.test(n)) return 'L';
    if (/ right | rt /.test(s) || /^right/.test(n) || /right$/.test(n)) return 'R';
    if (/ l | l$/.test(s) || /^l /.test(n) || / l$/.test(n)) return 'L';
    if (/ r | r$/.test(s) || /^r /.test(n) || / r$/.test(n)) return 'R';
    return '';
  }
  function papel(nomeBruto) {
    var n = limpar(nomeBruto), sd = lado(n), sem = n.replace(/\b(left|right|l|r)\b/g, ' ').replace(/^(left|right)/, '').replace(/(left|right)$/, '').replace(/\s+/g, ' ').trim();
    if (/thumb|index|middle|ring|pinky|finger|little|digit/.test(sem)) return null;
    var p = null;
    if (/(^|\s)(hips?|pelvis)(\s|$)/.test(sem)) p = 'hips';
    else if (/spine|chest|torso/.test(sem)) p = 'spine';
    else if (/neck/.test(sem)) p = 'neck';
    else if (/head/.test(sem) && !/top|end|nub|helmet/.test(sem)) p = 'head';
    else if (/shoulder|clavicle|collar/.test(sem)) p = 'ombro';
    else if (/fore ?arm|lower ?arm|low ?arm|loarm|elbow/.test(sem)) p = 'antebraco';
    else if (/up(per)? ?arm|(^|\s)arm(\s|$|\d)/.test(sem)) p = 'braco';
    else if (/hand|wrist/.test(sem)) p = 'mao';
    else if (/up(per)? ?leg|thigh/.test(sem)) p = 'coxa';
    else if (/calf|shin|lower ?leg|knee|(^|\s)leg(\s|$|\d)/.test(sem)) p = 'canela';
    else if (/foot|ankle/.test(sem)) p = 'pe';
    else if (/toe/.test(sem) && !/end|top|nub/.test(sem)) p = 'dedo';
    if (!p) return null;
    return (p === 'hips' || p === 'spine' || p === 'neck' || p === 'head') ? p : (sd ? p + sd : null);
  }

  function carregarScript(url) {
    return new Promise(function (ok, erro) { var s = document.createElement('script'); s.src = url; s.onload = ok; s.onerror = function () { erro(new Error('falha ao carregar ' + url)); }; document.head.appendChild(s); });
  }
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
          loader.load(cf.arquivo, function (g) { entrada.cena = g.scene; entrada.animacoes = g.animations || []; console.log('[heroi-glb] carregado:', cf.arquivo, '| animações no arquivo:', entrada.animacoes.map(function (a) { return a.name; }).join(', ') || '(nenhuma)'); res(); },
            undefined, function (e) { console.warn('[heroi-glb] não foi possível carregar', cf.arquivo, e); res(); });
        });
        return entrada.promessa;
      });
      return Promise.all(tarefas);
    })]).catch(function (e) { console.warn('[heroi-glb] desativado:', e.message); });
  }
  // cada herói ganha cópia própria do material (senão tingir um tingiria todos)
  function tingir(m, cor) { if (!m) return m; var n = m.clone(); if (n.emissive) { n.emissive.setHex(cor); if ('emissiveIntensity' in n) n.emissiveIntensity = 1; } return n; }
  function disponivel(persona) { return !!(cfgDe(persona) && cache[persona] && cache[persona].cena); }

  // ══════════════════════════════════════════════════════════════
  function criar(op) {
    var persona = op.persona || 'cacador', cf = cfgDe(persona), dados = cache[persona];
    if (!cf || !dados || !dados.cena) return null;
    var clone = (T.SkeletonUtils && T.SkeletonUtils.clone) ? T.SkeletonUtils.clone(dados.cena) : dados.cena.clone(true);
    // clima neon: tinge levemente todos os materiais de ciano/rosa (cf.emissivo = cor hexadecimal) para o visual "cyber"
    if (cf.emissivo) clone.traverse(function (o) { if (!o.isMesh) return; var ms = Array.isArray(o.material) ? o.material : [o.material]; o.material = Array.isArray(o.material) ? ms.map(function (m) { return tingir(m, cf.emissivo); }) : tingir(ms[0], cf.emissivo); });

    // ── hierarquia: raiz (yaw + escala) → cont → modelo (alinhado nos pés) ──
    var raiz = new T.Group(), cont = new T.Group(), modelo = new T.Group(); raiz.add(cont); cont.add(modelo); modelo.add(clone);
    modelo.rotation.y = cf.rotY || 0;
    raiz.updateMatrixWorld(true);
    var caixa = new T.Box3().setFromObject(clone), tamanho = new T.Vector3(); caixa.getSize(tamanho);
    var alvoAltura = cf.altura || 2.7, fit = tamanho.y > 0.001 ? alvoAltura / tamanho.y : 1;
    var cx = (caixa.min.x + caixa.max.x) / 2, cz = (caixa.min.z + caixa.max.z) / 2;
    modelo.position.set(-cx, -caixa.min.y, -cz);
    raiz.updateMatrixWorld(true);

    // ── ossos ──
    var ossos = {}, todos = [], mapaManual = cf.ossos || {};
    clone.traverse(function (o) { todos.push(o); });
    Object.keys(mapaManual).forEach(function (k) { var nome = mapaManual[k]; var o = todos.filter(function (x) { return x.name === nome; })[0]; if (o) ossos[k] = o; });
    var espinhas = [];
    todos.forEach(function (o) {
      if (!(o.isBone || (o.children && o.children.length) || o.name)) return;
      var p = papel(o.name); if (!p) return;
      if (p === 'spine') { espinhas.push(o); return; }
      if (!ossos[p]) ossos[p] = o;
    });
    function prof(o) { var d = 0; while (o.parent) { d++; o = o.parent; } return d; }
    espinhas.sort(function (a, b) { return prof(a) - prof(b); });
    var temEsq = ossos.hips && ossos.head && ossos.coxaL && ossos.coxaR && ossos.canelaL && ossos.canelaR && ossos.peL && ossos.peR && ossos.bracoL && ossos.bracoR && ossos.antebracoL && ossos.antebracoR;

    // ── escala da perna em relação ao esqueleto padrão do jogo (perna = 1.0) ──
    var wp = new T.Vector3(), wp2 = new T.Vector3();
    function pos(o) { return o.getWorldPosition(new T.Vector3()); }
    var info = { tipo: temEsq ? 'humanoide' : 'simples', ossos: Object.keys(ossos).length + espinhas.length };
    var sc = 1, restHipY = 0, restAnkleY = 0;
    var rest = {};
    function guardar(o, chave) { rest[chave] = { o: o, wq: o.getWorldQuaternion(new T.Quaternion()), wp: pos(o), lq: o.quaternion.clone(), lp: o.position.clone() }; }
    var limbs = {};
    if (temEsq) {
      var ordem = ['hips', 'neck', 'head', 'ombroL', 'ombroR', 'bracoL', 'bracoR', 'antebracoL', 'antebracoR', 'maoL', 'maoR', 'coxaL', 'coxaR', 'canelaL', 'canelaR', 'peL', 'peR', 'dedoL', 'dedoR'];
      ordem.forEach(function (k) { if (ossos[k]) guardar(ossos[k], k); });
      espinhas.forEach(function (o, i) { guardar(o, 'coluna' + i); });
      restHipY = (rest.coxaL.wp.y + rest.coxaR.wp.y) / 2; restAnkleY = (rest.peL.wp.y + rest.peR.wp.y) / 2;
      sc = Math.max(0.2, (restHipY - restAnkleY) / 1.0);             // altura da perna do modelo ÷ perna padrão (1.0)
      // direção de repouso (em relação ao filho): usada nos braços/pernas
      var dir = function (a, b) { return b.wp.clone().sub(a.wp).normalize(); };
      limbs.restDir = { bracoL: dir(rest.bracoL, rest.antebracoL), bracoR: dir(rest.bracoR, rest.antebracoR), antebracoL: rest.maoL ? dir(rest.antebracoL, rest.maoL) : null, antebracoR: rest.maoR ? dir(rest.antebracoR, rest.maoR) : null,
        coxaL: dir(rest.coxaL, rest.canelaL), coxaR: dir(rest.coxaR, rest.canelaR), canelaL: dir(rest.canelaL, rest.peL), canelaR: dir(rest.canelaR, rest.peR) };
      if (!rest.maoL) limbs.restDir.antebracoL = limbs.restDir.bracoL; if (!rest.maoR) limbs.restDir.antebracoR = limbs.restDir.bracoR;
    }
    // cabelo/rabo de cavalo do próprio modelo (opcional): ossos "hair/pony/tail" descendentes da cabeça
    var cabelo = [];
    if (temEsq) { var h = ossos.head; var achar = function (o, acc) { o.children.forEach(function (c) { if (/hair|pony|cabelo|rabo|ponytail/i.test(c.name)) { acc.push(c); achar(c, acc); } else achar(c, acc); }); }; achar(h, cabelo); }
    var cabeloRest = cabelo.map(function (o) { return o.quaternion.clone(); });

    // sem esqueleto humanoide reconhecido: usa as animações que vieram no próprio arquivo (idle/walk/run)
    var mixer = null, acoes = {};
    if (!temEsq && dados.animacoes.length && T.AnimationMixer) {
      mixer = new T.AnimationMixer(clone);
      dados.animacoes.forEach(function (a) { var n = a.name.toLowerCase(), tp = /run|sprint|corr/.test(n) ? 'run' : /walk|anda/.test(n) ? 'walk' : /idle|stand|parad|breath/.test(n) ? 'idle' : null; if (tp && !acoes[tp]) acoes[tp] = mixer.clipAction(a); });
      if (!acoes.idle) acoes.idle = mixer.clipAction(dados.animacoes[0]);
      Object.keys(acoes).forEach(function (k) { acoes[k].play(); acoes[k].setEffectiveWeight(k === 'idle' ? 1 : 0); });
    }
    // ── escala/altura final do herói e arma presa ao tronco ──
    raiz.scale.setScalar(fit);
    var pivo = new T.Group(); cont.add(pivo);
    var weapon = window.NRModelos.criarArma({ katana: !!op.katana, rifle: !!op.rifle, fem: !!op.fem }, {
      mArm2: new T.MeshPhongMaterial({ color: 0x1e2742, shininess: 60 }), mJunta: new T.MeshPhongMaterial({ color: 0x0c0f1a }), mNeon: new T.MeshBasicMaterial({ color: op.cor || 0x2ee6ff }), mAcento: new T.MeshBasicMaterial({ color: 0xff3da6 }) });
    var arma = weapon.grupo, off = cf.armaOffset || { x: 0, y: 0, z: 0 }, armaEsc = (cf.armaEscala || 1) * sc;
    arma.scale.setScalar(armaEsc); pivo.add(arma);
    function posArma() { arma.position.set((weapon.pos.x + off.x) * sc, (weapon.pos.y + off.y) * sc, (weapon.pos.z + off.z) * sc); }
    posArma();

    // ── animador ──
    var anim = window.NRAnimador.criar({ L1: 0.5, L2: 0.5, fh: 0.1, hw: 0.19, nCola: 6, nCachecol: 0, arma: op.katana ? 'katana' : 'rifle' });
    var est = { giro: 0, neon: op.cor || 0x2ee6ff, pose: anim.pose, info: info };

    // auxiliares (objetos reaproveitados: nada de lixo por quadro)
    var Q = {}; ['pel', 'tor', 'cab', 'cum', 'tmp', 'tmp2', 'pt', 'ax', 'pw', 'rw', 'novo'].forEach(function (k) { Q[k] = new T.Quaternion(); });
    var E = new T.Euler(), V = new T.Vector3(), V2 = new T.Vector3(), UP = new T.Vector3(0, -1, 0), AX = new T.Vector3(1, 0, 0);
    var restPivo = temEsq ? new T.Vector3((rest.coxaL.wp.x + rest.coxaR.wp.x) / 2, restHipY, (rest.coxaL.wp.z + rest.coxaR.wp.z) / 2) : new T.Vector3(0, 1, 0);
    function eul(q, x, y, z, ordem) { E.set(x, y, z, ordem); return q.setFromEuler(E); }
    function mudar(osso, chave, qMundoCont) {       // põe o osso para ter rotação "qMundoCont" (no referencial do container) e atualiza a hierarquia
      var pai = osso.parent; Q.rw.identity();
      cont.getWorldQuaternion(Q.rw);                                  // container → mundo
      Q.novo.copy(Q.rw).multiply(qMundoCont);                         // alvo no mundo
      if (pai) pai.getWorldQuaternion(Q.pw); else Q.pw.identity();
      osso.quaternion.copy(Q.pw).invert().multiply(Q.novo);           // local = pai⁻¹ · alvo
      osso.updateMatrixWorld(true);
    }
    function girarPara(chave, alvoDir) { Q.tmp.setFromUnitVectors(limbs.restDir[chave], alvoDir); Q.cum.copy(Q.tmp).multiply(rest[chave].wq); return Q.cum; }

    // ── animar (todo quadro) ──
    function animar(dt, t, vel, fx, fz, dashando, vx, vz) {
      if (vx === undefined) { vx = 0; vz = 0; }
      var vl = Math.sqrt(vx * vx + vz * vz), dd = dashando && vl > 0.1;
      var p = anim.atualizar(dt, { vx: vx, vz: vz, fx: fx, fz: fz, dash: !!dashando, dashDx: dd ? vx / vl : 0, dashDz: dd ? vz / vl : 0 });
      raiz.rotation.y = p.yawCorpo; est.giro = p.yawCorpo;
      raiz.scale.set(fit * p.escala.x, fit * p.escala.y, fit * p.escala.z);
      raiz.updateMatrixWorld(true);
      var q = p.quadril, c = p.coluna, h = p.cabeca;
      eul(Q.pel, q.pitch, q.yaw, q.roll, 'YXZ'); eul(Q.tor, c.pitch, c.yaw, c.roll, 'YXZ'); eul(Q.cab, h.pitch, h.yaw, h.roll, 'YXZ');
      var dY = (q.y - 1.1) * sc;                                      // quanto o quadril sobe/desce em relação ao repouso (perna esticada = 1.0 + tornozelo 0.1 = 1.1), em unidades do modelo

      if (!temEsq) { return animarSimples(p, dY, dt); }

      // QUADRIL: posição (sobe/desce) + rotação
      var hips = ossos.hips; V.set(rest.hips.wp.x, rest.hips.wp.y + dY, rest.hips.wp.z);
      cont.localToWorld(V); if (hips.parent) { hips.parent.worldToLocal(V); hips.position.copy(V); }
      Q.cum.copy(Q.pel).multiply(rest.hips.wq); mudar(hips, 'hips', Q.cum);

      // COLUNA: rotação do tronco distribuída entre os ossos da coluna
      var n = espinhas.length;
      for (var i = 0; i < n; i++) { Q.tmp.identity().slerp(Q.tor, (i + 1) / n); Q.cum.copy(Q.pel).multiply(Q.tmp).multiply(rest['coluna' + i].wq); mudar(espinhas[i], 'col', Q.cum); }
      var qPT = Q.pt.copy(Q.pel).multiply(Q.tor);                     // pelve · tronco
      // PESCOÇO e CABEÇA
      if (ossos.neck) { Q.tmp.identity().slerp(Q.cab, 0.4); Q.cum.copy(qPT).multiply(Q.tmp).multiply(rest.neck.wq); mudar(ossos.neck, 'neck', Q.cum); }
      Q.tmp.copy(qPT).multiply(Q.cab); Q.cum.copy(Q.tmp).multiply(rest.head.wq); mudar(ossos.head, 'head', Q.cum);
      // cabelo próprio do modelo (se existir): segue as molas do rabo de cavalo
      for (var ci = 0; ci < cabelo.length; ci++) { var ps = p.cola[Math.min(ci, p.cola.length - 1)]; E.set(ps.x - 0.3, ps.y, 0, 'XYZ'); cabelo[ci].quaternion.copy(cabeloRest[ci]).multiply(Q.tmp.setFromEuler(E)); }

      var lados = ['L', 'R'];
      for (var k = 0; k < 2; k++) {
        var s = lados[k], pl = p.perna[k], ar = p.braco[k], ld = k === 0 ? 1 : -1;
        // OMBRO (clavícula) acompanha o tronco
        if (ossos['ombro' + s]) { Q.cum.copy(qPT).multiply(rest['ombro' + s].wq); mudar(ossos['ombro' + s], 'om', Q.cum); }
        // BRAÇO e ANTEBRAÇO: apontam na direção da pose
        var gp = (op.katana && k === 1) ? p.arma.golpe * 0.55 : 0;
        eul(Q.tmp, -(ar.pitch + gp), 0, ld * ar.roll, 'ZXY');                              // braço no referencial do tronco
        V.copy(UP).applyQuaternion(Q.tmp).applyQuaternion(qPT);
        mudar(ossos['braco' + s], 'br', girarPara('braco' + s, V));
        eul(Q.tmp, -(ar.pitch + gp), 0, ld * ar.roll, 'ZXY'); Q.tmp.multiply(Q.ax.setFromAxisAngle(AX, -ar.cotovelo));       // + cotovelo
        V.copy(UP).applyQuaternion(Q.tmp).applyQuaternion(qPT);
        var dFore = girarPara('antebraco' + s, V).clone();
        mudar(ossos['antebraco' + s], 'fa', dFore);
        if (ossos['mao' + s]) { Q.tmp.setFromUnitVectors(limbs.restDir['antebraco' + s], V); Q.cum.copy(Q.tmp).multiply(rest['mao' + s].wq); mudar(ossos['mao' + s], 'mao', Q.cum); }
        // PERNA: coxa → canela → pé (mesma convenção do animador)
        eul(Q.tmp, -pl.pitch, pl.yaw, pl.roll, 'ZXY');                                      // coxa no referencial da pelve
        V.copy(UP).applyQuaternion(Q.tmp).applyQuaternion(Q.pel);
        mudar(ossos['coxa' + s], 'cx', girarPara('coxa' + s, V));
        Q.tmp.multiply(Q.ax.setFromAxisAngle(AX, pl.joelho));                                   // + joelho
        V.copy(UP).applyQuaternion(Q.tmp).applyQuaternion(Q.pel);
        mudar(ossos['canela' + s], 'cn', girarPara('canela' + s, V));
        Q.tmp.multiply(Q.ax.setFromAxisAngle(AX, pl.pe));                                        // + pé
        Q.cum.copy(Q.pel).multiply(Q.tmp).multiply(rest['pe' + s].wq);
        mudar(ossos['pe' + s], 'pe', Q.cum);
        if (ossos['dedo' + s]) { Q.cum.copy(Q.pel).multiply(Q.tmp).multiply(rest['dedo' + s].wq); mudar(ossos['dedo' + s], 'dedo', Q.cum); }
      }
      // ARMA presa ao tronco (pivô na cintura, gira com pelve+tronco)
      pivo.position.set(restPivo.x, restPivo.y + dY, restPivo.z); pivo.quaternion.copy(Q.pel).multiply(Q.tor);
      aplicarArma(p);
      return p;
    }
    function aplicarArma(p) {
      if (op.katana) { arma.rotation.set(0, 0.25 + p.arma.golpe * 1.5, Math.abs(p.arma.golpe) * 0.45); posArma(); }
      else { arma.position.set((weapon.pos.x + off.x) * sc, (weapon.pos.y + off.y + p.arma.recuo * 0.01) * sc, (weapon.pos.z + off.z - p.arma.recuo * 0.17) * sc); arma.rotation.x = p.arma.pitch - p.arma.recuo * 0.1; }
    }
    // MODO SIMPLES (sem esqueleto humanoide): só o corpo inteiro se mexe (pulinho + inclinação)
    function animarSimples(p, dY, dt) {
      if (mixer) { var wr = p.corrida, ww = Math.max(0, p.andando - p.corrida), wi = Math.max(0, 1 - p.andando); if (acoes.run) acoes.run.setEffectiveWeight(wr); if (acoes.walk) acoes.walk.setEffectiveWeight(acoes.run ? ww : p.andando); if (acoes.idle) acoes.idle.setEffectiveWeight(wi + (acoes.walk || acoes.run ? 0 : p.andando)); mixer.update(dt); return aplicarSimples(p, dY); }
      return aplicarSimples(p, dY);
    }
    function aplicarSimples(p, dY) {
      modelo.position.y = -caixa.min.y + dY * 0.5; cont.rotation.set(p.coluna.pitch * 0.6, 0, p.coluna.roll * 0.6, 'YXZ');
      pivo.position.set(0, restPivo.y + dY, 0); pivo.quaternion.copy(cont.quaternion); aplicarArma(p);
      return p;
    }
    function posPe(k, out) {
      var o = ossos[k === 0 ? 'peL' : 'peR'];
      if (o) { o.getWorldPosition(V2); out.x = V2.x; out.z = V2.z; } else { out.x = raiz.position.x; out.z = raiz.position.z; }
      out.y = raiz.position.y; return out;
    }
    console.log('[heroi-glb] ' + persona + ': modo ' + info.tipo + ' | ossos reconhecidos: ' + Object.keys(ossos).join(', ') + ' | coluna: ' + espinhas.length + ' | cabelo: ' + cabelo.length);

    // anel de brilho no chão (igual ao herói de blocos)
    var anel = new T.Mesh(new T.RingGeometry(0.75 / fit, 0.95 / fit, 28), new T.MeshBasicMaterial({ color: est.neon, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    anel.rotation.x = -PI / 2; anel.position.y = 0.04 / fit; modelo.parent.add(anel);
    return { grupo: raiz, animar: animar, estado: est, anel: anel, cor: est.neon, posPe: posPe, impulso: anim.impulso,
      recuar: function () { anim.impulso('tiro'); }, golpear: function () { anim.impulso('golpe'); }, materiais: [] };
  }

  window.NRHeroiGLB = { precarregar: precarregar, disponivel: disponivel, criar: criar, papel: papel };
})();
