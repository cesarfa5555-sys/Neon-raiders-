// ══════════════════════════════════════════════════════════════════
// Este arquivo agora lê/escreve os dados do jogador através de
// window.NRDados (definido em dados.js), que por sua vez fala com
// Firebase Auth + Realtime Database na estrutura usuarios/{uid}/...
//
// IMPORTANTE: a página que carrega este script precisa carregar
// dados.js ANTES (via <script src="dados.js"></script>), senão
// window.NRDados não vai existir ainda quando este arquivo rodar.
// ══════════════════════════════════════════════════════════════════

// ── CATÁLOGO DE NAVES (BALANCEADO) ───────────────────────────
// A antiga OMEGA foi substituída pela NR-01 VANGUARD — em vez de uma
// imagem fixa e stats fixos, ela é desenhada em canvas (vanguard-core.js)
// e seus stats vêm das peças equipadas na Loja Vanguard.
const NAVES = [
  {
    id: 'padrao',
    nome: 'PHANTOM',
    raridade: 'PADRÃO',
    rarColor: '#00ffff',
    preco: 0,
    img: 'padrao.png',
    // ── CURVA DE DANO/HP (balanceamento pós-inimigos3d.js) ──
    // As 6 naves compráveis (Vanguard fica de fora — é modular, tem
    // progressão própria via peças) agora escalam bem mais forte em
    // dmgMult/hpBonus do que antes (1.0-2.0x / 0-60 HP), pra acompanhar
    // o salto real de dificuldade dos inimigos (HP indo de ~10 no Mapa1
    // até ~200+ no Mapa6). Testado via TTK (tempo pra matar) e HTD
    // (quantos hits o jogador aguenta) nos dois extremos — ainda precisa
    // de teste jogando de verdade pra ajustar fino depois.
    dmgMult: 1.0,
    spdBonus: 0,
    hpBonus: 0,
    statDano: 2,
    statVel:  3,
    statHp:   2,
    desc: 'Nave padrão equilibrada. Boa pra aprender o jogo.',
  },
  {
    id: 'striker',
    nome: 'STRIKER',
    raridade: 'COMUM',
    rarColor: '#00ff88',
    preco: 1000,
    img: 'striker.png',
    dmgMult: 1.4,
    spdBonus: 0.6,
    hpBonus: 60,
    statDano: 3,
    statVel:  6,
    statHp:   3,
    desc: 'Rápida e ágil. Dano médio, mas frágil.',
  },
  {
    id: 'crimson',
    nome: 'CRIMSON',
    raridade: 'COMUM',
    rarColor: '#ff4444',
    preco: 3500,
    img: 'crimson.png',
    dmgMult: 1.9,
    spdBonus: 0,
    hpBonus: 150,
    statDano: 4,
    statVel:  2,
    statHp:   4,
    desc: 'Lenta e resistente. Alto dano, boa sobrevivência.',
  },
  {
    id: 'warbat',
    nome: 'WARBAT',
    raridade: 'RARO',
    rarColor: '#4488ff',
    preco: 8600,
    img: 'warbat-2.png',
    dmgMult: 2.6,
    spdBonus: 0.4,
    hpBonus: 280,
    statDano: 5,
    statVel:  5,
    statHp:   5,
    desc: 'Equilibrada e poderosa. Boa em tudo.',
  },
  {
    id: 'cyer',
    nome: 'CYER',
    raridade: 'RARO',
    rarColor: '#ff6600',
    preco: 17300,
    img: 'cyer.png',
    dmgMult: 3.6,
    spdBonus: 0.8,
    hpBonus: 450,
    statDano: 7,
    statVel:  8,
    statHp:   7,
    desc: 'Veloz e devastadora. Frágil, exige habilidade.',
  },
  {
    id: 'spectre',
    nome: 'SPECTRE',
    raridade: 'ÉPICO',
    rarColor: '#cc00ff',
    preco: 30400,
    img: 'spectre.png',
    dmgMult: 5.0,
    spdBonus: 0.5,
    hpBonus: 650,
    statDano: 10,
    statVel:  6,
    statHp:   10,
    desc: 'Elite. Alto dano, boa resistência e velocidade.',
  },
  {
    id: 'vanguard',
    nome: 'NR-01 VANGUARD',
    raridade: 'LENDÁRIO',
    rarColor: '#40daf2',
    preco: 60000,
    img: null,          // sem imagem — desenhada em canvas via vanguard-core.js
    desenhoCanvas: true, // marca especial lida por renderPreview/renderCardCanvas
    // dmgMult/spdBonus/hpBonus ficam de fora aqui de propósito: os
    // valores reais são calculados na hora por getBonusVanguard(),
    // que soma os bônus das peças equipadas na Loja Vanguard
    statDano: 10,
    statVel:  10,
    statHp:   10,
    desc: 'Nave modular. Customize cada peça na Loja Vanguard — o visual e os stats mudam conforme o que você equipar.',
  },
];

// ── ESTADO ────────────────────────────────────────────────────
let moedas         = 0;
let naveAtual      = 'padrao';
let navesCompradas = ['padrao'];

