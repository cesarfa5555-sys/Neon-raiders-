// ══════════════════════════════════════════════════════════════════
// CONQUISTAS-PERFIL.JS — extensão do sistema de conquistas existente
//
// Por que um arquivo separado em vez de editar conquistas.js direto:
// pra garantir 100% que as categorias "nitro" e "score" (e a lógica
// delas, com jogador/db) não são tocadas por engano. Este arquivo só
// ADICIONA itens novos à lista que já existe (window.ConquistasNR.LISTA)
// e usa o caminho novo (NRDados.desbloquearConquista), sem duplicar
// nada do sistema antigo.
//
// Carregar DEPOIS de: dados.js, conquistas.js (o antigo, que cria
// window.ConquistasNR), perfil.js/xp.js/level.js (que disparam
// "nr:levelup").
//
// A UI de conquistas (conquistas-2.html) já itera CONQUISTAS_DEF pelo
// window.ConquistasNR.LISTA — como aqui só damos .push() nela, os cards
// novos aparecem automaticamente. Só falta (fora do meu escopo, é HTML)
// adicionar um botão de filtro pra categoria "perfil" em conquistas-2.html
// se você quiser um filtro dedicado — sem isso, os itens aparecem em
// "Todas"/"Desbloqueadas" normalmente.
//
// CORRIGIDO (após checar login.html/perfilPadrao): verificarEstatisticas
// agora espera os nomes reais do branch estatisticas (totalKills,
// totalBosses), não os nomes inventados (inimigosTotal, bossesTotal)
// que não existem em lugar nenhum do jogo.
// ══════════════════════════════════════════════════════════════════

(function () {
  if (!window.ConquistasNR) {
    console.warn("[ConquistasPerfil] window.ConquistasNR não encontrado — carregue conquistas.js antes.");
    return;
  }

  const NOVAS_CONQUISTAS = [
    { id: "perfil_nivel10", categoria: "perfil", icone: "🔟", titulo: "Ascensão",        descricao: "Alcance o nível 10.", segredo: false },
    { id: "perfil_nivel20", categoria: "perfil", icone: "🚀", titulo: "Piloto Experiente", descricao: "Alcance o nível 20.", segredo: false },
    { id: "perfil_nivel50", categoria: "perfil", icone: "👑", titulo: "Lenda Neon",       descricao: "Alcance o nível 50.", segredo: false },
    { id: "perfil_1000kill", categoria: "perfil", icone: "💥", titulo: "Exterminador",   descricao: "Elimine 1.000 inimigos no total.", segredo: false },
    { id: "perfil_100boss",  categoria: "perfil", icone: "🐲", titulo: "Caçador Lendário", descricao: "Derrote 100 bosses no total.", segredo: true },
    { id: "perfil_colecionador", categoria: "perfil", icone: "🎒", titulo: "Colecionador", descricao: "Desbloqueie 5 avatares, molduras ou títulos.", segredo: false },
  ];

  // Evita duplicar caso este script seja carregado mais de uma vez
  NOVAS_CONQUISTAS.forEach(def => {
    if (!window.ConquistasNR.LISTA.some(c => c.id === def.id)) {
      window.ConquistasNR.LISTA.push(def);
    }
  });

  // ── Desbloqueio (caminho novo: usuarios/{uid}/conquistas/{id}) ────
  // Dispara "nr:conquistaDesbloqueada" pro animations.js cuidar do
  // efeito visual — este arquivo não desenha nada na tela.
  async function _desbloquear(id) {
    if (!window.NRDados || typeof window.NRDados.desbloquearConquista !== "function") return;
    const def = NOVAS_CONQUISTAS.find(c => c.id === id);
    if (!def) return;
    const foiNovo = await window.NRDados.desbloquearConquista(id);
    if (foiNovo) {
      window.dispatchEvent(new CustomEvent("nr:conquistaDesbloqueada", { detail: { conquista: def } }));
    }
  }

  // ── Gatilho automático: níveis ─────────────────────────────────────
  // Não precisa de nenhuma chamada manual — escuta o evento que o
  // núcleo (perfil.js/level.js) já dispara a cada level up.
  window.addEventListener("nr:levelup", (e) => {
    const nivel = e && e.detail && e.detail.nivelNovo;
    if (!nivel) return;
    if (nivel >= 10) _desbloquear("perfil_nivel10");
    if (nivel >= 20) _desbloquear("perfil_nivel20");
    if (nivel >= 50) _desbloquear("perfil_nivel50");
  });

  // ── Gatilho automático: avatar/moldura/título equipado ────────────
  // Conta quantos itens (fora os "padrao") o jogador já desbloqueou,
  // pra conquista "Colecionador".
  function _contarDesbloqueados() {
    let total = 0;
    try { total += (window.NRAvatares ? window.NRAvatares.listar() : []).filter(a => a.desbloqueado && a.requisito.tipo !== "padrao").length; } catch (e) {}
    try { total += (window.NRMolduras ? window.NRMolduras.listar() : []).filter(m => m.desbloqueada && m.requisito.tipo !== "padrao").length; } catch (e) {}
    try { total += (window.NRTitulos ? window.NRTitulos.listar() : []).filter(t => t.desbloqueado && t.requisito.tipo !== "padrao").length; } catch (e) {}
    return total;
  }
  window.addEventListener("nr:levelup", () => {
    if (_contarDesbloqueados() >= 5) _desbloquear("perfil_colecionador");
  });

  // ── Gatilho manual: estatísticas de partida ───────────────────────
  // Chame isso de onde as estatísticas de kills/bosses já são
  // atualizadas (o mesmo lugar que dispara as missões do NITRO em
  // boss.js/loja.js) — não mexi nesses arquivos, então é só plugar:
  //   window.NRConquistasPerfil.verificarEstatisticas({ totalKills, totalBosses })
  // Os nomes batem com o branch estatisticas real (usuarios/{uid}/estatisticas),
  // criado desde o cadastro em login.html.
  function verificarEstatisticas(stats) {
    if (!stats) return;
    if (stats.totalKills >= 1000) _desbloquear("perfil_1000kill");
    if (stats.totalBosses >= 100) _desbloquear("perfil_100boss");
  }

  window.NRConquistasPerfil = {
    LISTA: NOVAS_CONQUISTAS,
    verificarEstatisticas,
  };
})();
