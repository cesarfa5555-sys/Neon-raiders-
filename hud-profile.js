// ══════════════════════════════════════════════════════════════════
// HUD-PROFILE.JS — cartão de perfil no canto superior esquerdo do jogo
//
// Fica ACIMA do HUD de jogo (#hud), como elemento próprio posicionado
// via position:fixed — não interfere no layout de score/HP/energia que
// já existe em game.html.
//
// Cuidado de performance: o card só re-renderiza quando um evento
// dispara (nr:xpganho, nr:levelup, avatar/moldura/título equipado),
// nunca a cada frame do jogo. A única exceção é uma moldura "animada"
// equipada, que usa um loop próprio bem leve (canvas pequeno, ~10fps)
// só enquanto o card estiver visível — não usa shadowBlur por partícula
// nem nada pesado, só o anel da moldura.
//
// Depende de: dados.js, perfil.js/xp.js/level.js (NRPerfil), avatars.js,
// molduras.js, titulos.js, perfil-ui.js (pro clique abrir o perfil).
// Sem type="module".
//
// Uso: chamar window.NRHudPerfil.iniciar() uma vez, em qualquer página
// que tenha o jogo/HUD (ex: no fim de game.html, depois do login).
//
// CORRIGIDO (após checar login.html/perfilPadrao): nome do jogador vive
// em usuarios/{uid}/informacoes/nome, não em perfil.nome.
// ══════════════════════════════════════════════════════════════════

