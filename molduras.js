// ══════════════════════════════════════════════════════════════════
// MOLDURAS.JS — molduras de perfil (agora usando imagens PNG)
//
// Cada moldura é um arquivo PNG 512x512, fundo transparente, com o
// "buraco" central alinhado a raio=160 (em pixels da imagem original)
// — é esse número que usamos pra escalar a imagem certo em cima de
// qualquer avatar, seja lá qual for o raio pedido em desenharMoldura.
//
// Os arquivos ficam na pasta molduras/ (ex: molduras/bronze.png). Se
// quiser trocar o caminho, é só mudar PASTA_MOLDURAS abaixo.
//
// Depende de:
//   - window.NRDados.perfilLocal() / salvarPerfil(patch) (campo "molduraId")
//   - window.NRPerfil.getNivel()
//
// Sem type="module" (mesmo padrão global do resto do jogo).
// Carregar DEPOIS de dados.js e perfil.js/xp.js/level.js.
// ══════════════════════════════════════════════════════════════════

(function () {

  const PASTA_MOLDURAS = "molduras/";

  // Raio (em pixels da imagem original 512x512) onde fica o "buraco"
  // central de cada PNG — usado pra escalar a imagem certo em cima do
  // avatar, não importa o tamanho pedido em desenharMoldura()
  const RAIO_REFERENCIA_PX = 160;

  const MOLDURAS_DEF = [
    { id: "mold_nenhuma",     nome: "Sem moldura", arquivo: null,             requisito: { tipo: "padrao" } },
    { id: "mold_diamante",    nome: "Diamante",    arquivo: "diamante.png",    requisito: { tipo: "nivel", valor: 12 } },
    { id: "mold_ruby",        nome: "Ruby",        arquivo: "ruby.png",        requisito: { tipo: "nivel", valor: 18 } },
    { id: "mold_cibernetica", nome: "Cibernética", arquivo: "cibernetica.png", requisito: { tipo: "nivel", valor: 24 } },
    { id: "mold_sombria",     nome: "Sombria",     arquivo: "sombria.png",     requisito: { tipo: "nivel", valor: 27 } },
    { id: "mold_imperial",    nome: "Imperial",    arquivo: "imperial.png",    requisito: { tipo: "nivel", valor: 31 } },
    { id: "mold_holografica", nome: "Holográfica", arquivo: "holografica.png", requisito: { tipo: "nivel", valor: 35 } },
    { id: "mold_real",        nome: "Real",        arquivo: "real.png",        requisito: { tipo: "nivel", valor: 40 } },
    { id: "mold_astral",      nome: "Astral",      arquivo: "astral.png",      requisito: { tipo: "nivel", valor: 50 } },
    // Próximas artes entram aqui, mesmo formato: { id, nome, arquivo, requisito }
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

  function estaDesbloqueada(def) {
    const r = def.requisito;
    if (!r || r.tipo === "padrao") return true;
    if (r.tipo === "nivel") return _nivelAtual() >= r.valor;
    if (r.tipo === "conquista") return !!_conquistasDoJogador()[r.valor];
    return false;
  }

  function listar() {
    return MOLDURAS_DEF.map(def => ({ ...def, desbloqueada: estaDesbloqueada(def) }));
  }

  function getDef(id) {
    return MOLDURAS_DEF.find(m => m.id === id) || MOLDURAS_DEF[0];
  }

  function molduraAtualId() {
    return _perfilBranch().molduraId || "mold_nenhuma";
  }

  async function equipar(id) {
    const def = getDef(id);
    if (!estaDesbloqueada(def)) return { ok: false, motivo: "bloqueado" };
    if (window.NRDados && typeof window.NRDados.salvarPerfil === "function") {
      await window.NRDados.salvarPerfil({ molduraId: id });
    }
    window.dispatchEvent(new CustomEvent("nr:molduraEquipada", { detail: { molduraId: id } }));
    return { ok: true };
  }

  // ── Cache de imagens carregadas (uma por arquivo, compartilhada por
  // todo mundo — não é por jogador, então dá pra cachear pra sempre) ──
  const _cacheImagens = {};

  function _carregarImagem(arquivo) {
    if (_cacheImagens[arquivo]) return _cacheImagens[arquivo];
    const img = new Image();
    img.src = PASTA_MOLDURAS + arquivo;
    img.onload = function () {
      window.dispatchEvent(new CustomEvent("nr:molduraEquipada", { detail: {} }));
    };
    _cacheImagens[arquivo] = img;
    return img;
  }

  // Desenha a moldura AO REDOR de um avatar já desenhado em (cx, cy, raioAvatar).
  // "t" não é mais usado (as molduras agora são imagens estáticas, sem
  // animação em canvas) — mantido no parâmetro só por compatibilidade
  // com quem já chama essa função (hud-profile.js, perfil-ui.js).
  function desenharMoldura(ctx, molduraId, cx, cy, raioAvatar, t) {
    const def = getDef(molduraId);
    if (!def || !def.arquivo) return;
    const img = _carregarImagem(def.arquivo);
    if (!img.complete || img.naturalWidth === 0) return; // ainda carregando, pula esse frame

    const escala = raioAvatar / RAIO_REFERENCIA_PX;
    const ladoDesenhado = img.naturalWidth * escala;
    ctx.drawImage(
      img,
      cx - ladoDesenhado / 2,
      cy - ladoDesenhado / 2,
      ladoDesenhado,
      ladoDesenhado
    );
  }

  window.NRMolduras = {
    LISTA: MOLDURAS_DEF,
    listar,
    getDef,
    estaDesbloqueada,
    molduraAtualId,
    equipar,
    desenharMoldura,
  };
})();
