// ══════════════════════════════════════════════════════════════════
// EVENTO.JS — lobby de um evento específico (evento.html?id=...)
//
// Versão com diagnóstico visível: cada etapa atualiza o texto na tela
// e tem um limite de tempo. Se travar, a própria tela mostra QUAL
// etapa não respondeu — sem precisar abrir o console do navegador.
// ══════════════════════════════════════════════════════════════════

document.getElementById('voltar').onclick = function () {
  window.location.href = 'eventos.html';
};

const params = new URLSearchParams(window.location.search);
const eventoId = params.get('id');
const elTema = document.getElementById('tema');
const elTitulo = document.getElementById('titulo');

function formatarContagem(msRestante) {
  if (msRestante <= 0) return 'ENCERRADO';
  const totalMin = Math.floor(msRestante / 60000);
  const dias = Math.floor(totalMin / (60 * 24));
  const horas = Math.floor((totalMin % (60 * 24)) / 60);
  const min = totalMin % 60;
  if (dias > 0) return `ENCERRA EM ${dias}D ${horas}H`;
  if (horas > 0) return `ENCERRA EM ${horas}H ${min}M`;
  return `ENCERRA EM ${min}M`;
}

function renderPlacar(lista, meuUid) {
  const el = document.getElementById('placarLista');
  if (!lista.length) {
    el.innerHTML = '<div class="estado-vazio-mini">Ninguém pontuou ainda — seja o primeiro!</div>';
    return;
  }
  el.innerHTML = lista.map(function (entrada, i) {
    const pos = i + 1;
    const classes = ['placar-linha'];
    if (pos === 1) classes.push('top1');
    else if (pos === 2) classes.push('top2');
    else if (pos === 3) classes.push('top3');
    if (entrada.uid === meuUid) classes.push('eu');
    const medalha = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : pos;
    return `
      <div class="${classes.join(' ')}">
        <div class="placar-pos">${medalha}</div>
        <div class="placar-nome">${String(entrada.nome || 'Piloto').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>
        <div class="placar-score">${String(entrada.score).padStart(6, '0')}</div>
      </div>`;
  }).join('');
}

// Roda uma promessa com um prazo — se estourar o tempo, rejeita com
// uma mensagem explicando QUAL etapa travou, em vez de ficar girando
// pra sempre
function comPrazo(promessa, rotulo, segundos) {
  return Promise.race([
    promessa,
    new Promise(function (_, reject) {
      setTimeout(function () {
        reject(new Error('TRAVOU EM: ' + rotulo + ' (mais de ' + segundos + 's sem resposta)'));
      }, segundos * 1000);
    })
  ]);
}

function mostrarErro(mensagem) {
  elTitulo.textContent = 'ERRO';
  elTema.textContent = mensagem;
  elTema.style.color = '#ff4444';
}

async function iniciar() {
  // ── Checagem 0: os scripts base carregaram? ──
  if (typeof window.NRDados === 'undefined') {
    mostrarErro('dados.js NÃO CARREGOU (verifique se o arquivo está na pasta certa)');
    return;
  }
  if (typeof window.NREventos === 'undefined') {
    mostrarErro('eventos-dados.js NÃO CARREGOU (verifique se o arquivo está na pasta certa)');
    return;
  }

  if (!eventoId) {
    elTitulo.textContent = 'EVENTO NÃO ENCONTRADO';
    elTema.textContent = 'NENHUM ?id= NA URL';
    document.getElementById('countdown').textContent = '—';
    return;
  }

  elTema.textContent = 'CONECTANDO AO FIREBASE...';

  try {
    // ── Etapa 1: config do evento ──
    const config = await comPrazo(window.NREventos.carregarEvento(eventoId), 'carregar config do evento', 10);
    if (!config) {
      document.getElementById('titulo').textContent = 'EVENTO NÃO ENCONTRADO';
      document.getElementById('tema').textContent = 'ID NÃO EXISTE NO BANCO: ' + eventoId;
      return;
    }

    document.documentElement.style.setProperty('--cor-evento', config.cor || '#ff2d78');
    elTema.style.color = '';
    document.getElementById('tema').textContent = config.tema || '';
    document.getElementById('titulo').textContent = config.titulo || 'EVENTO';
    document.getElementById('headerMotor').textContent = (config.motor === '3d' ? '3D' : '2D') + ' · ' + (config.mecanica || 'EVENTO');
    document.getElementById('countdown').textContent = formatarContagem(config.fim - Date.now());

    document.getElementById('btnJogar').onclick = function () {
      const mapa = config.mapaBase || 1;
      const nivel = config.nivelReferencia || 6;
      const motor = config.motor === '3d' ? 'game3d-evento.html' : 'game-evento.html';
      window.location.href = `${motor}?evento=${encodeURIComponent(eventoId)}&mapa=${mapa}&nivel=${nivel}`;
    };

    // ── Etapa 2: uid do jogador logado ──
    document.getElementById('placarLista').innerHTML = '<div class="estado-vazio-mini">Verificando login...</div>';
    const uid = await comPrazo(window.NRDados.uid(), 'verificar login (uid)', 10).catch(function (e) {
      console.error(e);
      return null; // sem uid não é fatal, só não destaca "sua linha" no placar
    });

    // ── Etapa 3: recorde pessoal + placar ──
    document.getElementById('placarLista').innerHTML = '<div class="estado-vazio-mini">Carregando placar...</div>';
    const [recorde, placar] = await Promise.all([
      comPrazo(window.NREventos.meuRecorde(eventoId), 'carregar recorde pessoal', 10).catch(function (e) { console.error(e); return null; }),
      comPrazo(window.NREventos.carregarPlacar(eventoId, 20), 'carregar placar', 10).catch(function (e) { console.error(e); return []; })
    ]);

    document.getElementById('statMelhorScore').textContent = recorde ? String(recorde.score).padStart(6, '0') : '—';
    document.getElementById('statMelhorWave').textContent = recorde ? recorde.wave : '—';

    renderPlacar(placar, uid);

    setInterval(function () {
      document.getElementById('countdown').textContent = formatarContagem(config.fim - Date.now());
    }, 30000);

  } catch (e) {
    console.error('Erro ao carregar evento:', e);
    mostrarErro(e && e.message ? e.message : 'ERRO DESCONHECIDO — veja o console');
  }
}

iniciar();