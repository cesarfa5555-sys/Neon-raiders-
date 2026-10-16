// ══════════════════════════════════════════════════════════════════
// ANIMATIONS.JS — animações de progressão (level up, XP, recompensas,
// desbloqueio de avatar/moldura/título/conquista)
//
// Escuta sozinho os eventos do núcleo:
//   "nr:xpganho"            {detail:{ganho, xpAtual, nivel, posicao}}
//   "nr:levelup"            {detail:{nivelNovo}}
//   "nr:conquistaDesbloqueada" {detail:{conquista}}   (de conquistas-perfil.js)
//   "nr:avatarEquipado" / "nr:molduraEquipada" / "nr:tituloEquipado"
//
// Não precisa ser chamado manualmente na maior parte do tempo — só
// expõe window.NRAnimacoes.mostrarRecompensa(...) pra quando
// recompensas.js (núcleo) quiser disparar a animação de "recompensa
// recebida" explicitamente.
//
// Sem type="module". Carregar depois de avatars.js/molduras.js/
// titulos.js/conquistas-perfil.js (opcional, mas evita corrida ao
// checar desbloqueios novos por nível).
// ══════════════════════════════════════════════════════════════════

(function () {

  // ── injeta estilos uma única vez ──────────────────────────────────
  function _injetarEstilos() {
    if (document.getElementById("nr-anim-styles")) return;
    const style = document.createElement("style");
    style.id = "nr-anim-styles";
    style.textContent = `
      @keyframes nrToastIn { from{opacity:0;transform:translateX(40px);} to{opacity:1;transform:translateX(0);} }
      @keyframes nrToastOut { from{opacity:1;transform:translateX(0);} to{opacity:0;transform:translateX(40px);} }
      @keyframes nrFloatUp { 0%{opacity:0;transform:translateY(0) scale(0.8);} 15%{opacity:1;transform:translateY(-6px) scale(1.05);} 100%{opacity:0;transform:translateY(-46px) scale(1);} }
      @keyframes nrLevelUpIn { 0%{opacity:0;transform:scale(0.6);} 55%{opacity:1;transform:scale(1.08);} 75%{transform:scale(0.97);} 100%{opacity:1;transform:scale(1);} }
      @keyframes nrLevelUpOut { from{opacity:1;transform:scale(1);} to{opacity:0;transform:scale(0.9);} }
      @keyframes nrRingExpand { from{transform:scale(0.3);opacity:0.9;} to{transform:scale(2.4);opacity:0;} }
      .nr-toast {
        background:linear-gradient(135deg,#0d0d1a,#1a0a2e);
        border:1px solid #a855f7; border-left:4px solid #a855f7; border-radius:10px;
        padding:14px 18px; display:flex; align-items:center; gap:12px;
        min-width:240px; max-width:320px; box-shadow:0 0 20px #a855f744;
        animation:nrToastIn .4s ease forwards; pointer-events:all;
        font-family:'Orbitron','Courier New',monospace;
      }
    `;
    document.head.appendChild(style);
  }

  function _toastContainer() {
    let el = document.getElementById("nr-toast-container");
    if (!el) {
      el = document.createElement("div");
      el.id = "nr-toast-container";
      el.style.cssText = "position:fixed;bottom:24px;right:24px;z-index:99997;display:flex;flex-direction:column-reverse;gap:10px;pointer-events:none;";
      document.body.appendChild(el);
    }
    return el;
  }

  function _toast({ icone, titulo, subtitulo, cor }) {
    _injetarEstilos();
    cor = cor || "#a855f7";
    const container = _toastContainer();
    const toast = document.createElement("div");
    toast.className = "nr-toast";
    toast.style.borderColor = cor;
    toast.style.boxShadow = `0 0 20px ${cor}44`;
    toast.innerHTML = `
      <span style="font-size:26px;filter:drop-shadow(0 0 6px ${cor})">${icone}</span>
      <div>
        <div style="font-size:9px;color:${cor};letter-spacing:2px;text-transform:uppercase;margin-bottom:2px">${titulo}</div>
        ${subtitulo ? `<div style="font-size:12px;color:#e2e8f0;font-weight:700">${subtitulo}</div>` : ""}
      </div>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = "nrToastOut .4s ease forwards";
      setTimeout(() => toast.remove(), 400);
    }, 3800);
  }

  // ── Ganho de XP: texto flutuante perto do HUD de perfil ──────────
  // Se "origem" (elemento DOM) for passado, ancora perto dele —
  // senão usa canto superior esquerdo (onde fica o hud-profile).
  function mostrarGanhoXP(xp, x, y) {
    _injetarEstilos();
    const el = document.createElement("div");
    el.textContent = "+" + xp + " XP";
    el.style.cssText = `
      position:fixed; z-index:99996; pointer-events:none;
      font-family:'Orbitron',monospace; font-size:13px; font-weight:700;
      color:#22d3ee; text-shadow:0 0 8px #22d3eeaa;
      animation:nrFloatUp 1.1s ease-out forwards;
      transform: translate(-50%, -50%);
    `;
    // Sem posição (ex: XP de missão diária, sem ligação com um ponto
    // na tela), usa um cantinho fixo como padrão
    el.style.left = (typeof x === "number" ? x : window.innerWidth - 70) + "px";
    el.style.top = (typeof y === "number" ? y : 70) + "px";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1150);
  }

  // ── Level up: overlay central com anel de energia expandindo ────
  function mostrarLevelUp(nivelNovo) {
    _injetarEstilos();
    _tocarSom("levelup");

    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position:fixed; inset:0; z-index:99998; display:flex; align-items:center;
      justify-content:center; pointer-events:none;
    `;
    overlay.innerHTML = `
      <div style="position:relative; display:flex; flex-direction:column; align-items:center; animation:nrLevelUpIn .5s ease forwards;">
        <div style="position:absolute; width:160px; height:160px; border:2px solid #a855f7; border-radius:50%; animation:nrRingExpand 0.9s ease-out forwards;"></div>
        <div style="position:absolute; width:160px; height:160px; border:2px solid #22d3ee; border-radius:50%; animation:nrRingExpand 0.9s ease-out 0.15s forwards;"></div>
        <div style="font-family:'Orbitron',monospace; font-size:12px; letter-spacing:6px; color:#22d3ee; text-shadow:0 0 10px #22d3ee;">LEVEL UP</div>
        <div style="font-family:'Orbitron',monospace; font-size:42px; font-weight:900; letter-spacing:2px;
          background:linear-gradient(90deg,#a855f7,#22d3ee); -webkit-background-clip:text; -webkit-text-fill-color:transparent;
          text-shadow:0 0 24px #a855f766;">
          NÍVEL ${nivelNovo}
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => {
      const box = overlay.firstElementChild;
      if (box) box.style.animation = "nrLevelUpOut .4s ease forwards";
      setTimeout(() => overlay.remove(), 400);
    }, 1800);
  }

  function mostrarRecompensa(texto, icone) {
    _toast({ icone: icone || "🎁", titulo: "Recompensa Recebida", subtitulo: texto, cor: "#fbbf24" });
  }

  function mostrarDesbloqueio(tipo, nome, icone) {
    // tipo: "Avatar" | "Moldura" | "Título"
    _toast({ icone: icone || "✨", titulo: "Novo " + tipo, subtitulo: nome, cor: "#22d3ee" });
  }

  function mostrarConquista(def) {
    _toast({ icone: def.icone || "🏆", titulo: "Conquista Desbloqueada!", subtitulo: def.titulo, cor: "#a855f7" });
  }

  // Som opcional — só toca se o jogo já expuser um player de SFX global.
  // Não cria <audio> daqui pra não duplicar sistema de som do jogo.
  function _tocarSom(nome) {
    try {
      if (window.NRSom && typeof window.NRSom.tocar === "function") window.NRSom.tocar(nome);
    } catch (e) {}
  }

  // ── Auto-listeners ────────────────────────────────────────────────
  window.addEventListener("nr:xpganho", (e) => {
    const ganho = e && e.detail && e.detail.ganho;
    if (!ganho) return;
    const pos = e.detail.posicao;
    mostrarGanhoXP(ganho, pos ? pos.x : undefined, pos ? pos.y : undefined);
  });

  window.addEventListener("nr:levelup", (e) => {
    const nivelNovo = e && e.detail && e.detail.nivelNovo;
    if (!nivelNovo) return;
    mostrarLevelUp(nivelNovo);

    // Checa desbloqueios "exatos" nesse nível (avatar/moldura/título
    // cujo requisito bate com o nível que acabou de ser alcançado)
    try {
      (window.NRMolduras ? window.NRMolduras.LISTA : []).forEach(def => {
        if (def.requisito.tipo === "nivel" && def.requisito.valor === nivelNovo) {
          mostrarDesbloqueio("Moldura", def.nome, "🖼️");
        }
      });
      (window.NRTitulos ? window.NRTitulos.LISTA : []).forEach(def => {
        if (def.requisito.tipo === "nivel" && def.requisito.valor === nivelNovo) {
          mostrarDesbloqueio("Título", def.nome, "🏷️");
        }
      });
    } catch (err) {}
  });

  window.addEventListener("nr:conquistaDesbloqueada", (e) => {
    const def = e && e.detail && e.detail.conquista;
    if (def) mostrarConquista(def);
  });

  // Avisa que tem recompensa nova esperando (resgate continua manual,
  // abrindo o perfil — isso aqui é só a notificação de que existe uma)
  window.addEventListener("nr:recompensaDisponivel", (e) => {
    const nivel = e && e.detail && e.detail.nivel;
    if (nivel) _toast({ icone: "🎁", titulo: "Recompensa disponível", subtitulo: "Nível " + nivel + " — abra o perfil", cor: "#fbbf24" });
  });

  window.NRAnimacoes = {
    mostrarGanhoXP,
    mostrarLevelUp,
    mostrarRecompensa,
    mostrarDesbloqueio,
    mostrarConquista,
  };
})();
