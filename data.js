// ══════════════════════════════════════════════════════════════════
// DATA.JS — TODOS os números do jogo num lugar só (balanceamento).
//
// Este arquivo roda no CELULAR (window.NRData) e no SERVIDOR (require).
// É a única fonte de verdade: se mudar um número aqui, o jogo solo e o
// online mudam juntos. Para rebalancear, mexa só neste arquivo.
//
// Estilo: Survivor.io cyberpunk — ondas infinitas, 1 arma plásmica,
// habilidades que o jogador escolhe ao subir de nível dentro da partida.
// ══════════════════════════════════════════════════════════════════
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NRData = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ── CONFIGURAÇÃO GERAL ──────────────────────────────────────────
  const CFG = {
    arenaRaio: 46,            // raio do mapa (unidades 3D); o jogador não passa daqui
    ondaDuracao: 28,          // segundos por onda
    chefeACada: 5,            // um chefe a cada N ondas (5, 10, 15...)
    maxInimigos: 230,         // teto de inimigos vivos (performance no celular)
    maxJogadores: 4,          // co-op online
    spawnDistMin: 17,         // inimigos nascem a essa distância do jogador (fora da tela)
    spawnDistMax: 21,
    // jogador base
    jogador: {
      hp: 130, vel: 5.2, raio: 0.6, ima: 3.2,
      dashDist: 7.5, dashTempo: 0.18, dashRecarga: 3.6, dashInvul: 0.4,
      invulAposDano: 0.4,
      critChance: 0.05, critMult: 2.0,
    },
    maxHabilidades: 5,        // slots de habilidade ativa (a arma plásmica ocupa 1)
    maxPassivas: 6,           // slots de passiva
    nivelMaxHab: 8,
    nivelMaxPas: 5,
    // bônus por ter mais jogadores na sala (co-op)
    coopVida: 0.65,           // +65% de vida dos inimigos por jogador extra
    coopSpawn: 0.75,          // +75% de inimigos por jogador extra
    reviveTempo: 3.5,         // segundos ao lado do aliado caído para reviver
  };

  // ── CURVAS ──────────────────────────────────────────────────────
  // XP necessário para sair do nível n da PARTIDA (não é o nível da conta)
  function xpParaNivel(n) { return Math.round(3 + n * 2.2 + n * n * 0.3); }
  // multiplicador de vida dos inimigos na onda n
  function hpMulOnda(n) { const k = n - 1; return 1 + 0.30 * k + 0.018 * k * k; }
  // multiplicador de dano dos inimigos na onda n
  function danoMulOnda(n) { return 1 + 0.07 * (n - 1); }
  // quantos inimigos por segundo a onda n pede (1 jogador)
  function spawnPorSeg(n) { return 0.7 + 0.34 * n + 0.012 * n * n; }

  // ── INIMIGOS ────────────────────────────────────────────────────
  // comp: 'andar' (corpo a corpo) | 'voar' (kamikaze) | 'atirar' (mantém distância)
  const INIMIGOS = [
    { id: 'zumbi',    nome: 'GLITCH WALKER',  hp: 30,  vel: 2.0, dano: 8,  raio: 0.55, xp: 1,   moeda: 0.5, peso: 10, onda: 1, comp: 'andar',  cor: 0x39ff88 },
    { id: 'corredor', nome: 'NEON STRIDER',   hp: 18,  vel: 3.7, dano: 6,  raio: 0.45, xp: 1,   moeda: 0.5, peso: 6,  onda: 2, comp: 'andar',  cor: 0xff3da6 },
    { id: 'enxame',   nome: 'NANO SWARM',     hp: 9,   vel: 3.1, dano: 4,  raio: 0.32, xp: 0.5, moeda: 0.3, peso: 5,  onda: 3, comp: 'andar',  cor: 0xffd23d, grupo: 7 },
    { id: 'kamikaze', nome: 'DRONE BOMBER',   hp: 22,  vel: 4.3, dano: 26, raio: 0.5,  xp: 2,   moeda: 1,   peso: 4,  onda: 4, comp: 'voar',   cor: 0xff6a1a, explode: 2.3 },
    { id: 'atirador', nome: 'SNIPER BOT',     hp: 46,  vel: 1.8, dano: 11, raio: 0.6,  xp: 3,   moeda: 1.5, peso: 3,  onda: 5, comp: 'atirar', cor: 0x2ee6ff, tiroCd: 2.6, tiroVel: 7.5 },
    { id: 'bruto',    nome: 'ENFORCER MECH',  hp: 200, vel: 1.35, dano: 15, raio: 1.0,  xp: 9,   moeda: 4,   peso: 2,  onda: 7, comp: 'andar',  cor: 0xb04dff, resisteEmpurrao: 0.8 },
  ];
  const TIPO = {}; INIMIGOS.forEach(function (d, i) { TIPO[d.id] = i; });

  // ── CHEFES (ciclam a cada chefeACada ondas) ─────────────────────
  const CHEFES = [
    { id: 'goliath', nome: 'TITAN GOLIATH',   hp: 1500, vel: 1.9, dano: 26, raio: 2.0, xp: 120, moeda: 150, cor: 0xff3344 },
    { id: 'hidra',   nome: 'NEURAL HYDRA',    hp: 1300, vel: 1.5, dano: 20, raio: 1.8, xp: 120, moeda: 150, cor: 0x39ff88 },
    { id: 'espectro',nome: 'GLITCH WRAITH',   hp: 1100, vel: 2.4, dano: 22, raio: 1.5, xp: 120, moeda: 150, cor: 0xb04dff },
  ];

  // ── HABILIDADES ATIVAS ──────────────────────────────────────────
  // Cada habilidade tem 8 níveis. 'niveis' descreve o que muda em cada um
  // (texto mostrado na carta). Os números reais ficam em sim.js → statsHab().
  const HABILIDADES = {
    katana: { nome: 'KATANA RUBI',      icone: 'katana', cor: '#ff2a55', desc: 'Corta em arco todos os inimigos à sua frente.',
      niveis: ['Corte em arco à frente', 'Dano +25%', 'Alcance +20%', 'Cadência +18%', 'Corte duplo', 'Dano +30%', 'Alcance +25% e onda de corte que perfura', 'Corte dimensional: golpe em 360°'] },
    rifle:  { nome: 'RIFLE PLASMA',     icone: 'rifle', cor: '#2ee6ff', desc: 'Dispara plasma no inimigo mais próximo.',
      niveis: ['Dispara plasma automático', 'Dano +25%', '+1 projétil', 'Cadência +18%', 'Perfura +1 inimigo', 'Dano +30%', '+1 projétil', 'Plasma explosivo + perfura +1'] },
  };
  const ORDEM_HAB = ['rifle', 'katana'];       // só o ataque da arma equipada (sem habilidades extras: drones, EMP, tesla, granada e orbital foram removidos)

  // ── PASSIVAS (5 níveis) ─────────────────────────────────────────
  const PASSIVAS = {
    dano:    { nome: 'NÚCLEO DE DANO',  icone: 'dano', cor: '#ff5d3d', desc: '+12% de dano por nível.' },
    cadencia:{ nome: 'OVERCLOCK',       icone: 'cadencia', cor: '#ffd23d', desc: '+10% de cadência e -recarga por nível.' },
    vel:     { nome: 'SERVOS CYBER',    icone: 'vel', cor: '#39ff88', desc: '+8% de velocidade por nível.' },
    vida:    { nome: 'BLINDAGEM',       icone: 'escudo', cor: '#2ee6ff', desc: '+25 de vida máxima por nível.' },
    regen:   { nome: 'NANO-REPARO',     icone: 'regen', cor: '#39ff88', desc: 'Regenera +0,7 de vida por segundo por nível.' },
    ima:     { nome: 'ÍMÃ QUÂNTICO',    icone: 'ima', cor: '#b04dff', desc: '+30% de alcance para coletar XP por nível.' },
    critico: { nome: 'CHIP CRÍTICO',    icone: 'critico', cor: '#ff3da6', desc: '+7% de chance de crítico por nível.' },
    dash:    { nome: 'PROPULSORES',     icone: 'dash', cor: '#e8f6ff', desc: 'Dash recarrega 14% mais rápido por nível.' },
  };
  const ORDEM_PAS = [];       // passivas removidas (antes: dano, cadência, velocidade, vida, regen, ímã, crítico, dash) — a tabela PASSIVAS acima ficou sem uso

  // ── LOJA / META-PROGRESSÃO (fora da partida) ────────────────────
  const LOJA = {
    // O jogo só vende 1 persona e 1 arma. Sem comprar, o jogador usa o
    // "Operador Padrão" (mesmo modelo em cinza, sem os bônus) — assim
    // ninguém fica sem poder jogar.
    // PERSONAGENS (equipa 1 por vez) e ARMAS (equipa 1 por vez). O jogador pode comprar todos.
    cacador:  { id: 'cacador',  grupo: 'personagem', icone: 'cacador', nome: 'CAÇADOR CYBER',  preco: 25000, bonus: '+15% VIDA · +8% VELOCIDADE', desc: 'Caçador de elite com visor tático e armadura neon.' },
    kunoichi: { id: 'kunoichi', grupo: 'personagem', icone: 'kunoichi', nome: 'KUNOICHI NEON',  preco: 25000, bonus: '+15% VELOCIDADE · +8% CRÍTICO', desc: 'Guerreira ágil de cabelo longo preso em rabo de cavalo.' },
    rifle:    { id: 'rifle',    grupo: 'arma',       icone: 'rifle', nome: 'RIFLE PLASMA',   preco: 30000, bonus: 'TIRO RÁPIDO · -5% DANO POR TIRO', desc: 'Rifle de plasma de alta energia: atira muito mais rápido que a arma inicial (cada tiro 5% mais fraco).' },
    katana:   { id: 'katana',   grupo: 'arma',       icone: 'katana', nome: 'KATANA RUBI',    preco: 30000, bonus: '+25% DANO · CORTE EM ARCO', desc: 'Lâmina de rubi que corta todos à sua frente. Arma corpo a corpo.' },
    // ══ ONDE MUDAR OS BÔNUS DO PERSONAGEM E DA ARMA ══
    // Multiplicadores reais usados em sim.js (recalcular). Se mudar aqui, atualize também o texto "bonus" do item acima.
    //   vida/vel/dano = multiplicador (1.15 = +15%);   crit = soma na chance de crítico (0.08 = +8 pontos)
    efeitos: {
      personagem: { padrao: {}, cacador: { vida: 1.15, vel: 1.08 }, kunoichi: { vel: 1.15, crit: 0.08 } },
      arma: { base: {}, rifle: { dano: 0.95 }, katana: { dano: 1.25 } },     // rifle: 0.95 = cada tiro com 5% MENOS dano que a arma inicial (a cadência rápida, RIFLE_INTERVALO_PLASMA, fica em sim.js)
    },
    melhorias: true,          // false esconde a aba de melhorias permanentes
    // melhorias permanentes pagas com moedas
    up: {
      vida:  { nome: 'VITALIDADE',  icone: 'regen', max: 10, porNivel: 8,    unidade: 'vida máx',   base: 600 },
      dano:  { nome: 'POTÊNCIA',    icone: 'dano', max: 10, porNivel: 0.04, unidade: 'dano',       base: 800 },
      vel:   { nome: 'AGILIDADE',   icone: 'vel', max: 8,  porNivel: 0.03, unidade: 'velocidade', base: 700 },
      ima:   { nome: 'ALCANCE',     icone: 'ima', max: 8,  porNivel: 0.1,  unidade: 'ímã',        base: 500 },
      xp:    { nome: 'APRENDIZ',    icone: 'xp', max: 8,  porNivel: 0.05, unidade: 'XP',         base: 900 },
      moeda: { nome: 'SAQUEADOR',   icone: 'moeda',  max: 8,  porNivel: 0.06, unidade: 'moedas',     base: 1000 },
    },
  };
  function precoMelhoria(id, nivelAtual) { return Math.round(LOJA.up[id].base * Math.pow(1.55, nivelAtual)); }

  // normaliza o "loadout" (o que o jogador possui e equipou) vindo do Firebase/cliente
  function sanearLoadout(l) {
    l = l || {};
    const up = {};
    Object.keys(LOJA.up).forEach(function (k) {
      const v = Math.floor(Number(l.up && l.up[k]) || 0);
      up[k] = Math.max(0, Math.min(LOJA.up[k].max, v));
    });
    return {
      cacador: !!l.cacador, kunoichi: !!l.kunoichi, rifle: !!l.rifle, katana: !!l.katana,
      eqP: (l.eqP === 'cacador' || l.eqP === 'kunoichi') ? l.eqP : '', eqA: (l.eqA === 'rifle' || l.eqA === 'katana') ? l.eqA : '',
      up: up,
    };
  }
  // Decide o que realmente está em uso: persona 'cacador' | 'kunoichi' | 'padrao' e arma 'rifle' | 'katana' | 'base'.
  // (sem comprar nada = Operador Padrão com a arma base, que é o mesmo rifle sem bônus)
  function resolverEquip(lo) {
    lo = lo || {};
    let p = 'padrao', a = 'base';
    if (lo.eqP === 'kunoichi' && lo.kunoichi) p = 'kunoichi';
    else if (lo.eqP === 'cacador' && lo.cacador) p = 'cacador';
    else if (lo.cacador) p = 'cacador';
    else if (lo.kunoichi) p = 'kunoichi';
    if (lo.eqA === 'katana' && lo.katana) a = 'katana';
    else if (lo.eqA === 'rifle' && lo.rifle) a = 'rifle';
    else if (lo.rifle) a = 'rifle';
    else if (lo.katana) a = 'katana';
    return { persona: p, arma: a };
  }

  return {
    CFG: CFG, INIMIGOS: INIMIGOS, TIPO: TIPO, CHEFES: CHEFES,
    HABILIDADES: HABILIDADES, ORDEM_HAB: ORDEM_HAB, PASSIVAS: PASSIVAS, ORDEM_PAS: ORDEM_PAS,
    LOJA: LOJA, xpParaNivel: xpParaNivel, hpMulOnda: hpMulOnda, danoMulOnda: danoMulOnda,
    spawnPorSeg: spawnPorSeg, precoMelhoria: precoMelhoria, sanearLoadout: sanearLoadout, resolverEquip: resolverEquip,
  };
});
