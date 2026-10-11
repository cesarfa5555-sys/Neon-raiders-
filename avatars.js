// ══════════════════════════════════════════════════════════════════
// AVATARS.JS — foto de perfil personalizada
//
// Simplificado a pedido: nada de catálogo de emoji pra desbloquear —
// o avatar do jogador é sempre a foto que ele escolher da galeria, ou
// um ícone padrão genérico se ele ainda não escolheu nenhuma.
//
// Depende de:
//   - window.NRDados.perfilLocal() / salvarPerfil(patch) (campo
//     "fotoPersonalizada", um data URL base64 já recortado/redimensionado
//     pelo perfil-ui.js antes de chegar aqui)
//
// Não usa type="module" (compatibilidade Spck Editor / escopo global).
// Carregar DEPOIS de dados.js e perfil.js/xp.js/level.js.
// ══════════════════════════════════════════════════════════════════

(function () {

  const EMOJI_PADRAO = "🧑‍🚀"; // usado só enquanto o jogador não escolheu nenhuma foto

  function _perfilBranch() {
    const p = (window.NRDados && window.NRDados.perfilLocal && window.NRDados.perfilLocal()) || null;
    return (p && p.perfil) || {};
  }

  function _fotoPersonalizadaUrl() {
    return _perfilBranch().fotoPersonalizada || null;
  }

  function temFotoPersonalizada() {
    return !!_fotoPersonalizadaUrl();
  }

  // Cache da Image() já carregada, pra não recriar/recarregar a cada
  // frame (importante pro loop de moldura animada no hud-profile.js,
  // que redesenha ~10x por segundo)
  let _fotoImgCache = { url: null, img: null };

  function _carregarFotoImg(url) {
    if (_fotoImgCache.url === url && _fotoImgCache.img) return _fotoImgCache.img;
    const img = new Image();
    img.onload = function () {
      // Avisa quem estiver desenhando (HUD, perfil) que já pode
      // redesenhar agora que a imagem terminou de carregar
      window.dispatchEvent(new CustomEvent("nr:avatarEquipado", { detail: {} }));
    };
    img.src = url;
    _fotoImgCache = { url: url, img: img };
    return img;
  }

  // Salva a foto (já recortada/redimensionada pelo chamador)
  async function definirFotoPersonalizada(dataUrl) {
    if (window.NRDados && typeof window.NRDados.salvarPerfil === "function") {
      await window.NRDados.salvarPerfil({ fotoPersonalizada: dataUrl });
    }
    _fotoImgCache = { url: null, img: null }; // força recarregar a imagem nova
    window.dispatchEvent(new CustomEvent("nr:avatarEquipado", { detail: {} }));
  }

  // Remove a foto e volta pro ícone padrão
  async function removerFotoPersonalizada() {
    if (window.NRDados && typeof window.NRDados.salvarPerfil === "function") {
      await window.NRDados.salvarPerfil({ fotoPersonalizada: null });
    }
    _fotoImgCache = { url: null, img: null };
    window.dispatchEvent(new CustomEvent("nr:avatarEquipado", { detail: {} }));
  }

  // ── RENDER (canvas) ──────────────────────────────────────────────
  // Desenha a foto do jogador centralizada num círculo com leve glow.
  // Sem foto escolhida ainda, desenha o ícone padrão genérico no lugar.
  // ctx já deve estar com translate feito, se necessário; aqui usamos
  // coordenadas absolutas (cx, cy) e raio.
  function desenharAvatar(ctx, _avatarIdIgnorado, cx, cy, raio) {
    const url = _fotoPersonalizadaUrl();

    if (url) {
      const img = _carregarFotoImg(url);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, raio, 0, Math.PI * 2);
      ctx.clip();
      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, cx - raio, cy - raio, raio * 2, raio * 2);
      } else {
        ctx.fillStyle = "rgba(15,15,40,0.9)"; // placeholder enquanto carrega
        ctx.fillRect(cx - raio, cy - raio, raio * 2, raio * 2);
      }
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, raio, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#a855f7";
      ctx.stroke();
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, raio, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(cx, cy, raio * 0.2, cx, cy, raio);
    grad.addColorStop(0, "rgba(168,85,247,0.20)");
    grad.addColorStop(1, "rgba(15,15,40,0.9)");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#a855f7";
    ctx.stroke();

    ctx.font = (raio * 1.15) + "px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(EMOJI_PADRAO, cx, cy + raio * 0.05);
    ctx.restore();
  }

  // avatarAtualId() é mantido só por compatibilidade com quem já chama
  // essa função (hud-profile.js) — não representa mais um id de
  // catálogo, é só "tem_foto" ou "padrao"
  function avatarAtualId() {
    return temFotoPersonalizada() ? "foto_personalizada" : "padrao";
  }

  window.NRAvatares = {
    desenharAvatar,
    definirFotoPersonalizada,
    removerFotoPersonalizada,
    temFotoPersonalizada,
    avatarAtualId,
  };
})();