// ── CARREGAR DADOS ────────────────────────────────────────────
async function carregarDados() {
  try {
    const perfil = await window.NRDados.carregarPerfil();
    if (perfil) {
      const p = perfil.progresso || {};
      const n = perfil.naves || {};
      moedas         = typeof p.moedas === 'number' ? p.moedas : (Number(localStorage.getItem('moedas')) || 0);
      naveAtual      = p.naveAtual || localStorage.getItem('naveAtual') || 'padrao';
      navesCompradas = p.navesCompradas || JSON.parse(localStorage.getItem('navesCompradas') || '["padrao"]');
      // Joias: prioriza o que veio do perfil; se não tiver, cai no localStorage
      joiasMochila   = n.joiasMochila   || JSON.parse(localStorage.getItem('joiasMochila')   || '[]');
      joiasEquipadas = n.joiasEquipadas || JSON.parse(localStorage.getItem('joiasEquipadas') || '{}');
      if (typeof p.mapaDesbloqueado !== 'undefined') {
        const local = Number(localStorage.getItem('mapaDesbloqueado')) || 1;
        if (p.mapaDesbloqueado > local) localStorage.setItem('mapaDesbloqueado', p.mapaDesbloqueado);
      }
    } else {
      // Conta sem perfil no banco — reseta pro padrão de conta nova em
      // vez de reaproveitar o que sobrou no localStorage (era assim que
      // acontecia o bug de "conta nova com dado de conta antiga")
      moedas         = 0;
      naveAtual      = 'padrao';
      navesCompradas = ['padrao'];
      joiasMochila   = [];
      joiasEquipadas = {};
    }
  } catch (e) {
    moedas         = Number(localStorage.getItem('moedas')) || 0;
    naveAtual      = localStorage.getItem('naveAtual') || 'padrao';
    navesCompradas = JSON.parse(localStorage.getItem('navesCompradas') || '["padrao"]');
    carregarJoias();
  }

  salvarLocal();
  salvarJoiasLocal();
  renderMoedas();
  if (typeof renderGrid === 'function') renderGrid();
  atualizarBannerVanguard();

  // Escuta atualizações em tempo real (ex: moedas ganhas numa partida
  // aberta em outra aba refletem aqui sem precisar recarregar a página)
  try {
    const { db, dbMod } = await window.NRDados._getFirebase();
    const uid = await window.NRDados.uid();
    dbMod.onValue(dbMod.ref(db, 'usuarios/' + uid + '/progresso'), (snap) => {
      if (!snap.exists()) return;
      const d = snap.val();
      if (typeof d.moedas         !== 'undefined') moedas         = d.moedas;
      if (typeof d.naveAtual      !== 'undefined') naveAtual      = d.naveAtual;
      if (typeof d.navesCompradas !== 'undefined') navesCompradas = d.navesCompradas;
      salvarLocal();
      renderMoedas();
      if (typeof renderGrid === 'function') renderGrid();
      atualizarBannerVanguard();
    });
  } catch (e) {}
}

function salvarLocal() {
  localStorage.setItem('moedas', moedas);
  localStorage.setItem('naveAtual', naveAtual);
  localStorage.setItem('navesCompradas', JSON.stringify(navesCompradas));
}

async function salvar() {
  salvarLocal();
  try {
    await window.NRDados.salvarProgresso({
      moedas, naveAtual, navesCompradas,
      mapaDesbloqueado: Number(localStorage.getItem('mapaDesbloqueado')) || 1,
    });
  } catch (e) {}
}

// Compatibilidade: código antigo em outras páginas pode ainda chamar
// isso depois de qualquer ajuste de identidade — hoje não faz mais
// sentido (o login já garante a identidade), mas mantém sem quebrar
// nada caso ainda exista alguma chamada por aí
window.sincronizarAposNome = async function() { await salvar(); };

// ── MOEDAS ────────────────────────────────────────────────────
function ganharMoedas(valor) {
  moedas += valor;
  salvar();
  renderMoedas();

  // ── NITRO: missões de moedas totais (acumulado histórico, não o saldo atual) ──
  const totalMoedasHistorico = (Number(localStorage.getItem('nr_total_moedas')) || 0) + valor;
  localStorage.setItem('nr_total_moedas', totalMoedasHistorico);
  if (window.NRDados && typeof window.NRDados.salvarEstatisticas === 'function') {
    window.NRDados.salvarEstatisticas({ totalMoedasGanhas: totalMoedasHistorico });
  }
  if (typeof _dispararConquista === 'function') {
    if (totalMoedasHistorico >= 573)   _dispararConquista('nitro_m3');
    if (totalMoedasHistorico >= 2500)  _dispararConquista('nitro_m7');
    if (totalMoedasHistorico >= 25000) _dispararConquista('nitro_m12');
  }
}
window.ganharMoedas = ganharMoedas;

function ganharMoedasPorKill(en) {
  const val = Math.max(1, Math.round((en.reward || 50) / 8));
  ganharMoedas(val);
}
function ganharMoedasPorFase(onda) { ganharMoedas(30 + onda * 15); }
function ganharMoedasPorBoss(nivel) { ganharMoedas(400 * nivel); }

window.ganharMoedasPorKill  = ganharMoedasPorKill;
window.ganharMoedasPorFase  = ganharMoedasPorFase;
window.ganharMoedasPorBoss  = ganharMoedasPorBoss;

// ── BÔNUS DA NAVE ─────────────────────────────────────────────
// Nave normal: pega o bônus fixo do catálogo. Vanguard: soma os
// bônus das peças equipadas (vanguard-core.js), então isso muda
// toda vez que o jogador troca uma skin de peça na Loja Vanguard.
function getBonusNave() {
  if (naveAtual === 'vanguard' && typeof getBonusVanguard === 'function') {
    const b = getBonusVanguard();
    return { dmgMult: b.dmgMult, spdBonus: b.spdBonus, hpBonus: b.hpBonus, img: null, desenhoCanvas: true };
  }
  const nave = NAVES.find(n => n.id === naveAtual) || NAVES[0];
  return { dmgMult: nave.dmgMult, spdBonus: nave.spdBonus, hpBonus: nave.hpBonus, img: nave.img };
}
window.getBonusNave = getBonusNave;

// ── RENDER MOEDAS ─────────────────────────────────────────────
function renderMoedas() {
  const elDisplay = document.getElementById('moedas-display');
  if (elDisplay) elDisplay.textContent = moedas.toLocaleString('pt-BR');
  const elHud = document.getElementById('moedas');
  if (elHud) elHud.textContent = '◈ ' + moedas.toLocaleString('pt-BR');
}
window.renderMoedas = renderMoedas;

// ── BANNER DA LOJA VANGUARD ────────────────────────────────────
// Atualiza o visual do banner fixo no topo do hangar: travado (cadeado,
// escurecido, sem link) enquanto a nave Vanguard não foi comprada;
// destravado (colorido, clicável) depois que o jogador compra ela.
function atualizarBannerVanguard() {
  const banner  = document.getElementById('vanguardBanner');
  if (!banner) return; // essa função só roda em páginas que têm o banner
  const icone   = document.getElementById('vanguardBannerIcone');
  const titulo  = document.getElementById('vanguardBannerTitulo');
  const sub     = document.getElementById('vanguardBannerSub');

  const desbloqueada = navesCompradas.includes('vanguard');
  banner.classList.toggle('destravada', desbloqueada);
  banner.classList.toggle('bloqueada', !desbloqueada);

  if (desbloqueada) {
    icone.textContent = '⚡';
    titulo.textContent = 'LOJA VANGUARD';
    sub.textContent = 'Customize cada peça da sua nave';
  } else {
    icone.textContent = '🔒';
    titulo.textContent = 'LOJA VANGUARD — BLOQUEADA';
    sub.textContent = 'Compre a NR-01 VANGUARD abaixo para desbloquear';
  }
}

