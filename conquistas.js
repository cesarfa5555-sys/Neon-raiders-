// =============================================
//  NEON RAIDERS — Sistema de Conquistas
//  conquistas.js
// =============================================

  const CONQUISTAS_DEF = [
  // ── PONTUAÇÃO ────────────────────────────────
  { id: "score_1k",      categoria: "score",   icone: "⭐", titulo: "Marcador",              descricao: "Alcançou 1.000 pontos em uma partida.",    segredo: false },
  { id: "score_10k",     categoria: "score",   icone: "🌟", titulo: "Artilheiro",            descricao: "Alcançou 10.000 pontos em uma partida.",   segredo: false },
  { id: "score_50k",     categoria: "score",   icone: "💫", titulo: "Lendário",              descricao: "Alcançou 50.000 pontos em uma partida.",   segredo: true  },

  // ── MISSÕES DO NITRO ──
  { id: 'nitro_m1',  categoria: 'nitro', icone: '🤖', titulo: 'Estreante',         descricao: 'Elimine 65 inimigos no total.', segredo: false },
  { id: 'nitro_m2',  categoria: 'nitro', icone: '🤖', titulo: 'Primeiro Setor',    descricao: 'Complete o Mapa 1, Nível 1.', segredo: false },
  { id: 'nitro_m3',  categoria: 'nitro', icone: '🤖', titulo: 'Acumulador',        descricao: 'Acumule 573 moedas no total.', segredo: false },
  { id: 'nitro_m4',  categoria: 'nitro', icone: '🤖', titulo: 'Caçador Iniciante', descricao: 'Elimine 289 inimigos no total.', segredo: false },
  { id: 'nitro_m5',  categoria: 'nitro', icone: '🤖', titulo: 'Zona Gelada',       descricao: 'Complete o Mapa 2, Nível 1.', segredo: false },
  { id: 'nitro_m6',  categoria: 'nitro', icone: '🤖', titulo: 'Matador de Titãs',  descricao: 'Derrote 7 bosses no total.', segredo: false },
  { id: 'nitro_m7',  categoria: 'nitro', icone: '🤖', titulo: 'Rico do Setor',     descricao: 'Acumule 2.500 moedas no total.', segredo: false },
  { id: 'nitro_m8',  categoria: 'nitro', icone: '🤖', titulo: 'Veterano Glacial',  descricao: 'Complete o Mapa 2, Nível 6.', segredo: false },
  { id: 'nitro_m9',  categoria: 'nitro', icone: '🤖', titulo: 'Exterminador',      descricao: 'Elimine 611 inimigos no total.', segredo: false },
  { id: 'nitro_m10', categoria: 'nitro', icone: '🤖', titulo: 'Caçador de Bosses', descricao: 'Derrote 18 bosses no total.', segredo: false },
  { id: 'nitro_m11', categoria: 'nitro', icone: '🤖', titulo: 'Zona Infernal',     descricao: 'Complete o Mapa 3, Nível 1.', segredo: false },
  { id: 'nitro_m12', categoria: 'nitro', icone: '🤖', titulo: 'Magnata Espacial',  descricao: 'Acumule 25.000 moedas no total.', segredo: false },
  { id: 'nitro_m13', categoria: 'nitro', icone: '🤖', titulo: 'Lenda da Guerra',   descricao: 'Elimine 1.250 inimigos no total.', segredo: false },
  { id: 'nitro_m14', categoria: 'nitro', icone: '🤖', titulo: 'Zona Sombria',      descricao: 'Complete o Mapa 4, Nível 1.', segredo: false },
  { id: 'nitro_m15', categoria: 'nitro', icone: '🤖', titulo: 'Digno do NITRO',    descricao: 'Derrote 30 bosses — NITRO desbloqueado!', segredo: false },
];


// ── PROGRESSO NITRO ──
function getProgressoNitro(dados) {
  const missoes = CONQUISTAS_DEF.filter(c => c.categoria === 'nitro');
  return { total: missoes.length, completas: missoes.filter(c => dados[c.id]).length };
}

function atualizarProgressoNitro() {
  const jogador = localStorage.getItem('jogadorNome');
  const dados = JSON.parse(localStorage.getItem(`neonraiders_conquistas_${jogador||''}`) || '{}');
  const prog = getProgressoNitro(dados);
  const pct = (prog.completas / 15) * 100;
  const bar   = document.getElementById('nitroProgressBar');
  const label = document.getElementById('nitroProgressLabel');
  const badge = document.getElementById('nitroBadge');
  if (bar)   bar.style.width = pct + '%';
  if (label) label.textContent = prog.completas + ' / 15 MISSÕES';
  if (badge) badge.style.display = prog.completas >= 15 ? 'block' : 'none';
}

