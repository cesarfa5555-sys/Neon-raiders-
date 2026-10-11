// ══════════════════════════════════════════════════════════════════
// VANGUARD-CORE.JS
// Núcleo compartilhado da NR-01 Vanguard — usado por:
//   - loja.html (card no hangar + preview, desenhados em canvas)
//   - loja-vanguard.html (loja de customização das peças)
//   - boss.js (desenho da nave durante a partida + som do tiro)
//
// Carregar este script ANTES de loja.js / boss.js / do script inline
// da loja-vanguard.html em qualquer página que precise desenhar a
// Vanguard ou ler os bônus das peças equipadas.
//
// Não usa type="module" de propósito (mesma regra do resto do jogo:
// o preview do Spck Editor precisa de tudo em escopo global).
// ══════════════════════════════════════════════════════════════════

const VANGUARD_ID    = 'vanguard';
const VANGUARD_PRECO = 60000; // a nave mais cara do jogo (mesmo valor do catálogo em loja.js)

// ── BALANCEAMENTO ─────────────────────────────────────────────────
// Stats BASE da nave, sem nenhuma peça comprada. Mesma escala do
// NAVES_REAIS do boss3d.js (HP total = 700 + hpBonus). As peças somam
// por cima disso em getBonusVanguard().
//
// Poder = dano × HP total × cadência × crítico esperado, Spectre = 1.00x:
//   Spectre                       5.00 dmg / 650 hp             → 1.00x
//   Vanguard sem peças            5.10 dmg / 680 hp             → ~1.04x
//   UMA peça só (cada uma se nota):
//     Ogiva Sniper +15% dano                                    → ~1.20x
//     Núcleo de Plasma +30% dano                                → ~1.36x
//     Motor Grave +100 HP / Titânio +200 HP                     → ~1.12x / ~1.19x
//     Reforçada +15% cadência  /  Sombria 15% crítico (2x)      → ~1.20x
//     asas Turbo +30% velocidade (controle ~44% mais rápido)   → mesmo poder, mais ágil
//   Plasma + Motor Grave + Titânio                              → ~1.65x
//   … + Reforçada (ou Sombria) = build máxima                   → ~1.90x
// A máxima passa de um degrau da curva (~1.64x entre naves), o que faz
// sentido pra nave mais cara do jogo — mas só com ~3.750 moedas de
// peças. Pra deixar mais fraca/forte, mexe nos bônus das skins abaixo
// ou nestes 3 números:
const VANGUARD_BASE = { dmgMult: 5.1, spdBonus: 0.5, hpBonus: 680 };
// Acerto crítico (peça Sombria): chance vem de bonus.critico, e o dano
// do tiro que crita vira dano × este multiplicador.
const VANGUARD_CRITICO_MULT = 2.0;

/* ══════════════════════════════════════════════════════════════════
   1) GEOMETRIA BASE — os 27 blocos extraídos da arte original,
      organizados nas 5 partes compráveis. Cada bloco carrega sua
      "família" de cor original (cyan/magenta/azulClaro/casco), que é
      o que uma skin recolore. Coordenadas centralizadas em (0,0).
   ══════════════════════════════════════════════════════════════════ */
