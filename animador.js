// ══════════════════════════════════════════════════════════════════
// ANIMADOR.JS — o "cérebro" da animação do herói (sem nada de 3D aqui: só matemática).
//
// Ele recebe a VELOCIDADE e a MIRA do jogador e devolve uma POSE em ângulos anatômicos
// (coxa, joelho, pé, braço, cotovelo, coluna, cabeça, rabo de cavalo...). Quem desenha
// (modelos.js para o herói de blocos, heroi-glb.js para o modelo do Sketchfab) só aplica a pose.
//
// O QUE É FÍSICA/PROCEDURAL AQUI (nada de "ciclo gravado" repetindo):
//  • CAMINHADA / CORRIDA / RÉ / LATERAL: os pés seguem uma trajetória de passada e as pernas são
//    resolvidas por CINEMÁTICA INVERSA (IK de 2 ossos). O pé de apoio anda para trás exatamente na
//    velocidade do chão → o pé NÃO ESCORREGA. O quadril sobe e desce sozinho (vaivém natural), a
//    cadência e o tamanho do passo crescem com a velocidade, e há fase de voo na corrida.
//  • MOLAS (amortecedores): cada parte do corpo reage com inércia própria. O tronco inclina com
//    a aceleração, a cabeça tem atraso, a pelve e o tronco giram em tempos diferentes, e tiro,
//    golpe, dano e pouso dão "chutes" que as molas absorvem e balançam.
//  • CORRENTES: rabo de cavalo e cachecol são correntes de segmentos com mola, gravidade, vento
//    (velocidade) e inércia (aceleração do corpo).
//  • DASH: usa a ANIMAÇÃO REAL de captura de movimento (Mixamo, em anim-dados.js): decolagem, voo
//    e pouso, convertida em ângulos e misturada com a física.
//
// Convenções (radianos): pitch > 0 = para FRENTE; yaw > 0 = vira para a ESQUERDA do personagem;
// perna/braço índice 0 = ESQUERDA (+x), 1 = DIREITA (-x). Altura do quadril em unidades do jogo.
// ══════════════════════════════════════════════════════════════════
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NRAnimador = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PI = Math.PI, TAU = PI * 2;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function suave(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function volta(a) { while (a > PI) a -= TAU; while (a < -PI) a += TAU; return a; }
  function frac(x) { return x - Math.floor(x); }

  // ── MOLA amortecida (x = valor, v = velocidade). w = rigidez (rad/s), z = amortecimento (1 = sem balanço) ──
  function mola(m, alvo, w, z, dt) {
    var n = Math.max(1, Math.ceil(dt / 0.012)), h = dt / n;           // subpassos: estável mesmo com FPS baixo
    for (var i = 0; i < n; i++) { var a = -2 * z * w * m.v - w * w * (m.x - alvo); m.v += a * h; m.x += m.v * h; }
    return m.x;
  }
  // mola para ângulos (escolhe o caminho curto)
  function molaAng(m, alvo, w, z, dt) { m.x = alvo + volta(m.x - alvo); return mola(m, alvo, w, z, dt); }
  function M(x) { return { x: x || 0, v: 0 }; }

  // ── CINEMÁTICA INVERSA DA PERNA (2 ossos) ──
  // Alvo = posição do TORNOZELO relativa à junta do quadril (x esquerda, y cima, z frente).
  // Saída no formato do esqueleto: coxa gira em ordem 'ZXY' (roll=z, pitch=-x, yaw=y), canela só dobra em x.
  function ikPerna(o, x, y, z, L1, L2) {
    var d = Math.sqrt(x * x + y * y + z * z), dmax = (L1 + L2) * 0.998, dmin = Math.abs(L1 - L2) + 0.05, k = 1;
    if (d > dmax) k = dmax / d; else if (d < dmin) k = dmin / d;
    x *= k; y *= k; z *= k; d *= k;
    var ux = x / d, uy = y / d, uz = z / d;
    var A = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    // joelho sempre para a FRENTE: n = (0,0,1) sem a componente ao longo de u
    var nx = -uz * ux, ny = -uz * uy, nz = 1 - uz * uz, nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    var ca = Math.cos(A), sa = Math.sin(A);
    var tx = ca * ux + sa * nx, ty = ca * uy + sa * ny, tz = ca * uz + sa * nz;      // direção da coxa
    // coxa acima da horizontal (joelho levantado além de 90°): usa a outra representação (pitch > 90°) para não "virar"
    var p, r;
    if (ty > 0) { p = PI - Math.asin(clamp(tz, -1, 1)); r = Math.atan2(-tx, ty); } else { p = Math.asin(clamp(tz, -1, 1)); r = Math.atan2(tx, -ty); }
    // vetor joelho → tornozelo, levado ao referencial da coxa para achar a torção (yaw) e a dobra do joelho
    var wx = x - tx * L1, wy = y - ty * L1, wz = z - tz * L1;
    var cr = Math.cos(-r), sr = Math.sin(-r);                                          // Rz(-r)
    var ax = wx * cr - wy * sr, ay = wx * sr + wy * cr, az = wz;
    var cp = Math.cos(p), sp = Math.sin(p);                                            // Rx(+p)
    var bx = ax, by = ay * cp - az * sp, bz = ay * sp + az * cp;
    var yaw = Math.atan(bx / (Math.abs(bz) < 1e-6 ? 1e-6 : bz));                       // torção da coxa que alinha a dobradiça do joelho (x local = 0)
    var lz = bx * Math.sin(yaw) + bz * Math.cos(yaw);                                   // componente z da canela no referencial da coxa (<0 = para trás)
    o.pitch = p; o.roll = r; o.yaw = clamp(yaw, -0.8, 0.8);
    o.joelho = clamp(Math.atan2(-lz, -by), 0, 2.5);                                    // dobra do joelho (>0 = canela para trás)
    return o;
  }

  // ── DASH com captura de movimento ──
  function amostrarSalto(dados, t, out) {
    var q = dados.quadros, n = q.length, f = clamp(t * dados.fps, 0, n - 1.0001), i = Math.floor(f), u = f - i, a = q[i], b = q[i + 1];
    for (var c = 0; c < dados.campos.length; c++) { var k = dados.campos[c]; out[k] = lerp(a[k], b[k], u); }
    out.quadrilY = lerp(a.quadrilY, b.quadrilY, u);
    return out;
  }

  // ══════════════════════════════════════════════════════════════
  function criar(cfg) {
    cfg = cfg || {};
    var L1 = cfg.L1 || 0.5, L2 = cfg.L2 || 0.5, FH = cfg.fh === undefined ? 0.1 : cfg.fh, HW = cfg.hw || 0.19, LMAX = L1 + L2;
    var NCOLA = cfg.nCola === undefined ? 0 : cfg.nCola, NCACH = cfg.nCachecol === undefined ? 0 : cfg.nCachecol;
    var arma = cfg.arma || 'rifle';                       // 'rifle' | 'base' (duas mãos) | 'katana' (mão direita)
    var salto = cfg.salto || (typeof window !== 'undefined' && window.NRAnimDados && window.NRAnimDados.salto) || null;
    var SALTO_DUR = salto ? (salto.quadros.length - 1) / salto.fps : 0.4;
    var KALT = (L1 + L2 + 0.1) * 0.98 / 85;               // converte altura do quadril do clipe (cm) para unidades do jogo

    // ── estado interno ──
    var S = {
      iniciado: false, fase: 0, vx: 0, vz: 0, ax: 0, az: 0, runF: M(0), movF: M(0),
      yawPelve: M(0), yawTorso: M(0), yawCab: M(0), hip: M(FH + LMAX * 0.95), hipOff: M(0),
      leanP: M(0), leanR: M(0), cabP: M(0), cabR: M(0), cabY: M(0),
      mochila: M(0), arma: M(0), armaY: M(0), golpe: M(0), dano: M(0), pouso: M(0), tiro: M(0),
      leapT: -1, dashAnt: false, contato: [false, false], sinalGolpe: 1,
      cola: [], cach: [], t: 0, ultimaDir: 0,
    };
    for (var i = 0; i < NCOLA; i++) S.cola.push({ a: M(0.25), b: M(0) });
    for (var j = 0; j < NCACH; j++) S.cach.push({ a: M(0.3), b: M(0) });

    // pose reaproveitada a cada quadro (zero lixo para o coletor de memória)
    var pose = {
      yawCorpo: 0, quadril: { y: 1, pitch: 0, roll: 0, yaw: 0, x: 0 }, coluna: { pitch: 0, roll: 0, yaw: 0 }, cabeca: { pitch: 0, roll: 0, yaw: 0 },
      perna: [{ pitch: 0, roll: 0, yaw: 0, joelho: 0, pe: 0, apoio: 0 }, { pitch: 0, roll: 0, yaw: 0, joelho: 0, pe: 0, apoio: 0 }],
      braco: [{ pitch: 0, roll: 0, cotovelo: 0 }, { pitch: 0, roll: 0, cotovelo: 0 }],
      arma: { recuo: 0, yaw: 0, pitch: 0, golpe: 0 }, cola: [], cachecol: [], mochila: 0,
      escala: { x: 1, y: 1, z: 1 }, eventos: [], corrida: 0, andando: 0, voo: 0,
    };
    for (i = 0; i < NCOLA; i++) pose.cola.push({ x: 0, y: 0 });
    for (j = 0; j < NCACH; j++) pose.cachecol.push({ x: 0, y: 0 });
    var ik = [{}, {}], clip = {}, pePrev = [0, 0];

    // ── impulsos externos (tiro, golpe da katana, dano...) ──
    function impulso(tipo, forca) {
      forca = forca === undefined ? 1 : forca;
      if (tipo === 'tiro') S.tiro.v += 9 * forca;
      else if (tipo === 'golpe') { S.sinalGolpe = -S.sinalGolpe; S.golpe.v += 16 * forca * S.sinalGolpe; S.pouso.v += 1.2 * forca; }
      else if (tipo === 'dano') { S.dano.v += 7 * forca; S.hipOff.v -= 1.6 * forca; }
      else if (tipo === 'pouso') { S.pouso.v += 5 * forca; S.hipOff.v -= 2.2 * forca; }
    }

    // ══════════ ATUALIZAÇÃO (todo quadro) ══════════
    // e = { vx, vz (velocidade no MUNDO, u/s), fx, fz (direção da mira), dash (bool), dashDx, dashDz, vivo }
    function atualizar(dt, e) {
      dt = clamp(dt, 0.0005, 0.05);
      var ev = pose.eventos; ev.length = 0;
      S.t += dt;
      var vx = e.vx || 0, vz = e.vz || 0, vel = Math.sqrt(vx * vx + vz * vz);
      var fl = Math.hypot(e.fx || 0, e.fz || 0), aimYaw = fl > 0.01 ? Math.atan2(e.fx, e.fz) : S.ultimaDir; S.ultimaDir = aimYaw;
      if (!S.iniciado) { S.iniciado = true; S.yawPelve.x = S.yawTorso.x = S.yawCab.x = aimYaw; S.vx = vx; S.vz = vz; }

      // aceleração suavizada (alimenta inclinação do tronco, cabelo e mochila)
      var kv = 1 - Math.exp(-dt / 0.07), nvx = lerp(S.vx, vx, kv), nvz = lerp(S.vz, vz, kv);
      var axw = (nvx - S.vx) / dt, azw = (nvz - S.vz) / dt; S.vx = nvx; S.vz = nvz;
      S.ax = lerp(S.ax, axw, 1 - Math.exp(-dt / 0.05)); S.az = lerp(S.az, azw, 1 - Math.exp(-dt / 0.05));

      // quanto está andando / correndo (molas evitam trocas bruscas)
      var runAlvo = suave(2.4, 4.7, vel), movAlvo = suave(0.12, 0.8, vel);
      mola(S.runF, runAlvo, 9, 1, dt); mola(S.movF, movAlvo, 14, 1, dt);
      var runF = clamp(S.runF.x, 0, 1), movF = clamp(S.movF.x, 0, 1);

      // ── DASH: dispara/encerra o salto de captura de movimento ──
      if (e.dash && !S.dashAnt && salto) { S.leapT = 0; }
      S.dashAnt = !!e.dash;
      var wLeap = 0;
      if (S.leapT >= 0) {
        S.leapT += dt;
        wLeap = suave(0, 0.07, S.leapT) * (1 - suave(SALTO_DUR - 0.1, SALTO_DUR, S.leapT));
        if (S.leapT >= SALTO_DUR) { S.leapT = -1; wLeap = 0; impulso('pouso', 0.9); ev.push('pouso'); }
        else amostrarSalto(salto, S.leapT, clip);
      }

      // ── GIRO: pelve segue o movimento, tronco segue a mira, cabeça olha a mira ──
      var alvoPelve = aimYaw, ladoGaitSinal = 1;
      if (vel > 0.35) {
        var mov = Math.atan2(vx, vz), d = volta(mov - aimYaw);
        if (Math.abs(d) > PI / 2) d = volta(d - PI);                       // andando de costas: pelve continua virada para a mira
        alvoPelve = aimYaw + clamp(d * 0.8, -0.95, 0.95);
      }
      if (wLeap > 0 && (e.dashDx || e.dashDz)) alvoPelve = lerp(alvoPelve, aimYaw + volta(Math.atan2(e.dashDx, e.dashDz) - aimYaw), wLeap);
      molaAng(S.yawPelve, alvoPelve, 9 + 6 * wLeap, 0.85, dt);
      molaAng(S.yawTorso, aimYaw, 22, 0.8, dt);
      molaAng(S.yawCab, aimYaw, 34, 0.7, dt);
      var yawP = S.yawPelve.x;

      // ── velocidade no referencial da pelve (x = esquerda, z = frente) ──
      var sn = Math.sin(yawP), cs = Math.cos(yawP);
      var pf = S.vx * sn + S.vz * cs, ps = S.vx * cs - S.vz * sn, sp = Math.sqrt(pf * pf + ps * ps);
      var dx = sp > 0.05 ? ps / sp : 0, dz = sp > 0.05 ? pf / sp : 1;
      var recuando = pf < -0.2 ? 0.8 : 1;

      // ── PASSADA: tamanho e cadência crescem com a velocidade ──
      var Sl = (0.75 + 0.5 * sp) * recuando;                               // distância percorrida em 1 passada completa (2 passos)
      if (sp > 0.05) S.fase = frac(S.fase + dt * sp / Sl);
      var D = lerp(0.62, 0.34, runF);                                      // fração da passada com o pé no chão
      var Sc = D * Sl * movF;                                              // quanto o pé de apoio recua em relação à pelve
      var lift = lerp(0.15, 0.5, runF) * movF;
      var Lk = LMAX * lerp(0.965, 0.89, runF);                             // perna nunca fica 100% esticada (joelho sempre trabalha)

      // alvo dos pés + altura do quadril
      var hipNec = 1e9, temApoio = false, tau = [0, 0], liftK = [0, 0], sK = [0, 0], apoio = [0, 0], fx2 = [0, 0], fz2 = [0, 0];
      for (var k = 0; k < 2; k++) {
        var lado = k === 0 ? 1 : -1, p = frac(S.fase + (k ? 0.5 : 0)), s, lv = 0, em;
        if (p < D) {                                                       // APOIO: o pé recua na velocidade do chão
          var u = p / D; s = (0.5 - u) * Sc; em = 1;
          tau[k] = u < 0.3 ? lerp(-0.22, 0, u / 0.3) : u < 0.72 ? 0 : lerp(0, 0.5, (u - 0.72) / 0.28);
        } else {                                                           // BALANÇO: o pé volta em arco
          var w = (p - D) / (1 - D), ew = w * w * (3 - 2 * w); s = (-0.5 + ew) * Sc; lv = lift * Math.pow(Math.sin(PI * w), 0.85); em = 0;
          tau[k] = lerp(0.5, -0.22, suave(0.05, 0.85, w));
        }
        tau[k] *= movF; apoio[k] = em; liftK[k] = lv; sK[k] = s;
        fx2[k] = lado * (HW + 0.025 * (1 - movF)) + dx * s; fz2[k] = dz * s + 0.02;
        if (em) {                                                          // quadril precisa ficar alto o bastante para o pé de apoio alcançar o chão
          var dxh = fx2[k] - lado * HW, dzh = fz2[k], hk = FH + Math.sqrt(Math.max(0.04, Lk * Lk - dxh * dxh - dzh * dzh));
          hipNec = Math.min(hipNec, hk); temApoio = true;
        }
      }
      var alvoHip = temApoio ? hipNec : FH + Lk + 0.07 * runF;             // sem pé no chão = fase de voo da corrida
      // respiração e troca de peso quando parado
      var idle = 1 - movF;
      alvoHip += Math.sin(S.t * 1.7) * 0.006 * idle;
      mola(S.hip, alvoHip, 30, 1, dt);
      var hipY = S.hip.x;

      // ── pose do quadril (com solavancos de pouso/dano) ──
      mola(S.hipOff, 0, 22, 0.35, dt);
      var hipPos = hipY + S.hipOff.x;
      var dropE = liftK[0] - liftK[1];                                     // o lado do pé levantado cai um pouco
      var sig = (clamp(sK[0] / (Sc * 0.5 + 1e-4), -1, 1) - clamp(sK[1] / (Sc * 0.5 + 1e-4), -1, 1)) * 0.5 * movF;   // -1..1: perna esquerda à frente = +1
      var rollQuad = -dropE * 0.12 * (0.4 + runF) + Math.sin(S.t * 0.7) * 0.012 * idle;
      var yawQuad = -sig * 0.13 * (0.35 + runF);

      // ── PERNAS: IK ──
      for (k = 0; k < 2; k++) {
        var lado2 = k === 0 ? 1 : -1;
        var gy = -(hipY - FH) + liftK[k];                                  // tornozelo em relação ao quadril (chão = -(altura - FH))
        ikPerna(ik[k], fx2[k] - lado2 * HW, gy, fz2[k], L1, L2);
        var pl = pose.perna[k];
        pl.pitch = ik[k].pitch; pl.roll = ik[k].roll; pl.yaw = ik[k].yaw; pl.joelho = ik[k].joelho; pl.apoio = apoio[k];
        pl.pe = (ik[k].pitch - ik[k].joelho) - tau[k];                     // pé acompanha a canela e se mantém reto no chão
        // contato com o chão → evento de passo
        if (apoio[k] && !S.contato[k] && movF > 0.35) { ev.push(k === 0 ? 'passoE' : 'passoD'); }
        S.contato[k] = !!apoio[k];
      }

      // ── TRONCO: inclinação por velocidade + aceleração (molas) ──
      var axl = S.ax * cs - S.az * sn, azl = S.ax * sn + S.az * cs;         // aceleração no referencial da pelve (x esq, z frente)
      var leanBase = 0.05 + 0.33 * runF * movF + 0.1 * walkF(movF, runF);
      mola(S.leanP, leanBase + clamp(azl * 0.022, -0.2, 0.26), 12, 0.55, dt);
      mola(S.leanR, clamp(-axl * 0.02, -0.2, 0.2) - clamp(ps * 0.015, -0.1, 0.1), 12, 0.55, dt);
      mola(S.dano, 0, 14, 0.3, dt); mola(S.tiro, 0, 26, 0.35, dt); mola(S.golpe, 0, 15, 0.38, dt); mola(S.pouso, 0, 18, 0.3, dt);
      var respira = Math.sin(S.t * 1.6) * 0.012 * idle;
      var pitchTronco = S.leanP.x - S.dano.x * 0.05 - S.tiro.x * 0.012 + respira + S.pouso.x * 0.06;
      var rollTronco = S.leanR.x + S.golpe.x * 0.02;
      var twist = clamp(volta(S.yawTorso.x - yawP), -1.2, 1.2) + sig * 0.2 * (0.3 + runF) * 1 + S.golpe.x * 0.07;

      // ── CABEÇA: estabiliza o olhar e balança com atraso ──
      mola(S.cabP, -0.55 * pitchTronco - clamp(azl * 0.012, -0.12, 0.12) - S.dano.x * 0.07, 22, 0.45, dt);
      mola(S.cabR, -0.7 * rollTronco, 22, 0.5, dt);

      // ── BRAÇOS ──
      var Aarm = lerp(0.22, 0.95, runF) * movF;
      var hold = arma === 'katana' ? [0.0, 0.88] : [0.9, 0.9];             // quanto cada braço segura a arma (0 = livre, 1 = preso)
      for (k = 0; k < 2; k++) {
        var ar = pose.braco[k], sinal = k === 0 ? 1 : -1;
        var swing = -sig * sinal * Aarm * 1.35;                           // braço oposto à perna do mesmo lado
        var pFree = 0.12 + swing, rFree = 0.1 + 0.1 * runF, eFree = lerp(0.25, 1.4, runF * movF) + 0.3 * Math.max(0, swing) + 0.15;
        var pHold, rHold, eHold;
        if (arma === 'katana') { pHold = 0.95 + S.golpe.x * 0.9 * sinal * 0; rHold = 0.3; eHold = 0.85; }
        else { pHold = 1.15; rHold = 0.18; eHold = 0.5; }
        var h = hold[k] * (1 - 0.85 * wLeap);
        ar.pitch = lerp(pFree, pHold, h) + swing * 0.07 * h; ar.roll = lerp(rFree, rHold, h); ar.cotovelo = lerp(eFree, eHold, h) + S.tiro.x * 0.02;
      }

      // ── mistura com o SALTO de captura de movimento ──
      if (wLeap > 0) {
        var Wp = wLeap, c = clip;
        var tipoPe = function (pitchCoxa, joelho, pePitch) { return (pitchCoxa - joelho) - pePitch; };
        for (k = 0; k < 2; k++) {
          var sf = k === 0 ? 'E' : 'D', pl2 = pose.perna[k], ar2 = pose.braco[k];
          pl2.pitch = lerp(pl2.pitch, c['coxaPitch' + sf], Wp); pl2.roll = lerp(pl2.roll, (k === 0 ? 1 : -1) * c['coxaRoll' + sf], Wp);
          pl2.joelho = lerp(pl2.joelho, c['joelho' + sf], Wp); pl2.yaw = lerp(pl2.yaw, 0, Wp);
          pl2.pe = lerp(pl2.pe, tipoPe(c['coxaPitch' + sf], c['joelho' + sf], c['pePitch' + sf]), Wp); pl2.apoio = lerp(pl2.apoio, 0, Wp);
          ar2.pitch = lerp(ar2.pitch, c['bracoPitch' + sf], Wp); ar2.roll = lerp(ar2.roll, Math.abs(c['bracoRoll' + sf]) + 0.1, Wp); ar2.cotovelo = lerp(ar2.cotovelo, c['cotovelo' + sf], Wp);
        }
        pitchTronco = lerp(pitchTronco, c.colunaPitch * 0.85 + 0.12, Wp); rollTronco = lerp(rollTronco, c.colunaRoll * 0.6, Wp);
        twist = lerp(twist, c.colunaTorcao * 0.8, Wp);
        S.cabP.x = lerp(S.cabP.x, c.cabecaPitch * 0.7 - 0.1, Wp * 0.6);
        rollQuad = lerp(rollQuad, c.quadrilRoll * 0.5, Wp); yawQuad = lerp(yawQuad, (c.quadrilYaw + 0.5) * 0.35, Wp);
        // altura do quadril da captura, nunca deixando o pé entrar no chão
        var hLeap = c.quadrilY * KALT, minH = 0;
        for (k = 0; k < 2; k++) { var pl3 = pose.perna[k]; minH = Math.max(minH, L1 * Math.cos(pl3.pitch) * Math.cos(pl3.roll) + L2 * Math.cos(pl3.pitch - pl3.joelho) + FH * 0.9 - 0.02); }
        hipPos = lerp(hipPos, Math.max(hLeap, minH), Wp);
      }

      // ── CORRENTES (rabo de cavalo / cachecol): mola + gravidade + vento + inércia ──
      var velF = pf, aF = azl, aS = axl;
      function corrente(lista, saida, n, rigidez, vento, restBase) {
        var angCab = pitchTronco + S.cabP.x;                               // o quanto a base já está inclinada
        for (var q = 0; q < n; q++) {
          var s = lista[q], pesoQ = (q + 1) / n, kq = rigidez * (1 - 0.55 * pesoQ);
          var alvoA = restBase + (q === 0 ? 0 : 0.1) + vento * clamp(velF, -3, 7) * 0.06 * pesoQ + clamp(aF * 0.045, -0.5, 0.5) * pesoQ - angCab * 0.5 * (q === 0 ? 1 : 0.3);
          alvoA += Math.sin(S.t * (7 + q) - q * 0.9) * 0.05 * (0.3 + runF) * pesoQ;
          mola(s.a, clamp(alvoA, -0.4, 1.6), kq, 0.32, dt);
          mola(s.b, clamp(-aS * 0.05 * pesoQ - ps * 0.05 * pesoQ, -0.7, 0.7) + Math.sin(S.t * 4.3 - q) * 0.05 * (0.3 + runF) * pesoQ, kq * 0.9, 0.35, dt);
          saida[q].x = s.a.x; saida[q].y = s.b.x;
        }
      }
      if (NCOLA) corrente(S.cola, pose.cola, NCOLA, 34, 1.0, 0.35 + 0.35 * runF);
      if (NCACH) corrente(S.cach, pose.cachecol, NCACH, 40, 1.1, 0.3 + 0.2 * runF);
      mola(S.mochila, -clamp(azl * 0.02, -0.12, 0.12) + S.dano.x * 0.02, 28, 0.3, dt);

      // ── ESCRITA DA POSE ──
      pose.yawCorpo = yawP;
      var q0 = pose.quadril; q0.y = hipPos; q0.pitch = pitchTronco * 0.18 + S.pouso.x * 0.05; q0.roll = rollQuad; q0.yaw = yawQuad; q0.x = 0;
      var co = pose.coluna; co.pitch = pitchTronco * 0.82; co.roll = rollTronco; co.yaw = twist - yawQuad;   // yaw do tronco é relativo ao quadril
      var ca = pose.cabeca; ca.pitch = S.cabP.x; ca.roll = S.cabR.x; ca.yaw = clamp(volta(S.yawCab.x - (yawP + twist)), -1.0, 1.0);   // a cabeça continua olhando para a mira
      var wp = pose.arma; wp.recuo = clamp(S.tiro.x, -0.2, 1.4); wp.yaw = S.golpe.x * 0.9; wp.pitch = -S.tiro.x * 0.08; wp.golpe = S.golpe.x;
      pose.mochila = S.mochila.x;
      pose.escala.y = 1 - clamp(S.pouso.x, -0.4, 0.4) * 0.22 + 0.05 * wLeap; pose.escala.x = pose.escala.z = 1 + clamp(S.pouso.x, -0.4, 0.4) * 0.1 - 0.02 * wLeap;
      pose.corrida = runF * movF; pose.andando = movF; pose.voo = wLeap;
      return pose;
    }
    function walkF(m, r) { return m * (1 - r); }

    return { atualizar: atualizar, impulso: impulso, pose: pose, estado: S, dims: { L1: L1, L2: L2, fh: FH, hw: HW } };
  }

  return { criar: criar, ikPerna: ikPerna, mola: mola };
});