window.irParaLojaVanguard = function() {
  if (!navesCompradas.includes('vanguard')) {
    showToast('🔒 Compre a NR-01 VANGUARD primeiro', 'erro');
    return;
  }
  window.location.href = 'loja-vanguard.html';
};

// ── TOAST ─────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, tipo = '') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast show ' + tipo;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('show'); }, 2200);
}

// ── PREVIEW DA NAVE ───────────────────────────────────────────
function renderPreview(nave) {
  const canvas = document.getElementById('previewCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 160, 160);
  ctx.fillStyle = '#000514'; ctx.fillRect(0, 0, 160, 160);
  ctx.strokeStyle = 'rgba(0,255,255,0.06)'; ctx.lineWidth = 0.5;
  for (let x = 0; x < 160; x += 20) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,160); ctx.stroke(); }
  for (let y = 0; y < 160; y += 20) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(160,y); ctx.stroke(); }

  // NR-01 VANGUARD: desenhada em canvas (vanguard-core.js), não é img
  if (nave.desenhoCanvas && typeof desenharVanguardModular === 'function') {
    desenharVanguardModular(ctx, 80, 84, 0.15, 0, true);
  } else {
    const img = new Image();
    img.onload = () => { ctx.save(); ctx.translate(80,80); ctx.drawImage(img,-40,-40,80,80); ctx.restore(); };
    img.onerror = () => {
      ctx.save(); ctx.translate(80,80);
      ctx.fillStyle = nave.rarColor; ctx.shadowColor = nave.rarColor; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.moveTo(0,-38); ctx.lineTo(26,28); ctx.lineTo(-26,28); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0,8,8,0,Math.PI*2); ctx.fill();
      ctx.restore();
    };
    img.src = nave.img;
  }

  document.getElementById('preview-nome').textContent = nave.nome;
  document.getElementById('preview-nome').style.color = nave.rarColor;
  document.getElementById('preview-nome').style.textShadow = `0 0 12px ${nave.rarColor}88`;
  const statsEl = document.getElementById('preview-stats');
  if (!statsEl) return;
  statsEl.innerHTML = '';

  // Pra Vanguard, os stats exibidos refletem os bônus reais das peças
  // equipadas (não um valor fixo de catálogo como as outras naves)
  let statDano = nave.statDano, statVel = nave.statVel, statHp = nave.statHp;
  if (nave.desenhoCanvas && typeof vanguardCalcularStatsTotais === 'function') {
    const totais = vanguardCalcularStatsTotais();
    statDano = Math.min(10, 3 + totais.dano * 10);
    statVel  = Math.min(10, 3 + totais.velocidade * 10);
    statHp   = Math.min(10, 3 + totais.hp / 20);
  }

  [{ label:'DANO', val:statDano, color:'#ff4466' },
   { label:'VEL',  val:statVel,  color:'#00ffff' },
   { label:'HP',   val:statHp,   color:'#00ff88' }].forEach(s => {
    statsEl.innerHTML += `<div class="stat-row">
      <span class="stat-label">${s.label}</span>
      <div class="stat-bar-bg"><div class="stat-bar-fill" style="width:${(s.val/10)*100}%;background:${s.color};box-shadow:0 0 6px ${s.color}88;"></div></div>
    </div>`;
  });
}

// ── MINI CANVAS ───────────────────────────────────────────────
function renderCardCanvas(canvas, nave, comprada) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,80,80); ctx.fillStyle = '#000310'; ctx.fillRect(0,0,80,80);

  // NR-01 VANGUARD: desenhada em canvas — fica em tons de cinza e mais
  // escura enquanto não foi comprada, igual as outras naves bloqueadas
  if (nave.desenhoCanvas && typeof desenharVanguardModular === 'function') {
    ctx.save();
    if (!comprada) { ctx.filter = 'grayscale(100%) brightness(0.5)'; }
    desenharVanguardModular(ctx, 32, 32, 0.090, 0, comprada);
    ctx.restore();
    return;
  }

  const img = new Image();
  img.onload = () => { if (!comprada) ctx.filter = 'grayscale(100%) brightness(0.4)'; ctx.drawImage(img,-3,3,70,64); ctx.filter = 'none'; };
  img.onerror = () => {
    ctx.save(); ctx.translate(40,40); ctx.globalAlpha = comprada ? 1 : 0.35;
    ctx.fillStyle = nave.rarColor;
    ctx.beginPath(); ctx.moveTo(0,-22); ctx.lineTo(15,16); ctx.lineTo(-15,16); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0,6,5,0,Math.PI*2); ctx.fill();
    ctx.restore();
  };
  img.src = nave.img;
}