const VANGUARD_GEOMETRIA = {

  bico: [
    ['CIANO_BICO_ESQ', 'cyan', [[-22.5,-267],[-52.5,-225],[-74.5,-65],[-53.5,-45],[-22.5,-176]]],
    ['CIANO_BICO_DIR', 'cyan', [[25.5,-268],[25.5,-180],[56.5,-44],[78.5,-65],[55.5,-227]]],
    ['MAGENTA_BICO_CENTRAL', 'magenta', [[-9.5,-127],[-16.5,-92],[-14.5,-90],[20.5,-91],[13.5,-126],[10.5,-129],[-6.5,-129]]],
    ['MAGENTA_COCKPIT', 'magenta', [[-19.5,-72],[-32.5,-23],[-26.5,38],[26.5,41],[37.5,-17],[25.5,-70]]],
  ],

  asas: [
    ['CIANO_ASA_ESQ', 'cyan', [[-83.5,-54],[-129.5,-15],[-128.5,106],[-102.5,82]]],
    ['CIANO_ASA_DIR', 'cyan', [[87.5,-54],[106.5,81],[132.5,106],[132.5,-17]]],
    ['CIANO_ASA_INTERNA_ESQ', 'cyan', [[-77.5,93],[-143.5,155],[-143.5,221],[-113.5,228],[-109.5,136],[-79.5,106]]],
    ['CIANO_ASA_INTERNA_DIR', 'cyan', [[81.5,92],[83.5,107],[114.5,138],[117.5,229],[149.5,218],[149.5,158]]],
    ['MAGENTA_ASA_ESQ', 'magenta', [[-151.5,7],[-198.5,51],[-198.5,137],[-150.5,97]]],
    ['MAGENTA_ASA_DIR', 'magenta', [[155.5,6],[154.5,97],[202.5,136],[202.5,51]]],
    ['MAGENTA_SUPERIOR_ESQ', 'magenta', [[-73.5,-128],[-78.5,-127],[-103.5,-96],[-116.5,-40],[-83.5,-66]]],
    ['MAGENTA_SUPERIOR_DIR', 'magenta', [[78.5,-125],[87.5,-66],[119.5,-40],[107.5,-96],[90.5,-118]]],
    ['MAGENTA_FAIXA_FINA_ESQ', 'magenta', [[-51.5,82],[-52.5,208],[-26.5,210],[-44.5,86]]],
    ['MAGENTA_FAIXA_FINA_DIR', 'magenta', [[53.5,82],[48.5,85],[30.5,210],[56.5,207]]],
  ],

  pontaAsa: [
    ['CIANO_PONTA_ASA_ESQ', 'cyan', [[-221.5,81],[-284.5,143],[-294.5,48],[-309.5,177],[-335.5,215],[-232.5,113]]],
    ['CIANO_PONTA_ASA_DIR', 'cyan', [[225.5,80],[236.5,114],[339.5,215],[313.5,177],[298.5,48],[288.5,143]]],
    ['AZUL_CLARO_PONTA_ASA_ESQ', 'azulClaro', [[-219.5,111],[-337.5,226],[-339.5,292],[-289.5,273],[-285.5,223],[-221.5,182]]],
    ['AZUL_CLARO_PONTA_ASA_DIR', 'azulClaro', [[223.5,108],[223.5,148],[290.5,225],[306.5,278],[342.5,294],[341.5,226]]],
    ['CASCO_CONECTOR_ESQ', 'casco', [[-135.5,115],[-219.5,111],[-221.5,182],[-143.5,237]]],
    ['CASCO_CONECTOR_DIR', 'casco', [[135.5,115],[223.5,108],[223.5,148],[143.5,237]]],
  ],

  cauda: [
    ['CIANO_CAUDA_CENTRAL', 'cyan', [[-20.5,63],[-5.5,184],[9.5,184],[26.5,64]]],
    ['AZUL_CLARO_BASE_CAUDA', 'azulClaro', [[-50.5,218],[-33.5,244],[-20.5,248],[33.5,247],[52.5,221],[19.5,213]]],
    ['MAGENTA_PONTA_CAUDA_ESQ', 'magenta', [[-133.5,245],[-122.5,283],[-88.5,290],[-79.5,289],[-75.5,274],[-76.5,264]]],
    ['MAGENTA_PONTA_CAUDA_DIR', 'magenta', [[138.5,246],[124.5,247],[80.5,264],[78.5,271],[83.5,288],[90.5,290],[126.5,283]]],
  ],

  casco: [
    ['CASCO_PRINCIPAL', 'casco', [[-15.5,-206],[-44.5,-39],[-76.5,-56],[-131.5,133],[-71.5,104],[-107.5,231],[-139.5,237],[-56.5,266],[-48.5,75],[-19.5,213],[23.5,213],[51.5,74],[62.5,267],[143.5,237],[111.5,231],[75.5,89],[135.5,115],[81.5,-56],[48.5,-38],[19.5,-205]]],
  ],
};