(function () {
  let _card = null;
  let _canvasAvatar = null;
  let _animId = null;

  function _injetarEstilos() {
    if (document.getElementById("nr-hudperfil-styles")) return;
    const style = document.createElement("style");
    style.id = "nr-hudperfil-styles";
    style.textContent = `
      #nrHudProfileCard {
        position: fixed;
        top:2px;
        left:2px;
        z-index: 220;
        display: flex; align-items: center;
        cursor: pointer; user-select: none;
        max-width: 190px;
      }
      #nrHudProfileCard:active .nr-hp-bg { border-color: #a855f7; }
      #nrHudProfileCard .nr-hp-bg {
        position: absolute;
        top: 0; bottom: 0;
        left:2px; right: 0;
        background: linear-gradient(to right, rgba(20,20,28,0.85), rgba(30,30,42,0.85));
        border: 1px solid rgba(168,85,247,0.35);
        border-radius: 25px;
        transition: border-color .2s;
        z-index: 0;
      }
      #nrHudProfileCard canvas {
        position: relative; z-index: 2;
        flex-shrink: 0;
        width: 50px; height: 50px;
        border-radius: 50%;
      }
      #nrHudProfileCard .nr-hp-info { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; padding: 0px 12px 0px 10px; }
      #nrHudProfileCard .nr-hp-nome { font-family:'Orbitron',monospace; font-size: 5px; font-weight:700; color:#e2e8f0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:110px; }
      #nrHudProfileCard .nr-hp-nivel { font-family:'Share Tech Mono',monospace; font-size: 1px; color:#22d3ee;  }
      #nrHudProfileCard .nr-hp-xpbar-track { width: 80px; height: 4px; background:#1e1e4a; border-radius:3px; overflow:hidden; }
      #nrHudProfileCard .nr-hp-xpbar-fill { height:100%; background:linear-gradient(90deg,#6d28d9,#a855f7,#22d3ee); border-radius:3px; transition: width .5s ease; box-shadow:0 0 6px #a855f7aa; }
    `;
    document.head.appendChild(style);
  }

  function _dadosAtuais() {
    const nivel = (window.NRPerfil && window.NRPerfil.getNivel && window.NRPerfil.getNivel()) || 1;
    const xp = (window.NRPerfil && window.NRPerfil.getXP && window.NRPerfil.getXP()) || 0;
    const xpProximo = (window.NRPerfil && window.NRPerfil.getXpProximoNivel && window.NRPerfil.getXpProximoNivel()) || 50;
    const perfil = (window.NRDados && window.NRDados.perfilLocal && window.NRDados.perfilLocal()) || {};
    // Nome vive em informacoes.nome (branch criado no cadastro), não em perfil.nome
    const nome = (perfil.informacoes && perfil.informacoes.nome) || localStorage.getItem("jogadorNome") || "Piloto";
    const avatarId = window.NRAvatares ? window.NRAvatares.avatarAtualId() : null;
    const molduraId = window.NRMolduras ? window.NRMolduras.molduraAtualId() : null;
    return { nivel, xp, xpProximo, nome, avatarId, molduraId };
  }

  function _renderAvatar(t) {
    if (!_canvasAvatar) return;
    const ctx = _canvasAvatar.getContext("2d");
    const W = _canvasAvatar.width, H = _canvasAvatar.height;
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2, raio = W / 1.9 - 8;
    const { avatarId, molduraId } = _dadosAtuais();
    if (window.NRAvatares) window.NRAvatares.desenharAvatar(ctx, avatarId, cx, cy, raio);
    if (window.NRMolduras) window.NRMolduras.desenharMoldura(ctx, molduraId, cx, cy, raio, t);
  }

  function _molduraEhAnimada() {
    if (!window.NRMolduras) return false;
    const def = window.NRMolduras.getDef(window.NRMolduras.molduraAtualId());
    return !!(def && def.animada);
  }

  function _pararLoopAnimado() {
    if (_animId) { cancelAnimationFrame(_animId); _animId = null; }
  }

  function _iniciarLoopSeNecessario() {
    _pararLoopAnimado();
    if (!_molduraEhAnimada()) { _renderAvatar(0); return; }
    // Loop leve (~10fps) só pra moldura animada — não usa shadowBlur pesado,
    // só o traço do anel (ver molduras.js).
    let ultimo = 0;
    function frame(ts) {
      if (ts - ultimo > 100) {
        ultimo = ts;
        _renderAvatar(ts / 1000);
      }
      _animId = requestAnimationFrame(frame);
    }
    _animId = requestAnimationFrame(frame);
  }

  function atualizar() {
    if (!_card) return;
    const d = _dadosAtuais();
    _card.querySelector(".nr-hp-nome").textContent = d.nome;
    _card.querySelector(".nr-hp-nivel").textContent = "NÍVEL " + d.nivel;
    const pct = Math.max(0, Math.min(100, (d.xp / d.xpProximo) * 100));
    _card.querySelector(".nr-hp-xpbar-fill").style.width = pct + "%";
    _iniciarLoopSeNecessario();
  }

  function _criarCard() {
    _injetarEstilos();
    const card = document.createElement("div");
    card.id = "nrHudProfileCard";
    card.innerHTML = `
      <div class="nr-hp-bg"></div>
      <canvas width="100" height="100"></canvas>
      <div class="nr-hp-info">
        <div class="nr-hp-nome"></div>
        <div class="nr-hp-nivel"></div>
        <div class="nr-hp-xpbar-track"><div class="nr-hp-xpbar-fill" style="width:0%"></div></div>
      </div>
    `;
    document.body.appendChild(card);
    card.addEventListener("click", () => {
      if (window.NRPerfilUI && typeof window.NRPerfilUI.abrir === "function") {
        window.NRPerfilUI.abrir();
      }
    });
    _card = card;
    _canvasAvatar = card.querySelector("canvas");
  }

  function iniciar() {
    if (_card) { atualizar(); return; } // já iniciado, só atualiza
    _criarCard();
    atualizar();

    window.addEventListener("nr:xpganho", atualizar);
    window.addEventListener("nr:levelup", atualizar);
    window.addEventListener("nr:avatarEquipado", atualizar);
    window.addEventListener("nr:molduraEquipada", atualizar);
    window.addEventListener("nr:tituloEquipado", atualizar);
  }

  function destruir() {
    _pararLoopAnimado();
    if (_card) { _card.remove(); _card = null; _canvasAvatar = null; }
  }

  window.NRHudPerfil = { iniciar, atualizar, destruir };
})();