// ── RENDER GRADE ──────────────────────────────────────────────
function renderGrid() {
  const grid = document.getElementById('navesGrid');
  if (!grid) return;
  grid.innerHTML = '';
  NAVES.forEach(nave => {
    const comprada  = navesCompradas.includes(nave.id);
    const equipada  = naveAtual === nave.id;
    const podePagar = moedas >= nave.preco;
    const card = document.createElement('div');
    card.className = 'nave-card ' + (equipada ? 'equipada' : comprada ? 'comprada' : 'bloqueada');
    const faixa = document.createElement('div');
    faixa.className = 'raridade-faixa';
    faixa.style.background = nave.rarColor;
    faixa.style.boxShadow = `0 0 8px ${nave.rarColor}88`;
    card.appendChild(faixa);
    const wrap = document.createElement('div'); wrap.className = 'nave-canvas-wrap';
    const cnv = document.createElement('canvas'); cnv.width = 64; cnv.height = 64;
    wrap.appendChild(cnv); card.appendChild(wrap);
    renderCardCanvas(cnv, nave, comprada);
    const nome = document.createElement('div');
    nome.className = 'nave-nome'; nome.style.color = nave.rarColor; nome.textContent = nave.nome;
    card.appendChild(nome);
    const rar = document.createElement('div');
    rar.className = 'nave-raridade-txt'; rar.style.color = nave.rarColor; rar.textContent = nave.raridade;
    card.appendChild(rar);
    if (equipada) {
      const badge = document.createElement('div');
      badge.className = 'nave-status-badge badge-equipada'; badge.textContent = '✦ EQUIPADA';
      card.appendChild(badge);
    } else if (comprada) {
      const badge = document.createElement('div');
      badge.className = 'nave-status-badge badge-comprada'; badge.textContent = 'EQUIPAR';
      card.appendChild(badge);
    } else {
      const preco = document.createElement('div');
      preco.className = 'nave-preco';
      preco.innerHTML = `<span class="moeda-icone-mini">◈</span> ${nave.preco.toLocaleString('pt-BR')}`;
      if (!podePagar) preco.style.opacity = '0.45';
      card.appendChild(preco);
    }
    card.addEventListener('click', () => onCardClick(nave));
    grid.appendChild(card);
  });
}

// ── AÇÃO DO CARD ─────────────────────────────────────────────
function onCardClick(nave) {
  const comprada = navesCompradas.includes(nave.id);
  const equipada = naveAtual === nave.id;
  if (equipada) { showToast('✦ JÁ EQUIPADA', ''); return; }
  if (comprada) {
    naveAtual = nave.id; salvar(); renderGrid();
    const naveEquipada = NAVES.find(n => n.id === naveAtual) || NAVES[0];
    renderPreview(naveEquipada);
    showToast(`✦ ${nave.nome} EQUIPADA`, 'sucesso'); return;
  }
  if (moedas < nave.preco) { showToast(`✗ MOEDAS INSUFICIENTES  (◈ ${nave.preco.toLocaleString('pt-BR')} necessárias)`, 'erro'); return; }
  if (card_pendente === nave.id) {
    moedas -= nave.preco; navesCompradas.push(nave.id); naveAtual = nave.id;
    salvar(); renderMoedas(); renderGrid();
    const naveEquipada = NAVES.find(n => n.id === naveAtual) || NAVES[0];
    renderPreview(naveEquipada);
    atualizarBannerVanguard();
    if (nave.id === 'vanguard') {
      showToast(`⚡ NR-01 VANGUARD ADQUIRIDA! Loja Vanguard desbloqueada`, 'sucesso');
    } else {
      showToast(`✦ ${nave.nome} COMPRADA E EQUIPADA!`, 'sucesso');
    }
    card_pendente = null;
  } else {
    card_pendente = nave.id;
    showToast(`TOQUE NOVAMENTE PARA COMPRAR  ◈ ${nave.preco.toLocaleString('pt-BR')}`, '');
    setTimeout(() => { card_pendente = null; }, 3000);
  }
}
let card_pendente = null;

// ── INIT ─────────────────────────────────────────────────────

// ════════════════════════════════════════════════════════════════
// SISTEMA DE JOIAS EVOLUTIVAS
// ════════════════════════════════════════════════════════════════

// Definição das 4 joias disponíveis
const JOIAS = [
  {
    id: 'joia_preta',
    nome: 'JOIA SOMBRIA',
    img: 'joia_preta.png',
    paleta3d: 'branco', // tom acinzentado da paleta bate com o cinza original (#888888)
    cor: '#888888',
    bonus: { dmgMult: 0.4 },
    desc: '+40% de dano de ataque',
    preco: 1200,
  },
  {
    id: 'joia_roxa',
    nome: 'JOIA ARCANA',
    img: 'joia_roxa.png',
    paleta3d: 'roxo',
    cor: '#aa44ff',
    bonus: { spdBonus: 1.2 },
    desc: '+1.2 de velocidade de movimento',
    preco: 900,
  },
  {
    id: 'joia_pink',
    nome: 'JOIA CARMESIM',
    img: 'joia_pink.png',
    paleta3d: 'verde', // não tinha paleta rosa/pink disponível — sobrou essa, troque se quiser outra
    cor: '#ff44aa',
    bonus: { hpBonus: 60 },
    desc: '+60 de HP máximo',
    preco: 800,
  },
  {
    id: 'joia_vermelha',
    nome: 'JOIA SANGUE',
    img: 'joia_vermelha.png',
    paleta3d: 'vermelho',
    cor: '#ff2222',
    bonus: { dmgMult: 0.2, hpBonus: 30 },
    desc: '+20% dano e +30 HP',
    preco: 1500,
  },
];

// ── CICLO DE QUADROS (giro 3D "de mentirinha", grade da loja) ────
// _ciclosFrames guarda, por elemento .joia-live, o intervalId do
// setInterval que troca a <img> entre os quadros pré-renderizados.
// Usa Map normal (não WeakMap) porque precisamos poder limpar todos
// de uma vez (pararTodosCiclosFrames) — ex: ao trocar de aba ou
// re-renderizar a grade, senão o intervalo antigo fica rodando
// escondido tentando atualizar uma <img> que já nem existe mais.
const _ciclosFrames = new Map();

function pararCicloFrames(el) {
  const dado = _ciclosFrames.get(el);
  if (dado) { clearInterval(dado.intervalId); _ciclosFrames.delete(el); }
}

function pararTodosCiclosFrames() {
  _ciclosFrames.forEach((dado) => clearInterval(dado.intervalId));
  _ciclosFrames.clear();
}

function iniciarCicloFrames(el, imgEl, frames) {
  pararCicloFrames(el);
  let idx = 0;
  const intervalId = setInterval(() => {
    idx = (idx + 1) % frames.length;
    imgEl.src = frames[idx];
  }, 200);
  _ciclosFrames.set(el, { intervalId });
}

