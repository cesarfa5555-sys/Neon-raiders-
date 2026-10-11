// ══════════════════════════════════════════════════════════════════
// CONFIG-SERVIDOR.JS — endereço do servidor multiplayer, em UM lugar só.
// Carregado por menu.html, multiplayer.html e game3d.html ANTES dos outros scripts.
//
// COMO TROCAR DE REGIÃO (2 passos):
//   1) O endereço do Virginia já está preenchido em NR_SERVIDORES.virginia.
//   2) Mude NR_REGIAO abaixo: 'virginia' (servidor perto) ou 'oregon' (para voltar). Só isso.
//
// IMPORTANTE: todo mundo precisa estar no MESMO servidor (a sala só existe onde foi criada).
// Por isso a escolha fica aqui, no arquivo do jogo, e vale para todos os jogadores.
// ══════════════════════════════════════════════════════════════════

// Endereços dos servidores (sempre começando com wss://, sem barra no final)
window.NR_SERVIDORES = {
  oregon:   'wss://neon-raiders-servidor-1.onrender.com',
  virginia: 'wss://neon-raiders-servidor-2.onrender.com'   // Virginia (serviço novo)
};

// Qual servidor o jogo usa agora: 'oregon' ou 'virginia'
window.NR_REGIAO = 'virginia';

// ── (daqui para baixo não precisa mexer) ──────────────────────────
// Rede de segurança: se a região escolhida ainda estiver com o endereço de exemplo, volta para Oregon
// em vez de quebrar o multiplayer.
(function () {
  var s = window.NR_SERVIDORES, escolhido = s[window.NR_REGIAO];
  if (!escolhido || /COLOQUE/i.test(escolhido)) {
    if (window.console) console.warn('[config-servidor] endereço de "' + window.NR_REGIAO + '" não preenchido — usando Oregon.');
    escolhido = s.oregon; window.NR_REGIAO = 'oregon';
  }
  window.NR_SERVIDOR = escolhido;
  // Mesmo endereço, mas em HTTP (usado para acordar o servidor e medir o ping do menu)
  window.NR_SERVIDOR_HTTP = escolhido.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
})();
