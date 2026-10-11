// ── CONFIGS DE CADA MAPA ─────────────────────────────────────
const MAPA_INFO = {
  1: { nome: 'MAPA 1 ', tema: 'CYBERPUNK',  cor: '#00ffff' },
  2: { nome: 'MAPA 2', tema: 'GELO',       cor: '#aaeeff' },
  3: { nome: 'MAPA 3', tema: 'FOGO',       cor: '#ff4400' },
  4: { nome: 'MAPA 4', tema: 'SOMBRA',     cor: '#9900ff' },
  5: { nome: 'MAPA 5', tema: 'ROBÓTICO',   cor: '#88aaff' },
  6: { nome: 'MAPA 6', tema: 'VOID',       cor: '#ff00ff' },
};

// ── BOSS DE CADA MAPA × NÍVEL ─────────────────────────────────
const BOSS_NAMES = {
  1: ['ALPHA-CORE','VIPER-X','TITAN-SHELL','PHANTOM-NULL','SWARM-QUEEN','OMEGA-VOID'],
  2: ['FROST-CORE','CRYO-VIPER','ICE-TITAN','NULL-FROST','BLIZZARD-QUEEN','ABSOLUTE-ZERO'],
  3: ['EMBER-CORE','FLAME-X','INFERNO-SHELL','PHANTOM-BLAZE','FIRE-QUEEN','SOLAR-VOID'],
  4: ['SHADOW-CORE','DARK-VIPER','SHADE-TITAN','NULL-SHADOW','MIRROR-QUEEN','ABYSS-VOID'],
  5: ['MECH-CORE','CIRCUIT-X','STEEL-TITAN','PHANTOM-MECH','HIVE-QUEEN','OMEGA-MECH'],
  6: ['CHAOS-CORE','RIFT-X','VOID-TITAN','NULL-CHAOS','RIFT-QUEEN','OMEGA-CHAOS'],
};

// ── LÊ MAPA DA URL ───────────────────────────────────────────
const params    = new URLSearchParams(window.location.search);
const mapaAtual = Number(params.get("mapa")) || 1;

// ── NÍVEL DESBLOQUEADO ────────────────────────────────────────
function chaveNivel(mapa) { return "nivelDesbloqueado_mapa" + mapa; }

