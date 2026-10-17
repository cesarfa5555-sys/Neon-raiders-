// ══════════════════════════════════════════════════════════════════
// SIM.JS — o "cérebro" do jogo (SEM nenhum código de gráfico).
//
// Roda no CELULAR (modo solo) e no SERVIDOR (modo online). Como é o
// mesmo código nos dois lugares, o jogo online se comporta exatamente
// igual ao solo, e o servidor é quem manda (ninguém consegue trapacear
// o dano, a vida ou o tempo).
//
// Plano de coordenadas: o chão é o plano X/Z (visto de cima). Y é altura
// e só existe no desenho (renderer), não na simulação.
//
// Uso:
//   const sim = NRSim.criar({ seed: 123, coop: false });
//   sim.adicionarJogador({ id:'a', nome:'Tehe', loadout:{...} });
//   sim.entrada('a', { mx:0.5, mz:-1, dash:false });
//   sim.passo(1/60);
//   sim.drenarEventos();   // lista de efeitos (tiro, acerto, morte...) p/ som e partículas
// ══════════════════════════════════════════════════════════════════
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./data.js'));
  else root.NRSim = factory(root.NRData);
})(typeof self !== 'undefined' ? self : this, function (D) {
  'use strict';

  const CFG = D.CFG;
  const PI2 = Math.PI * 2;

  // Tipos de evento (cada evento é um array: [tipo, ...números])
  const EV = {
    TIRO: 1,       // [tipo, pid, x, z, dx, dz]            jogador atirou
    HIT: 2,        // [tipo, x, z, dano, crit, tipoInim]    inimigo levou dano
    MORTE: 3,      // [tipo, x, z, tipoInim, elite, chefe]  inimigo morreu
    GEMA: 4,       // [tipo, pid, valor]                    jogador pegou XP
    NIVEL: 5,      // [tipo, pid, nivel]                    jogador subiu de nível
    DANO: 6,       // [tipo, pid, dano, x, z]               jogador levou dano
    EMP: 7,        // [tipo, x, z, raio]                    pulso EMP
    RAIO: 8,       // [tipo, pid, n, x0,z0, x1,z1, ...]     arco tesla
    EXPLO: 9,      // [tipo, x, z, raio, cor]               explosão
    ONDA: 10,      // [tipo, numero]                        nova onda
    CHEFE: 11,     // [tipo, x, z, idxChefe]                chefe apareceu
    ORBITAL: 12,   // [tipo, x, z, raio]                    raio orbital caiu
    DASH: 13,      // [tipo, pid, x, z]
    CAPSULA: 14,   // [tipo, pid]                           pegou cápsula
    CAIU: 15,      // [tipo, pid, x, z]                     jogador caiu (co-op)
    REVIVEU: 16,   // [tipo, pid, x, z]
    ITEM: 17,      // [tipo, pid, kindItem]                 pegou item
    TIRO_INIM: 18, // [tipo, x, z, dx, dz, tipoInim]        inimigo atirou
    TELEGRAFO: 19, // [tipo, kind, x, z, r, dur, x2, z2]    aviso no chão (1=círculo 2=linha)
    FIM: 20,       // [tipo]
    CURA: 21,      // [tipo, pid, qtd]
    HORDA: 22,     // [tipo, kind]                          horda especial chegando
    TELEPORTE: 23, // [tipo, x0, z0, x1, z1]
    DRONE_TIRO: 24, // [tipo, pid, x, z, dx, dz]
    LOJA: 25,      // [tipo, onda]                          fim de onda: abriu a loja
    LOJA_FIM: 26,  // [tipo]                                a loja fechou, próxima onda
    SLASH: 27      // [tipo, pid, x, z, dx, dz, arco, alcance]  corte da katana
  };

  // Itens do chão
  const ITEM = { CURA: 1, IMA: 2, BOMBA: 3, CAPSULA: 4 };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ── NÚMEROS DAS HABILIDADES POR NÍVEL (1..8) ────────────────────
  // (os textos mostrados nas cartas estão em data.js)
  function statsHab(id, l) {
    const i = Math.max(0, Math.min(7, l - 1));
    switch (id) {
      case 'rifle': return {
        dano: 16 * [1, 1.25, 1.25, 1.25, 1.25, 1.6, 1.6, 1.6][i],
        intervalo: 0.5 * (l >= 4 ? 0.82 : 1),
        proj: 1 + (l >= 3 ? 1 : 0) + (l >= 7 ? 1 : 0),
        perfura: (l >= 5 ? 1 : 0) + (l >= 8 ? 1 : 0),
        explode: l >= 8 ? 1.7 : 0, vel: 24, vida: 0.78,
      };
      case 'katana': return {
        dano: 34 * [1, 1.25, 1.25, 1.25, 1.25, 1.62, 1.62, 1.62][i],
        intervalo: 0.55 * (l >= 4 ? 0.82 : 1),
        alcance: [3.3, 3.3, 3.9, 3.9, 3.9, 3.9, 4.8, 4.8][i],
        arco: l >= 8 ? 6.4 : 2.3,            // radianos totais do corte (6.4 = volta inteira)
        duplo: l >= 5, onda: l >= 7,
      };
      case 'drones': return {
        n: [1, 2, 2, 3, 3, 4, 4, 5][i], dano: 11 * [1, 1, 1.3, 1.3, 1.3, 1.3, 1.82, 1.82][i],
        orbita: l >= 5 ? 3.4 : 2.7, velAng: l >= 5 ? 3.0 : 2.3, atira: l >= 8,
      };
      case 'emp': return {
        cd: [6, 6, 6, 5.1, 5.1, 5.1, 4.1, 3.6][i], raio: [4.0, 4.6, 4.6, 4.6, 5.3, 5.3, 5.3, 5.8][i],
        dano: [30, 30, 40, 40, 40, 56, 56, 70][i], duplo: l >= 8,
      };
      case 'tesla': return {
        cd: [2.2, 2.2, 2.2, 2.2, 1.76, 1.76, 1.76, 1.2][i], saltos: [2, 3, 3, 4, 4, 4, 6, 8][i],
        dano: [26, 26, 35, 35, 35, 49, 49, 60][i], alcance: 10.5, salto: 5.5,
      };
      case 'granada': return {
        cd: [3.4, 3.4, 3.4, 2.72, 2.72, 2.72, 2.72, 2.5][i], raio: [2.6, 3.0, 3.0, 3.0, 3.0, 3.0, 3.6, 3.6][i],
        dano: [48, 48, 65, 65, 65, 91, 91, 110][i], chamas: l >= 5, dupla: l >= 8, alcance: 12,
      };
      case 'orbital': return {
        cd: [4.2, 4.2, 4.2, 3.4, 3.4, 3.4, 3.4, 3.4][i], n: [1, 2, 2, 2, 3, 3, 3, 5][i],
        dano: [70, 70, 95, 95, 95, 133, 133, 133][i], raio: l >= 7 ? 2.4 : 1.8, alcance: 11,
      };
    }
    return {};
  }

  // ══════════════════════════════════════════════════════════════════
  function criar(opcoes) {
    opcoes = opcoes || {};
    const rng = mulberry32((opcoes.seed | 0) || 1234567);
    const pausaNasCartas = opcoes.pausaNasCartas !== false && !opcoes.coop; // solo pausa; online não

    const S = {
      t: 0, tick: 0, onda: 1, ondaT: 0, acumSpawn: 0, idSeq: 1,
      coop: !!opcoes.coop, fim: false, pausado: false,
      jogadores: [], inimigos: [], projeteis: [], gemas: [], itens: [], zonas: [], granadas: [],
      eventos: [], chefe: null, resultado: null,
      fase: 'luta', lojaT: 0,                       // 'luta' | 'loja' (intervalo estilo Brotato entre as ondas)
      abatesTotal: 0, chefesMortos: 0, danoPorFonte: {},
    };

    const nid = function () { return S.idSeq++; };
    const ev = function () { S.eventos.push(Array.prototype.slice.call(arguments)); };
    const rnd = function (a, b) { return a + rng() * (b - a); };

    // ── GRADE ESPACIAL (acha vizinhos rápido, sem comparar todos com todos) ──
    const CEL = 2.5, OFF = CFG.arenaRaio + 16, GN = Math.ceil(OFF * 2 / CEL) + 1;
    const cabeca = new Int32Array(GN * GN);
    let prox = new Int32Array(1024);
    const buf = [];
    function cel(x, z) {
      let gx = Math.floor((x + OFF) / CEL), gz = Math.floor((z + OFF) / CEL);
      gx = gx < 0 ? 0 : gx >= GN ? GN - 1 : gx; gz = gz < 0 ? 0 : gz >= GN ? GN - 1 : gz;
      return gz * GN + gx;
    }
    function montarGrade() {
      cabeca.fill(-1);
      const L = S.inimigos;
      if (prox.length < L.length) prox = new Int32Array(L.length * 2);
      for (let i = 0; i < L.length; i++) {
        const e = L[i]; if (e.morto) continue;
        const c = cel(e.x, e.z); prox[i] = cabeca[c]; cabeca[c] = i;
      }
    }
    // preenche buf com inimigos vivos num raio (considerando o raio de cada um)
    function consulta(x, z, r) {
      buf.length = 0;
      const g0x = Math.max(0, Math.floor((x - r - 2 + OFF) / CEL)), g1x = Math.min(GN - 1, Math.floor((x + r + 2 + OFF) / CEL));
      const g0z = Math.max(0, Math.floor((z - r - 2 + OFF) / CEL)), g1z = Math.min(GN - 1, Math.floor((z + r + 2 + OFF) / CEL));
      for (let gz = g0z; gz <= g1z; gz++) for (let gx = g0x; gx <= g1x; gx++) {
        for (let i = cabeca[gz * GN + gx]; i !== -1; i = prox[i]) {
          const e = S.inimigos[i]; if (e.morto) continue;
          const dx = e.x - x, dz = e.z - z, rr = r + e.raio;
          if (dx * dx + dz * dz <= rr * rr) buf.push(e);
        }
      }
      return buf;
    }
    function maisProximo(x, z, maxD, ignorar) {
      let melhor = null, md = maxD * maxD;
      const r = maxD, g0x = Math.max(0, Math.floor((x - r + OFF) / CEL)), g1x = Math.min(GN - 1, Math.floor((x + r + OFF) / CEL));
      const g0z = Math.max(0, Math.floor((z - r + OFF) / CEL)), g1z = Math.min(GN - 1, Math.floor((z + r + OFF) / CEL));
      for (let gz = g0z; gz <= g1z; gz++) for (let gx = g0x; gx <= g1x; gx++) {
        for (let i = cabeca[gz * GN + gx]; i !== -1; i = prox[i]) {
          const e = S.inimigos[i]; if (e.morto || (ignorar && ignorar.indexOf(e) >= 0)) continue;
          const dx = e.x - x, dz = e.z - z, d = dx * dx + dz * dz;
          if (d < md) { md = d; melhor = e; }
        }
      }
      return melhor;
    }

    // ── JOGADORES ───────────────────────────────────────────────────
    function adicionarJogador(info) {
      const lo = D.sanearLoadout(info.loadout);
      const slot = S.jogadores.length;
      const p = {
        id: info.id, nome: String(info.nome || 'Raider').slice(0, 16), slot: slot, loadout: lo,
        x: Math.cos(slot * 1.7) * 1.2, z: Math.sin(slot * 1.7) * 1.2, fx: 0, fz: 1, mx: 0, mz: 0,
        hp: 1, hpMax: 1, vivo: true, fora: false, nivel: 1, xp: 0, xpProx: D.xpParaNivel(1),
        hab: {}, pas: {},
        cd: { rifle: 0.3, katana: 0.3, emp: 2, tesla: 1, granada: 1.5, orbital: 2, dronesTiro: 1 }, empSeg: 0,
        droneAng: 0, dashT: 0, dashCd: 0, dashX: 0, dashZ: 1, invul: 0, regenAcc: 0,
        cartas: null, cartaT: 0, pendentes: 0, reviveProg: 0, sofreu: 0,
        abates: 0, dano: 0, moedaAcum: 0, nivelMax: 1,
        sucata: 0, lojaOfertas: null, lojaPronto: false, rerolls: 0, lojaVer: 0,
      };
      recalcular(p);                                              // define persona/arma equipadas e todos os bônus
      p.hab[p.armaTipo === 'katana' ? 'katana' : 'rifle'] = 1;     // a arma equipada é a habilidade inicial
      p.hp = p.hpMax;
      S.jogadores.push(p);
      return p;
    }
    function jogador(id) { for (let i = 0; i < S.jogadores.length; i++) if (S.jogadores[i].id === id) return S.jogadores[i]; return null; }
    function removerJogador(id) {
      const p = jogador(id); if (!p) return;
      p.fora = true; p.vivo = false; p.cartas = null; p.pendentes = 0;
    }
    function recalcular(p) {
      const lo = p.loadout, up = lo.up, pas = p.pas, J = CFG.jogador;
      const eq = D.resolverEquip(lo); p.persona = eq.persona; p.armaTipo = eq.arma;
      p.dmgMul = (1 + 0.12 * (pas.dano || 0)) * (1 + up.dano * D.LOJA.up.dano.porNivel) * (eq.arma === 'rifle' ? 1.2 : eq.arma === 'katana' ? 1.25 : 1);
      p.cdMul = 1 / (1 + 0.10 * (pas.cadencia || 0));
      p.vel = J.vel * (1 + 0.08 * (pas.vel || 0)) * (1 + up.vel * D.LOJA.up.vel.porNivel) * (eq.persona === 'cacador' ? 1.08 : eq.persona === 'kunoichi' ? 1.15 : 1);
      const hpAntes = p.hpMax;
      p.hpMax = Math.round((J.hp + 25 * (pas.vida || 0) + up.vida * D.LOJA.up.vida.porNivel) * (eq.persona === 'cacador' ? 1.15 : 1));
      if (hpAntes > 1 && p.hpMax > hpAntes) p.hp += p.hpMax - hpAntes; // ganhar vida máxima também cura essa diferença
      p.regen = 0.7 * (pas.regen || 0);
      p.ima = J.ima * (1 + 0.30 * (pas.ima || 0)) * (1 + up.ima * D.LOJA.up.ima.porNivel);
      p.crit = J.critChance + 0.07 * (pas.critico || 0) + (eq.persona === 'kunoichi' ? 0.08 : 0);
      p.dashRecarga = J.dashRecarga * Math.pow(0.86, pas.dash || 0);
      p.xpMul = 1 + up.xp * D.LOJA.up.xp.porNivel;
      p.moedaMul = 1 + up.moeda * D.LOJA.up.moeda.porNivel;
    }
    function entrada(id, e) {
      const p = jogador(id); if (!p || !e) return;
      let mx = Number(e.mx) || 0, mz = Number(e.mz) || 0;
      const m = Math.hypot(mx, mz);
      if (m > 1) { mx /= m; mz /= m; }
      p.mx = mx; p.mz = mz;
      if (e.dash) p.querDash = true;
    }

    // ── CARTAS DE LEVEL UP ──────────────────────────────────────────
    function gerarCartas(p, qtd) {
      qtd = qtd || 3;
      const op = [];
      const nHab = Object.keys(p.hab).length, nPas = Object.keys(p.pas).length;
      D.ORDEM_HAB.forEach(function (id) {
        const l = p.hab[id] || 0;
        if (l >= CFG.nivelMaxHab) return;
        if (l === 0 && (id === 'rifle' || id === 'katana')) return;   // a arma inicial é a equipada no Hangar
        if (l === 0 && nHab >= CFG.maxHabilidades) return;
        op.push({ tipo: 'hab', id: id, nivel: l + 1, peso: l === 0 ? 2.2 : 3 });
      });
      D.ORDEM_PAS.forEach(function (id) {
        const l = p.pas[id] || 0;
        if (l >= CFG.nivelMaxPas) return;
        if (l === 0 && nPas >= CFG.maxPassivas) return;
        op.push({ tipo: 'pas', id: id, nivel: l + 1, peso: l === 0 ? 1.8 : 2.4 });
      });
      const cartas = [];
      while (cartas.length < qtd && op.length) {
        let tot = 0; op.forEach(function (o) { tot += o.peso; });
        let r = rng() * tot, k = 0;
        for (; k < op.length - 1; k++) { r -= op[k].peso; if (r <= 0) break; }
        cartas.push({ tipo: op[k].tipo, id: op[k].id, nivel: op[k].nivel });
        op.splice(k, 1);
      }
      while (cartas.length < qtd) cartas.push(cartas.length === 0 ? { tipo: 'cura', id: 'cura', nivel: 0 } : { tipo: 'moeda', id: 'moeda', nivel: 0 });
      return cartas;
    }
    function abrirCartas(p) {
      if (p.cartas || p.pendentes <= 0 || !p.vivo) return;
      p.cartas = gerarCartas(p); p.cartaT = 14;
    }
    function aplicarCarta(p, c) {
      if (c.tipo === 'hab') p.hab[c.id] = c.nivel;
      else if (c.tipo === 'pas') { p.pas[c.id] = c.nivel; recalcular(p); }
      else if (c.tipo === 'cura') { const q = Math.round(p.hpMax * 0.4); p.hp = Math.min(p.hpMax, p.hp + q); ev(EV.CURA, p.slot, q); }
      else if (c.tipo === 'moeda') p.moedaAcum += 150;
    }
    function escolher(id, idx) {
      const p = jogador(id); if (!p || !p.cartas) return false;
      const c = p.cartas[idx | 0]; if (!c) return false;
      aplicarCarta(p, c);
      p.cartas = null; p.pendentes--;
      if (p.pendentes > 0) abrirCartas(p);
      return true;
    }


    // ── LOJA ENTRE AS ONDAS (estilo Brotato) ───────────────────────
    function precoOferta(c) {
      const f = 1 + 0.12 * (S.onda - 2);
      let base = c.tipo === 'hab' ? (c.nivel === 1 ? 45 : 28 + c.nivel * 16)
        : c.tipo === 'pas' ? (c.nivel === 1 ? 34 : 22 + c.nivel * 13) : c.tipo === 'cura' ? 26 : 30;
      return Math.round(base * Math.max(1, f));
    }
    function custoReroll(p) { return 8 + 6 * p.rerolls; }
    function ofertar(p) {
      p.lojaOfertas = gerarCartas(p, 4).map(function (c) { c.preco = precoOferta(c); return c; });
      p.lojaVer++;
    }
    function abrirLoja() {
      S.fase = 'loja'; S.lojaT = 0;
      // a arena é limpa (como no Brotato): gemas viram XP, o resto some
      S.gemas.forEach(function (g) { const q = vivoMaisPerto(g.x, g.z); if (q) ganharXP(q, g.v); });
      S.gemas.length = 0; S.inimigos.length = 0; S.projeteis.length = 0; S.zonas.length = 0; S.granadas.length = 0; S.itens.length = 0;
      S.jogadores.forEach(function (p) {
        p.lojaPronto = !p.vivo || p.fora; p.rerolls = 0; p.cartas = null; p.pendentes = 0; p.dashT = 0;
        if (p.vivo) { p.hp = Math.min(p.hpMax, p.hp + p.hpMax * 0.25); ofertar(p); }
        else if (!p.fora) { p.vivo = true; p.hp = Math.round(p.hpMax * 0.4); p.reviveProg = 0; ofertar(p); p.lojaPronto = false; } // quem caiu no co-op volta para a próxima onda
      });
      ev(EV.LOJA, S.onda);
    }
    function fecharLoja() {
      S.fase = 'luta'; S.lojaT = 0;
      S.jogadores.forEach(function (p) { p.lojaOfertas = null; p.lojaPronto = false; p.lojaVer++; p.invul = 1.5; });
      ev(EV.LOJA_FIM); aoIniciarOnda();
    }
    function comprar(id, idx) {
      const p = jogador(id); if (!p || S.fase !== 'loja' || !p.lojaOfertas || p.lojaPronto) return false;
      const c = p.lojaOfertas[idx | 0]; if (!c || c.vendida || p.sucata < c.preco) return false;
      p.sucata -= c.preco; aplicarCarta(p, c); c.vendida = true; p.lojaVer++;
      // se a compra mudou o nível da mesma habilidade em outra oferta, as outras ofertas continuam válidas só se ainda fizerem sentido
      p.lojaOfertas.forEach(function (o) { if (!o.vendida && o.id === c.id && o.tipo === c.tipo && o.nivel <= c.nivel) o.nivel = c.nivel + 1; if (!o.vendida && o.nivel > (o.tipo === 'hab' ? CFG.nivelMaxHab : CFG.nivelMaxPas) && (o.tipo === 'hab' || o.tipo === 'pas')) o.vendida = true; });
      return true;
    }
    function rerolar(id) {
      const p = jogador(id); if (!p || S.fase !== 'loja' || p.lojaPronto) return false;
      const custo = custoReroll(p); if (p.sucata < custo) return false;
      p.sucata -= custo; p.rerolls++; ofertar(p); return true;
    }
    function prontoLoja(id) { const p = jogador(id); if (!p || S.fase !== 'loja') return false; p.lojaPronto = true; p.lojaVer++; return true; }

    function ganharXP(p, v) {
      p.xp += v * p.xpMul;
      while (p.xp >= p.xpProx) {
        p.xp -= p.xpProx; p.nivel++; p.nivelMax = p.nivel; p.xpProx = D.xpParaNivel(p.nivel);
        p.pendentes++; ev(EV.NIVEL, p.slot, p.nivel);
        if (p.vivo) p.hp = Math.min(p.hpMax, p.hp + p.hpMax * 0.10); // subir de nível cura um pouco
      }
      abrirCartas(p);
    }

    // ── DANO ────────────────────────────────────────────────────────
    // empurra um inimigo (chefes não saem do lugar; brutos resistem)
    function empurrar(e, fx, fz) {
      if (e.chefe) return;
      const r = e.elite ? 0.5 : (D.INIMIGOS[e.t].resisteEmpurrao || 0);
      e.kx += fx * (1 - r); e.kz += fz * (1 - r);
    }
    function danoInimigo(e, dano, p, crit) {
      if (e.morto) return;
      e.hp -= dano; e.flash = 0.09;
      if (p) p.dano += dano;
      ev(EV.HIT, e.x, e.z, Math.round(dano), crit ? 1 : 0, e.chefe ? 90 + e.t : e.t);
      if (e.hp <= 0) matar(e, p);
    }
    function rolar(p, base) {            // aplica dano do jogador + crítico
      let d = base * p.dmgMul, crit = 0;
      if (rng() < p.crit) { d *= CFG.jogador.critMult; crit = 1; }
      return { d: d, crit: crit };
    }
    function ferirJogador(p, dano, fonte) {
      if (!p.vivo || p.invul > 0 || p.dashT > 0) return;
      dano = Math.max(1, Math.round(dano));
      S.danoPorFonte[fonte || '?'] = (S.danoPorFonte[fonte || '?'] || 0) + dano; // telemetria p/ balanceamento
      p.hp -= dano; p.invul = CFG.jogador.invulAposDano; p.sofreu = 0.2;
      ev(EV.DANO, p.slot, dano, p.x, p.z);
      if (p.hp <= 0) {
        p.hp = 0; p.vivo = false; p.reviveProg = 0; p.cartas = null;
        ev(EV.CAIU, p.slot, p.x, p.z);
      }
    }
    function curar(p, q) { const n = Math.min(p.hpMax - p.hp, q); if (n > 0) { p.hp += n; ev(EV.CURA, p.slot, Math.round(n)); } }

    function matar(e, p) {
      if (e.morto) return;
      e.morto = true; e.hp = 0;
      const def = e.chefe ? D.CHEFES[e.t] : D.INIMIGOS[e.t];
      S.abatesTotal++;
      if (p) p.abates++;
      ev(EV.MORTE, e.x, e.z, e.chefe ? 90 + e.t : e.t, e.elite ? 1 : 0, e.chefe ? 1 : 0);
      const xpV = def.xp * (1 + 0.06 * (S.onda - 1)) * (e.elite ? 5 : 1);
      soltarGema(e.x, e.z, xpV);
      // moedas vão direto pro bolso de quem matou (ou de todos, se foi morte de área sem dono)
      const moeda = def.moeda * (e.elite ? 5 : 1);
      if (p) p.moedaAcum += moeda * p.moedaMul; else S.jogadores.forEach(function (q) { q.moedaAcum += moeda * q.moedaMul / S.jogadores.length; });
      // SUCATA (dinheiro da partida, gasto na loja entre as ondas — estilo Brotato)
      const suc = (def.moeda * 1.1 + 0.2) * (e.elite ? 4 : 1) * (e.chefe ? 0.5 : 1);
      if (p) p.sucata += suc; else S.jogadores.forEach(function (q) { q.sucata += suc / S.jogadores.length; });
      if (e.chefe) {
        S.chefesMortos++; S.chefe = null;
        soltarItem(e.x + 1, e.z, ITEM.CAPSULA); soltarItem(e.x - 1, e.z, ITEM.CAPSULA); soltarItem(e.x, e.z + 1.2, ITEM.IMA);
      } else if (e.elite) {
        soltarItem(e.x, e.z, ITEM.CAPSULA);
      } else {
        const r = rng();
        if (r < 0.004) soltarItem(e.x, e.z, ITEM.CURA);
        else if (r < 0.0075) soltarItem(e.x, e.z, ITEM.IMA);
        else if (r < 0.0095) soltarItem(e.x, e.z, ITEM.BOMBA);
      }
    }
    function soltarGema(x, z, v) {
      const tipo = v < 4 ? 0 : v < 16 ? 1 : 2;
      // junta com uma gema vizinha pra não lotar a tela
      for (let i = S.gemas.length - 1; i >= Math.max(0, S.gemas.length - 12); i--) {
        const g = S.gemas[i];
        if (!g.puxada && Math.abs(g.x - x) < 0.7 && Math.abs(g.z - z) < 0.7 && g.tipo === tipo) { g.v += v; return; }
      }
      S.gemas.push({ id: nid(), x: x + rnd(-0.4, 0.4), z: z + rnd(-0.4, 0.4), v: v, tipo: tipo, puxada: false });
      if (S.gemas.length > 420) { // lotou: as mais antigas viram XP direto pro jogador mais perto
        const velhas = S.gemas.splice(0, 60);
        velhas.forEach(function (g) { const q = vivoMaisPerto(g.x, g.z); if (q) ganharXP(q, g.v); });
      }
    }
    function soltarItem(x, z, kind) { S.itens.push({ id: nid(), x: x, z: z, kind: kind, t: 45 }); }

    // ── ALVOS (jogadores) ───────────────────────────────────────────
    function vivoMaisPerto(x, z) {
      let m = null, md = 1e9;
      for (let i = 0; i < S.jogadores.length; i++) {
        const p = S.jogadores[i]; if (!p.vivo) continue;
        const dx = p.x - x, dz = p.z - z, d = dx * dx + dz * dz;
        if (d < md) { md = d; m = p; }
      }
      return m;
    }
    function vivos() { let n = 0; for (let i = 0; i < S.jogadores.length; i++) if (S.jogadores[i].vivo) n++; return n; }
    function ativos() { let n = 0; for (let i = 0; i < S.jogadores.length; i++) if (!S.jogadores[i].fora) n++; return n; }

    // ── SPAWN ───────────────────────────────────────────────────────
    function criarInimigo(t, x, z, opt) {
      opt = opt || {};
      const def = opt.chefe ? D.CHEFES[t] : D.INIMIGOS[t];
      const np = Math.max(1, ativos());
      const hpM = D.hpMulOnda(S.onda) * (1 + CFG.coopVida * (np - 1));
      const e = {
        id: nid(), t: t, chefe: !!opt.chefe, elite: !!opt.elite, x: x, z: z, vx: 0, vz: 0, kx: 0, kz: 0,
        hp: 1, hpMax: 1, raio: def.raio * (opt.elite ? 1.3 : 1), morto: false, flash: 0, atk: 0.4 + rng() * 0.5,
        lento: 0, alvo: null, dronaCd: 0, fase: 0, t1: 3 + rng() * 2, t2: 6 + rng() * 3, t3: 2,
        danoMul: D.danoMulOnda(S.onda) * (opt.elite ? 1.4 : 1), velMul: (opt.elite ? 1.1 : 1) * (0.92 + rng() * 0.16),
        tiro: 1 + rng() * (def.tiroCd || 1), carga: 0, cargaDx: 0, cargaDz: 0, prep: 0, giro: 0,
      };
      e.hpMax = e.hp = Math.round(def.hp * hpM * (opt.elite ? 4.5 : 1) * (opt.chefe ? 0.85 : 1));
      S.inimigos.push(e);
      return e;
    }
    function pontoSpawn(p) {
      const a = rng() * PI2, d = rnd(CFG.spawnDistMin, CFG.spawnDistMax);
      let x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      const lim = CFG.arenaRaio + 5, r = Math.hypot(x, z);
      if (r > lim) { x = p.x - Math.cos(a) * d; z = p.z - Math.sin(a) * d; } // saiu do mapa: nasce do lado oposto
      const r2 = Math.hypot(x, z);
      if (r2 > lim) { x *= lim / r2; z *= lim / r2; }
      return [x, z];
    }
    function escolherTipo() {
      let tot = 0; const pesos = [];
      for (let i = 0; i < D.INIMIGOS.length; i++) {
        const d = D.INIMIGOS[i]; let w = 0;
        if (S.onda >= d.onda) {
          w = d.peso;
          if (d.id === 'zumbi') w = Math.max(3, d.peso - S.onda * 0.35);   // zumbis vão ficando menos comuns
          if (d.id === 'bruto') w = d.peso + Math.min(6, (S.onda - d.onda) * 0.35);
        }
        pesos.push(w); tot += w;
      }
      let r = rng() * tot;
      for (let i = 0; i < pesos.length; i++) { r -= pesos[i]; if (r <= 0) return i; }
      return 0;
    }
    function spawnUm() {
      const alvo = vivoMaisPerto(0, 0) && sortearVivo(); if (!alvo) return;
      const t = escolherTipo(), def = D.INIMIGOS[t];
      const pt = pontoSpawn(alvo);
      if (def.grupo) {
        const n = def.grupo + Math.floor(S.onda / 6);
        for (let k = 0; k < n && S.inimigos.length < CFG.maxInimigos; k++) criarInimigo(t, pt[0] + rnd(-1.6, 1.6), pt[1] + rnd(-1.6, 1.6));
        return;
      }
      const chanceElite = S.onda >= 3 ? Math.min(0.1, 0.012 + 0.005 * S.onda) : 0;
      criarInimigo(t, pt[0], pt[1], { elite: rng() < chanceElite });
    }
    function sortearVivo() {
      const v = S.jogadores.filter(function (p) { return p.vivo; });
      return v.length ? v[Math.floor(rng() * v.length)] : null;
    }
    function spawnChefe() {
      const alvo = sortearVivo(); if (!alvo) return;
      const idx = (Math.round(S.onda / CFG.chefeACada) - 1) % D.CHEFES.length;
      const pt = pontoSpawn(alvo);
      const e = criarInimigo(idx, pt[0], pt[1], { chefe: true });
      S.chefe = e;
      ev(EV.CHEFE, e.x, e.z, idx);
    }
    function spawnHorda() {
      const alvo = sortearVivo(); if (!alvo) return;
      const n = Math.min(60, 22 + Math.floor(S.onda * 1.6));
      const tipo = S.onda >= 8 && rng() < 0.5 ? D.TIPO.corredor : D.TIPO.zumbi;
      const R = 15;
      for (let k = 0; k < n && S.inimigos.length < CFG.maxInimigos + 40; k++) {
        const a = (k / n) * PI2;
        criarInimigo(tipo, alvo.x + Math.cos(a) * R, alvo.z + Math.sin(a) * R);
      }
      ev(EV.HORDA, 1);
    }
    function spawnManada() {  // linha de corredores vindo de um lado só
      const alvo = sortearVivo(); if (!alvo) return;
      const a = rng() * PI2, n = Math.min(40, 14 + S.onda), px = -Math.sin(a), pz = Math.cos(a);
      for (let k = 0; k < n; k++) {
        const o = (k - n / 2) * 0.9;
        const e = criarInimigo(D.TIPO.corredor, alvo.x + Math.cos(a) * 17 + px * o, alvo.z + Math.sin(a) * 17 + pz * o);
        e.velMul *= 1.25;
      }
      ev(EV.HORDA, 2);
    }
    function aoIniciarOnda() {
      ev(EV.ONDA, S.onda);
      if (S.onda % CFG.chefeACada === 0) spawnChefe();
      else if (S.onda % 4 === 0) spawnHorda();
      else if (S.onda >= 6 && S.onda % 3 === 0) spawnManada();
    }
    function diretor(dt) {
      S.ondaT += dt;
      if (S.ondaT >= CFG.ondaDuracao) {
        S.ondaT -= CFG.ondaDuracao; S.onda++;
        if (!S.chefe && vivos() > 0) abrirLoja(); else aoIniciarOnda();   // com chefe vivo a luta continua sem intervalo
        return;
      }
      if (S.inimigos.length >= CFG.maxInimigos) return;
      const np = Math.max(1, vivos());
      S.acumSpawn += D.spawnPorSeg(S.onda) * (1 + CFG.coopSpawn * (np - 1)) * (S.chefe ? 0.45 : 1) * dt;
      let guard = 0;
      while (S.acumSpawn >= 1 && S.inimigos.length < CFG.maxInimigos && guard++ < 6) { spawnUm(); S.acumSpawn -= 1; }
      if (S.acumSpawn > 8) S.acumSpawn = 8;
    }

    // ── PROJÉTEIS ───────────────────────────────────────────────────
    // kind: 0 = plasma do jogador, 1 = bala inimiga, 2 = bala de drone
    function atirar(kind, dono, x, z, dx, dz, vel, dano, vida, extra) {
      const b = { id: nid(), kind: kind, dono: dono, x: x, z: z, vx: dx * vel, vz: dz * vel, dano: dano, vida: vida, perfura: 0, explode: 0, r: 0.3, hits: null, crit: 0 };
      if (extra) for (const k in extra) b[k] = extra[k];
      S.projeteis.push(b);
      return b;
    }
    function explosao(x, z, raio, dano, p, cor) {
      ev(EV.EXPLO, x, z, raio, cor || 0);
      consulta(x, z, raio);
      const alvos = buf.slice();
      for (let i = 0; i < alvos.length; i++) {
        const e = alvos[i], dx = e.x - x, dz = e.z - z, d = Math.hypot(dx, dz) || 1;
        empurrar(e, dx / d * 6, dz / d * 6);
        danoInimigo(e, dano, p, 0);
      }
    }
    function passoProjeteis(dt) {
      const L = S.projeteis;
      for (let i = L.length - 1; i >= 0; i--) {
        const b = L[i];
        b.x += b.vx * dt; b.z += b.vz * dt; b.vida -= dt;
        let remover = b.vida <= 0 || Math.hypot(b.x, b.z) > CFG.arenaRaio + 12;
        if (!remover) {
          if (b.kind === 1) {                              // bala inimiga → jogadores
            for (let j = 0; j < S.jogadores.length; j++) {
              const p = S.jogadores[j]; if (!p.vivo) continue;
              const dx = p.x - b.x, dz = p.z - b.z, rr = CFG.jogador.raio + b.r;
              if (dx * dx + dz * dz < rr * rr) { ferirJogador(p, b.dano, 'bala'); remover = true; break; }
            }
          } else {                                         // plasma / drone → inimigos
            consulta(b.x, b.z, b.r);
            for (let k = 0; k < buf.length && !remover; k++) {
              const e = buf[k];
              if (b.hits && b.hits.indexOf(e.id) >= 0) continue;
              const dono = jogador(b.dono);
              danoInimigo(e, b.dano, dono, b.crit);
              { const d = Math.hypot(b.vx, b.vz) || 1; empurrar(e, b.vx / d * 1.6, b.vz / d * 1.6); }
              if (b.explode) explosao(b.x, b.z, b.explode, b.dano * 0.6, dono, 1);
              if (b.perfura > 0) { b.perfura--; (b.hits = b.hits || []).push(e.id); }
              else remover = true;
            }
          }
        }
        if (remover) { L[i] = L[L.length - 1]; L.pop(); }
      }
    }

    // ── HABILIDADES DO JOGADOR ──────────────────────────────────────
    function habilidades(p, dt) {
      const H = p.hab;
      // RIFLE PLASMA
      if (H.rifle) {
        p.cd.rifle -= dt;
        if (p.cd.rifle <= 0) {
          const s = statsHab('rifle', H.rifle), alvo = maisProximo(p.x, p.z, 15);
          if (alvo) {
            const dx = alvo.x - p.x, dz = alvo.z - p.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
            p.fx = ux; p.fz = uz;
            const abre = 0.11, n = s.proj;
            for (let k = 0; k < n; k++) {
              const a = Math.atan2(uz, ux) + (k - (n - 1) / 2) * abre;
              const r = rolar(p, s.dano), cx = Math.cos(a), cz = Math.sin(a);
              atirar(0, p.id, p.x + cx * 0.9, p.z + cz * 0.9, cx, cz, s.vel, r.d, s.vida, { perfura: s.perfura, explode: s.explode, crit: r.crit, r: 0.35 });
            }
            ev(EV.TIRO, p.slot, p.x, p.z, ux, uz);
            p.cd.rifle = s.intervalo * p.cdMul;
          } else p.cd.rifle = 0.12;
        }
      }
      // KATANA RUBI: corte em arco em todos à frente (corpo a corpo)
      if (H.katana) {
        const s = statsHab('katana', H.katana);
        p.cd.katana -= dt;
        if (p.cd.katana <= 0) {
          const alvo = maisProximo(p.x, p.z, s.alcance + 2.2);
          if (alvo) {
            const dx = alvo.x - p.x, dz = alvo.z - p.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
            p.fx = ux; p.fz = uz; cortar(p, s, ux, uz);
            if (s.duplo) { p.corteSeg = 0.2; p.corteDx = ux; p.corteDz = uz; }
            p.cd.katana = s.intervalo * p.cdMul;
          } else p.cd.katana = 0.1;
        }
        if (p.corteSeg > 0) { p.corteSeg -= dt; if (p.corteSeg <= 0) cortar(p, s, p.corteDx, p.corteDz, true); }
      }
      // DRONES ORBITAIS (dano por contato)
      if (H.drones) {
        const s = statsHab('drones', H.drones);
        p.droneAng += s.velAng * dt;
        for (let i = 0; i < s.n; i++) {
          const a = p.droneAng + i * PI2 / s.n, dx = p.x + Math.cos(a) * s.orbita, dz = p.z + Math.sin(a) * s.orbita;
          consulta(dx, dz, 0.75);
          for (let k = 0; k < buf.length; k++) {
            const e = buf[k]; if (e.dronaCd > 0) continue;
            e.dronaCd = 0.35; const r = rolar(p, s.dano);
            danoInimigo(e, r.d, p, r.crit);
            empurrar(e, Math.cos(a) * 2.2, Math.sin(a) * 2.2);
          }
          if (s.atira && i === 0) { // drones nível 8 também atiram
            p.cd.dronesTiro -= dt;
            if (p.cd.dronesTiro <= 0) {
              const alvo = maisProximo(p.x, p.z, 10);
              if (alvo) {
                for (let q = 0; q < s.n; q++) {
                  const aq = p.droneAng + q * PI2 / s.n, ox = p.x + Math.cos(aq) * s.orbita, oz = p.z + Math.sin(aq) * s.orbita;
                  const ddx = alvo.x - ox, ddz = alvo.z - oz, d = Math.hypot(ddx, ddz) || 1;
                  const r = rolar(p, s.dano * 0.8);
                  atirar(2, p.id, ox, oz, ddx / d, ddz / d, 18, r.d, 0.7, { crit: r.crit, r: 0.3 });
                  ev(EV.DRONE_TIRO, p.slot, ox, oz, ddx / d, ddz / d);
                }
              }
              p.cd.dronesTiro = 1.3 * p.cdMul;
            }
          }
        }
      }
      // PULSO EMP
      if (H.emp) {
        const s = statsHab('emp', H.emp);
        p.cd.emp -= dt;
        if (p.cd.emp <= 0) {
          if (maisProximo(p.x, p.z, s.raio + 1.5)) { pulsoEMP(p, s); if (s.duplo) p.empSeg = 0.4; p.cd.emp = s.cd * p.cdMul; }
          else p.cd.emp = 0.25;
        }
        if (p.empSeg > 0) { p.empSeg -= dt; if (p.empSeg <= 0) pulsoEMP(p, s); }
      }
      // ARCO TESLA
      if (H.tesla) {
        const s = statsHab('tesla', H.tesla);
        p.cd.tesla -= dt;
        if (p.cd.tesla <= 0) {
          const primeiro = maisProximo(p.x, p.z, s.alcance);
          if (primeiro) {
            const cadeia = [primeiro], pts = [p.x, p.z, primeiro.x, primeiro.z];
            let ult = primeiro;
            for (let k = 1; k < s.saltos; k++) {
              const prox2 = maisProximo(ult.x, ult.z, s.salto, cadeia);
              if (!prox2) break;
              cadeia.push(prox2); pts.push(prox2.x, prox2.z); ult = prox2;
            }
            ev.apply(null, [EV.RAIO, p.slot, pts.length / 2].concat(pts));
            for (let k = 0; k < cadeia.length; k++) { const r = rolar(p, s.dano); danoInimigo(cadeia[k], r.d, p, r.crit); }
            p.cd.tesla = s.cd * p.cdMul;
          } else p.cd.tesla = 0.2;
        }
      }
      // GRANADA PLASMA
      if (H.granada) {
        const s = statsHab('granada', H.granada);
        p.cd.granada -= dt;
        if (p.cd.granada <= 0) {
          const alvo = melhorAglomerado(p, s.alcance);
          if (alvo) {
            lancarGranada(p, s, alvo.x, alvo.z);
            if (s.dupla) { const a2 = melhorAglomerado(p, s.alcance, alvo); lancarGranada(p, s, a2 ? a2.x : alvo.x + rnd(-2, 2), a2 ? a2.z : alvo.z + rnd(-2, 2)); }
            p.cd.granada = s.cd * p.cdMul;
          } else p.cd.granada = 0.3;
        }
      }
      // ATAQUE ORBITAL
      if (H.orbital) {
        const s = statsHab('orbital', H.orbital);
        p.cd.orbital -= dt;
        if (p.cd.orbital <= 0) {
          const escolhidos = [];
          for (let k = 0; k < s.n; k++) {
            const e = maisProximoAleatorio(p, s.alcance, escolhidos);
            if (!e) break;
            escolhidos.push(e);
            S.zonas.push({ id: nid(), tipo: 'orbital', x: e.x + e.vx * 0.5, z: e.z + e.vz * 0.5, r: s.raio, t: 0.9, dano: s.dano, dono: p.id });
            ev(EV.TELEGRAFO, 1, e.x, e.z, s.raio, 0.9, 0, 0);
          }
          p.cd.orbital = (escolhidos.length ? s.cd : 0.3) * p.cdMul;
        }
      }
    }
    // golpe da katana: atinge todos num arco (ou 360° no nível 8); nível 7+ também lança uma onda de corte
    function cortar(p, s, ux, uz, segundo) {
      ev(EV.SLASH, p.slot, p.x, p.z, ux, uz, s.arco, s.alcance);
      consulta(p.x, p.z, s.alcance);
      const alvos = buf.slice(), metade = Math.cos(s.arco / 2);
      for (let i = 0; i < alvos.length; i++) {
        const e = alvos[i], dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz) || 0.001;
        if (s.arco < 6 && d > e.raio + 0.9 && (dx * ux + dz * uz) / d < metade) continue;   // fora do arco
        const r = rolar(p, s.dano * (segundo ? 0.8 : 1));
        danoInimigo(e, r.d, p, r.crit); empurrar(e, dx / d * 3.5, dz / d * 3.5);
      }
      if (s.onda && !segundo) {
        const r = rolar(p, s.dano * 0.7);
        atirar(3, p.id, p.x + ux * 1.2, p.z + uz * 1.2, ux, uz, 15, r.d, 0.5, { perfura: 5, r: 0.95, crit: r.crit });
        if (s.arco > 6) { atirar(3, p.id, p.x - ux * 1.2, p.z - uz * 1.2, -ux, -uz, 15, r.d, 0.5, { perfura: 5, r: 0.95, crit: r.crit }); }
      }
    }
    function pulsoEMP(p, s) {
      ev(EV.EMP, p.x, p.z, s.raio);
      consulta(p.x, p.z, s.raio);
      const alvos = buf.slice();
      for (let i = 0; i < alvos.length; i++) {
        const e = alvos[i], dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz) || 1;
        const r = rolar(p, s.dano);
        danoInimigo(e, r.d, p, r.crit);
        empurrar(e, dx / d * 8, dz / d * 8);
        e.lento = 2;
      }
      // o pulso também apaga balas inimigas dentro do raio
      for (let i = S.projeteis.length - 1; i >= 0; i--) {
        const b = S.projeteis[i];
        if (b.kind === 1 && Math.hypot(b.x - p.x, b.z - p.z) < s.raio) { S.projeteis[i] = S.projeteis[S.projeteis.length - 1]; S.projeteis.pop(); }
      }
    }
    // escolhe o inimigo com mais vizinhos por perto (alvo ideal da granada)
    function melhorAglomerado(p, alcance, evitar) {
      let melhor = null, mv = -1;
      for (let k = 0; k < 9; k++) {
        const a = rng() * PI2, d = rng() * alcance;
        const e = maisProximo(p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, 3);
        if (!e || e === evitar || Math.hypot(e.x - p.x, e.z - p.z) > alcance + 2) continue;
        consulta(e.x, e.z, 2.4);
        const v = buf.length + (e.chefe ? 6 : 0);
        if (v > mv) { mv = v; melhor = e; }
      }
      return melhor;
    }
    function maisProximoAleatorio(p, alcance, ignorar) {
      if (S.chefe && !S.chefe.morto && ignorar.indexOf(S.chefe) < 0 && Math.hypot(S.chefe.x - p.x, S.chefe.z - p.z) < alcance + 3) return S.chefe;
      for (let k = 0; k < 6; k++) {
        const a = rng() * PI2, d = rng() * alcance;
        const e = maisProximo(p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, 4, ignorar);
        if (e && Math.hypot(e.x - p.x, e.z - p.z) < alcance + 2) return e;
      }
      return maisProximo(p.x, p.z, alcance, ignorar);
    }
    function lancarGranada(p, s, x, z) {
      S.granadas.push({ id: nid(), x0: p.x, z0: p.z, x1: x, z1: z, t: 0, dur: 0.7, raio: s.raio, dano: s.dano, chamas: s.chamas, dono: p.id });
    }
    function passoGranadas(dt) {
      const L = S.granadas;
      for (let i = L.length - 1; i >= 0; i--) {
        const g = L[i]; g.t += dt;
        if (g.t >= g.dur) {
          const p = jogador(g.dono), r = p ? rolar(p, g.dano) : { d: g.dano };
          explosao(g.x1, g.z1, g.raio, r.d, p, 2);
          if (g.chamas) S.zonas.push({ id: nid(), tipo: 'chama', x: g.x1, z: g.z1, r: g.raio * 0.85, t: 3.2, dano: g.dano * 0.22, tick: 0.4, dono: g.dono });
          L[i] = L[L.length - 1]; L.pop();
        }
      }
    }
    function passoZonas(dt) {
      const L = S.zonas;
      for (let i = L.length - 1; i >= 0; i--) {
        const z = L[i]; z.t -= dt;
        const p = z.dono ? jogador(z.dono) : null;
        if (z.tipo === 'chama') {
          z.tick -= dt;
          if (z.tick <= 0) {
            z.tick = 0.4; consulta(z.x, z.z, z.r);
            const alvos = buf.slice();
            for (let k = 0; k < alvos.length; k++) { const r = p ? rolar(p, z.dano) : { d: z.dano, crit: 0 }; danoInimigo(alvos[k], r.d, p, 0); }
          }
        } else if (z.t <= 0) {
          if (z.tipo === 'orbital') {
            ev(EV.ORBITAL, z.x, z.z, z.r);
            consulta(z.x, z.z, z.r);
            const alvos = buf.slice();
            for (let k = 0; k < alvos.length; k++) { const r = p ? rolar(p, z.dano) : { d: z.dano, crit: 0 }; danoInimigo(alvos[k], r.d, p, r.crit); }
          } else { // zonas dos chefes ferem jogadores
            ev(EV.EXPLO, z.x, z.z, z.r, 3);
            for (let j = 0; j < S.jogadores.length; j++) {
              const q = S.jogadores[j]; if (!q.vivo) continue;
              if (Math.hypot(q.x - z.x, q.z - z.z) < z.r + CFG.jogador.raio) ferirJogador(q, z.dano, 'zona-chefe');
            }
          }
        }
        if (z.t <= 0) { L[i] = L[L.length - 1]; L.pop(); }
      }
    }

    // ── INIMIGOS ────────────────────────────────────────────────────
    function passoInimigos(dt) {
      const L = S.inimigos;
      for (let i = 0; i < L.length; i++) {
        const e = L[i]; if (e.morto) continue;
        const def = e.chefe ? D.CHEFES[e.t] : D.INIMIGOS[e.t];
        if (e.flash > 0) e.flash -= dt;
        if (e.dronaCd > 0) e.dronaCd -= dt;
        if (e.lento > 0) e.lento -= dt;
        if (e.atk > 0) e.atk -= dt;
        if (!e.alvo || !e.alvo.vivo || ((S.tick + e.id) & 15) === 0) e.alvo = vivoMaisPerto(e.x, e.z);
        const a = e.alvo; if (!a) { e.vx = e.vz = 0; continue; }
        let dx = a.x - e.x, dz = a.z - e.z; const d = Math.hypot(dx, dz) || 0.001; dx /= d; dz /= d;
        let vel = def.vel * e.velMul * (e.lento > 0 ? 0.55 : 1);
        let mx = dx, mz = dz;

        if (e.chefe) { comportamentoChefe(e, def, a, d, dx, dz, dt); vel = e._vel !== undefined ? e._vel : vel; mx = e._mx !== undefined ? e._mx : mx; mz = e._mz !== undefined ? e._mz : mz; }
        else if (def.comp === 'atirar') {
          if (d > 8.5) { /* aproxima */ } else if (d < 6) { mx = -dx; mz = -dz; vel *= 0.8; } else { mx = -dz * 0.6; mz = dx * 0.6; }
          e.tiro -= dt;
          if (e.tiro <= 0 && d < 13) {
            e.tiro = def.tiroCd * (0.85 + rng() * 0.3);
            atirar(1, -1, e.x, e.z, dx, dz, def.tiroVel, def.dano * e.danoMul, 3.2, { r: 0.28 });
            ev(EV.TIRO_INIM, e.x, e.z, dx, dz, e.t);
          }
        } else if (def.comp === 'voar') {
          if (d < 1.1) { // BOOM
            for (let j = 0; j < S.jogadores.length; j++) {
              const q = S.jogadores[j]; if (!q.vivo) continue;
              if (Math.hypot(q.x - e.x, q.z - e.z) < def.explode) ferirJogador(q, def.dano * e.danoMul, 'kamikaze');
            }
            ev(EV.EXPLO, e.x, e.z, def.explode, 3);
            matar(e, null); continue;
          }
        }
        // separação (inimigos não viram uma bolha só)
        let sx = 0, sz = 0, cont = 0;
        if (!e.chefe) {
          const g = cel(e.x, e.z);
          const gx = g % GN, gz = (g - gx) / GN;
          for (let oz = -1; oz <= 1 && cont < 7; oz++) for (let ox = -1; ox <= 1 && cont < 7; ox++) {
            const xx = gx + ox, zz = gz + oz; if (xx < 0 || zz < 0 || xx >= GN || zz >= GN) continue;
            for (let k = cabeca[zz * GN + xx]; k !== -1 && cont < 7; k = prox[k]) {
              if (k === i) continue;
              const o = L[k]; if (o.morto) continue;
              const ddx = e.x - o.x, ddz = e.z - o.z, rr = e.raio + o.raio, dd = ddx * ddx + ddz * ddz;
              if (dd < rr * rr && dd > 0.0001) { const q = Math.sqrt(dd); const f = (rr - q) / rr; sx += ddx / q * f; sz += ddz / q * f; cont++; }
            }
          }
        }
        e.vx = mx * vel + sx * 2.4; e.vz = mz * vel + sz * 2.4;
        e.x += (e.vx + e.kx) * dt; e.z += (e.vz + e.kz) * dt;
        const kd = Math.exp(-7 * dt); e.kx *= kd; e.kz *= kd;
        const rr = Math.hypot(e.x, e.z), lim = CFG.arenaRaio + 8;
        if (rr > lim) { e.x *= lim / rr; e.z *= lim / rr; }

        // contato com jogadores (cada inimigo tem um intervalo próprio entre mordidas)
        if (e.atk <= 0 && def.comp !== 'voar') {
          for (let j = 0; j < S.jogadores.length; j++) {
            const q = S.jogadores[j]; if (!q.vivo) continue;
            const ddx = q.x - e.x, ddz = q.z - e.z, rr2 = CFG.jogador.raio + e.raio;
            if (ddx * ddx + ddz * ddz < rr2 * rr2) {
              ferirJogador(q, def.dano * e.danoMul * (e.carga > 0 ? 1.4 : 1), e.chefe ? 'chefe-contato' : def.id);
              e.atk = 0.85; break;
            }
          }
        }
      }
    }

    // comportamentos especiais dos 3 chefes
    function comportamentoChefe(e, def, a, d, dx, dz, dt) {
      e._vel = undefined; e._mx = undefined; e._mz = undefined;
      const mul = e.danoMul;
      if (e.t === 0) {                                   // TITAN GOLIATH: pisão + investida
        e.t1 -= dt; e.t2 -= dt;
        if (e.prep > 0) {                                 // parado "carregando" a investida
          e.prep -= dt; e._vel = 0;
          if (e.prep <= 0) { e.carga = 0.95; }
        } else if (e.carga > 0) {                         // investida em linha reta
          e.carga -= dt; e._vel = 15; e._mx = e.cargaDx; e._mz = e.cargaDz;
        } else {
          if (e.t1 <= 0 && d < 15) {
            e.t1 = 6.5;
            S.zonas.push({ id: nid(), tipo: 'chefe', x: a.x, z: a.z, r: 5.2, t: 1.2, dano: def.dano * mul * 1.5 });
            ev(EV.TELEGRAFO, 1, a.x, a.z, 5.2, 1.2, 0, 0);
          }
          if (e.t2 <= 0 && d > 5) {
            e.t2 = 11; e.prep = 0.9; e.cargaDx = dx; e.cargaDz = dz;
            ev(EV.TELEGRAFO, 2, e.x, e.z, 2.2, 0.9, e.x + dx * 15, e.z + dz * 15);
          }
        }
      } else if (e.t === 1) {                            // NEURAL HYDRA: anéis de balas + invoca enxame
        e.t1 -= dt; e.t2 -= dt;
        if (d < 7) { e._mx = -dx; e._mz = -dz; e._vel = def.vel; } else if (d < 10) e._vel = 0;
        if (e.t1 <= 0) {
          e.t1 = 3.2; e.giro += 0.33;
          const n = 16;
          for (let k = 0; k < n; k++) {
            const ang = e.giro + k * PI2 / n;
            atirar(1, -1, e.x, e.z, Math.cos(ang), Math.sin(ang), 6.2, def.dano * mul * 0.55, 6, { r: 0.35 });
          }
          ev(EV.TIRO_INIM, e.x, e.z, 0, 0, 90 + e.t);
        }
        if (e.t2 <= 0) {
          e.t2 = 9;
          for (let k = 0; k < 7 && S.inimigos.length < CFG.maxInimigos + 20; k++) {
            const ang = k * PI2 / 7; criarInimigo(D.TIPO.enxame, e.x + Math.cos(ang) * 2.5, e.z + Math.sin(ang) * 2.5);
          }
        }
      } else {                                           // GLITCH WRAITH: teleporte + leque + chuva de zonas
        e.t1 -= dt; e.t2 -= dt; e.t3 -= dt;
        if (e.t1 <= 0) {
          e.t1 = 5;
          const ang = rng() * PI2, dist = rnd(6, 8.5);
          let nx = a.x + Math.cos(ang) * dist, nz = a.z + Math.sin(ang) * dist;
          const rr = Math.hypot(nx, nz); if (rr > CFG.arenaRaio) { nx *= CFG.arenaRaio / rr; nz *= CFG.arenaRaio / rr; }
          ev(EV.TELEPORTE, e.x, e.z, nx, nz); e.x = nx; e.z = nz;
          const bx = a.x - e.x, bz = a.z - e.z, bd = Math.hypot(bx, bz) || 1;
          for (let k = -2; k <= 2; k++) {
            const ang2 = Math.atan2(bz, bx) + k * 0.2;
            atirar(1, -1, e.x, e.z, Math.cos(ang2), Math.sin(ang2), 9, def.dano * mul * 0.5, 4, { r: 0.35 });
          }
          ev(EV.TIRO_INIM, e.x, e.z, bx / bd, bz / bd, 90 + e.t);
        }
        if (e.t2 <= 0) {
          e.t2 = 4.2;
          for (let k = 0; k < 3; k++) {
            const zx = a.x + rnd(-4, 4), zz = a.z + rnd(-4, 4);
            S.zonas.push({ id: nid(), tipo: 'chefe', x: zx, z: zz, r: 2.4, t: 1.1, dano: def.dano * mul });
            ev(EV.TELEGRAFO, 1, zx, zz, 2.4, 1.1, 0, 0);
          }
        }
        if (e.t3 <= 0) {
          e.t3 = 2.4;
          const bd = Math.hypot(a.x - e.x, a.z - e.z) || 1, ux = (a.x - e.x) / bd, uz = (a.z - e.z) / bd;
          for (let k = -1; k <= 1; k++) {
            const ang3 = Math.atan2(uz, ux) + k * 0.09;
            atirar(1, -1, e.x, e.z, Math.cos(ang3), Math.sin(ang3), 11, def.dano * mul * 0.45, 3.5, { r: 0.3 });
          }
        }
      }
    }

    // ── JOGADORES (movimento, dash, regen, ressuscitar) ─────────────
    function passoJogadores(dt) {
      const J = CFG.jogador;
      for (let i = 0; i < S.jogadores.length; i++) {
        const p = S.jogadores[i]; if (p.fora) continue;
        if (p.invul > 0) p.invul -= dt;
        if (p.sofreu > 0) p.sofreu -= dt;
        if (!p.vivo) {
          // co-op: aliado vivo perto → barra de ressurreição
          let aliado = false;
          for (let k = 0; k < S.jogadores.length; k++) {
            const q = S.jogadores[k]; if (q === p || !q.vivo) continue;
            if (Math.hypot(q.x - p.x, q.z - p.z) < 2.6) { aliado = true; break; }
          }
          p.reviveProg = Math.max(0, p.reviveProg + (aliado ? dt / CFG.reviveTempo : -dt * 0.4));
          if (p.reviveProg >= 1) {
            p.vivo = true; p.hp = Math.round(p.hpMax * 0.5); p.invul = 2.5; p.reviveProg = 0;
            ev(EV.REVIVEU, p.slot, p.x, p.z); abrirCartas(p);
          }
          continue;
        }
        // dash
        if (p.dashCd > 0) p.dashCd -= dt;
        if (p.querDash) {
          p.querDash = false;
          if (p.dashCd <= 0) {
            let dx = p.mx, dz = p.mz; const m = Math.hypot(dx, dz);
            if (m < 0.1) { dx = p.fx; dz = p.fz; } else { dx /= m; dz /= m; }
            p.dashX = dx; p.dashZ = dz; p.dashT = J.dashTempo; p.dashCd = p.dashRecarga; p.invul = Math.max(p.invul, J.dashInvul);
            ev(EV.DASH, p.slot, p.x, p.z);
          }
        }
        let vx, vz;
        if (p.dashT > 0) { p.dashT -= dt; vx = p.dashX * J.dashDist / J.dashTempo; vz = p.dashZ * J.dashDist / J.dashTempo; }
        else { vx = p.mx * p.vel; vz = p.mz * p.vel; }
        p.x += vx * dt; p.z += vz * dt;
        if (Math.abs(p.mx) + Math.abs(p.mz) > 0.05 && p.dashT <= 0) { const m = Math.hypot(p.mx, p.mz); p.fx = p.mx / m; p.fz = p.mz / m; }
        p.vx = vx; p.vz = vz;
        const r = Math.hypot(p.x, p.z), lim = CFG.arenaRaio - 1.5;
        if (r > lim) { p.x *= lim / r; p.z *= lim / r; }
        // regeneração
        if (p.regen > 0 && p.hp < p.hpMax) { p.hp = Math.min(p.hpMax, p.hp + p.regen * dt); }
        // cartas: online escolhe sozinho se demorar demais
        if (p.cartas && !pausaNasCartas) {
          p.cartaT -= dt;
          if (p.cartaT <= 0) escolher(p.id, Math.floor(rng() * p.cartas.length));
        }
        habilidades(p, dt);
      }
    }
    function passoColetaveis(dt) {
      // gemas
      const G = S.gemas;
      for (let i = G.length - 1; i >= 0; i--) {
        const g = G[i];
        let alvo = null, md = 1e9;
        for (let j = 0; j < S.jogadores.length; j++) {
          const p = S.jogadores[j]; if (!p.vivo) continue;
          const d = Math.hypot(p.x - g.x, p.z - g.z);
          const ima = g.puxada ? 1e9 : p.ima;
          if (d < ima && d < md) { md = d; alvo = p; }
        }
        if (alvo) {
          g.puxada = true;
          const dx = alvo.x - g.x, dz = alvo.z - g.z, d = Math.hypot(dx, dz) || 1;
          const v = 9 + (g.pv = Math.min(30, (g.pv || 0) + 40 * dt));
          g.x += dx / d * v * dt; g.z += dz / d * v * dt;
          if (d < 0.7) { ganharXP(alvo, g.v); ev(EV.GEMA, alvo.slot, g.v); G[i] = G[G.length - 1]; G.pop(); }
        }
      }
      // itens
      const IT = S.itens;
      for (let i = IT.length - 1; i >= 0; i--) {
        const it = IT[i]; it.t -= dt;
        let pego = false;
        for (let j = 0; j < S.jogadores.length && !pego; j++) {
          const p = S.jogadores[j]; if (!p.vivo) continue;
          if (Math.hypot(p.x - it.x, p.z - it.z) < 1.3 + (it.kind === ITEM.CAPSULA ? 0.4 : 0)) { pego = true; usarItem(p, it); }
        }
        if (pego || it.t <= 0) { IT[i] = IT[IT.length - 1]; IT.pop(); }
      }
    }
    function usarItem(p, it) {
      ev(EV.ITEM, p.slot, it.kind);
      if (it.kind === ITEM.CURA) curar(p, p.hpMax * 0.35);
      else if (it.kind === ITEM.IMA) S.gemas.forEach(function (g) { g.puxada = true; });
      else if (it.kind === ITEM.BOMBA) {
        for (let i = 0; i < S.inimigos.length; i++) {
          const e = S.inimigos[i]; if (e.morto || Math.hypot(e.x - p.x, e.z - p.z) > 15) continue;
          danoInimigo(e, e.chefe ? e.hpMax * 0.05 : 140 * D.hpMulOnda(S.onda) * 0.6 + 60, p, 0);
        }
        ev(EV.EXPLO, p.x, p.z, 15, 4);
      } else if (it.kind === ITEM.CAPSULA) { p.pendentes += 2; ev(EV.CAPSULA, p.slot); abrirCartas(p); }
    }

    function limparMortos() {
      const L = S.inimigos; let j = 0;
      for (let i = 0; i < L.length; i++) if (!L[i].morto) L[j++] = L[i];
      L.length = j;
      if (S.chefe && S.chefe.morto) S.chefe = null;
    }

    function checarFim() {
      if (S.fim) return;
      let algumVivo = false, algum = false;
      for (let i = 0; i < S.jogadores.length; i++) { const p = S.jogadores[i]; if (p.fora) continue; algum = true; if (p.vivo) algumVivo = true; }
      if (algum && !algumVivo) terminar('morreu');
      else if (!algum && S.jogadores.length) terminar('saiu');
    }
    function terminar(motivo) {
      S.fim = true;
      S.resultado = {
        motivo: motivo, onda: S.onda, tempo: Math.round(S.t), abates: S.abatesTotal, chefes: S.chefesMortos,
        jogadores: S.jogadores.map(function (p) { return Object.assign({ id: p.id, nome: p.nome, nivel: p.nivelMax, abates: p.abates, dano: Math.round(p.dano) }, recompensa(p)); }),
      };
      ev(EV.FIM);
    }
    // recompensas da conta (moedas + XP de perfil) — mesma conta no solo e no servidor
    function recompensa(p) {
      const bonusOnda = S.onda * 20 + S.chefesMortos * 150;
      return {
        moedas: Math.floor(p.moedaAcum + bonusOnda * p.moedaMul),
        xpConta: Math.round(S.onda * 10 + p.abates * 0.15 + S.chefesMortos * 80),
        pontos: Math.round(S.onda * 500 + p.abates * 10 + S.chefesMortos * 2000 + S.t),
      };
    }

    // ── PASSO PRINCIPAL ─────────────────────────────────────────────
    function passo(dt) {
      if (S.fim) return;
      if (dt > 0.05) dt = 0.05; // nunca simula um "pulo" gigante (aba em segundo plano)
      if (S.fase === 'loja') {                      // intervalo: só espera os jogadores (no co-op, no máximo 25 s)
        S.pausado = true; S.lojaT += dt;
        if (S.coop && S.lojaT >= 25) S.jogadores.forEach(function (p) { p.lojaPronto = true; });
        if (S.jogadores.every(function (p) { return p.lojaPronto || p.fora; })) { S.pausado = false; fecharLoja(); }
        return;
      }
      S.pausado = pausaNasCartas && S.jogadores.some(function (p) { return p.cartas; });
      if (S.pausado) return;
      S.t += dt; S.tick++;
      if (S.tick === 1) aoIniciarOnda();
      diretor(dt);
      montarGrade();
      passoJogadores(dt);
      montarGrade(); // jogadores podem ter empurrado/matado inimigos
      passoInimigos(dt);
      passoProjeteis(dt);
      passoGranadas(dt);
      passoZonas(dt);
      passoColetaveis(dt);
      limparMortos();
      checarFim();
    }
    function drenarEventos() { const e = S.eventos; S.eventos = []; return e; }

    return {
      S: S, EV: EV, ITEM: ITEM, passo: passo, entrada: entrada, escolher: escolher, comprar: comprar, rerolar: rerolar, prontoLoja: prontoLoja, custoReroll: custoReroll,
      adicionarJogador: adicionarJogador, removerJogador: removerJogador, jogador: jogador,
      drenarEventos: drenarEventos, recompensa: recompensa, terminar: terminar, statsHab: statsHab,
    };
  }

  return { criar: criar, EV: EV, ITEM: ITEM, statsHab: statsHab };
});