const VANGUARD_CORES_PADRAO = { cyan:'#40daf2', magenta:'#cf54c9', azulClaro:'#2f5289', casco:'#294068' };

const VANGUARD_NOMES_PARTES = {
  bico: 'BICO / COCKPIT', asas: 'ASAS', pontaAsa: 'PONTAS DE ASA',
  cauda: 'CAUDA / MOTOR', casco: 'CASCO',
};
const VANGUARD_ORDEM_PARTES = ['bico','asas','pontaAsa','cauda','casco'];

/* ══════════════════════════════════════════════════════════════════
   2) SKINS — cores/formato/bônus/som de cada peça (ver comentário
      detalhado no loja-vanguard.html, que é quem lê isso pra montar
      a vitrine). Aqui só precisa existir pros cálculos de bônus e
      pro desenho funcionarem em qualquer página.
   ══════════════════════════════════════════════════════════════════ */
const VANGUARD_SKINS = {
  bico: [
    { id:'bico_padrao', nome:'Padrão', preco:0, paleta:{}, bonus:{} },
    { id:'bico_sniper', nome:'Ogiva Sniper', preco:700,
      paleta:{ cyan:'#ff5252', magenta:'#7a1616' },
      transformar:{ escalaY:1.18, origemY:-44 },
      bonus:{ dano:0.15 } },
    { id:'bico_plasma', nome:'Núcleo de Plasma', preco:1300,
      paleta:{ cyan:'#4bffb0', magenta:'#0a5c3d' },
      bonus:{ dano:0.30 } },
  ],
  asas: [
    { id:'asas_padrao', nome:'Padrão', preco:0, paleta:{}, bonus:{} },
    { id:'asas_aerodinamica', nome:'Aerodinâmica', preco:650,
      paleta:{ cyan:'#bfe9ff', magenta:'#6fa8d8' },
      bonus:{ velocidade:0.15 } },
    { id:'asas_turbo', nome:'Turbo', preco:1200,
      paleta:{ cyan:'#ff8a3d', magenta:'#c23d00' },
      transformar:{ escalaX:1.15, origemX:0 },
      bonus:{ velocidade:0.30 } },
  ],
  pontaAsa: [
    { id:'ponta_padrao', nome:'Padrão', preco:0, paleta:{}, bonus:{} },
    { id:'ponta_reforcada', nome:'Reforçada', preco:500,
      paleta:{ cyan:'#ffd24d', azulClaro:'#8a6a1f', casco:'#4a3a10' },
      bonus:{ cadencia:0.15 } },
    { id:'ponta_sombria', nome:'Sombria', preco:950,
      paleta:{ cyan:'#b06bff', azulClaro:'#5a2f8a', casco:'#2a1240' },
      bonus:{ critico:0.15 } },
  ],
  cauda: [
    { id:'cauda_padrao', nome:'Padrão', preco:0, paleta:{}, bonus:{}, som:{ freq:880, tipo:'square' } },
    { id:'cauda_grave', nome:'Motor Grave', preco:550,
      paleta:{ cyan:'#2f6fff', azulClaro:'#173a8f', magenta:'#7a2fbf' },
      bonus:{ hp:100 }, som:{ freq:220, tipo:'sawtooth' } },
    { id:'cauda_aguda', nome:'Motor Agudo', preco:550,
      paleta:{ cyan:'#ffe94d', azulClaro:'#8f7a17', magenta:'#ff9d4d' },
      bonus:{ velocidade:0.10 }, som:{ freq:1400, tipo:'triangle' } },
  ],
  casco: [
    { id:'casco_padrao', nome:'Padrão', preco:0, paleta:{}, bonus:{} },
    { id:'casco_blindado', nome:'Blindado', preco:600,
      paleta:{ casco:'#3a3a45' }, bonus:{ hp:120 } },
    { id:'casco_titanio', nome:'Titânio', preco:1400,
      paleta:{ casco:'#7d8899' },
      transformar:{ escalaX:1.1, escalaY:1.05 },
      bonus:{ hp:200 } },
  ],
};

