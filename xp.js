// ══════════════════════════════════════════════════════════════════
// XP.JS — valores de XP por ação + lógica de ganho de XP
// Sistema de Perfil / XP / Níveis — Neon Raiders
//
// Depende de: level.js (curva de XP) e perfil.js (estado do perfil).
// Carregar DEPOIS desses dois e depois de dados.js.
//
// Dispara os eventos "nr:xpganho" e "nr:levelup" no window — quem cuida
// de HUD/animações (hud-profile.js, animations.js) escuta esses eventos
// em vez de chamar isso daqui diretamente. Contrato combinado entre as
// duas partes do sistema, então não mude os nomes/formato sem avisar.
// ══════════════════════════════════════════════════════════════════

(function () {
  // Tabela de XP por ação/evento do jogo.
  // Pra rebalancear quanto XP cada coisa dá, só mude os números aqui —
  // nada mais no sistema precisa mudar.
  const XP_VALORES = {
    inimigoComum: 5,
    elite: 20,
    miniBoss: 50,
    boss: 100,
    faseCompleta: 50,
    missaoDiaria: 30,
    evento: 100
  };

  // ganharXP aceita:
  //   - uma chave de XP_VALORES, ex: ganharXP("boss")
  //   - ou um número direto, ex: ganharXP(37)
  // Retorna { xpAtual, nivel, subiuDeNivel } depois de salvar no Firebase.
  async function ganharXP(origemOuQuantidade, opcoes) {
    const quantidade = typeof origemOuQuantidade === "number"
      ? origemOuQuantidade
      : (XP_VALORES[origemOuQuantidade] || 0);

    if (quantidade <= 0) return null;

    // Posição de tela (x,y em pixels) de onde o XP foi ganho — ex: onde
    // o inimigo morreu. Opcional: sem isso, quem escuta o evento usa
    // uma posição padrão própria.
    const posicao = (opcoes && typeof opcoes.x === "number" && typeof opcoes.y === "number")
      ? { x: opcoes.x, y: opcoes.y }
      : null;

    // nivel/xp vivem em usuarios/{uid}/progresso (criados desde o
    // cadastro em login.html) — não no branch novo "perfil"
    const dadosCompletos = await window.NRDados.carregarPerfil();
    const progresso = (dadosCompletos && dadosCompletos.progresso) || {};
    let xp = (progresso.xp || 0) + quantidade;
    let nivel = progresso.nivel || 1;
    let subiuDeNivel = false;

    // Loop, não "if" — um ganho grande (ex: recompensa de evento) pode
    // fazer o jogador subir mais de um nível de uma vez só
    while (nivel < window.NRLevel.NIVEL_MAXIMO && xp >= window.NRLevel.xpParaProximoNivel(nivel)) {
      xp -= window.NRLevel.xpParaProximoNivel(nivel);
      nivel++;
      subiuDeNivel = true;
    }

    // Salva os dois campos juntos numa única escrita no Firebase
    await window.NRDados.salvarProgresso({ xp: xp, nivel: nivel });

    window.dispatchEvent(new CustomEvent("nr:xpganho", {
      detail: { ganho: quantidade, xpAtual: xp, nivel: nivel, posicao: posicao }
    }));

    if (subiuDeNivel) {
      window.dispatchEvent(new CustomEvent("nr:levelup", {
        detail: { nivelNovo: nivel }
      }));
      // Se o módulo de recompensas (Bloco 2) já estiver carregado,
      // avisa ele que subiu de nível pra verificar recompensa liberada.
      // Guardado atrás de typeof pra não quebrar se recompensas.js
      // ainda não tiver sido carregado nessa página.
      if (window.NRRecompensas && typeof window.NRRecompensas.verificarNivel === "function") {
        window.NRRecompensas.verificarNivel(nivel);
      }
    }

    return { xpAtual: xp, nivel: nivel, subiuDeNivel: subiuDeNivel };
  }

  window.NRXP = {
    VALORES: XP_VALORES,
    ganharXP: ganharXP
  };
})();
