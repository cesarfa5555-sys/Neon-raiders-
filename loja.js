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
    }
  } catch (e) {
    moedas         = Number(localStorage.getItem('moedas')) || 0;
    naveAtual      = localStorage.getItem('naveAtual') || 'padrao';
    navesCompradas = JSON.parse(localStorage.getItem('navesCompradas') || '["padrao"]');
  }

  salvarLocal();
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
    // A Vanguard base já é mais forte que a Spectre (dano/HP 9 de 10);
    // as peças levam as barras ao máximo. Velocidade parte de 6 (igual
    // à Spectre, spdBonus 0.5). Tetos de peças: dano +30%, vel +40%, hp +300.
    statDano = Math.min(10, 9 + totais.dano / 0.30);
    statVel  = Math.min(10, 6 + (totais.velocidade / 0.40) * 4);
    statHp   = Math.min(10, 9 + totais.hp / 300);
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
// JOIA — vitrine da joia nova
// As 4 joias antigas (com bônus, compra, mochila, equipar por nave)
// saíram do jogo inteiro — nem a loja nem o boss3d.js aplicam bônus
// de joia mais. No lugar entra só uma vitrine: a joia nova (Three.js,
// ver joia-nova.js) girando sozinha, com "EM BREVE" embaixo, sem
// preço e sem poder comprar ainda — as habilidades dela são a
// próxima etapa, ainda não decidida.
// ════════════════════════════════════════════════════════════════
let _vitrineJoia = null; // handle devolvido por NRJoiaNova.montar() — .parar() desliga o WebGL

function iniciarVitrineJoia() {
  if (_vitrineJoia) return; // já está rodando, não duplica
  const canvas = document.getElementById('joiaNovaCanvas');
  if (canvas && window.NRJoiaNova) _vitrineJoia = window.NRJoiaNova.montar(canvas);
}

function pararVitrineJoia() {
  if (_vitrineJoia) { _vitrineJoia.parar(); _vitrineJoia = null; }
}

window.trocarAba = trocarAba;

// ── ALTERNÂNCIA DE ABAS ───────────────────────────────────────
function trocarAba(aba) {
  const secaoNaves  = document.querySelector('.preview-section');
  const secaoGrid   = document.querySelector('.naves-grid');
  const secaoJoias  = document.getElementById('secaoJoias');
  const secaoCaixas = document.getElementById('secaoCaixas');
  const btnNaves    = document.getElementById('abaNavesBtn');
  const btnJoias    = document.getElementById('abaJoiasBtn');
  const btnCaixas   = document.getElementById('abaCaixasBtn');
  const iframeBau   = document.getElementById('caixaBauIframe');

  // O WebView só aguenta 1 contexto WebGL ativo por vez — então
  // sempre que a aba de caixas NÃO é a que vai ficar visível, o
  // iframe do baú (que roda Three.js) é esvaziado pra soltar o
  // contexto dele, e vice-versa em relação às joias/naves.
  if (aba !== 'caixas' && iframeBau) {
    iframeBau.src = 'about:blank';
  }

  if (aba === 'naves') {
    // Sai da aba de joias — para a vitrine da joia, pra não deixar o
    // WebGL dela rodando escondido atrás da tela de naves.
    pararVitrineJoia();

    secaoNaves.classList.remove('hidden');
    secaoGrid.classList.remove('hidden');
    secaoJoias.classList.add('hidden');
    secaoCaixas.classList.add('hidden');
    btnNaves.classList.add('ativa');
    btnJoias.classList.remove('ativa');
    btnCaixas.classList.remove('ativa');
    // Scroll pro topo ao voltar pras naves
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (aba === 'joias') {
    secaoNaves.classList.add('hidden');
    secaoGrid.classList.add('hidden');
    secaoJoias.classList.remove('hidden');
    secaoCaixas.classList.add('hidden');
    btnNaves.classList.remove('ativa');
    btnJoias.classList.add('ativa');
    btnCaixas.classList.remove('ativa');
    iniciarVitrineJoia();
    // Scroll automático para a seção de joias
    setTimeout(() => {
      secaoJoias.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  } else if (aba === 'caixas') {
    // Sai de naves/joias — mesmo cuidado de sempre: para a vitrine
    // da joia antes de ligar a cena 3D do baú.
    pararVitrineJoia();

    secaoNaves.classList.add('hidden');
    secaoGrid.classList.add('hidden');
    secaoJoias.classList.add('hidden');
    secaoCaixas.classList.remove('hidden');
    btnNaves.classList.remove('ativa');
    btnJoias.classList.remove('ativa');
    btnCaixas.classList.add('ativa');

    // Sempre recarrega do zero ao entrar na aba — garante que não
    // sobra nenhum contexto WebGL de uma visita anterior e que
    // estoque/moedas aparecem sempre atualizados.
    if (iframeBau) {
      iframeBau.src = 'bau-system.html';
    }

    setTimeout(() => {
      secaoCaixas.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }
}
window.trocarAba = trocarAba;

async function init() {
  await carregarDados();
  if (!document.getElementById('navesGrid')) return;
  const naveEquipada = NAVES.find(n => n.id === naveAtual) || NAVES[0];
  renderPreview(naveEquipada);
  renderGrid();
}
init();