/* ══════════════════════════════════════════════════════════════════
   3) PERSISTÊNCIA
   ══════════════════════════════════════════════════════════════════ */
function vanguardGetPartesEquipadas() {
  try { return JSON.parse(localStorage.getItem('vanguardPartes') || '{}'); }
  catch(e) { return {}; }
}
function vanguardSetParteEquipada(parte, skinId, sincronizar = true) {
  const atual = vanguardGetPartesEquipadas();
  atual[parte] = skinId;
  localStorage.setItem('vanguardPartes', JSON.stringify(atual));
  // Sobe pro Firebase (conta do jogador) — sem isso a peça equipada só
  // existia no localStorage e sumia ao trocar de conta/aparelho.
  // Numa compra, quem chama passa false e faz UMA gravação só (com moedas).
  if (sincronizar) vanguardSalvarNuvem();
}
function vanguardGetSkinEquipada(parte) {
  const equipadas = vanguardGetPartesEquipadas();
  const padrao = VANGUARD_SKINS[parte][0];
  const id = equipadas[parte] || padrao.id;
  const skin = VANGUARD_SKINS[parte].find(s => s.id === id) || padrao;
  // Só vale a peça que o jogador realmente tem (a padrão é grátis). Sem
  // isso, editar o localStorage dava os bônus de uma peça não comprada.
  return vanguardSkinJaComprada(skin) ? skin : padrao;
}
function vanguardGetSkinsCompradas() {
  try { return JSON.parse(localStorage.getItem('vanguardSkinsCompradas') || '[]'); }
  catch(e) { return []; }
}
function vanguardComprarSkin(skinId) {
  const compradas = vanguardGetSkinsCompradas();
  if (!compradas.includes(skinId)) {
    compradas.push(skinId);
    localStorage.setItem('vanguardSkinsCompradas', JSON.stringify(compradas));
  }
  // (a gravação no Firebase é feita por quem chama, junto com as moedas,
  // via vanguardSalvarNuvem({ moedas }) — uma única gravação atômica)
}

// ── NUVEM (Firebase via dados.js) ────────────────────────────────
// Grava peças equipadas + peças compradas (e, se passado, o saldo de
// moedas) numa única gravação atômica. Se dados.js não estiver na página
// ou o jogador estiver sem rede, falha em silêncio e devolve false — o
// localStorage continua funcionando igual.
function vanguardSalvarNuvem(extra) {
  if (!(window.NRDados && typeof window.NRDados.salvarCompraVanguard === 'function')) return Promise.resolve(false);
  const dados = Object.assign({
    partesEquipadas: vanguardGetPartesEquipadas(),
    skinsCompradas: vanguardGetSkinsCompradas(),
  }, extra || {});
  return window.NRDados.salvarCompraVanguard(dados)
    .then(() => true)
    .catch(e => { console.warn('Vanguard: falha ao salvar na nuvem', e); return false; });
}

// Firebase devolve array sem buracos como array, mas pode devolver
// objeto {0:..,1:..} — normaliza pros dois casos
function _vanguardParaArray(v) {
  if (Array.isArray(v)) return v.filter(x => x != null);
  if (v && typeof v === 'object') return Object.values(v).filter(x => x != null);
  return [];
}

