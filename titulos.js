// ══════════════════════════════════════════════════════════════════
// TITULOS.JS — títulos equipáveis do perfil
//
// Depende de:
//   - window.NRDados.perfilLocal() / salvarPerfil(patch) (campo "tituloId")
//   - window.NRPerfil.getNivel()
//
// Sem type="module" (escopo global, Spck Editor).
// Carregar DEPOIS de dados.js e perfil.js/xp.js/level.js.
// ══════════════════════════════════════════════════════════════════

(function () {

  const TITULOS_DEF = [
    { id: "tit_novato",   nome: "Novato",           requisito: { tipo: "padrao" } },
    { id: "tit_soldado",  nome: "Soldado",          requisito: { tipo: "nivel", valor: 5 } },
    { id: "tit_veterano", nome: "Veterano",         requisito: { tipo: "nivel", valor: 15 } },
    { id: "tit_elite",    nome: "Elite",            requisito: { tipo: "nivel", valor: 25 } },
    { id: "tit_lenda",    nome: "Lenda",            requisito: { tipo: "nivel", valor: 50 } },
    { id: "tit_cacador",  nome: "Caçador de Boss",  requisito: { tipo: "conquista", valor: "nitro_m10" } },
    { id: "tit_mestre",   nome: "Mestre Neon",      requisito: { tipo: "conquista", valor: "nitro_m15" } },
  ];

  function _perfilBranch() {
    const p = (window.NRDados && window.NRDados.perfilLocal && window.NRDados.perfilLocal()) || null;
    return (p && p.perfil) || {};
  }

  function _nivelAtual() {
    try {
      if (window.NRPerfil && typeof window.NRPerfil.getNivel === "function") {
        return window.NRPerfil.getNivel() || 1;
      }
    } catch (e) {}
    return 1;
  }

  function _conquistasDoJogador() {
    const p = (window.NRDados && window.NRDados.perfilLocal && window.NRDados.perfilLocal()) || null;
    return (p && p.conquistas) || {};
  }

  function estaDesbloqueado(def) {
    const r = def.requisito;
    if (!r || r.tipo === "padrao") return true;
    if (r.tipo === "nivel") return _nivelAtual() >= r.valor;
    if (r.tipo === "conquista") return !!_conquistasDoJogador()[r.valor];
    return false;
  }

  function listar() {
    return TITULOS_DEF.map(def => ({ ...def, desbloqueado: estaDesbloqueado(def) }));
  }

  function getDef(id) {
    return TITULOS_DEF.find(t => t.id === id) || TITULOS_DEF[0];
  }

  function tituloAtualId() {
    return _perfilBranch().tituloId || "tit_novato";
  }

  function tituloAtual() {
    return getDef(tituloAtualId());
  }

  async function equipar(id) {
    const def = getDef(id);
    if (!estaDesbloqueado(def)) return { ok: false, motivo: "bloqueado" };
    if (window.NRDados && typeof window.NRDados.salvarPerfil === "function") {
      await window.NRDados.salvarPerfil({ tituloId: id });
    }
    window.dispatchEvent(new CustomEvent("nr:tituloEquipado", { detail: { tituloId: id } }));
    return { ok: true };
  }

  window.NRTitulos = {
    LISTA: TITULOS_DEF,
    listar,
    getDef,
    estaDesbloqueado,
    tituloAtualId,
    tituloAtual,
    equipar,
  };
})();
