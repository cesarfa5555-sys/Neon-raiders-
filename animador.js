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
  function ikMembro(o, x, y, z, L1, L2, polX, polY, polZ, yawMax) {
    var d = Math.sqrt(x * x + y * y + z * z), dmax = (L1 + L2) * 0.998, dmin = Math.abs(L1 - L2) + 0.05, k = 1;
    if (d > dmax) k = dmax / d; else if (d < dmin) k = dmin / d;
    x *= k; y *= k; z *= k; d *= k;
    var ux = x / d, uy = y / d, uz = z / d;
    var A = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    // articulação (joelho/cotovelo) fica do lado do "polo": n = polo sem a componente ao longo de u
    var pd = polX * ux + polY * uy + polZ * uz;
    var nx = polX - pd * ux, ny = polY - pd * uy, nz = polZ - pd * uz, nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    var ca = Math.cos(A), sa = Math.sin(A);
    var tx = ca * ux + sa * nx, ty = ca * uy + sa * ny, tz = ca * uz + sa * nz;      // direção do 1º osso (coxa / braço)
    // 1º osso acima da horizontal (joelho/braço levantado além de 90°): usa a outra representação (pitch > 90°) para não "virar"
    var p, r;
    if (ty > 0) { p = PI - Math.asin(clamp(tz, -1, 1)); r = Math.atan2(-tx, ty); } else { p = Math.asin(clamp(tz, -1, 1)); r = Math.atan2(tx, -ty); }
    // vetor articulação → ponta, levado ao referencial do 1º osso para achar a torção (yaw) e a dobra
    var wx = x - tx * L1, wy = y - ty * L1, wz = z - tz * L1;
    var cr = Math.cos(-r), sr = Math.sin(-r);                                          // Rz(-r)
    var ax = wx * cr - wy * sr, ay = wx * sr + wy * cr, az = wz;
    var cp = Math.cos(p), sp = Math.sin(p);                                            // Rx(+p)
    var bx = ax, by = ay * cp - az * sp, bz = ay * sp + az * cp;
    var yaw = Math.atan(bx / (Math.abs(bz) < 1e-6 ? 1e-6 : bz));                       // torção que alinha a dobradiça (x local = 0)
    var lz = bx * Math.sin(yaw) + bz * Math.cos(yaw);                                   // z do 2º osso no referencial do 1º (<0 = para trás)
    o.pitch = p; o.roll = r; o.yaw = clamp(yaw, -yawMax, yawMax);
    o.flex = Math.atan2(-lz, -by);                                                     // dobra com sinal: >0 = 2º osso para trás (joelho), <0 = para frente (cotovelo)
    o.joelho = clamp(o.flex, 0, 2.5);
    o.alcance = d;
    return o;
  }
  function ikPerna(o, x, y, z, L1, L2) { return ikMembro(o, x, y, z, L1, L2, 0, 0, 1, 0.8); }     // perna: joelho para a frente

  // ── pequenos auxiliares de vetor/base (usados pela arma) ──
  function norm3(v) { var l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  // base da arma: z = direção da ponta, y ≈ para cima (girado por "roll"), x = esquerda
  function baseArma(D, roll, B) {
    var z = norm3(D), up = Math.abs(z[1]) > 0.97 ? [0, 0, 1] : [0, 1, 0];
    var x = norm3([up[1] * z[2] - up[2] * z[1], up[2] * z[0] - up[0] * z[2], up[0] * z[1] - up[1] * z[0]]);
    var y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
    var c = Math.cos(roll), s = Math.sin(roll);
    B.x = [x[0] * c + y[0] * s, x[1] * c + y[1] * s, x[2] * c + y[2] * s]; B.y = [-x[0] * s + y[0] * c, -x[1] * s + y[1] * c, -x[2] * s + y[2] * c]; B.z = z; return B;
  }

  // ── GOLPES DA KATANA: caminhos da espada no espaço do tronco (x esquerda, y cima, z frente, origem na cintura) ──
  // cada golpe = 5 quadros-chave: guarda → preparação → impacto → continuação → volta.
  // P = posição do centro do cabo; D = direção da ponta; roll = giro da lâmina; tw = torção do tronco; pit = inclinação do tronco;
  // lung = avanço do quadril; drop = quanto o quadril abaixa (agachada do golpe).
  var GUARDA_KATANA = { P: [-0.02, 0.56, 0.46], D: [0.02, 0.95, 0.3], roll: 0, tw: 0, pit: 0.05, lung: 0, drop: 0 };
  var ATAQUES = [
    [GUARDA_KATANA, { P: [-0.30, 1.22, 0.08], D: [-0.25, 0.78, -0.58], roll: 0.4, tw: -0.6, pit: -0.06, lung: -0.05, drop: 0.0 },       // 1) DIAGONAL de cima: ergue sobre o ombro direito…
      { P: [0.12, 0.62, 0.50], D: [0.64, -0.26, 0.72], roll: -0.3, tw: 0.62, pit: 0.24, lung: 0.2, drop: 0.09 },                         //    …e corta para baixo-esquerda
      { P: [0.18, 0.52, 0.48], D: [0.72, -0.46, 0.52], roll: -0.4, tw: 0.7, pit: 0.22, lung: 0.17, drop: 0.08 }, GUARDA_KATANA],
    [GUARDA_KATANA, { P: [0.30, 0.40, 0.40], D: [0.72, -0.56, 0.42], roll: -0.5, tw: 0.62, pit: 0.16, lung: 0.04, drop: 0.09 },        // 2) DIAGONAL ascendente: de baixo-esquerda…
      { P: [-0.24, 1.0, 0.46], D: [-0.56, 0.56, 0.6], roll: 0.4, tw: -0.55, pit: 0.04, lung: 0.2, drop: 0.05 },                         //    …para cima-direita
      { P: [-0.32, 1.1, 0.40], D: [-0.62, 0.62, 0.48], roll: 0.5, tw: -0.65, pit: 0.02, lung: 0.16, drop: 0.04 }, GUARDA_KATANA],
    [GUARDA_KATANA, { P: [0.0, 1.5, -0.04], D: [0.0, 0.96, -0.3], roll: 0, tw: 0.0, pit: -0.2, lung: -0.1, drop: 0.0 },               // 3) VERTICAL: espada sobre a cabeça…
      { P: [0.0, 0.78, 0.52], D: [0.0, -0.12, 1.0], roll: 0, tw: 0.0, pit: 0.34, lung: 0.24, drop: 0.13 },                               //    …desce à frente
      { P: [0.0, 0.68, 0.54], D: [0.0, -0.34, 0.94], roll: 0, tw: 0.0, pit: 0.3, lung: 0.2, drop: 0.12 }, GUARDA_KATANA],
    [GUARDA_KATANA, { P: [-0.52, 0.9, 0.14], D: [-0.82, 0.0, 0.42], roll: 0.2, tw: -0.85, pit: 0.06, lung: -0.04, drop: 0.06 },        // 4) HORIZONTAL (ampla): da direita…
      { P: [0.28, 0.9, 0.46], D: [0.84, 0.0, 0.46], roll: -0.2, tw: 0.85, pit: 0.12, lung: 0.16, drop: 0.08 },                            //    …para a esquerda
      { P: [0.34, 0.88, 0.44], D: [0.88, 0.05, 0.38], roll: -0.2, tw: 0.95, pit: 0.12, lung: 0.14, drop: 0.07 }, GUARDA_KATANA],
  ];
  var ATK_T = [0, 0.14, 0.24, 0.34, 0.50];                               // tempo de cada quadro-chave (s)
  var ATK_DUR = 0.5;
  function ease(tipo, u) { return tipo === 1 ? u * u * (1.6 - 0.6 * u) : tipo === 2 ? 1 - Math.pow(1 - u, 2.2) : u * u * (3 - 2 * u); }
  function amostrarAtaque(idx, t, o) {
    var K = ATAQUES[idx % ATAQUES.length], i = 0; while (i < 3 && t > ATK_T[i + 1]) i++;
    var u = clamp((t - ATK_T[i]) / (ATK_T[i + 1] - ATK_T[i]), 0, 1), e = ease(i === 1 ? 1 : i === 2 ? 2 : 0, u), a = K[i], b = K[i + 1];
    for (var c = 0; c < 3; c++) { o.P[c] = lerp(a.P[c], b.P[c], e); o.D[c] = lerp(a.D[c], b.D[c], e); }
    o.roll = lerp(a.roll, b.roll, e); o.tw = lerp(a.tw, b.tw, e); o.pit = lerp(a.pit, b.pit, e); o.lung = lerp(a.lung, b.lung, e); o.drop = lerp(a.drop, b.drop, e);
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
    var KALT = (L1 + L2 + 0.1) * 0.98 / 85;
    // pontos onde as MÃOS seguram a arma (no espaço da arma: x esquerda, y cima, z frente) e medidas do braço/ombro do modelo
    var GR = cfg.grips || (arma === 'katana' ? { dir: { x: 0, y: 0, z: 0.16 }, esq: { x: 0, y: 0, z: -0.14 } } : { dir: { x: 0, y: -0.12, z: 0.02 }, esq: { x: 0, y: -0.04, z: 0.4 } });
    var BD = cfg.bracoDims || { A1: 0.38, A2: 0.38, SW: 0.46, SY: 0.78, SZ: 0.02 };
    var ALCANCE = arma === 'katana' ? 7.2 : 14.5;                       // distância em que o inimigo conta como "perto" (katana = guarda; rifle = mira)               // converte altura do quadril do clipe (cm) para unidades do jogo

    // ── estado interno ──
    var S = {
      iniciado: false, fase: 0, vx: 0, vz: 0, ax: 0, az: 0, runF: M(0), movF: M(0),
      yawPelve: M(0), yawTorso: M(0), yawCab: M(0), hip: M(FH + LMAX * 0.95), hipOff: M(0),
      leanP: M(0), leanR: M(0), cabP: M(0), cabR: M(0), cabY: M(0),
      mochila: M(0), arma: M(0), armaY: M(0), golpe: M(0), dano: M(0), pouso: M(0), tiro: M(0),
      leapT: -1, dashAnt: false, contato: [false, false], sinalGolpe: 1,
      cola: [], cach: [], t: 0, ultimaDir: 0,
      tiroT: 0, comb: M(0), est: M(0), atk: null, atkN: -1, wroll: M(0), twAim: M(0), pitAim: M(0), lung: M(0), drop: M(0), atkW: M(0),
      wp: arma === 'katana' ? [M(-0.30), M(0.32 + 0.7 * (((cfg.bracoDims && cfg.bracoDims.SY) || 0.78) - 0.78)), M(0.32)] : [M(-0.12), M(0.56 + ((cfg.bracoDims && cfg.bracoDims.SY) || 0.78) - 0.78), M(0.38)], wd: arma === 'katana' ? [M(0.12), M(-0.40), M(0.91)] : [M(0.08), M(0.12), M(1)], olhaP: M(0),       // começa já na pose parada da arma
    };
    for (var i = 0; i < NCOLA; i++) S.cola.push({ a: M(0.25), b: M(0) });
    for (var j = 0; j < NCACH; j++) S.cach.push({ a: M(0.3), b: M(0) });

    // pose reaproveitada a cada quadro (zero lixo para o coletor de memória)
    var pose = {
      yawCorpo: 0, quadril: { y: 1, pitch: 0, roll: 0, yaw: 0, x: 0 }, coluna: { pitch: 0, roll: 0, yaw: 0 }, cabeca: { pitch: 0, roll: 0, yaw: 0 },
      perna: [{ pitch: 0, roll: 0, yaw: 0, joelho: 0, pe: 0, apoio: 0 }, { pitch: 0, roll: 0, yaw: 0, joelho: 0, pe: 0, apoio: 0 }],
      braco: [{ pitch: 0, roll: 0, yaw: 0, flex: 0, cotovelo: 0 }, { pitch: 0, roll: 0, yaw: 0, flex: 0, cotovelo: 0 }],
      arma: { recuo: 0, yaw: 0, pitch: 0, golpe: 0, x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 1, roll: 0, mao: [0, 0, 0, 0, 0, 0], ataque: 0 }, cola: [], cachecol: [], mochila: 0,
      escala: { x: 1, y: 1, z: 1 }, eventos: [], corrida: 0, andando: 0, voo: 0,
    };
    for (i = 0; i < NCOLA; i++) pose.cola.push({ x: 0, y: 0 });
    for (j = 0; j < NCACH; j++) pose.cachecol.push({ x: 0, y: 0 });
    var ik = [{}, {}], ikA = [{}, {}], clip = {}, pePrev = [0, 0], ataqueAtual = { P: [0, 0, 0], D: [0, 0, 1], roll: 0, tw: 0, pit: 0, lung: 0, drop: 0 }, baseA = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

    // ── impulsos externos (tiro, golpe da katana, dano...) ──
    function impulso(tipo, forca) {
      forca = forca === undefined ? 1 : forca;
      if (tipo === 'tiro') { S.tiro.v += 9 * forca; S.tiroT = 0.9; }                       // atirou: mantém a pose de mira por ~1 s
      else if (tipo === 'golpe') {
        S.sinalGolpe = -S.sinalGolpe; S.golpe.v += 16 * forca * S.sinalGolpe; S.pouso.v += 1.2 * forca;
        if (arma === 'katana') {                                                            // começa o próximo golpe do ciclo (diagonal, ascendente, vertical, horizontal)
          if (S.atk && S.atk.t > 0.12 && S.atk.t < 0.3) { S.atkN++; S.atk = { t: 0.11, i: S.atkN }; }   // golpe duplo: encadeia sem refazer a preparação
          else { S.atkN++; S.atk = { t: 0, i: S.atkN }; }
        }
      }
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

      // ── COMBATE: tem inimigo perto? rifle → pose de MIRA; katana → pose de GUARDA ──
      var alvo = e.alvo || null, dAlvo = alvo ? alvo.d : 1e9;
      S.tiroT = Math.max(0, S.tiroT - dt);
      var perto = dAlvo < ALCANCE ? 1 : 0, alvoComb = arma === 'katana' ? perto : Math.max(perto, S.tiroT > 0 ? 1 : 0);
      mola(S.comb, alvoComb, 9, 1, dt); var wC = clamp(S.comb.x, 0, 1);
      mola(S.est, wC, 7, 1, dt); var est = clamp(S.est.x, 0, 1);                 // postura de combate (pés escalonados, joelhos dobrados)
      // golpe em andamento da katana (caminho da espada)
      var wA = 0;
      if (S.atk) { S.atk.t += dt; if (S.atk.t >= ATK_DUR) S.atk = null; else { amostrarAtaque(S.atk.i, S.atk.t, ataqueAtual); wA = suave(0, 0.05, S.atk.t) * (1 - suave(0.44, 0.5, S.atk.t)); } }
      mola(S.atkW, wA, 40, 1, dt); wA = clamp(S.atkW.x, 0, 1);

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
      var olhaYaw = alvo ? aimYaw + clamp(volta(Math.atan2(alvo.dx, alvo.dz) - aimYaw), -1.1, 1.1) : aimYaw;     // a cabeça olha o inimigo mais perto
      molaAng(S.yawCab, olhaYaw, 34, 0.7, dt);
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
      var Lk = LMAX * lerp(0.965, 0.89, runF) * (1 - 0.04 * est * (1 - movF));                             // perna nunca fica 100% esticada (joelho sempre trabalha)

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
        var frentePe = arma === 'katana' ? 1 : 0, escal = est * (1 - movF);                // postura de combate: um pé à frente, outro atrás, pernas mais abertas
        fx2[k] = lado * (HW + 0.025 * (1 - movF) + 0.05 * escal) + dx * s; fz2[k] = dz * s + 0.02 + (k === frentePe ? 0.2 : -0.16) * escal - S.lung.x * (1 - movF);   // quadril avança no golpe, o pé fica onde está
        if (em) {                                                          // quadril precisa ficar alto o bastante para o pé de apoio alcançar o chão
          var dxh = fx2[k] - lado * HW, dzh = fz2[k], hk = FH + Math.sqrt(Math.max(0.04, Lk * Lk - dxh * dxh - dzh * dzh));
          hipNec = Math.min(hipNec, hk); temApoio = true;
        }
      }
      var alvoHip = temApoio ? hipNec : FH + Lk + 0.07 * runF;             // sem pé no chão = fase de voo da corrida
      alvoHip = Math.max(alvoHip, FH + 0.35);
      // respiração e troca de peso quando parado
      var idle = 1 - movF;
      alvoHip += Math.sin(S.t * 1.7) * 0.006 * idle;
      mola(S.hip, alvoHip, 30, 1, dt);
      var hipY = S.hip.x;

      // ── pose do quadril (com solavancos de pouso/dano) ──
      mola(S.hipOff, 0, 22, 0.35, dt);
      var hipPos = hipY + S.hipOff.x - S.drop.x;                              // agachada do golpe/postura de combate
      var dropE = liftK[0] - liftK[1];                                     // o lado do pé levantado cai um pouco
      var sig = (clamp(sK[0] / (Sc * 0.5 + 1e-4), -1, 1) - clamp(sK[1] / (Sc * 0.5 + 1e-4), -1, 1)) * 0.5 * movF;   // -1..1: perna esquerda à frente = +1
      var rollQuad = -dropE * 0.12 * (0.4 + runF) + Math.sin(S.t * 0.7) * 0.012 * idle;
      var yawQuad = -sig * 0.13 * (0.35 + runF);

      // ── PERNAS: IK ──
      for (k = 0; k < 2; k++) {
        var lado2 = k === 0 ? 1 : -1;
        var gy = -(hipPos - FH) + liftK[k];                                // tornozelo em relação ao quadril REAL (agachadas e solavancos dobram o joelho; o pé fica no chão)
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
      // pose de combate: rifle = ombro direito atrás e tronco inclinado para frente; ataque da katana = torção/inclinação do golpe
      mola(S.twAim, arma === 'katana' ? 0 : -0.36 * wC, 10, 0.9, dt); mola(S.pitAim, arma === 'katana' ? 0.05 * wC : 0.11 * wC, 10, 0.9, dt);
      mola(S.lung, ataqueAtual.lung * wA, 22, 0.85, dt); mola(S.drop, ataqueAtual.drop * wA + 0.035 * est * (1 - movF), 18, 0.9, dt);
      twist += S.twAim.x + ataqueAtual.tw * wA; pitchTronco += S.pitAim.x + ataqueAtual.pit * wA;

      // ── CABEÇA: estabiliza o olhar e balança com atraso ──
      var olhaPitch = alvo ? clamp(Math.atan2(0.85, Math.max(2, dAlvo)) * 0.9, 0, 0.35) : 0;          // olha levemente para baixo, na direção do inimigo
      mola(S.cabP, -0.55 * pitchTronco - clamp(azl * 0.012, -0.12, 0.12) - S.dano.x * 0.07 + olhaPitch - (arma === 'katana' ? 0 : 0.05 * wC), 22, 0.45, dt);
      mola(S.cabR, -0.7 * rollTronco, 22, 0.5, dt);

      // ── ARMA: pose-alvo (rifle: pronto ↔ mira | katana: cintura ↔ guarda ↔ golpe), seguida por molas ──
      var P0, D0, r0, P1, D1, r1;
      if (arma === 'katana') { P0 = [-0.30, 0.32, 0.32]; D0 = [0.12, -0.40, 0.91]; r0 = 0.5; P1 = GUARDA_KATANA.P; D1 = GUARDA_KATANA.D; r1 = 0; }       // espada na cintura → vertical à frente
      else { P0 = [-0.12, 0.56, 0.38]; D0 = [0.08, 0.12, 1]; r0 = 0; P1 = [-0.08, 0.58, 0.46]; D1 = [0.36, 0.05, 0.93]; r1 = 0; }                             // rifle baixo/pronto → mirando (cano acompanha a torção do tronco)
      // as poses foram desenhadas para um tronco "padrão" (ombros a 0.78 acima da cintura); personagens com tronco mais longo/curto sobem/descem a arma junto com os ombros
      var dyOm = BD.SY - 0.78, alvoP = [0, 0, 0], alvoD = [0, 0, 0];
      var kP0 = arma === 'katana' ? dyOm * 0.7 : dyOm;                                         // katana parada fica na altura da cintura/barriga (sobe só 70% do que sobem os ombros, senão o braço curto não alcança)
      var dzOm = -Math.max(0, BD.SW - 0.30) * 0.8;                                             // ombros largos: puxa a arma um pouco para trás (o braço alcança)
      for (var c0 = 0; c0 < 3; c0++) {
        var p0 = P0[c0] + (c0 === 1 ? kP0 : c0 === 2 ? dzOm : 0), p1 = P1[c0] + (c0 === 1 ? dyOm : c0 === 2 ? dzOm : 0), pa = ataqueAtual.P[c0] + (c0 === 1 ? dyOm : c0 === 2 ? dzOm : 0);
        alvoP[c0] = lerp(lerp(p0, p1, wC), pa, wA); alvoD[c0] = lerp(lerp(D0[c0], D1[c0], wC), ataqueAtual.D[c0], wA);
      }
      alvoP[2] -= S.tiro.x * 0.1; alvoD[1] += S.tiro.x * 0.05;                    // recuo do tiro
      var rig = lerp(14, 48, wA);
      for (c0 = 0; c0 < 3; c0++) { mola(S.wp[c0], alvoP[c0], rig, 0.95, dt); mola(S.wd[c0], alvoD[c0], rig, 0.95, dt); }
      mola(S.wroll, lerp(lerp(r0, r1, wC), ataqueAtual.roll, wA), rig, 0.9, dt);
      var Pw = [S.wp[0].x, S.wp[1].x, S.wp[2].x], Dw = [S.wd[0].x, S.wd[1].x, S.wd[2].x];
      baseArma(Dw, S.wroll.x, baseA);
      function ptoArma(g, out, o) { out[o] = Pw[0] + g.x * baseA.x[0] + g.y * baseA.y[0] + g.z * baseA.z[0]; out[o + 1] = Pw[1] + g.x * baseA.x[1] + g.y * baseA.y[1] + g.z * baseA.z[1]; out[o + 2] = Pw[2] + g.x * baseA.x[2] + g.y * baseA.y[2] + g.z * baseA.z[2]; }
      var maosPos = pose.arma.mao; ptoArma(GR.esq, maosPos, 0); ptoArma(GR.dir, maosPos, 3);        // [mão esquerda xyz, mão direita xyz] no espaço do tronco
      // LIMITADOR DE ALCANCE: se uma mão que segura a arma ficaria longe demais do ombro (braço curto, ombro largo, tronco longo), a arma é puxada
      // para perto do ombro na medida certa, em vez de a mão ficar solta no ar. Funciona com qualquer personagem importado.
      var wDuasL = clamp(Math.max(wC, wA), 0, 1), alcMax = 0.97 * (BD.A1 + BD.A2);
      for (var itL = 0; itL < 3; itL++) {
        var sxL = 0, syL = 0, szL = 0, passou = false;
        for (k = 0; k < 2; k++) {
          if (arma === 'katana' && k === 0 && wDuasL < 0.5) continue;                              // mão esquerda livre (repousa na bainha): não conta
          var sgn = k === 0 ? 1 : -1, ddx = sgn * BD.SW - maosPos[k * 3], ddy = BD.SY - maosPos[k * 3 + 1], ddz = BD.SZ - maosPos[k * 3 + 2], dd0 = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz), exc = dd0 - alcMax;
          if (exc > 0) { sxL += ddx / dd0 * exc; syL += ddy / dd0 * exc; szL += ddz / dd0 * exc; passou = true; }
        }
        if (!passou) break;
        Pw[0] += sxL; Pw[1] += syL; Pw[2] += szL; ptoArma(GR.esq, maosPos, 0); ptoArma(GR.dir, maosPos, 3);
      }

      // ── BRAÇOS: as DUAS MÃOS vão até os pontos de empunhadura (cinemática inversa); braço livre balança correndo ──
      var Aarm = lerp(0.22, 0.95, runF) * movF;
      var wDuas = clamp(Math.max(wC, wA), 0, 1);                                                 // katana: guarda/golpe = duas mãos na espada
      var wBainha = arma === 'katana' ? (1 - wDuas) * (1 - 0.9 * movF) : 0;                      // parada: mão esquerda repousa na bainha
      var hold = arma === 'katana' ? [Math.max(wDuas, wBainha), 1] : [1, 1];             // quanto cada braço segura a arma (0 = livre)
      for (k = 0; k < 2; k++) {
        var ar = pose.braco[k], sinal = k === 0 ? 1 : -1;
        var swing = -sig * sinal * Aarm * 1.35;                           // braço oposto à perna do mesmo lado
        var pFree = 0.12 + swing, rFree = sinal * (0.1 + 0.1 * runF), fFree = -(lerp(0.25, 1.4, runF * movF) + 0.3 * Math.max(0, swing) + 0.15);
        var hx = maosPos[k * 3], hy = maosPos[k * 3 + 1], hz = maosPos[k * 3 + 2];
        if (arma === 'katana' && k === 0) { var mb = 1 - wDuas; hx = lerp(hx, 0.3, mb); hy = lerp(hy, 0.2 + 0.7 * dyOm, mb); hz = lerp(hz, 0.12, mb); }   // alvo da mão esquerda: bainha → cabo
        var Tx = hx - sinal * BD.SW, Ty = hy - BD.SY, Tz = hz - BD.SZ;
        ikMembro(ikA[k], Tx, Ty, Tz, BD.A1, BD.A2, sinal * 0.22, -0.55, -1.0, 1.5);           // cotovelos bem para TRÁS (e um pouco para baixo/fora), como quem segura a arma junto ao corpo
        var h = hold[k] * (1 - 0.85 * wLeap);
        ar.pitch = lerp(pFree, ikA[k].pitch, h) + swing * 0.05 * h; ar.roll = lerp(rFree, ikA[k].roll, h); ar.yaw = lerp(0, ikA[k].yaw, h); ar.flex = lerp(fFree, ikA[k].flex, h); ar.cotovelo = -ar.flex; ar.alcance = Math.sqrt(Tx * Tx + Ty * Ty + Tz * Tz) / (BD.A1 + BD.A2);      // alcance = distância ombro→ponto de empunhadura ÷ comprimento do braço (>1 = a mão não alcança)
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
          ar2.pitch = lerp(ar2.pitch, c['bracoPitch' + sf], Wp); ar2.roll = lerp(ar2.roll, (k === 0 ? 1 : -1) * (Math.abs(c['bracoRoll' + sf]) + 0.1), Wp); ar2.yaw = lerp(ar2.yaw, 0, Wp); ar2.flex = lerp(ar2.flex, -c['cotovelo' + sf], Wp); ar2.cotovelo = -ar2.flex;
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
        var angCab = pitchTronco + S.cabP.x, absAnt = 0;                    // o quanto a base já está inclinada; ângulo absoluto do segmento anterior
        for (var q = 0; q < n; q++) {
          var s = lista[q], pesoQ = (q + 1) / n, kq = rigidez * (1 - 0.55 * pesoQ);
          // ângulo ABSOLUTO desejado deste segmento: repouso (igual para todos) + empurrão do vento e da inércia, crescendo até a ponta
          var abso = restBase + vento * clamp(velF, -3, 7) * 0.06 * pesoQ + clamp(aF * 0.045, -0.5, 0.5) * pesoQ - angCab * 0.45 * (1 - pesoQ * 0.6)
                   + Math.sin(S.t * (7 + q) - q * 0.9) * 0.05 * (0.3 + runF) * pesoQ;
          var rel = clamp(abso, -0.4, 1.7) - absAnt; absAnt += rel;           // cada segmento só dobra a DIFERENÇA para o anterior (nada de enrolar em espiral)
          mola(s.a, rel, kq, 0.32, dt);
          mola(s.b, clamp(-aS * 0.05 * pesoQ - ps * 0.05 * pesoQ, -0.7, 0.7) / n * 2.2 + Math.sin(S.t * 4.3 - q) * 0.05 * (0.3 + runF) * pesoQ, kq * 0.9, 0.35, dt);
          saida[q].x = s.a.x; saida[q].y = s.b.x;
        }
      }
      if (NCOLA) corrente(S.cola, pose.cola, NCOLA, 34, 1.0, 0.35 + 0.35 * runF);
      if (NCACH) corrente(S.cach, pose.cachecol, NCACH, 40, 1.1, 0.3 + 0.2 * runF);
      mola(S.mochila, -clamp(azl * 0.02, -0.12, 0.12) + S.dano.x * 0.02, 28, 0.3, dt);

      // ── ESCRITA DA POSE ──
      pose.yawCorpo = yawP;
      var q0 = pose.quadril; q0.y = hipPos; q0.pitch = pitchTronco * 0.18 + S.pouso.x * 0.05; q0.roll = rollQuad; q0.yaw = yawQuad; q0.x = 0; q0.z = S.lung.x;
      var co = pose.coluna; co.pitch = pitchTronco * 0.82; co.roll = rollTronco; co.yaw = twist - yawQuad;   // yaw do tronco é relativo ao quadril
      var ca = pose.cabeca; ca.pitch = S.cabP.x; ca.roll = S.cabR.x; ca.yaw = clamp(volta(S.yawCab.x - (yawP + twist)), -1.0, 1.0);   // a cabeça continua olhando para a mira
      var wp = pose.arma; wp.recuo = clamp(S.tiro.x, -0.2, 1.4); wp.yaw = S.golpe.x * 0.9; wp.pitch = -S.tiro.x * 0.08; wp.golpe = S.golpe.x;
      wp.base = baseA; wp.x = Pw[0]; wp.y = Pw[1]; wp.z = Pw[2]; wp.dx = Dw[0]; wp.dy = Dw[1]; wp.dz = Dw[2]; wp.roll = S.wroll.x; wp.ataque = wA;     // pose completa da arma no espaço do tronco
      pose.mochila = S.mochila.x;
      pose.escala.y = 1 - clamp(S.pouso.x, -0.4, 0.4) * 0.22 + 0.05 * wLeap; pose.escala.x = pose.escala.z = 1 + clamp(S.pouso.x, -0.4, 0.4) * 0.1 - 0.02 * wLeap;
      pose.corrida = runF * movF; pose.andando = movF; pose.voo = wLeap; pose.combate = wC; pose.postura = est;
      return pose;
    }
    function walkF(m, r) { return m * (1 - r); }

    return { atualizar: atualizar, impulso: impulso, pose: pose, estado: S, dims: { L1: L1, L2: L2, fh: FH, hw: HW } };
  }

  return { criar: criar, ikPerna: ikPerna, ikMembro: ikMembro, mola: mola, baseArma: baseArma };
});