async function montarTela() {
  // Busca o progresso mais atualizado da conta antes de montar a grade
  // (cobre o caso de o jogador ter avançado em outro aparelho). Se por
  // algum motivo não conseguir, usa o que já está salvo localmente.
  let nivelDesbloqueado = Number(localStorage.getItem(chaveNivel(mapaAtual))) || 1;
  try {
    if (window.NRDados) {
      const perfil = await window.NRDados.carregarPerfil();
      const niveis = perfil && perfil.progresso && perfil.progresso.niveisDesbloqueados;
      if (niveis && typeof niveis[String(mapaAtual)] !== 'undefined') {
        // Usa o MAIOR entre o valor local e o do Firebase — assim, se
        // uma sincronização anterior falhou silenciosamente e o Firebase
        // ficou desatualizado, o jogo não "regride" o nível na tela
        nivelDesbloqueado = Math.max(nivelDesbloqueado, niveis[String(mapaAtual)]);
        localStorage.setItem(chaveNivel(mapaAtual), nivelDesbloqueado);
      }
    }
  } catch (e) {}

  // ── APLICA COR DO MAPA ────────────────────────────────────────
  const info = MAPA_INFO[mapaAtual] || MAPA_INFO[1];
  document.documentElement.style.setProperty('--cor-mapa', info.cor);

  // ── PREENCHE HEADER ───────────────────────────────────────────
  document.getElementById('mapa-nome').textContent = info.nome;
  document.getElementById('mapa-tema').textContent = info.tema;

  // ── BARRA DE PROGRESSO ────────────────────────────────────────
  const totalCompletos = Math.max(0, nivelDesbloqueado - 1);
  const pct = Math.round((totalCompletos / 6) * 100);
  document.getElementById('progresso-fill').style.width = pct + '%';
  document.getElementById('progresso-label').textContent =
    totalCompletos === 0 ? 'NENHUM NÍVEL COMPLETO' :
    totalCompletos === 6 ? '✓ MAPA COMPLETO!' :
    totalCompletos + ' / 6 NÍVEIS COMPLETOS';

  // ── GERA O CAMINHO (hexágonos + linha pontilhada em canvas) ───────
  const container = document.getElementById('niveisCaminho');
  const canvas    = document.getElementById('caminhoCanvas');
  const ctx       = canvas.getContext('2d');
  const bosses    = BOSS_NAMES[mapaAtual] || BOSS_NAMES[1];
  const TOTAL     = 6;

  // Posição x (em % da largura do container) de cada nó, formando um
  // zigue-zague — mesma ideia do mapa de overworld que inspirou isso.
  const OFFSETS_X = [50, 76, 50, 24, 50, 76];
  const ESPACO_Y  = 132; // distância vertical entre um nó e o próximo, em px
  const PADDING_TOPO = 70;

  const alturaTotal = PADDING_TOPO + ESPACO_Y * (TOTAL - 1) + 70;
  container.style.height = alturaTotal + 'px';

  // Centro (x,y em pixels reais do container) de cada nível, 1-indexado
  const pontos = { };
  for (let i = 1; i <= TOTAL; i++) {
    pontos[i] = { xPct: OFFSETS_X[i - 1], y: PADDING_TOPO + ESPACO_Y * (i - 1) };
  }

  function corDoEstado(estado) {
    if (estado === 'completo')   return getComputedStyle(document.documentElement).getPropertyValue('--ouro').trim() || '#ffd700';
    if (estado === 'disponivel') return info.cor;
    return 'rgba(255,255,255,0.15)';
  }

  function estadoDoNivel(i) {
    return i < nivelDesbloqueado ? 'completo' : i === nivelDesbloqueado ? 'disponivel' : 'bloqueado';
  }

  // Desenha um hexágono (ponta pra cima) preenchido + com borda, e glow
  // proporcional ao estado (bloqueado quase sem glow, disponível bem aceso)
  function desenharHexagono(cx, cy, raio, estado) {
    const cor = corDoEstado(estado);
    ctx.save();
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const ang = (Math.PI / 180) * (60 * k - 90);
      const x = cx + raio * Math.cos(ang);
      const y = cy + raio * Math.sin(ang);
      if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();

    ctx.fillStyle = estado === 'bloqueado' ? 'rgba(10,14,24,0.85)' : 'rgba(0,10,20,0.85)';
    ctx.fill();

    ctx.shadowColor = cor;
    ctx.shadowBlur = estado === 'bloqueado' ? 0 : estado === 'disponivel' ? 18 : 10;
    ctx.strokeStyle = cor;
    ctx.lineWidth = estado === 'disponivel' ? 3 : 2;
    ctx.stroke();
    ctx.restore();
  }

  // Linha pontilhada entre dois níveis consecutivos — colorida se o
  // nível de origem já foi completado ou é o disponível, cinza/apagada
  // se leva a algo ainda bloqueado
  function desenharLigacao(p1, p2, estadoOrigem) {
    const cor = estadoOrigem === 'bloqueado' ? 'rgba(255,255,255,0.12)' : corDoEstado(estadoOrigem === 'completo' ? 'completo' : 'disponivel');
    ctx.save();
    ctx.strokeStyle = cor;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([7, 7]);
    ctx.shadowColor = cor;
    ctx.shadowBlur = estadoOrigem === 'bloqueado' ? 0 : 8;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.restore();
  }

  function redesenharCanvas() {
    const rect = container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const centros = {};
    for (let i = 1; i <= TOTAL; i++) {
      centros[i] = { x: rect.width * (pontos[i].xPct / 100), y: pontos[i].y };
    }

    // Linhas primeiro (ficam atrás dos hexágonos)
    for (let i = 1; i < TOTAL; i++) {
      desenharLigacao(centros[i], centros[i + 1], estadoDoNivel(i));
    }
    // Hexágonos por cima
    for (let i = 1; i <= TOTAL; i++) {
      desenharHexagono(centros[i].x, centros[i].y, 44, estadoDoNivel(i));
    }
  }

  redesenharCanvas();
  window.addEventListener('resize', redesenharCanvas);

  // ── OVERLAYS CLICÁVEIS (texto + número + boss, por cima do canvas) ──
  for (let i = 1; i <= TOTAL; i++) {
    const estado = estadoDoNivel(i);
    const badge  = estado === 'completo' ? '✓' : estado === 'bloqueado' ? '🔒' : '';

    const no = document.createElement('div');
    no.className = `nivel-no ${estado}`;
    no.style.left = pontos[i].xPct + '%';
    no.style.top  = pontos[i].y + 'px';
    no.innerHTML = `
      ${badge ? `<div class="no-badge">${badge}</div>` : ''}
      <div class="no-lv">LV</div>
      <div class="no-numero">${i}</div>
      <div class="no-boss">${bosses[i - 1]}</div>
    `;

    if (estado !== 'bloqueado') {
      no.addEventListener('click', () => {
        window.location.href = `game3d.html?mapa=${mapaAtual}&nivel=${i}`;
      });
    }

    container.appendChild(no);
  }
}
montarTela();

// ── BOTÃO VOLTAR ─────────────────────────────────────────────
document.getElementById('voltar').addEventListener('click', () => {
  window.location.href = 'menu.html';
});

// ── MÚSICA ───────────────────────────────────────────────────
document.getElementById('btnMusica').addEventListener('click', () => {
  const music = document.getElementById('bgMusic');
  music.volume = 0.3;
  music.play();
});