// ─────────────────────────────────────────────
//  Utilitários de storage
// ─────────────────────────────────────────────

function _lsKey(jogador) { return `neonraiders_conquistas_${jogador}`; }

function _salvarLocal(jogador, dados) {
  try { localStorage.setItem(_lsKey(jogador), JSON.stringify(dados)); } catch(e) {}
}

function _lerLocal(jogador) {
  try {
    const raw = localStorage.getItem(_lsKey(jogador));
    return raw ? JSON.parse(raw) : {};
  } catch(e) { return {}; }
}

// ─────────────────────────────────────────────
//  Core: desbloquear conquista
// ─────────────────────────────────────────────

/**
 * Desbloqueia uma conquista para o jogador.
 * @param {string} jogador  - nome/id do jogador
 * @param {string} id       - id da conquista (ver CONQUISTAS_DEF)
 * @param {object} [db]     - instância do Firebase Realtime Database (opcional)
 */
async function desbloquearConquista(jogador, id, db) {
  if (!jogador || !id) return;

  const def = CONQUISTAS_DEF.find(c => c.id === id);
  if (!def) { console.warn(`[Conquistas] ID desconhecido: ${id}`); return; }

  // ── localStorage ──
  const local = _lerLocal(jogador);
  if (local[id]) return; // já desbloqueada

  const timestamp = Date.now();
  local[id] = timestamp;
  _salvarLocal(jogador, local);

  // ── Firebase ──
  if (db) {
    try {
      const ref = db.ref(`conquistas/${jogador}/${id}`);
      const snap = await ref.once("value");
      if (!snap.exists()) await ref.set(timestamp);
    } catch(e) { console.error("[Conquistas] Firebase erro:", e); }
  }

  // ── Notificação visual ──
  _mostrarToast(def);
  console.log(`[Conquistas] ✅ ${def.titulo} desbloqueada para ${jogador}`);
}

/**
 * Carrega todas as conquistas do jogador (Firebase tem prioridade, localStorage como fallback).
 * Retorna objeto { [id]: timestamp }
 */
async function carregarConquistas(jogador, db) {
  const local = _lerLocal(jogador);

  if (!db) return local;

  try {
    const snap = await db.ref(`conquistas/${jogador}`).once("value");
    if (snap.exists()) {
      const firebase = snap.val();
      // Mescla: Firebase + local (sem sobrescrever Firebase com dados desatualizados)
      const merged = Object.assign({}, local, firebase);
      _salvarLocal(jogador, merged);
      return merged;
    }
  } catch(e) { console.error("[Conquistas] Erro ao carregar:", e); }

  return local;
}

// ─────────────────────────────────────────────
//  Toast de notificação
// ─────────────────────────────────────────────