// ── VISUAL DE REPOUSO DA JOIA ──────────────────────────────────
// Elementos marcados com data-girar="1" (só a grade da loja) tentam
// o giro 3D "de mentirinha" via obterFramesGiro — vários quadros reais
// pré-renderizados trocando rápido, sem manter WebGL aberto, então dá
// pra ter as 4 girando ao mesmo tempo com segurança. Os demais
// (mochila, ícones pequenos) usam só o thumbnail parado de sempre.
// Se o Three.js ainda não carregou, cai pro círculo sólido em CSS até
// ficar pronto — ver montarVisualizadoresVivos() logo abaixo, que
// reagenda essa função pra rodar de novo assim que estiver disponível.
function montarJoiaVisual(el, joia) {
  if (!el) return null;
  pararCicloFrames(el);
  el.innerHTML = '';

  const girar = el.dataset.girar === '1';

  if (girar && window.NRGemas3D && window.NRGemas3D.obterFramesGiro) {
    const frames = window.NRGemas3D.obterFramesGiro(joia.paleta3d, 16, 160);
    if (frames && frames.length) {
      const img = document.createElement('img');
      img.src = frames[0];
      img.alt = joia.nome;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'contain';
      img.style.filter = `drop-shadow(0 0 8px ${joia.cor}88)`;
      el.appendChild(img);
      iniciarCicloFrames(el, img, frames);
      return null;
    }
  }

  const url = window.NRGemas3D ? window.NRGemas3D.obterThumb(joia.paleta3d, 160) : null;
  if (url) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = joia.nome;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    img.style.filter = `drop-shadow(0 0 8px ${joia.cor}88)`;
    el.appendChild(img);
    return null;
  }

  // Three.js ainda não carregou — círculo sólido por enquanto.
  const div = document.createElement('div');
  div.style.width = '100%';
  div.style.height = '100%';
  div.style.borderRadius = '50%';
  div.style.background = `radial-gradient(circle at 35% 30%, ${joia.cor}cc, ${joia.cor}33)`;
  el.appendChild(div);
  return null;
}

// Liga o WebGL de verdade num elemento .joia-live só quando o dedo
// toca nele — desliga qualquer outro que estivesse ativo antes, então
// nunca existe mais de 1 contexto WebGL vivo na tela ao mesmo tempo.
let _webglAtivoHandle = null;
let _webglAtivoEl = null;
function ligarWebGLNoToque(el, joia) {
  if (_webglAtivoEl === el) return; // já é esse mesmo, não refaz
  if (_webglAtivoHandle) { _webglAtivoHandle.parar(); _webglAtivoHandle = null; }
  if (_webglAtivoEl) montarJoiaVisual(_webglAtivoEl, _elParaJoia.get(_webglAtivoEl));
  pararCicloFrames(el); // o giro de mentirinha para enquanto o de verdade está ligado
  if (!window.NRGemas3D) return;
  try {
    const h = window.NRGemas3D.montarAoVivo(el, joia.paleta3d);
    if (h) { _webglAtivoHandle = h; _webglAtivoEl = el; }
  } catch (e) { /* fica no visual de repouso mesmo */ }
}
// Guarda qual joia pertence a qual elemento, pra poder devolver o
// visual de repouso certo no elemento anterior quando o toque troca
// de joia (ou quando o Three.js termina de carregar e precisa
// atualizar todo mundo de uma vez — ver montarVisualizadoresVivos).
const _elParaJoia = new WeakMap();

function desligarWebGLAtivo() {
  if (_webglAtivoHandle) { _webglAtivoHandle.parar(); _webglAtivoHandle = null; }
  if (_webglAtivoEl) { montarJoiaVisual(_webglAtivoEl, _elParaJoia.get(_webglAtivoEl)); _webglAtivoEl = null; }
}

// Devolve a imagem 3D pré-renderizada da joia (data URL cacheado por
// NRGemas3D — só renderiza de verdade na primeira vez que cada joia
// é pedida, depois disso é só reaproveitar a string). Cai pro PNG
// antigo (joia.img) se o gemas3d.js não tiver carregado por algum
// motivo, pra loja nunca ficar com ícone quebrado.
function imgJoia(joia) {
  if (window.NRGemas3D) {
    try { return window.NRGemas3D.obterThumb(joia.paleta3d, 160); }
    catch (e) { /* cai pro png abaixo */ }
  }
  return joia.img;
}

// Estado das joias — carregado/salvo no localStorage
// joiasMochila: array de ids de joias na mochila
// joiasEquipadas: objeto { naveId: joiaId } — qual joia está em qual nave
let joiasMochila   = [];
let joiasEquipadas = {};

// Joia selecionada atualmente no modal de compra
let _joiaSelecionada = null;

// ── CARREGAMENTO E SALVAMENTO ──────────────────────────────────
function carregarJoias() {
  joiasMochila   = JSON.parse(localStorage.getItem('joiasMochila')   || '[]');
  joiasEquipadas = JSON.parse(localStorage.getItem('joiasEquipadas') || '{}');
}

// Só grava no localStorage (usado internamente pelo carregarDados())
function salvarJoiasLocal() {
  localStorage.setItem('joiasMochila',   JSON.stringify(joiasMochila));
  localStorage.setItem('joiasEquipadas', JSON.stringify(joiasEquipadas));
}

// Grava local E sincroniza com a conta — é essa que o resto do
// arquivo chama toda vez que uma joia muda de lugar (mochila, equipar,
// trocar de nave). Antes as joias só eram salvas no Firebase às vezes,
// por acidente, quando salvar() rodava por outro motivo — agora
// sincroniza sempre que qualquer coisa relacionada a joia muda.
function salvarJoias() {
  salvarJoiasLocal();
  if (window.NRDados) {
    window.NRDados.salvarNaves({ joiasMochila, joiasEquipadas }).catch(() => {});
  }
}

// Retorna os bônus totais da joia equipada em uma nave (ou {} se não tiver)
function getBonusJoia(naveId) {
  const joiaId = joiasEquipadas[naveId];
  if (!joiaId) return {};
  const joia = JOIAS.find(j => j.id === joiaId);
  return joia ? joia.bonus : {};
}
window.getBonusJoia = getBonusJoia;
window.equiparJoiaNaNave = equiparJoiaNaNave;
window.abrirModalCompra = abrirModalCompra;
window.fecharModal = fecharModal;
window.fecharModalNave = fecharModalNave;
window.usarJoiaDaMochila = usarJoiaDaMochila;
window.trocarAba = trocarAba;

