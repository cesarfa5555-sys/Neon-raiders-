// ══════════════════════════════════════════════════════════════════
// EVENTOS.JS — hub de eventos mensais (eventos.html)
//
// Carrega os eventos ativos via window.NREventos (eventos-dados.js),
// renderiza os cards e mantém a contagem regressiva de cada um
// atualizada. Cada card leva pro evento correspondente ao ser tocado.
//
// NÃO usa type="module" (mesma regra do resto do jogo).
// ══════════════════════════════════════════════════════════════════

document.getElementById('voltar').onclick = function () {
  window.location.href = 'menu.html';
};

const grid = document.getElementById('eventosGrid');
let _intervaloCountdowns = null;

function formatarContagem(msRestante) {
  if (msRestante <= 0) return 'ENCERRANDO...';
  const totalMin = Math.floor(msRestante / 60000);
  const dias = Math.floor(totalMin / (60 * 24));
  const horas = Math.floor((totalMin % (60 * 24)) / 60);
  const min = totalMin % 60;
  if (dias > 0) return `ENCERRA EM ${dias}D ${horas}H`;
  if (horas > 0) return `ENCERRA EM ${horas}H ${min}M`;
  return `ENCERRA EM ${min}M`;
}

function renderEstadoVazio() {
  grid.innerHTML = `
    <div class="estado-vazio">
      <div class="icone">◈</div>
      <div class="titulo">NENHUM EVENTO ATIVO</div>
      <div class="texto">Volte em breve — todo mês tem um evento novo com tema, história e modo de jogo diferentes.</div>
    </div>`;
}

function renderCards(eventos, recordes) {
  grid.innerHTML = '';
  eventos.forEach(function (ev) {
    const card = document.createElement('div');
    card.className = 'evento-card';
    card.style.setProperty('--card-cor', ev.cor || '#00ffff');

    const recorde = recordes[ev.id];
    const recordeHtml = recorde
      ? `SEU RECORDE: <b>${String(recorde.score).padStart(6, '0')}</b> · ONDA ${recorde.wave}`
      : 'VOCÊ AINDA NÃO JOGOU';

    card.innerHTML = `
      <div class="evento-top-row">
        <span class="evento-motor-tag">${ev.motor === '3d' ? '3D' : '2D'} · ${ev.mecanica || 'EVENTO'}</span>
        <span class="evento-countdown"><span class="dot"></span><span class="countdown-texto" data-fim="${ev.fim}">${formatarContagem(ev.fim - Date.now())}</span></span>
      </div>
      <div class="evento-tema">${ev.tema || ''}</div>
      <div class="evento-titulo">${ev.titulo || 'EVENTO SEM NOME'}</div>
      <div class="evento-bottom-row">
        <span class="evento-recorde">${recordeHtml}</span>
        <button class="evento-entrar">ENTRAR ▸</button>
      </div>
    `;

    card.onclick = function () {
      window.location.href = 'evento.html?id=' + encodeURIComponent(ev.id);
    };

    grid.appendChild(card);
  });

  // Atualiza os countdowns ao vivo sem re-renderizar os cards inteiros
  if (_intervaloCountdowns) clearInterval(_intervaloCountdowns);
  _intervaloCountdowns = setInterval(function () {
    document.querySelectorAll('.countdown-texto').forEach(function (el) {
      const fim = Number(el.dataset.fim);
      el.textContent = formatarContagem(fim - Date.now());
    });
  }, 30000);
}

async function iniciar() {
  try {
    const eventos = await window.NREventos.carregarEventosAtivos();

    if (!eventos.length) {
      renderEstadoVazio();
      return;
    }

    // Busca o recorde pessoal de cada evento em paralelo (não bloqueia
    // um pelo outro)
    const recordesLista = await Promise.all(
      eventos.map(function (ev) {
        return window.NREventos.meuRecorde(ev.id).catch(function () { return null; });
      })
    );
    const recordes = {};
    eventos.forEach(function (ev, i) { recordes[ev.id] = recordesLista[i]; });

    renderCards(eventos, recordes);
  } catch (e) {
    console.error('Erro ao carregar eventos:', e);
    const detalhe = (e && (e.code || e.message)) ? (e.code || e.message) : 'erro desconhecido';
    grid.innerHTML = `
      <div class="estado-vazio">
        <div class="icone">⚠</div>
        <div class="titulo">FALHA AO CARREGAR</div>
        <div class="texto" style="color:#ff6666;">${detalhe}</div>
      </div>`;
  }
}

iniciar();