function _mostrarToast(def) {
  // Evita duplicar o container
  let container = document.getElementById("conquista-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "conquista-toast-container";
    container.style.cssText = `
      position:fixed; bottom:24px; right:24px; z-index:9999;
      display:flex; flex-direction:column; gap:10px; pointer-events:none;
    `;
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.style.cssText = `
    background: linear-gradient(135deg, #0d0d1a, #1a0a2e);
    border: 1px solid #a855f7;
    border-left: 4px solid #a855f7;
    border-radius: 10px;
    padding: 14px 18px;
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 260px;
    max-width: 320px;
    box-shadow: 0 0 20px #a855f744;
    animation: toastIn 0.4s ease forwards;
    pointer-events: all;
    font-family: 'Orbitron', 'Courier New', monospace;
  `;
  toast.innerHTML = `
    <span style="font-size:28px">${def.icone}</span>
    <div>
      <div style="font-size:10px;color:#a855f7;letter-spacing:2px;text-transform:uppercase;margin-bottom:2px">Conquista Desbloqueada!</div>
      <div style="font-size:13px;color:#e2e8f0;font-weight:700">${def.titulo}</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:2px">${def.descricao}</div>
    </div>
  `;

  // Injetar animação uma única vez
  if (!document.getElementById("conquista-toast-style")) {
    const style = document.createElement("style");
    style.id = "conquista-toast-style";
    style.textContent = `
      @keyframes toastIn {
        from { opacity:0; transform: translateX(40px); }
        to   { opacity:1; transform: translateX(0); }
      }
      @keyframes toastOut {
        from { opacity:1; transform: translateX(0); }
        to   { opacity:0; transform: translateX(40px); }
      }
    `;
    document.head.appendChild(style);
  }

  container.appendChild(toast);

  // Remover após 4s
  setTimeout(() => {
    toast.style.animation = "toastOut 0.4s ease forwards";
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

// ─────────────────────────────────────────────
//  Helpers de gatilhos (chamar no jogo)
// ─────────────────────────────────────────────

/**
 * Verificadores prontos para chamar nos eventos do jogo.
 * Passe sempre: jogador (string), db (Firebase), e os stats atuais.
 */
const ConquistasGatilhos = {

  aoBossDerrota(jogador, db, totalBosses, semDano) {
    desbloquearConquista(jogador, "boss_1", db);
    if (totalBosses >= 5) desbloquearConquista(jogador, "boss_2", db);
    if (semDano)          desbloquearConquista(jogador, "boss_sem_dano", db);
  },

  aoZerarMapa(jogador, db, mapaId, semMorrer) {
    const mapaMap = { 1: "mapa_1", 2: "mapa_2", 3: "mapa_3" };
    if (mapaMap[mapaId]) desbloquearConquista(jogador, mapaMap[mapaId], db);
    if (semMorrer)       desbloquearConquista(jogador, "sem_morrer", db);
    // "todos_mapas" deve ser verificado externamente após checar todos os mapas
  },

  aoTodosMapas(jogador, db) {
    desbloquearConquista(jogador, "todos_mapas", db);
  },

  aoMatarInimigo(jogador, db, totalKills, foiEspecial) {
    if (totalKills >= 10)  desbloquearConquista(jogador, "kill_10", db);
    if (totalKills >= 100) desbloquearConquista(jogador, "kill_100", db);
    if (totalKills >= 500) desbloquearConquista(jogador, "kill_500", db);
    if (foiEspecial)       desbloquearConquista(jogador, "kill_especial", db);
  },

  aoFimDePartida(jogador, db, pontuacao) {
    if (pontuacao >= 1000)  desbloquearConquista(jogador, "score_1k", db);
    if (pontuacao >= 10000) desbloquearConquista(jogador, "score_10k", db);
    if (pontuacao >= 50000) desbloquearConquista(jogador, "score_50k", db);
  },

  aoComprarSkin(jogador, db, totalSkins, maxSkins) {
    desbloquearConquista(jogador, "primeira_skin", db);
    if (totalSkins >= maxSkins) desbloquearConquista(jogador, "todas_skins", db);
  },

  aoLogin(jogador, db, diasSeguidos) {
    if (diasSeguidos >= 7) desbloquearConquista(jogador, "login_7dias", db);
  },
};

// Exporta para uso global (compatível com scripts no browser)
if (typeof window !== "undefined") {
  window.ConquistasNR = {
    LISTA: CONQUISTAS_DEF,
    desbloquear: desbloquearConquista,
    carregar: carregarConquistas,
    gatilhos: ConquistasGatilhos,
  };
}

// ════════════════════════════════════════════════════════════════
// TELA ESPECIAL DO NITRO — animação e progresso
// ════════════════════════════════════════════════════════════════

// Atualiza a barra de progresso do NITRO
function atualizarProgressoNitro() {
  const jogador = localStorage.getItem('jogadorNome');
  if (!jogador) return;
  const chave = `neonraiders_conquistas_${jogador}`;
  const dados = JSON.parse(localStorage.getItem(chave) || '{}');
  const missoes = CONQUISTAS_DEF.filter(c => c.categoria === 'nitro');
  const completas = missoes.filter(c => dados[c.id]).length;
  const pct = (completas / 15) * 100;

  const bar   = document.getElementById('nitroProgressBar');
  const label = document.getElementById('nitroProgressLabel');
  const badge = document.getElementById('nitroBadge');
  if (bar)   bar.style.width = pct + '%';
  if (label) label.textContent = completas + ' / 15 MISSÕES';
  if (badge) badge.style.display = completas >= 15 ? 'block' : 'none';
}

// Animação do NITRO no canvas (drone robótico girando)
let _nitroAnimId = null;
function animarNitroCanvas() {
  const c = document.getElementById('nitroCanvas');
  if (!c) return;
  if (_nitroAnimId) cancelAnimationFrame(_nitroAnimId);
  const ctx = c.getContext('2d');
  const W = c.width, H = c.height;
  let t = 0;

  function frame() {
    t += 0.03;
    ctx.clearRect(0, 0, W, H);

    const cx = W/2, cy = H/2;

    // Corpo central do drone
    const pulso = Math.sin(t * 1.5) * 0.1 + 0.9;
    ctx.save();
    ctx.translate(cx, cy);

    // Glow externo
    ctx.shadowColor = '#00ffcc';
    ctx.shadowBlur = 20 * pulso;

    // Anel giratório externo
    ctx.save();
    ctx.rotate(t);
    ctx.strokeStyle = `rgba(0,255,200,${0.4 * pulso})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, 45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // Marcadores no anel
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI/2) * i;
      ctx.fillStyle = '#00ffcc';
      ctx.beginPath();
      ctx.arc(Math.cos(a)*45, Math.sin(a)*45, 3, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();

    // Anel giratório interno (sentido contrário)
    ctx.save();
    ctx.rotate(-t * 0.7);
    ctx.strokeStyle = `rgba(0,200,255,${0.3 * pulso})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 8]);
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Corpo hexagonal do drone
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI/3)*i - Math.PI/6;
      const r = 18 * pulso;
      i === 0 ? ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r)
              : ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
    }
    ctx.closePath();
    const grad = ctx.createRadialGradient(0,0,0, 0,0,18);
    grad.addColorStop(0, 'rgba(0,255,200,0.6)');
    grad.addColorStop(1, 'rgba(0,100,150,0.3)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Olho central do drone (LED pulsante)
    ctx.beginPath();
    ctx.arc(0, 0, 6 * pulso, 0, Math.PI*2);
    ctx.fillStyle = '#00ffcc';
    ctx.fill();

    // Antenas
    ctx.strokeStyle = '#00ffcc88';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-8, -18*pulso);
    ctx.lineTo(-12, -32);
    ctx.moveTo(8, -18*pulso);
    ctx.lineTo(12, -32);
    ctx.stroke();
    // Pontas das antenas
    ctx.fillStyle = '#00ffcc';
    ctx.beginPath(); ctx.arc(-12, -32, 2.5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(12, -32, 2.5, 0, Math.PI*2); ctx.fill();

    // Propulsores (bolinhas nos lados)
    [[-22, 5], [22, 5]].forEach(([dx, dy]) => {
      const propPulso = Math.sin(t * 3 + dx) * 0.3 + 0.7;
      ctx.save();
      ctx.shadowColor = '#00aaff';
      ctx.shadowBlur = 8;
      ctx.fillStyle = `rgba(0,150,255,${propPulso})`;
      ctx.beginPath();
      ctx.arc(dx*pulso, dy, 5, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    });

    // Rastro de energia abaixo
    const gradRastro = ctx.createLinearGradient(0, 20, 0, 50);
    gradRastro.addColorStop(0, `rgba(0,255,200,${0.4*pulso})`);
    gradRastro.addColorStop(1, 'rgba(0,255,200,0)');
    ctx.fillStyle = gradRastro;
    ctx.beginPath();
    ctx.ellipse(0, 35, 6*pulso, 15, 0, 0, Math.PI*2);
    ctx.fill();

    ctx.restore();

    _nitroAnimId = requestAnimationFrame(frame);
  }
  frame();
}

// Para a animação quando sai da aba NITRO
function pararNitroAnim() {
  if (_nitroAnimId) { cancelAnimationFrame(_nitroAnimId); _nitroAnimId = null; }
}

// Renderiza a lista de missões do NITRO abaixo do card
function renderMissoesNitro() {
  const jogador = localStorage.getItem('jogadorNome');
  const dados = JSON.parse(localStorage.getItem(`neonraiders_conquistas_${jogador||''}`) || '{}');
  const lista = document.getElementById('nitroMissoesList');
  if (!lista) return;

  const missoes = CONQUISTAS_DEF.filter(c => c.categoria === 'nitro');
  lista.innerHTML = missoes.map((m, i) => {
    const completa = !!dados[m.id];
    return `<div style="background:rgba(0,255,200,${completa?'0.08':'0.02'});border:1px solid rgba(0,255,200,${completa?'0.3':'0.1'});border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:12px;">
      <div style="width:28px;height:28px;border-radius:50%;border:2px solid ${completa?'#00ffcc':'rgba(0,255,200,0.2)'};background:${completa?'rgba(0,255,200,0.2)':'transparent'};display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;">${completa?'✓':i+1}</div>
      <div style="flex:1;">
        <div style="font-family:'Orbitron',monospace;font-size:10px;font-weight:700;letter-spacing:2px;color:${completa?'#00ffcc':'#ffffff88'};margin-bottom:2px;">${m.titulo}</div>
        <div style="font-family:'Share Tech Mono',monospace;font-size:10px;color:${completa?'#ffffff88':'#ffffff44'};letter-spacing:1px;">${m.descricao}</div>
      </div>
    </div>`;
  }).join('');
}

// ── Expõe funções do NITRO globalmente ──
window.animarNitroCanvas     = animarNitroCanvas;
window.pararNitroAnim        = pararNitroAnim;
window.atualizarProgressoNitro = atualizarProgressoNitro;
window.renderMissoesNitro    = renderMissoesNitro;
