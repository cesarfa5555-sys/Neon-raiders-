// ══════════════════════════════════════════════════════════════════
// LEVEL.JS — curva de XP e cálculo de nível
// Sistema de Perfil / XP / Níveis — Neon Raiders
//
// Responsabilidade única deste arquivo: matemática pura da progressão
// de nível. Não mexe em Firebase, não mexe em DOM, não sabe de HUD —
// só calcula números. Isso deixa fácil rebalancear a curva inteira do
// jogo no futuro sem tocar em nenhum outro arquivo.
//
// NÃO usa type="module" (mesma regra do resto do jogo — Spck Editor
// precisa de tudo em escopo global via window).
// ══════════════════════════════════════════════════════════════════

(function () {
  // ── CURVA DE XP ───────────────────────────────────────────────────
  // xpParaProximoNivel(n) = XP_A*n² + XP_B*n + XP_C
  //
  // Essas 3 constantes foram ajustadas pra bater com a tabela original
  // pedida:
  //   nível 1 → 50 XP   nível 2 → 80 XP   nível 3 → 120 XP
  //   nível 4 → 170 XP  nível 5 → 240 XP (fórmula dá 230, bem próximo)
  //
  // Pra rebalancear a progressão inteira do jogo (deixar mais fácil ou
  // mais difícil de subir de nível), só mude essas 3 constantes — não
  // precisa mexer em mais nada.
  const XP_A = 5;
  const XP_B = 15;
  const XP_C = 30;

  const NIVEL_MAXIMO = 50; // trava de segurança; aumente se quiser mais níveis

  // Quanto de XP falta para sair do "nivelAtual" e ir pro próximo
  function xpParaProximoNivel(nivelAtual) {
    const n = Math.min(Math.max(nivelAtual, 1), NIVEL_MAXIMO);
    return Math.round(XP_A * n * n + XP_B * n + XP_C);
  }

  // Dado um XP TOTAL acumulado desde sempre, descobre em que nível o
  // jogador estaria e quanto XP sobra dentro do nível atual.
  // Não é usado no fluxo normal (que é incremental via xp.js), mas fica
  // disponível caso precisemos recalcular tudo do zero algum dia
  // (ex: migração de dados, correção de bug de XP).
  function calcularDeXpTotal(xpTotal) {
    let nivel = 1;
    let restante = xpTotal;
    while (nivel < NIVEL_MAXIMO && restante >= xpParaProximoNivel(nivel)) {
      restante -= xpParaProximoNivel(nivel);
      nivel++;
    }
    return {
      nivel: nivel,
      xpAtual: restante,
      xpProximoNivel: xpParaProximoNivel(nivel)
    };
  }

  window.NRLevel = {
    xpParaProximoNivel: xpParaProximoNivel,
    calcularDeXpTotal: calcularDeXpTotal,
    NIVEL_MAXIMO: NIVEL_MAXIMO
  };
})();