// ── ALTERNÂNCIA DE ABAS ───────────────────────────────────────
function trocarAba(aba) {
  const secaoNaves  = document.querySelector('.preview-section');
  const secaoGrid   = document.querySelector('.naves-grid');
  const secaoJoias  = document.getElementById('secaoJoias');
  const btnNaves    = document.getElementById('abaNavesBtn');
  const btnJoias    = document.getElementById('abaJoiasBtn');

  if (aba === 'naves') {
    // Sai da aba de joias — para o ciclo de quadros e o WebGL ao vivo
    // (se algum estiver ligado), pra não deixar nada rodando escondido.
    pararTodosCiclosFrames();
    desligarWebGLAtivo();

    secaoNaves.classList.remove('hidden');
    secaoGrid.classList.remove('hidden');
    secaoJoias.classList.add('hidden');
    btnNaves.classList.add('ativa');
    btnJoias.classList.remove('ativa');
    // Scroll pro topo ao voltar pras naves
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    secaoNaves.classList.add('hidden');
    secaoGrid.classList.add('hidden');
    secaoJoias.classList.remove('hidden');
    btnNaves.classList.remove('ativa');
    btnJoias.classList.add('ativa');
    renderJoias();
    renderMochila();
    // Scroll automático para a seção de joias
    setTimeout(() => {
      secaoJoias.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }
}
window.trocarAba = trocarAba;

// ── RENDER DA LOJA DE JOIAS ───────────────────────────────────
function renderJoias() {
  const grid = document.getElementById('joiasGrid');
  if (!grid) return;

  // Fecha o ciclo de quadros e o visualizador 3D ao vivo (se algum
  // estiver ligado) antes de jogar fora os elementos — sem isso o
  // setInterval/contexto WebGL continua rodando escondido pra sempre.
  pararTodosCiclosFrames();
  desligarWebGLAtivo();
  if (window.NRGemas3D) window.NRGemas3D.pararTodos();

  grid.innerHTML = JOIAS.map(joia => {
    const podePagar = moedas >= joia.preco;
    return `
      <div class="joia-card ${podePagar ? '' : 'sem-moedas'}"
           style="--joia-cor: ${joia.cor}"
           onclick="abrirModalCompra('${joia.id}')">
        <div class="joia-live" data-paleta="${joia.paleta3d}" data-joia="${joia.id}" data-girar="1"></div>
        <div class="joia-card-nome">${joia.nome}</div>
        <div class="joia-card-bonus">${joia.desc}</div>
        <div class="joia-card-preco">◈ ${joia.preco.toLocaleString('pt-BR')}</div>
      </div>
    `;
  }).join('');

  montarVisualizadoresVivos(grid);
}

// Monta o visual de repouso em cada .joia-live da área (thumbnail 3D
// real — girando de mentirinha na grade, parado na mochila — ou
// círculo sólido se o Three.js ainda não carregou), e prepara o toque
// pra ligar o WebGL de verdade só naquela joia específica quando o
// dedo encostar (nunca mais de uma com WebGL vivo ao mesmo tempo). Se
// alguma tiver ficado com círculo sólido porque o Three.js ainda não
// tinha carregado, isso reagenda a troca pro visual real assim que
// ele terminar — sem precisar o usuário tocar em nada.
function montarVisualizadoresVivos(escopoEl) {
  escopoEl.querySelectorAll('.joia-live').forEach(function (el) {
    const joia = JOIAS.find(j => j.id === el.dataset.joia);
    if (!joia) return;
    _elParaJoia.set(el, joia);
    montarJoiaVisual(el, joia);
    el.addEventListener('pointerdown', function () { ligarWebGLNoToque(el, joia); });
  });

  if (window.NRGemas3D) {
    window.NRGemas3D.pronto(function () {
      escopoEl.querySelectorAll('.joia-live').forEach(function (el) {
        if (el === _webglAtivoEl) return; // esse já está com o WebGL ao vivo ligado, não mexe
        const joia = _elParaJoia.get(el);
        if (joia) montarJoiaVisual(el, joia);
      });
    });
  }
}

// ── RENDER DA MOCHILA ─────────────────────────────────────────
function renderMochila() {
  const lista = document.getElementById('mochila-lista');
  if (!lista) return;

  desligarWebGLAtivo();
  if (window.NRGemas3D) window.NRGemas3D.pararTodos();

  if (joiasMochila.length === 0) {
    lista.innerHTML = '<div class="mochila-vazia">Nenhuma joia na mochila</div>';
    return;
  }

  lista.innerHTML = joiasMochila.map((joiaId, idx) => {
    const joia = JOIAS.find(j => j.id === joiaId);
    if (!joia) return '';
    // Sem data-girar aqui de propósito — a mochila fica parada
    // (thumbnail estático), só a grade da loja gira sozinha.
    return `
      <div class="mochila-item" onclick="usarJoiaDaMochila(${idx})">
        <div class="joia-live" data-paleta="${joia.paleta3d}" data-joia="${joia.id}"></div>
        <div class="mochila-item-nome">${joia.nome}</div>
      </div>
    `;
  }).join('');

  montarVisualizadoresVivos(lista);
}

// ── MODAIS ────────────────────────────────────────────────────
function abrirModalCompra(joiaId) {
  const joia = JOIAS.find(j => j.id === joiaId);
  if (!joia) return;
  _joiaSelecionada = joia;

  const elImg = document.getElementById('modalJoiaImg');
  _elParaJoia.set(elImg, joia);
  ligarWebGLNoToque(elImg, joia); // modal é vitrine única na tela, pode ligar direto
  document.getElementById('modalJoiaNome').textContent  = joia.nome;
  document.getElementById('modalJoiaDesc').textContent  = joia.desc;
  document.getElementById('modalJoiaPreco').textContent = '◈ ' + joia.preco.toLocaleString('pt-BR');

  document.getElementById('modalBtnSim').onclick = () => confirmarCompraJoia(joia);
  document.getElementById('modalCompra').classList.remove('hidden');
}

function fecharModal() {
  document.getElementById('modalCompra').classList.add('hidden');
  _joiaSelecionada = null;
  desligarWebGLAtivo();
}
window.fecharModal = fecharModal;

function confirmarCompraJoia(joia) {
  if (moedas < joia.preco) {
    showToast('✗ MOEDAS INSUFICIENTES', 'erro');
    fecharModal();
    return;
  }
  // Desconta as moedas
  moedas -= joia.preco;
  salvar();
  renderMoedas();
  fecharModal();

  // Abre modal de destino: equipar nave ou mochila
  document.getElementById('modalDestinoNome').textContent = joia.nome;
  document.getElementById('modalBtnEquipar').onclick = () => abrirModalEscolherNave(joia);
  document.getElementById('modalBtnMochila').onclick = () => colocarNaMochila(joia);
  document.getElementById('modalDestino').classList.remove('hidden');
}

function fecharModalDestino() {
  document.getElementById('modalDestino').classList.add('hidden');
}

function colocarNaMochila(joia) {
  joiasMochila.push(joia.id);
  salvarJoias();
  fecharModalDestino();
  renderMochila();
  showToast('🎒 Joia adicionada à mochila!');
}

// Joia e nave selecionadas na tela de escolha
let _joiaParaEquipar = null;
let _naveSelecionadaId = null;

function abrirModalEscolherNave(joia) {
  fecharModalDestino();
  _joiaParaEquipar = joia;
  _naveSelecionadaId = null;

  // Cria tela de escolha de nave do zero (layout lado a lado)
  let tela = document.getElementById('telaEscolherNave');
  if (tela) tela.remove();

  tela = document.createElement('div');
  tela.id = 'telaEscolherNave';
  tela.style.cssText = 'position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,0.95);display:flex;flex-direction:column;font-family:Orbitron,monospace;';

  // ── HEADER ──
  tela.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid rgba(0,255,255,0.15);">
      <div style="font-size:12px;font-weight:700;letter-spacing:3px;color:#00ffff;">ESCOLHA UMA NAVE</div>
      <button onclick="fecharTelaEscolherNave()" style="font-family:Orbitron,monospace;font-size:11px;font-weight:700;letter-spacing:2px;padding:8px 16px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.05);color:#ffffff66;cursor:pointer;">SAIR</button>
    </div>

    <div style="display:flex;flex:1;overflow:hidden;">
      <!-- LADO ESQUERDO: lista de naves com scroll -->
      <div id="listaNavesTela" style="width:50%;overflow-y:auto;padding:12px 8px;border-right:1px solid rgba(0,255,255,0.1);display:flex;flex-direction:column;gap:8px;"></div>

      <!-- LADO DIREITO: info da joia + botão colocar -->
      <div style="width:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px;">
        <div id="joiaEscolherPreview" style="width:56px;height:70px;filter:drop-shadow(0 0 12px ${joia.cor});"></div>
        <div style="font-size:10px;font-weight:700;letter-spacing:2px;color:${joia.cor};text-align:center;">${joia.nome}</div>
        <div id="joiaPoderTexto" style="font-family:Share Tech Mono,monospace;font-size:11px;color:#ffffff66;letter-spacing:1px;text-align:center;line-height:1.6;">${joia.desc}</div>
        <button id="btnColocarJoia" onclick="confirmarColocarJoia()" style="font-family:Orbitron,monospace;font-size:11px;font-weight:700;letter-spacing:2px;padding:12px 20px;border-radius:10px;border:none;background:linear-gradient(135deg,#00ffff,#00aaff);color:#000;cursor:pointer;opacity:0.4;pointer-events:none;width:90%;">COLOCAR</button>
        <div id="naveSelecionadaInfo" style="font-family:Share Tech Mono,monospace;font-size:10px;color:#ffffff44;letter-spacing:1px;text-align:center;"></div>
      </div>
    </div>
  `;

  document.body.appendChild(tela);
  const elPreview = document.getElementById('joiaEscolherPreview');
  _elParaJoia.set(elPreview, joia);
  ligarWebGLNoToque(elPreview, joia);

  // Renderiza lista de naves
  const lista = document.getElementById('listaNavesTela');
  navesCompradas.forEach(naveId => {
    const nave = NAVES.find(n => n.id === naveId);
    if (!nave) return;

    const joiaEquipada = joiasEquipadas[naveId];
    const joiaEquipadaObj = joiaEquipada ? JOIAS.find(j => j.id === joiaEquipada) : null;

    const item = document.createElement('div');
    item.id = 'naveItem_' + naveId;
    item.style.cssText = 'background:rgba(0,255,255,0.04);border:1px solid rgba(0,255,255,0.12);border-radius:12px;padding:10px;cursor:pointer;transition:all 0.2s;position:relative;';

    // Canvas da nave
    const canvasId = 'minitela_' + naveId;
    item.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="position:relative;width:52px;height:52px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">
          <canvas id="${canvasId}" width="52" height="52" style="border-radius:8px;display:block;margin:auto;"></canvas>
          <!-- Joia equipada aparece sobre a nave como bolinha centralizada -->
          ${joiaEquipadaObj ? `<div style="position:absolute;top:15%;left:62%;transform:translate(-50%,-50%);width:32px;height:32px;border-radius:50%;background:radial-gradient(circle at 35% 30%, ${joiaEquipadaObj.cor}cc, ${joiaEquipadaObj.cor}33);filter:drop-shadow(0 0 6px ${joiaEquipadaObj.cor});opacity:0.9;pointer-events:none;"></div>` : ''}
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;letter-spacing:2px;color:#00ffff;">${nave.nome}</div>
          <div style="font-family:Share Tech Mono,monospace;font-size:9px;color:${joiaEquipadaObj ? joiaEquipadaObj.cor : '#ffffff33'};margin-top:2px;">
            ${joiaEquipadaObj ? '💎 ' + joiaEquipadaObj.nome : 'Sem joia'}
          </div>
        </div>
      </div>
    `;

    item.onclick = () => selecionarNave(naveId);
    lista.appendChild(item);

    // Renderiza a nave no mini canvas
    setTimeout(() => {
      const c = document.getElementById(canvasId);
      if (c) renderCardCanvas(c, nave, true);
    }, 60);
  });
}