// Puxa da conta (Firebase) as peças, moedas e naves compradas pro
// localStorage. Roda ao abrir a Loja Vanguard: cobre o caso de trocar de
// conta/aparelho (o dados.js limpa o cache local ao detectar outra conta,
// e antes disso as peças nunca voltavam porque nunca eram gravadas).
// MIGRAÇÃO: se o aparelho tem peças compradas que a nuvem ainda não tem
// (compras feitas antes desta correção), elas sobem pra nuvem agora.
async function vanguardHidratarDaNuvem(timeoutMs = 6000) {
  if (!(window.NRDados && typeof window.NRDados.carregarPerfil === 'function')) return false;
  try {
    const perfil = await Promise.race([
      window.NRDados.carregarPerfil(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs)),
    ]);
    if (!perfil) return false;
    const p = perfil.progresso || {};
    const v = perfil.vanguard || {};
    if (typeof p.moedas === 'number') localStorage.setItem('moedas', String(p.moedas));
    if (Array.isArray(p.navesCompradas)) localStorage.setItem('navesCompradas', JSON.stringify(p.navesCompradas));

    const skinsNuvem = _vanguardParaArray(v.skinsCompradas);
    const skinsLocal = vanguardGetSkinsCompradas();
    const uniao = Array.from(new Set(skinsNuvem.concat(skinsLocal)));
    localStorage.setItem('vanguardSkinsCompradas', JSON.stringify(uniao));

    const partesNuvem = (v.partesEquipadas && typeof v.partesEquipadas === 'object') ? v.partesEquipadas : {};
    const partes = Object.assign({}, vanguardGetPartesEquipadas(), partesNuvem);
    localStorage.setItem('vanguardPartes', JSON.stringify(partes));

    if (uniao.length > skinsNuvem.length) vanguardSalvarNuvem(); // migração
    return true;
  } catch (e) {
    console.warn('Vanguard: não consegui ler da nuvem, usando dados locais', e);
    return false;
  }
}
function vanguardSkinJaComprada(skin) {
  return skin.preco === 0 || vanguardGetSkinsCompradas().includes(skin.id);
}

// A Vanguard em si (a nave-base) foi comprada no hangar? Reaproveita a
// MESMA lista "navesCompradas" que loja.js já usa pras outras naves.
function vanguardEstaDesbloqueada() {
  try {
    const navesCompradas = JSON.parse(localStorage.getItem('navesCompradas') || '["padrao"]');
    return navesCompradas.includes(VANGUARD_ID);
  } catch(e) { return false; }
}

/* ══════════════════════════════════════════════════════════════════
   4) DESENHO MODULAR
   ══════════════════════════════════════════════════════════════════ */
function _vanguardPoligono(ctx, pontos) {
  ctx.beginPath();
  ctx.moveTo(pontos[0][0], pontos[0][1]);
  for (let i=1;i<pontos.length;i++) ctx.lineTo(pontos[i][0], pontos[i][1]);
  ctx.closePath();
  ctx.fill();
}
function _vanguardTransformar(pontos, t) {
  if (!t) return pontos;
  const ex = t.escalaX ?? 1, ey = t.escalaY ?? 1;
  const ox = t.origemX ?? 0, oy = t.origemY ?? 0;
  return pontos.map(([x,y]) => [ (x-ox)*ex + ox, (y-oy)*ey + oy ]);
}

/**
 * Desenha a NR-01 Vanguard montada com as peças equipadas no momento,
 * centralizada em (x,y), na escala `scale` (1 = ~680px de largura
 * total no espaço original) e rotacionada `rotacao` radianos.
 */
function desenharVanguardModular(ctx, x, y, scale=1, rotacao=0, glow=true) {
  const equipadas = VANGUARD_ORDEM_PARTES.reduce((acc,p) => { acc[p] = vanguardGetSkinEquipada(p); return acc; }, {});

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotacao);
  ctx.scale(scale, scale);

  const ORDEM_DESENHO = ['casco','pontaAsa','cauda','asas','bico'];

  ORDEM_DESENHO.forEach(parte => {
    const skin = equipadas[parte];
    VANGUARD_GEOMETRIA[parte].forEach(([id, familia, pontosBase]) => {
      const cor = skin.paleta[familia] || VANGUARD_CORES_PADRAO[familia];
      const pontos = _vanguardTransformar(pontosBase, skin.transformar);
      ctx.fillStyle = cor;
      ctx.strokeStyle = cor;
      ctx.lineWidth = 1.5;
      if (glow && familia !== 'casco') {
        ctx.shadowColor = cor;
        ctx.shadowBlur = 12;
      } else {
        ctx.shadowBlur = 0;
      }
      _vanguardPoligono(ctx, pontos);
      ctx.stroke();
    });
  });

  ctx.shadowBlur = 0;
  ctx.restore();
}

