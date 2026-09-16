// ══════════════════════════════════════════════════════════════════
// PERFIL.JS — estado do perfil do jogador
// Sistema de Perfil / XP / Níveis — Neon Raiders
//
// IMPORTANTE (corrigido após checar login.html): nível e XP NÃO ficam
// aqui — eles já existem em usuarios/{uid}/progresso/{nivel,xp}, criados
// desde o cadastro (login.html) exatamente pra essa finalidade. Este
// arquivo só cuida do que é realmente novo: avatar/moldura/título
// equipados e quais recompensas por nível já foram resgatadas — tudo
// isso sim é um branch novo, usuarios/{uid}/perfil, sem conflito com
// nada existente.
//
// getNivel()/getXP()/getXpProximoNivel() ficam AQUI (não em xp.js/
// level.js) só por conveniência de import — mas leem do branch
// "progresso", não do branch "perfil". Isso é transparente pra quem
// chama: avatars.js/molduras.js/titulos.js/hud-profile.js/perfil-ui.js
// não precisam saber de qual branch veio o número.
//
// Ponte com o Firebase via dados.js: window.NRDados.salvarPerfil grava
// em usuarios/{uid}/perfil (avatarId/molduraId/tituloId/recompensasResgatadas).
//
// Carregar DEPOIS de dados.js e level.js, e ANTES de xp.js,
// recompensas.js, avatars.js, molduras.js, titulos.js, perfil-ui.js,
// hud-profile.js.
// ══════════════════════════════════════════════════════════════════

(function () {
  // Valores padrão só dos campos cosméticos deste branch — nivel/xp
  // NÃO entram aqui, eles vivem em progresso (ver comentário acima)
  const PADRAO = {
    avatarId: "padrao",
    molduraId: "bronze",
    tituloId: "novato",
    recompensasResgatadas: {} // ex: { "2": true, "5": true } = já resgatou nível 2 e 5
  };

  let _cache = null;

  // Carrega o branch "perfil" (Firebase na primeira vez, cache depois).
  // Sempre mescla com PADRAO pra garantir que todo campo exista mesmo
  // que a conta seja antiga e ainda não tenha esse branch salvo.
  async function carregar(forcarRecarregar) {
    if (_cache && !forcarRecarregar) return _cache;
    const dadosCompletos = await window.NRDados.carregarPerfil(forcarRecarregar);
    const perfilSalvo = (dadosCompletos && dadosCompletos.perfil) || {};
    _cache = Object.assign({}, PADRAO, perfilSalvo);
    return _cache;
  }

  // Versão síncrona (sem esperar rede) do branch cosmético, pra HUD
  // renderizar de primeira usando o cache local que dados.js já mantém
  function local() {
    if (_cache) return _cache;
    const d = window.NRDados.perfilLocal();
    return Object.assign({}, PADRAO, (d && d.perfil) || {});
  }

  // Atualiza parcialmente o branch cosmético (avatarId, molduraId,
  // tituloId ou recompensasResgatadas) e salva no Firebase
  async function salvar(patch) {
    if (!_cache) await carregar();
    Object.assign(_cache, patch);
    return window.NRDados.salvarPerfil(patch);
  }

  // ── Nível / XP (leem de progresso, não de perfil) ─────────────────
  // Síncronas de propósito: avatars.js/molduras.js/titulos.js/
  // hud-profile.js/perfil-ui.js chamam essas funções sem await, então
  // elas trabalham em cima do cache local que dados.js já mantém.
  function _progressoLocal() {
    const d = window.NRDados.perfilLocal();
    return (d && d.progresso) || {};
  }

  function getNivel() {
    return _progressoLocal().nivel || 1;
  }

  function getXP() {
    return _progressoLocal().xp || 0;
  }

  function getXpProximoNivel() {
    return window.NRLevel.xpParaProximoNivel(getNivel());
  }

  window.NRPerfil = {
    carregar: carregar,
    local: local,
    salvar: salvar,
    PADRAO: PADRAO,
    getNivel: getNivel,
    getXP: getXP,
    getXpProximoNivel: getXpProximoNivel
  };
})();
