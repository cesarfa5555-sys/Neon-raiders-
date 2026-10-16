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
    rifle:  { nome: 'RIFLE PLASMA',     icone: '🔫', cor: '#2ee6ff', desc: 'Dispara plasma no inimigo mais próximo.',
      niveis: ['Dispara plasma automático', 'Dano +25%', '+1 projétil', 'Cadência +18%', 'Perfura +1 inimigo', 'Dano +30%', '+1 projétil', 'Plasma explosivo + perfura +1'] },
    drones: { nome: 'DRONES ORBITAIS',  icone: '🛸', cor: '#ffd23d', desc: 'Drones giram ao seu redor e cortam quem chegar perto.',
      niveis: ['1 drone orbital', '+1 drone', 'Dano +30%', '+1 drone', 'Órbita maior e mais rápida', '+1 drone', 'Dano +40%', '+1 drone que também atira'] },
    emp:    { nome: 'PULSO EMP',        icone: '💠', cor: '#7a5cff', desc: 'Onda de choque ao redor: dano, empurrão e lentidão.',
      niveis: ['Pulso a cada 6s', 'Raio +15%', 'Dano +35%', 'Recarga -15%', 'Raio +15%', 'Dano +40%', 'Recarga -20%', 'Pulso duplo devastador'] },
    tesla:  { nome: 'ARCO TESLA',       icone: '⚡', cor: '#e8f6ff', desc: 'Raio que salta entre vários inimigos.',
      niveis: ['Raio salta em 2 alvos', '+1 salto', 'Dano +35%', '+1 salto', 'Recarga -20%', 'Dano +40%', '+2 saltos', 'Tempestade: 8 saltos'] },
    granada:{ nome: 'GRANADA PLASMA',   icone: '💣', cor: '#ff6a1a', desc: 'Lança granadas nos grupos mais densos.',
      niveis: ['Granada explosiva', 'Raio +15%', 'Dano +35%', 'Recarga -20%', 'Deixa chamas no chão', 'Dano +40%', 'Raio +20%', 'Granada dupla'] },
    orbital:{ nome: 'ATAQUE ORBITAL',   icone: '🛰️', cor: '#ff3da6', desc: 'Satélite dispara raios do céu em inimigos aleatórios.',
      niveis: ['1 raio orbital', '+1 raio', 'Dano +35%', 'Recarga -20%', '+1 raio', 'Dano +40%', 'Raio mais largo', '+2 raios'] },
  };
  const ORDEM_HAB = ['rifle', 'drones', 'emp', 'tesla', 'granada', 'orbital'];

  // ── PASSIVAS (5 níveis) ─────────────────────────────────────────
  const PASSIVAS = {
    dano:    { nome: 'NÚCLEO DE DANO',  icone: '🔥', cor: '#ff5d3d', desc: '+12% de dano por nível.' },
    cadencia:{ nome: 'OVERCLOCK',       icone: '⏱️', cor: '#ffd23d', desc: '+10% de cadência e -recarga por nível.' },
    vel:     { nome: 'SERVOS CYBER',    icone: '👟', cor: '#39ff88', desc: '+8% de velocidade por nível.' },
    vida:    { nome: 'BLINDAGEM',       icone: '🛡️', cor: '#2ee6ff', desc: '+25 de vida máxima por nível.' },
    regen:   { nome: 'NANO-REPARO',     icone: '💚', cor: '#39ff88', desc: 'Regenera +0,7 de vida por segundo por nível.' },
    ima:     { nome: 'ÍMÃ QUÂNTICO',    icone: '🧲', cor: '#b04dff', desc: '+30% de alcance para coletar XP por nível.' },
    critico: { nome: 'CHIP CRÍTICO',    icone: '🎯', cor: '#ff3da6', desc: '+7% de chance de crítico por nível.' },
    dash:    { nome: 'PROPULSORES',     icone: '💨', cor: '#e8f6ff', desc: 'Dash recarrega 14% mais rápido por nível.' },
  };
  const ORDEM_PAS = ['dano', 'cadencia', 'vel', 'vida', 'regen', 'ima', 'critico', 'dash'];

  // ── LOJA / META-PROGRESSÃO (fora da partida) ────────────────────
  const LOJA = {
    // O jogo só vende 1 persona e 1 arma. Sem comprar, o jogador usa o
    // "Operador Padrão" (mesmo modelo em cinza, sem os bônus) — assim
    // ninguém fica sem poder jogar.
    cacador: { id: 'cacador', nome: 'CAÇADOR CYBER', preco: 25000, desc: 'Caçador de elite com visor tático e armadura neon. +15% de vida e +8% de velocidade.' },
    rifle:   { id: 'rifle',   nome: 'RIFLE PLASMA',  preco: 30000, desc: 'Rifle de plasma de alta energia. +20% de dano e brilho plasma exclusivo.' },
    melhorias: true,          // false esconde a aba de melhorias permanentes
    // melhorias permanentes pagas com moedas
    up: {
      vida:  { nome: 'VITALIDADE',  icone: '❤️', max: 10, porNivel: 8,    unidade: 'vida máx',   base: 600 },
      dano:  { nome: 'POTÊNCIA',    icone: '🔥', max: 10, porNivel: 0.04, unidade: 'dano',       base: 800 },
      vel:   { nome: 'AGILIDADE',   icone: '👟', max: 8,  porNivel: 0.03, unidade: 'velocidade', base: 700 },
      ima:   { nome: 'ALCANCE',     icone: '🧲', max: 8,  porNivel: 0.1,  unidade: 'ímã',        base: 500 },
      xp:    { nome: 'APRENDIZ',    icone: '📈', max: 8,  porNivel: 0.05, unidade: 'XP',         base: 900 },
      moeda: { nome: 'SAQUEADOR',   icone: '◈',  max: 8,  porNivel: 0.06, unidade: 'moedas',     base: 1000 },
    },
  };
  function precoMelhoria(id, nivelAtual) { return Math.round(LOJA.up[id].base * Math.pow(1.55, nivelAtual)); }

  // normaliza o "loadout" (o que o jogador possui) vindo do Firebase/cliente
  function sanearLoadout(l) {
    l = l || {};
    const up = {};
    Object.keys(LOJA.up).forEach(function (k) {
      const v = Math.floor(Number(l.up && l.up[k]) || 0);
      up[k] = Math.max(0, Math.min(LOJA.up[k].max, v));
    });
    return { cacador: !!l.cacador, rifle: !!l.rifle, up: up };
  }

  return {
    CFG: CFG, INIMIGOS: INIMIGOS, TIPO: TIPO, CHEFES: CHEFES,
    HABILIDADES: HABILIDADES, ORDEM_HAB: ORDEM_HAB, PASSIVAS: PASSIVAS, ORDEM_PAS: ORDEM_PAS,
    LOJA: LOJA, xpParaNivel: xpParaNivel, hpMulOnda: hpMulOnda, danoMulOnda: danoMulOnda,
    spawnPorSeg: spawnPorSeg, precoMelhoria: precoMelhoria, sanearLoadout: sanearLoadout,
  };
});