// Soma os bônus (em %/valores brutos) de todas as 5 peças equipadas
function vanguardCalcularStatsTotais() {
  const totais = { dano:0, velocidade:0, hp:0, cadencia:0, critico:0 };
  VANGUARD_ORDEM_PARTES.forEach(parte => {
    const skin = vanguardGetSkinEquipada(parte);
    Object.entries(skin.bonus).forEach(([k,v]) => { totais[k] = (totais[k]||0) + v; });
  });
  return totais;
}

// Texto legível de um bônus de peça (usado na Loja Vanguard)
function vanguardTextoBonus(chave, valor) {
  const pct = Math.round(valor * 100);
  switch (chave) {
    case 'dano':      return `+${pct}% dano`;
    case 'velocidade':return `+${pct}% velocidade`;
    case 'hp':        return `+${valor} HP`;
    case 'cadencia':  return `+${pct}% cadência de tiro`;
    case 'critico':   return `${pct}% de chance de crítico (${VANGUARD_CRITICO_MULT}x dano)`;
    default:          return `+${pct}% ${chave}`;
  }
}

// Stats FINAIS da Vanguard no mesmo formato das outras naves
// (dmgMult multiplicador, spdBonus somado à velocidade, hpBonus somado
// ao HP base de 700): stats base (VANGUARD_BASE) + bônus das peças
// equipadas. É essa função que o boss3d.js chama ao iniciar a partida
// e que a loja usa pra mostrar o bônus da nave equipada.
//  • dano: as peças MULTIPLICAM o dano base (+20% = ×1.20)
//  • velocidade: cada 10% de peça = +0.8 de spdBonus (asas Turbo +30% =
//    +2.4 → o controle responde ~36% mais rápido; Aerodinâmica ~18%;
//    Motor Agudo ~12%). O efeito de spdBonus no jogo é pequeno por
//    unidade (0.15 × 0.15), por isso o multiplicador é alto.
//  • hp: as peças somam HP bruto
//  • cadência: +10% = tiro normal 10% mais rápido (não afeta o RAPID)
//  • crítico: chance de cada tiro causar VANGUARD_CRITICO_MULT × dano
function getBonusVanguard() {
  const totais = vanguardCalcularStatsTotais();
  return {
    dmgMult: VANGUARD_BASE.dmgMult * (1 + totais.dano),
    spdBonus: VANGUARD_BASE.spdBonus + totais.velocidade * 8,
    hpBonus: VANGUARD_BASE.hpBonus + totais.hp,
    cadencia: totais.cadencia,
    critico: totais.critico,
  };
}

/* ══════════════════════════════════════════════════════════════════
   5) SOM — sintetizado via Web Audio (a skin de cauda define o
      timbre). Usado tanto no preview da loja quanto no tiro real
      dentro da partida.
   ══════════════════════════════════════════════════════════════════ */
let _vanguardAudioCtx = null;
function vanguardTocarSom(som) {
  if (!som) return;
  if (!_vanguardAudioCtx) _vanguardAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const ctx = _vanguardAudioCtx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = som.tipo;
  osc.frequency.setValueAtTime(som.freq, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(som.freq*0.4, ctx.currentTime+0.15);
  gain.gain.setValueAtTime(0.25, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+0.18);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(); osc.stop(ctx.currentTime+0.2);
}

// Som de tiro específico da Vanguard = timbre da skin de cauda equipada
function vanguardTocarSomTiro() {
  const skinCauda = vanguardGetSkinEquipada('cauda');
  vanguardTocarSom(skinCauda.som);
}