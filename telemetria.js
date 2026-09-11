// ════════════════════════════════════════════════════════════════
// TELEMETRIA.JS — manda o estado da partida pro Firebase (pro painel
// de espectador/admin) e escuta comandos de kick/ban em tempo real.
//
// Só funciona se as regras novas do banco (telemetria/, moderacao/,
// admins/) já tiverem sido aplicadas no console do Firebase — ver
// database.rules.json.
//
// COMO É OTIMIZADO (não pesa no jogo nem no tráfego):
//   - Escreve no banco no MÁXIMO a cada INTERVALO_ENVIO_MS (1.5s) —
//     não a cada frame. boss3d.js pode chamar enviar() todo frame
//     sem problema, o throttle é feito AQUI dentro.
//   - Cada escrita é "fire-and-forget" (não espera resposta antes de
//     continuar o jogo) — se a rede estiver ruim/caiu, o jogo não
//     trava nem engasga esperando o Firebase.
//   - Payload é só números/textos curtos (não manda canvas, vídeo,
//     nem a cena 3D inteira) — o radar simplificado manda só um
//     array de [x, altura, hp] de cada inimigo visível, arredondado.
//   - onDisconnect().remove() limpa a entrada sozinho se o jogador
//     fechar o app/perder conexão — o painel nunca mostra "jogador
//     fantasma" que já saiu.
//
// NÃO usa type="module" (mesma regra do resto do jogo — Spck precisa
// de escopo global). NÃO abre conexão própria com o Firebase — recebe
// a conexão (db/dbMod) e o uid já prontos de quem chamar iniciar(),
// reaproveitando a mesma sessão que o jogo (boss3d.js/boss3d-evento.js)
// já tem aberta, em vez de abrir uma segunda conexão à toa.
// ════════════════════════════════════════════════════════════════

(function () {
  const INTERVALO_ENVIO_MS = 1500; // taxa de atualização do painel — suficiente pra acompanhar humano vendo, sem gastar tráfego à toa

  let _db = null, _dbMod = null, _uid = null, _refAtivo = null;
  let _pronto = false;
  let _ultimoEnvio = 0;
  let _encerrado = false;
  let _ultimaLatenciaMs = null;

  // Inicializa a telemetria pra essa sessão de partida. Chama uma vez
  // só, DEPOIS que o boss3d.js/boss3d-evento.js já confirmou o login
  // (dentro de ligarFirebase(), logo depois de "firebaseUid = uid") —
  // reaproveita a MESMA conexão que o jogo já abriu com o Firebase, em
  // vez de abrir uma segunda conexão própria.
  function iniciar(db, dbMod, uid) {
    try {
      _db = db; _dbMod = dbMod; _uid = uid;
      _refAtivo = dbMod.ref(db, 'telemetria/ativos/' + uid);

      // Se a conexão cair (fechar app, perder rede, matar o processo),
      // o próprio Firebase remove essa entrada sozinho — sem precisar
      // de um "heartbeat" ou timeout manual do lado do painel.
      dbMod.onDisconnect(_refAtivo).remove();

      _pronto = true;
      _escutarModeracao();
    } catch (e) {
      console.error('[telemetria] não consegui iniciar:', e);
      // Falha aqui NUNCA deve impedir o jogo de rodar normal — só a
      // telemetria/moderação em tempo real que fica indisponível.
    }
  }

  // Chamado (pode ser todo frame, sem medo) pelo jogo com o estado
  // atual — só escreve de verdade no banco a cada INTERVALO_ENVIO_MS.
  function enviar(dados) {
    if (!_pronto || _encerrado) return;
    const agora = Date.now();
    if (agora - _ultimoEnvio < INTERVALO_ENVIO_MS) return;
    _ultimoEnvio = agora;

    const payload = Object.assign({}, dados, {
      atualizadoEm: agora,
      ping: _ultimaLatenciaMs, // mede o round-trip da MESMA escrita, ver abaixo — sem gasto extra
    });

    const t0 = performance.now();
    _dbMod.set(_refAtivo, payload)
      .then(() => { _ultimaLatenciaMs = Math.round(performance.now() - t0); })
      .catch(() => { /* melhor esforço — se falhar, só não atualiza dessa vez */ });
  }

  // Chamado quando a partida termina normalmente (vitória/derrota) —
  // tira a entrada do painel na hora, sem esperar o onDisconnect.
  function encerrar() {
    _encerrado = true;
    if (_refAtivo && _dbMod) {
      _dbMod.remove(_refAtivo).catch(() => {});
    }
  }

  // ── KICK/BAN EM TEMPO REAL ────────────────────────────────────────
  function _escutarModeracao() {
    const refMod = _dbMod.ref(_db, 'moderacao/' + _uid);
    _dbMod.onValue(refMod, (snap) => {
      if (!snap.exists()) return;
      const dado = snap.val();
      if (!dado || (dado.tipo !== 'kick' && dado.tipo !== 'ban')) return;
      _mostrarTelaModeracao(dado.tipo, dado.motivo || '');
      // Apaga o comando depois de aplicado, senão ele "dispara nulo"
      // de novo se o jogador voltar a jogar mais tarde (kick é só
      // daquela sessão, não deve persistir)
      _dbMod.remove(refMod).catch(() => {});
    });
  }

  function _mostrarTelaModeracao(tipo, motivo) {
    encerrar();
    if (typeof window.pausarJogoPorModeracao === 'function') {
      try { window.pausarJogoPorModeracao(); } catch (e) {}
    }

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(5,5,16,0.97);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;font-family:monospace;color:#ff4466;text-align:center;padding:28px;';

    const icone = document.createElement('div');
    icone.style.fontSize = '42px';
    icone.textContent = '🚫';

    const titulo = document.createElement('div');
    titulo.style.cssText = 'font-size:15px;font-weight:bold;letter-spacing:2px;';
    titulo.textContent = tipo === 'ban' ? 'SUA CONTA FOI BANIDA' : 'VOCÊ FOI REMOVIDO DA PARTIDA';

    overlay.appendChild(icone);
    overlay.appendChild(titulo);

    if (motivo) {
      const motivoEl = document.createElement('div');
      motivoEl.style.cssText = 'font-size:12px;color:#ffffff88;max-width:320px;line-height:1.5;';
      motivoEl.textContent = motivo; // textContent, não innerHTML — nunca interpreta o texto do admin como HTML
      overlay.appendChild(motivoEl);
    }

    const btn = document.createElement('button');
    btn.style.cssText = 'margin-top:10px;padding:11px 26px;border-radius:8px;border:1px solid #ff4466;background:rgba(255,68,102,0.12);color:#ff4466;font-family:monospace;font-size:12px;letter-spacing:1px;';
    btn.textContent = 'VOLTAR AO MENU';
    btn.onclick = () => { window.location.href = 'menu.html'; };
    overlay.appendChild(btn);

    document.body.appendChild(overlay);
  }

  window.NRTelemetria = { iniciar, enviar, encerrar };
})();
