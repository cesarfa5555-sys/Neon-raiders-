// ══════════════════════════════════════════════════════════════════
// RECOMPENSAS.JS — recompensas por nível + sistema de resgate
// Sistema de Perfil / XP / Níveis — Neon Raiders
//
// Depende de: dados.js, perfil.js (carregado antes deste).
// xp.js já chama window.NRRecompensas.verificarNivel(nivel) sozinho
// toda vez que o jogador sobe de nível — não precisa chamar na mão.
//
// Este arquivo NÃO sabe desenhar avatar/moldura/título — quem faz isso
// é avatars.js / molduras.js / titulos.js (feitos pela outra instância
// de Claude). Pra não precisar conhecer o código deles, este arquivo
// só dispara o evento "nr:recompensaResgatada" com o tipo e o valor —
// cada módulo escuta e desbloqueia o que for da sua responsabilidade.
// ══════════════════════════════════════════════════════════════════

(function () {
  // Tabela de recompensas por nível. Totalmente configurável: pra
  // adicionar/mudar uma recompensa, só mexe aqui.
  //
  // "valor" pra tipo "moedas" é um número. Pra qualquer outro tipo é um
  // ID que o módulo dono daquele tipo (avatars.js, molduras.js etc.)
  // vai reconhecer e desbloquear — ajustem os IDs junto com a outra
  // instância se os nomes não baterem.
  const TABELA_RECOMPENSAS = {
    2:  { tipo: "moedas",  valor: 200 },
    3:  { tipo: "moedas",  valor: 500 },
    5:  { tipo: "nave",    valor: "nave_nivel5" },
    8:  { tipo: "avatar",  valor: "avatar_nivel8" },
    10: { tipo: "skin",    valor: "skin_nivel10" },
    15: { tipo: "moldura", valor: "moldura_nivel15" },
    20: { tipo: "arma",    valor: "arma_nivel20" },
    25: { tipo: "titulo",  valor: "titulo_nivel25" },
    30: { tipo: "skin",    valor: "skin_lendaria_nivel30" },
    40: { tipo: "efeito",  valor: "efeito_nivel40" },
    50: { tipo: "nave",    valor: "nave_lendaria_nivel50" }
  };

  // Chamado automaticamente por xp.js quando o jogador sobe de nível.
  // Não entrega a recompensa sozinho (o resgate é manual, como pedido) —
  // só avisa a UI que tem recompensa nova esperando, pra mostrar um
  // indicador/badge no perfil.
  function verificarNivel(nivelNovo) {
    const recompensa = TABELA_RECOMPENSAS[nivelNovo];
    if (!recompensa) return;
    window.dispatchEvent(new CustomEvent("nr:recompensaDisponivel", {
      detail: { nivel: nivelNovo, tipo: recompensa.tipo, valor: recompensa.valor }
    }));
  }

  // Lista todas as recompensas que o jogador já tem nível suficiente
  // pra resgatar mas ainda não resgatou. Útil pra perfil-ui.js montar
  // a lista/badges de "recompensas pendentes".
  async function pendentes() {
    const perfil = await window.NRPerfil.carregar();
    const nivelAtual = window.NRPerfil.getNivel();
    const resgatadas = perfil.recompensasResgatadas || {};
    const lista = [];
    for (const nivelStr in TABELA_RECOMPENSAS) {
      const nivel = Number(nivelStr);
      if (nivelAtual >= nivel && !resgatadas[nivel]) {
        lista.push(Object.assign({ nivel: nivel }, TABELA_RECOMPENSAS[nivel]));
      }
    }
    return lista.sort((a, b) => a.nivel - b.nivel);
  }

  // Resgata a recompensa de um nível específico. Retorna:
  //   { sucesso: true, tipo, valor }   — resgatou agora
  //   { sucesso: false, motivo: "..." } — não deu, com o motivo
  async function resgatar(nivel) {
    const recompensa = TABELA_RECOMPENSAS[nivel];
    if (!recompensa) return { sucesso: false, motivo: "nao_existe" };

    const perfil = await window.NRPerfil.carregar();
    if (window.NRPerfil.getNivel() < nivel) return { sucesso: false, motivo: "nivel_insuficiente" };

    const resgatadas = perfil.recompensasResgatadas || {};
    if (resgatadas[nivel]) return { sucesso: false, motivo: "ja_resgatada" };

    // Aplica o efeito da recompensa
    if (recompensa.tipo === "moedas") {
      // Reaproveita window.ganharMoedas (loja.js) se a página tiver
      // carregado esse script; senão escreve direto no branch
      // progresso, que é onde as moedas já vivem hoje
      if (typeof window.ganharMoedas === "function") {
        window.ganharMoedas(recompensa.valor);
      } else {
        const dados = await window.NRDados.carregarPerfil();
        const moedasAtuais = (dados && dados.progresso && dados.progresso.moedas) || 0;
        await window.NRDados.salvarProgresso({ moedas: moedasAtuais + recompensa.valor });
      }
    } else {
      // Pra nave/avatar/skin/moldura/arma/titulo/efeito: quem
      // desbloqueia de fato é o módulo dono daquele tipo, escutando
      // este evento — este arquivo só avisa, não decide o formato
      // interno de cada um deles
      window.dispatchEvent(new CustomEvent("nr:recompensaResgatada", {
        detail: { nivel: nivel, tipo: recompensa.tipo, valor: recompensa.valor }
      }));
    }

    // Marca como resgatada (uma vez só, pra sempre) e salva
    resgatadas[nivel] = true;
    await window.NRPerfil.salvar({ recompensasResgatadas: resgatadas });

    return { sucesso: true, tipo: recompensa.tipo, valor: recompensa.valor };
  }

  window.NRRecompensas = {
    TABELA: TABELA_RECOMPENSAS,
    verificarNivel: verificarNivel,
    pendentes: pendentes,
    resgatar: resgatar
  };
})();
