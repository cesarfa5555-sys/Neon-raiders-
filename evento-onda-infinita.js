// ══════════════════════════════════════════════════════════════════
// EVENTO-ONDA-INFINITA.JS — hook do modo evento pro motor de jogo
// (boss.js / game-evento.html)
//
// Este arquivo PRECISA carregar ANTES de boss.js. Ele não roda o
// jogo — só prepara duas coisas que o boss.js (com o patch mínimo
// aplicado) vai usar quando window._eventoInfinito for true:
//
//   1. window._eventoInfinito       → liga o "modo sobrevivência"
//      (o patch em boss.js usa essa flag pra nunca disparar a tela
//      de vitória/avanço de campanha quando o boss é derrotado)
//
//   2. window._enviarScoreEvento(resultado) → envia o score final
//      pro placar do evento (NREventos) e injeta o resultado na
//      tela de Game Over já existente, sem duplicar HTML
//
// Sem ?evento= na URL, este arquivo não faz nada — o jogo roda
// exatamente como sempre rodou (partida de campanha normal).
//
// NÃO usa type="module" (mesma regra do resto do jogo).
// ══════════════════════════════════════════════════════════════════

(function () {
  const params = new URLSearchParams(window.location.search);
  const eventoId = params.get('evento');
  if (!eventoId) return;

  window._eventoInfinito = true;
  window._eventoAtivoId = eventoId;

  async function _nomeExibicao() {
    try {
      const { auth } = await window.NRDados._getFirebase();
      if (auth.currentUser) return auth.currentUser.displayName || auth.currentUser.email || 'Piloto';
    } catch (e) {}
    return 'Piloto';
  }

  function _injetarResultadoNaTela(resposta) {
    const overlay = document.getElementById('gameOverScreen');
    if (!overlay || document.getElementById('eventoResultadoBox')) return;

    const box = document.createElement('div');
    box.id = 'eventoResultadoBox';
    box.style.cssText = 'margin-top:14px;padding:12px 14px;border:1.5px solid #ff2d78;border-radius:10px;background:rgba(255,45,120,0.08);width:85%;max-width:320px;text-align:center;';

    const titulo = resposta.enviado
      ? (resposta.novoRecorde ? '🏆 NOVO RECORDE NO EVENTO!' : 'SCORE REGISTRADO NO EVENTO')
      : 'NÃO FOI POSSÍVEL REGISTRAR O SCORE';

    box.innerHTML = `
      <div style="font-family:'Orbitron',monospace;font-size:11px;font-weight:700;letter-spacing:1.5px;color:${resposta.novoRecorde ? '#ffd700' : '#ff2d78'};margin-bottom:10px;">${titulo}</div>
      <button id="btnVerPlacarEvento" style="width:100%;font-family:'Orbitron',monospace;font-size:10px;font-weight:700;letter-spacing:2px;padding:10px;border-radius:8px;cursor:pointer;color:#000;background:#ff2d78;border:none;">◈ VER PLACAR DO EVENTO</button>
    `;
    overlay.appendChild(box);
    document.getElementById('btnVerPlacarEvento').onclick = function () {
      window.location.href = 'evento.html?id=' + encodeURIComponent(eventoId);
    };
  }

  // Chamado pelo patch em boss.js dentro de endGame(), já com os
  // números finais da run prontos — este arquivo só envia e mostra
  window._enviarScoreEvento = async function (resultado) {
    if (!window.NREventos) return;
    try {
      const nome = await _nomeExibicao();
      const resposta = await window.NREventos.enviarScore(eventoId, resultado, nome);
      _injetarResultadoNaTela(resposta);
    } catch (e) {
      console.error('Erro ao enviar score do evento:', e);
      _injetarResultadoNaTela({ enviado: false });
    }
  };
})();