// Seleciona uma nave na tela de escolha
function selecionarNave(naveId) {
  _naveSelecionadaId = naveId;
  const nave = NAVES.find(n => n.id === naveId);

  // Remove seleção anterior
  document.querySelectorAll('[id^="naveItem_"]').forEach(el => {
    el.style.border = '1px solid rgba(0,255,255,0.12)';
    el.style.background = 'rgba(0,255,255,0.04)';
  });

  // Marca como selecionada
  const item = document.getElementById('naveItem_' + naveId);
  if (item) {
    item.style.border = '1px solid #00ffff';
    item.style.background = 'rgba(0,255,255,0.12)';
  }

  // Ativa botão COLOCAR
  const btn = document.getElementById('btnColocarJoia');
  if (btn) { btn.style.opacity = '1'; btn.style.pointerEvents = 'auto'; }

  // Mostra nave selecionada
  const info = document.getElementById('naveSelecionadaInfo');
  if (info && nave) info.textContent = nave.nome + ' selecionada';
}
window.selecionarNave = selecionarNave;

// Confirma colocar a joia na nave (modal sim/não)
function confirmarColocarJoia() {
  if (!_naveSelecionadaId || !_joiaParaEquipar) return;
  const nave = NAVES.find(n => n.id === _naveSelecionadaId);
  if (!nave) return;

  // Cria modal de confirmação
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML = `
    <div style="width:min(320px,100%);background:linear-gradient(180deg,#0c0818,#070510);border:1px solid rgba(0,255,255,0.2);border-radius:20px;padding:28px 20px;display:flex;flex-direction:column;align-items:center;gap:12px;">
      <div style="width:60px;height:75px;border-radius:50%;background:radial-gradient(circle at 35% 30%, ${_joiaParaEquipar.cor}cc, ${_joiaParaEquipar.cor}33);"></div>
      <div style="font-family:Orbitron,monospace;font-size:12px;font-weight:700;color:#fff;letter-spacing:2px;text-align:center;">${_joiaParaEquipar.nome}</div>
      <p style="font-family:Share Tech Mono,monospace;font-size:12px;color:#ffffff66;letter-spacing:1px;text-align:center;line-height:1.6;">Deseja colocar esta joia na nave<br><strong style="color:#00ffff">${nave.nome}</strong>?</p>
      <div style="display:flex;gap:10px;width:100%;">
        <button id="btnSimColocar" style="flex:1;font-family:Orbitron,monospace;font-size:11px;font-weight:700;letter-spacing:2px;padding:12px;border-radius:10px;border:none;background:linear-gradient(135deg,#00ffff,#00aaff);color:#000;cursor:pointer;">SIM</button>
        <button onclick="this.closest('div[style]').remove()" style="flex:1;font-family:Orbitron,monospace;font-size:11px;font-weight:700;letter-spacing:2px;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.05);color:#ffffff55;cursor:pointer;">NÃO</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('btnSimColocar').onclick = () => {
    // Se já tinha joia, devolve pra mochila
    const joiaAnterior = joiasEquipadas[_naveSelecionadaId];
    if (joiaAnterior) joiasMochila.push(joiaAnterior);

    // Equipa a joia
    joiasEquipadas[_naveSelecionadaId] = _joiaParaEquipar.id;
    salvarJoias();
    salvar();
    overlay.remove();
    fecharTelaEscolherNave();
    renderMochila();
    renderJoias();
    showToast('💎 Joia equipada com sucesso!');
  };
}
window.confirmarColocarJoia = confirmarColocarJoia;

function fecharTelaEscolherNave() {
  const tela = document.getElementById('telaEscolherNave');
  if (tela) tela.remove();
  desligarWebGLAtivo();
  _joiaParaEquipar = null;
  _naveSelecionadaId = null;
}
window.fecharTelaEscolherNave = fecharTelaEscolherNave;

function fecharModalNave() {
  document.getElementById('modalEscolherNave').classList.add('hidden');
}
window.fecharModalNave = fecharModalNave;

function equiparJoiaNaNave(joiaId, naveId) {
  const joia = JOIAS.find(j => j.id === joiaId);
  const nave = NAVES.find(n => n.id === naveId);
  if (!joia || !nave) return;

  // Fecha modal de escolha de nave
  fecharModalNave();

  // Modal de confirmação antes de equipar
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.zIndex = '2000';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-joia-img"><div style="width:60px;height:75px;border-radius:50%;background:radial-gradient(circle at 35% 30%, ${joia.cor}cc, ${joia.cor}33);"></div></div>
      <div class="modal-joia-nome">${joia.nome}</div>
      <p class="modal-pergunta">Deseja adicionar esta joia<br>na nave <strong style="color:#00ffff">${nave.nome}</strong>?</p>
      <div class="modal-btns">
        <button class="modal-btn-sim" id="btnConfirmarEquipar">SIM</button>
        <button class="modal-btn-nao" id="btnCancelarEquipar">NÃO</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('btnConfirmarEquipar').onclick = () => {
    // Se já tinha uma joia, devolve pra mochila
    const joiaAnterior = joiasEquipadas[naveId];
    if (joiaAnterior) joiasMochila.push(joiaAnterior);

    // Equipa a nova joia e salva
    joiasEquipadas[naveId] = joiaId;
    salvarJoias();
    salvar(); // salva no Firebase também
    document.body.removeChild(overlay);
    renderMochila();
    renderJoias();
    showToast('💎 Joia equipada com sucesso!');
  };

  document.getElementById('btnCancelarEquipar').onclick = () => {
    // Devolve a joia pra mochila se veio da mochila
    joiasMochila.push(joiaId);
    salvarJoias();
    document.body.removeChild(overlay);
    renderMochila();
  };
}

// Usa uma joia da mochila (equipa em uma nave)
function usarJoiaDaMochila(idx) {
  const joiaId = joiasMochila[idx];
  const joia = JOIAS.find(j => j.id === joiaId);
  if (!joia) return;

  // Remove da mochila temporariamente e abre modal de nave
  joiasMochila.splice(idx, 1);
  salvarJoias();
  abrirModalEscolherNave(joia);
}
window.usarJoiaDaMochila = usarJoiaDaMochila;

async function init() {
  await carregarDados();
  if (!document.getElementById('navesGrid')) return;
  const naveEquipada = NAVES.find(n => n.id === naveAtual) || NAVES[0];
  renderPreview(naveEquipada);
  renderGrid();
}
init();
