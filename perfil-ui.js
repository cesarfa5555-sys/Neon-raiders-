// ══════════════════════════════════════════════════════════════════
// PERFIL-UI.JS — janela completa de perfil (modal)
//
// Abre por cima de qualquer página (game.html, menu.html) sem precisar
// de iframe — cria um overlay fixed e injeta seu próprio HTML/CSS.
//
// Depende de: dados.js, perfil.js/xp.js/level.js (NRPerfil, inclui
// NRDados.salvarPerfil/salvarInformacoes), avatars.js, molduras.js,
// titulos.js, conquistas.js + conquistas-perfil.js, animations.js
// (opcional, só usada indiretamente pelos módulos ao equipar).
// Sem type="module".
//
// Uso: window.NRPerfilUI.abrir() / .fechar()
//
// CORRIGIDO (após checar login.html/perfilPadrao):
//   - nome do jogador vive em usuarios/{uid}/informacoes/nome, não em
//     usuarios/{uid}/perfil.nome — lido e gravado no lugar certo agora
//   - estatísticas usam os nomes reais que já existem no schema
//     (tempoJogado, mortes, vitorias, totalKills, totalBosses,
//     totalMoedasGanhas). Campos como maiorWave/precisão/bombas/
//     power-ups/missões ainda não existem em lugar nenhum do jogo —
//     ficam de fora até alguém adicionar esses campos e chamar
//     salvarEstatisticas de dentro de boss.js/loja.js (tarefa futura)
// ══════════════════════════════════════════════════════════════════

(function () {
  let _overlay = null;
  let _abaAtual = "stats";

  // ── Estilos ────────────────────────────────────────────────────
  function _injetarEstilos() {
    if (document.getElementById("nr-perfilui-styles")) return;
    const style = document.createElement("style");
    style.id = "nr-perfilui-styles";
    style.textContent = `
      #nrPerfilOverlay {
        position:fixed; inset:0; z-index:99990; background:rgba(3,3,10,0.88);
        backdrop-filter:blur(3px); display:flex; align-items:flex-start;
        justify-content:center; overflow-y:auto; padding:35px 27px 30px;
        font-family:'Share Tech Mono',monospace; color:#e2e8f0;
      }
      #nrPerfilJanela {
        width:100%; max-width:460px; background:#0b0b1f; border:1px solid #1e1e4a;
        border-radius:16px; overflow:hidden; box-shadow:0 0 40px #a855f722;
      }
      .nr-p-header {
        background:linear-gradient(135deg, rgba(168,85,247,0.18), rgba(34,211,238,0.10));
        padding:16px 16px 20px; position:relative; text-align:center;
      }
      .nr-p-fechar {
        position:fixed; top:5px; right:6px; background:rgba(255,255,255,0.05);
        border:1px solid #1e1e4a; color:#94a3b8; border-radius:50%; width:30px; height:30px;
        font-size:14px; cursor:pointer; display:flex; align-items:center; justify-content:center;
      }
      .nr-p-avatarwrap { display:flex; justify-content:center; margin-bottom:8px; position:relative; }
      .nr-p-fotobadge {
        position:absolute; left:50%; margin-left:44px; bottom:6px;
        width:32px; height:32px; border-radius:30%;
        background:#0f0f28; border:2px solid #a855f7;
        display:flex; align-items:center; justify-content:center;
        font-size:16px; cursor:pointer; box-shadow:0 0 10px #a855f766;
      }
      .nr-p-nome { font-family:'Orbitron',monospace; font-size:16px; font-weight:700; color:#fff; cursor:pointer; }
      .nr-p-nome:active { color:#22d3ee; }
      .nr-p-titulo { font-size:10px; color:#22d3ee; letter-spacing:2px; margin-top:2px; text-transform:uppercase; }
      .nr-p-uid { font-size:9px; color:#475569; margin-top:6px; letter-spacing:1px; }
      .nr-p-xpwrap { margin:14px auto 0; max-width:260px; }
      .nr-p-xplabel { display:flex; justify-content:space-between; font-size:9px; color:#94a3b8; margin-bottom:3px; letter-spacing:1px; }
      .nr-p-xptrack { height:8px; background:#1e1e4a; border-radius:4px; overflow:hidden; }
      .nr-p-xpfill { height:100%; background:linear-gradient(90deg,#6d28d9,#a855f7,#22d3ee); box-shadow:0 0 8px #a855f7aa; transition:width .5s ease; }
      .nr-p-moedas { display:flex; justify-content:center; gap:18px; margin-top:12px; font-family:'Orbitron',monospace; font-size:11px; }
      .nr-p-moedas span.gold { color:#fbbf24; } .nr-p-moedas span.gem { color:#22d3ee; }
      .nr-p-tabs { display:flex; border-bottom:1px solid #1e1e4a; overflow-x:auto; }
      .nr-p-tab { flex:1; min-width:70px; text-align:center; padding:11px 4px; font-family:'Orbitron',monospace; font-size:9px; letter-spacing:1px; color:#64748b; cursor:pointer; border-bottom:2px solid transparent; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .nr-p-tab.ativa { color:#e2e8f0; border-bottom-color:#a855f7; }
      .nr-p-conteudo { padding:16px; min-height:200px; }
      .nr-p-statgrid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
      .nr-p-statcard { background:#0f0f28; border:1px solid #1e1e4a; border-radius:10px; padding:10px 12px; }
      .nr-p-statval { font-family:'Orbitron',monospace; font-size:16px; font-weight:700; color:#a855f7; }
      .nr-p-statlabel { font-size:9px; color:#64748b; letter-spacing:1px; margin-top:2px; text-transform:uppercase; }
      .nr-p-itemgrid { display:grid; grid-template-columns:repeat(auto-fill,minmax(76px,1fr)); gap:10px; }
      .nr-p-item { background:#0f0f28; border:1px solid #1e1e4a; border-radius:10px; padding:10px 6px; text-align:center; cursor:pointer; position:relative; }
      .nr-p-item.equipado { border-color:#22d3ee; box-shadow:0 0 12px #22d3ee33; }
      .nr-p-item.bloqueado { opacity:0.45; cursor:not-allowed; }
      .nr-p-item .ic { font-size:22px; display:block; margin-bottom:4px; }
      .nr-p-molduraThumb { width:36px; height:36px; display:block; margin:0 auto 4px; object-fit:contain; }
      .nr-p-item .nm { font-size:8px; color:#94a3b8; letter-spacing:0.5px; }
      .nr-p-item .lock { position:absolute; top:4px; right:6px; font-size:10px; }
      .nr-p-titulolinha { display:flex; align-items:center; justify-content:space-between; background:#0f0f28; border:1px solid #1e1e4a; border-radius:10px; padding:10px 14px; margin-bottom:8px; cursor:pointer; }
      .nr-p-titulolinha.equipado { border-color:#22d3ee; }
      .nr-p-titulolinha.bloqueado { opacity:0.45; cursor:not-allowed; }
      .nr-p-achcard { display:flex; align-items:center; gap:10px; background:#0f0f28; border:1px solid #1e1e4a; border-radius:10px; padding:10px 12px; margin-bottom:8px; }
      .nr-p-achcard.desbloqueada { border-color:#a855f744; }
      .nr-p-achcard.bloqueada { opacity:0.5; }
      .nr-p-achtitulo { font-family:'Orbitron',monospace; font-size:11px; color:#e2e8f0; }
      .nr-p-achdesc { font-size:9px; color:#64748b; margin-top:2px; }
      
      /* ═══════════════════════════════════════════════
   POPUP NR — AVISO PERSONALIZADO
   ═══════════════════════════════════════════════ */

#nrAvisoOverlay {
  position: fixed;
  inset: 0;
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 25px;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(5px);
}

.nr-aviso-box {
  width: 100%;
  max-width: 340px;
  background: linear-gradient(
    145deg,
    #12122d,
    #0a0a1c
  );
  border: 1px solid #a855f7;
  border-radius: 16px;
  padding: 24px 20px 20px;
  text-align: center;
  box-shadow:
    0 0 30px #a855f744,
    inset 0 0 25px #a855f70d;
  animation: nrAvisoEntrada .22s ease-out;
}

@keyframes nrAvisoEntrada {
  from {
    opacity: 0;
    transform: scale(.88) translateY(10px);
  }

  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.nr-aviso-icone {
  width: 52px;
  height: 52px;
  margin: 0 auto 12px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #a855f71c;
  border: 1px solid #a855f7;
  color: #a855f7;
  font-size: 24px;
  box-shadow: 0 0 18px #a855f755;
}

.nr-aviso-titulo {
  font-family: 'Orbitron', monospace;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #fff;
  margin-bottom: 8px;
}

.nr-aviso-texto {
  font-family: 'Share Tech Mono', monospace;
  font-size: 11px;
  line-height: 1.6;
  color: #94a3b8;
  margin-bottom: 18px;
}

.nr-aviso-input {
  width: 100%;
  background: #0b0b1f;
  border: 1px solid #a855f7;
  border-radius: 9px;
  padding: 11px 12px;
  color: #fff;
  font-family: 'Share Tech Mono', monospace;
  font-size: 13px;
  margin-bottom: 16px;
  outline: none;
  box-sizing: border-box;
  text-align: center;
}
.nr-aviso-input:focus {
  box-shadow: 0 0 10px #a855f766;
}

.nr-aviso-botoes {
  display: flex;
  gap: 10px;
}

.nr-aviso-botao {
  width: 100%;
  height: 42px;
  border: 1px solid #a855f7;
  border-radius: 9px;
  background: linear-gradient(
    90deg,
    #6d28d9,
    #a855f7
  );
  color: #fff;
  font-family: 'Orbitron', monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
  cursor: pointer;
  box-shadow: 0 0 15px #a855f744;
}

.nr-aviso-botoes .nr-aviso-botao {
  width: auto;
  flex: 1;
}

.nr-aviso-botao-secundario {
  background: rgba(255,255,255,0.05);
  border: 1px solid #2a2a55;
  color: #94a3b8;
  box-shadow: none;
}

.nr-aviso-botao:active {
  transform: scale(.97);
}
      
    `;
    document.head.appendChild(style);
  }

  // ── Dados auxiliares ──────────────────────────────────────────────
  function _perfilCompleto() {
    return (window.NRDados && window.NRDados.perfilLocal && window.NRDados.perfilLocal()) || {};
  }
  
  // Popup de aviso — substitui alert() nativo. Só um botão OK.
  function _mostrarAviso(titulo, mensagem, icone = "!") {
  const antigo = document.getElementById("nrAvisoOverlay");
  if (antigo) antigo.remove();

  const overlay = document.createElement("div");
  overlay.id = "nrAvisoOverlay";

  overlay.innerHTML = `
    <div class="nr-aviso-box">

      <div class="nr-aviso-icone">
        ${icone}
      </div>

      <div class="nr-aviso-titulo">
        ${titulo}
      </div>

      <div class="nr-aviso-texto">
        ${mensagem}
      </div>

      <button class="nr-aviso-botao" id="nrAvisoOK">
        OK
      </button>

    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector("#nrAvisoOK").addEventListener("click", () => {
    overlay.remove();
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
}

  // Popup com campo de texto — substitui prompt() nativo. Como não dá
  // pra travar a execução como o prompt() de verdade fazia, devolve
  // uma Promise: resolve com o texto digitado (OK/Enter) ou null
  // (Cancelar/Esc/clicar fora). Quem chama precisa usar await.
  function _mostrarPrompt(titulo, mensagem, valorInicial = "") {
    return new Promise((resolve) => {
      const antigo = document.getElementById("nrAvisoOverlay");
      if (antigo) antigo.remove();

      const overlay = document.createElement("div");
      overlay.id = "nrAvisoOverlay";

      overlay.innerHTML = `
        <div class="nr-aviso-box">
          <div class="nr-aviso-titulo">${titulo}</div>
          <div class="nr-aviso-texto">${mensagem}</div>
          <input type="text" class="nr-aviso-input" id="nrAvisoInput" maxlength="18">
          <div class="nr-aviso-botoes">
            <button class="nr-aviso-botao nr-aviso-botao-secundario" id="nrAvisoCancelar">CANCELAR</button>
            <button class="nr-aviso-botao" id="nrAvisoConfirmar">OK</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      const input = overlay.querySelector("#nrAvisoInput");
      input.value = valorInicial; // via .value, não no HTML — evita quebrar com aspas/HTML no nome atual
      input.focus();
      input.select();

      let resolvido = false;
      function finalizar(valor) {
        if (resolvido) return;
        resolvido = true;
        overlay.remove();
        resolve(valor);
      }

      overlay.querySelector("#nrAvisoConfirmar").addEventListener("click", () => finalizar(input.value));
      overlay.querySelector("#nrAvisoCancelar").addEventListener("click", () => finalizar(null));
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") finalizar(input.value);
        else if (e.key === "Escape") finalizar(null);
      });
      overlay.addEventListener("click", (e) => { if (e.target === overlay) finalizar(null); });
    });
  }
  
  // Nome vive em informacoes.nome (branch criado no cadastro),
  // NÃO em perfil.nome — corrigido após checar login.html
  function _nomeAtual() {
    const p = _perfilCompleto();
    return (p.informacoes && p.informacoes.nome) || localStorage.getItem("jogadorNome") || "Piloto";
  }

  function _uidCurto() {
    // uid completo só é obtido async; usamos o que já estiver disponível
    // via localStorage/estado (evita travar a abertura do modal por rede)
    try {
      if (window.NRDados && typeof window.NRDados.uid === "function") {
        // uid() é async e não queremos travar o render — deixa "—" na
        // primeira renderização, sem chamada bloqueante aqui
      }
    } catch (e) {}
    return "—";
  }

  function _estatisticas() {
    const p = _perfilCompleto();
    return p.estatisticas || {};
  }

  // ── Renomear (custa moedas) ────────────────────────────────────────
  const CUSTO_RENOMEAR = 5000;

  // Resolução máxima da foto de perfil (quadrada). 320px já fica nítido
  // mesmo dando zoom na janela do perfil, e mantém o arquivo pequeno
  // (JPEG a 78% de qualidade, tipicamente uns 20-40KB em base64) — dá
  // pra aumentar pra 500 se quiser mais nitidez, é só mudar esse número.
  const LIMITE_FOTO_PX = 500;

  // Lê o arquivo escolhido, corta o centro num quadrado (cover-crop,
  // pra não esticar/distorcer foto retangular) e redimensiona pro
  // limite acima, devolvendo um data URL JPEG pronto pra salvar.
  function _processarArquivoFoto(file) {
    return new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = LIMITE_FOTO_PX;
          canvas.height = LIMITE_FOTO_PX;
          const ctx = canvas.getContext("2d");
          const lado = Math.min(img.width, img.height);
          const sx = (img.width - lado) / 2;
          const sy = (img.height - lado) / 2;
          ctx.drawImage(img, sx, sy, lado, lado, 0, 0, LIMITE_FOTO_PX, LIMITE_FOTO_PX);
          resolve(canvas.toDataURL("image/jpeg", 0.78));
        };
        img.onerror = () => reject(new Error("imagem_invalida"));
        img.src = leitor.result;
      };
      leitor.onerror = () => reject(new Error("leitura_falhou"));
      leitor.readAsDataURL(file);
    });
  }

  // Disparado pela troca no <input type="file"> — processa e salva
  async function _trocarFoto(inputEl) {
    const file = inputEl.files && inputEl.files[0];
    inputEl.value = ""; // permite escolher o mesmo arquivo de novo depois
    if (!file) return;
    if (!file.type || file.type.indexOf("image/") !== 0) {
      _mostrarAviso("ARQUIVO INVÁLIDO", "Escolhe um arquivo de imagem.", "✕");
      return;
    }
    try {
      const dataUrl = await _processarArquivoFoto(file);
      await window.NRAvatares.definirFotoPersonalizada(dataUrl);
      _render();
    } catch (e) {
      _mostrarAviso("ERRO AO CARREGAR", "Não deu pra carregar essa imagem. Tenta outra.", "✕");
    }
  }

  async function _renomear() {
    const p = _perfilCompleto();
    const moedas = (p.progresso && p.progresso.moedas) || 0;
    if (moedas < CUSTO_RENOMEAR) {
  _mostrarAviso(
    "MOEDAS INSUFICIENTES",
    "Trocar o nome custa " + CUSTO_RENOMEAR + " moedas.",
    "◈"
  );
  return;
}
    const nomeAtual = _nomeAtual();
    const novoNome = await _mostrarPrompt("NOVO NOME", "Custa " + CUSTO_RENOMEAR + " moedas trocar o nome.", nomeAtual);
    if (!novoNome || !novoNome.trim() || novoNome.trim() === nomeAtual) return;

    if (window.NRDados) {
      if (typeof window.NRDados.salvarProgresso === "function") {
        await window.NRDados.salvarProgresso({ moedas: moedas - CUSTO_RENOMEAR });
      }
      // Grava em informacoes (branch real do nome), não em perfil
      if (typeof window.NRDados.salvarInformacoes === "function") {
        await window.NRDados.salvarInformacoes({ nome: novoNome.trim() });
      }
    }
    _render();
  }

  // ── Abas ────────────────────────────────────────────────────────
  const ABAS = [
    { id: "stats", label: "STATS" },
    { id: "recompensas", label: "PRÊMIOS" },
    { id: "avatares", label: "FOTO" },
    { id: "molduras", label: "MOLDURAS" },
    { id: "titulos", label: "TÍTULOS" },
  ];

  function _renderStats() {
    const e = _estatisticas();
    // Nomes reais do branch estatisticas (login.html/perfilPadrao):
    // tempoJogado, mortes, vitorias, totalKills, totalBosses, totalMoedasGanhas.
    // Campos como maiorWave/precisão/bombas/power-ups/missões ainda não
    // são gravados em lugar nenhum do jogo — ficam de fora por enquanto.
    const segundosJogados = e.tempoJogado || 0;
    const tempoFormatado = segundosJogados < 60
      ? segundosJogados + "s"
      : Math.floor(segundosJogados / 60) + "m " + (segundosJogados % 60) + "s";
    const itens = [
      ["Inimigos eliminados", e.totalKills || 0],
      ["Bosses derrotados", e.totalBosses || 0],
      ["Partidas vencidas", e.vitorias || 0],
      ["Mortes", e.mortes || 0],
      ["Tempo jogado", tempoFormatado],
      ["Moedas ganhas (total)", e.totalMoedasGanhas || 0],
    ];
    return `<div class="nr-p-statgrid">${itens.map(([label, val]) => `
      <div class="nr-p-statcard"><div class="nr-p-statval">${val}</div><div class="nr-p-statlabel">${label}</div></div>
    `).join("")}</div>`;
  }

  // Mesma lógica de window.NRRecompensas.pendentes(), só que síncrona
  // (usando NRPerfil.getNivel()/local(), que já são síncronos) — assim
  // dá pra desenhar a aba direto, sem precisar de await no meio do
  // template de render.
  function _recompensasPendentesSync() {
    if (!window.NRRecompensas || !window.NRPerfil) return [];
    const nivel = window.NRPerfil.getNivel();
    const perfil = window.NRPerfil.local();
    const resgatadas = perfil.recompensasResgatadas || {};
    const lista = [];
    for (const nivelStr in window.NRRecompensas.TABELA) {
      const n = Number(nivelStr);
      if (nivel >= n && !resgatadas[n]) {
        lista.push(Object.assign({ nivel: n }, window.NRRecompensas.TABELA[n]));
      }
    }
    return lista.sort((a, b) => a.nivel - b.nivel);
  }

  function _descricaoRecompensa(r) {
    if (r.tipo === "moedas") return r.valor + " moedas";
    const nomes = { nave: "Nova nave", avatar: "Avatar", skin: "Skin", moldura: "Moldura", arma: "Arma", titulo: "Título raro", efeito: "Efeito especial" };
    return nomes[r.tipo] || r.tipo;
  }

  function _renderRecompensas() {
    if (!window.NRRecompensas) return "";
    const pendentes = _recompensasPendentesSync();
    if (!pendentes.length) {
      return `<p style="font-size:11px;color:#64748b;text-align:center;padding:24px 0;">Nenhuma recompensa esperando. Suba de nível pra desbloquear mais!</p>`;
    }
    return pendentes.map(r => `
      <div class="nr-p-achcard desbloqueada" data-resgatar="${r.nivel}" style="cursor:pointer;">
        <span style="font-size:22px">🎁</span>
        <div><div class="nr-p-achtitulo">Nível ${r.nivel}</div><div class="nr-p-achdesc">${_descricaoRecompensa(r)} — toque pra resgatar</div></div>
      </div>`).join("");
  }


  function _renderAvatares() {
    if (!window.NRAvatares) return "";
    const temFoto = window.NRAvatares.temFotoPersonalizada && window.NRAvatares.temFotoPersonalizada();
    const cardFoto = `
      <div class="nr-p-item equipado" id="nrPerfilCardFoto">
        <span class="ic"><img src="galeria.png" width="34px"></span><span class="nm">${temFoto ? "Trocar foto" : "Escolher foto"}</span>
      </div>`;
    const cardRemoverFoto = temFoto ? `
      <div class="nr-p-item" id="nrPerfilCardRemoverFoto">
        <span class="ic">✕</span><span class="nm">Remover foto</span>
      </div>` : "";
    return `<div class="nr-p-itemgrid">${cardFoto}${cardRemoverFoto}</div>`;
  }

  function _renderMolduras() {
    if (!window.NRMolduras) return "";
    const atualId = window.NRMolduras.molduraAtualId();
    return `<div class="nr-p-itemgrid">${window.NRMolduras.listar().map(m => `
      <div class="nr-p-item ${m.id === atualId ? "equipado" : ""} ${!m.desbloqueada ? "bloqueado" : ""}" data-moldura="${m.id}">
        ${!m.desbloqueada ? '<span class="lock">🔒</span>' : ""}
        ${m.arquivo
          ? `<img src="molduras/${m.arquivo}" class="nr-p-molduraThumb" alt="${m.nome}">`
          : '<span class="ic">◯</span>'}
        <span class="nm">${m.nome}</span>
      </div>`).join("")}</div>`;
  }

  function _renderTitulos() {
    if (!window.NRTitulos) return "";
    const atualId = window.NRTitulos.tituloAtualId();
    return `<div class="nr-p-itemgrid">${window.NRTitulos.listar().map(t => `
      <div class="nr-p-item ${t.id === atualId ? "equipado" : ""} ${!t.desbloqueado ? "bloqueado" : ""}" data-titulo="${t.id}">
        ${!t.desbloqueado ? '<span class="lock">🔒</span>' : ""}
        <span class="ic" style="font-size:13px;">🏷️</span><span class="nm">${t.nome}</span>
      </div>`).join("")}</div>`;
  }

  function _renderAba() {
    if (_abaAtual === "stats") return _renderStats();
    if (_abaAtual === "recompensas") return _renderRecompensas();
    if (_abaAtual === "avatares") return _renderAvatares();
    if (_abaAtual === "molduras") return _renderMolduras();
    if (_abaAtual === "titulos") return _renderTitulos();
    return "";
  }

  // ── Render completo ────────────────────────────────────────────
  function _render() {
    if (!_overlay) return;
    const p = _perfilCompleto();
    const nivel = (window.NRPerfil && window.NRPerfil.getNivel && window.NRPerfil.getNivel()) || 1;
    const xp = (window.NRPerfil && window.NRPerfil.getXP && window.NRPerfil.getXP()) || 0;
    const xpProximo = (window.NRPerfil && window.NRPerfil.getXpProximoNivel && window.NRPerfil.getXpProximoNivel()) || 50;
    const pct = Math.max(0, Math.min(100, (xp / xpProximo) * 100));
    const nome = _nomeAtual();
    const tituloDef = window.NRTitulos ? window.NRTitulos.tituloAtual() : null;
    const moedas = (p.progresso && p.progresso.moedas) || 0;
    const cristais = (p.progresso && p.progresso.joiasGemas) || 0;

    const janela = document.getElementById("nrPerfilJanela");
    janela.innerHTML = `
      <div class="nr-p-header">
        <div class="nr-p-fechar" id="nrPerfilFechar">✕</div>
        <div class="nr-p-avatarwrap">
          <canvas id="nrPerfilAvatarCanvas" width="168" height="168"></canvas>
          <div class="nr-p-fotobadge" id="nrPerfilFotoBadge" title="Trocar foto"><img src="galeria-de-fotos (1).png" ></div>
          <input type="file" id="nrPerfilFotoInput" accept="image/*" style="display:none">
        </div>
        <div class="nr-p-nome" id="nrPerfilNome">${nome} ✎</div>
        ${tituloDef ? `<div class="nr-p-titulo">${tituloDef.nome}</div>` : ""}
        <div class="nr-p-uid">UID ${_uidCurto()}</div>
        <div class="nr-p-xpwrap">
          <div class="nr-p-xplabel"><span>NÍVEL ${nivel}</span><span>${xp} / ${xpProximo} XP</span></div>
          <div class="nr-p-xptrack"><div class="nr-p-xpfill" style="width:${pct}%"></div></div>
        </div>
        <div class="nr-p-moedas"><span class="gold">◈ ${moedas}</span><span class="gem">✦ ${cristais}</span></div>
      </div>
      <div class="nr-p-tabs">${ABAS.map(a => `<div class="nr-p-tab ${a.id === _abaAtual ? "ativa" : ""}" data-tab="${a.id}">${a.label}</div>`).join("")}</div>
      <div class="nr-p-conteudo">${_renderAba()}</div>
    `;

    // Avatar + moldura no canvas do header
    const canvas = document.getElementById("nrPerfilAvatarCanvas");
    if (canvas && window.NRAvatares) {
      const ctx = canvas.getContext("2d");
      window.NRAvatares.desenharAvatar(ctx, window.NRAvatares.avatarAtualId(), 84, 84, 66);
      if (window.NRMolduras) window.NRMolduras.desenharMoldura(ctx, window.NRMolduras.molduraAtualId(), 84, 84, 66, 0);
    }

    _ligarEventos();
  }

  function _ligarEventos() {
    const janela = document.getElementById("nrPerfilJanela");

    janela.querySelectorAll("[data-resgatar]").forEach(el => {
      el.addEventListener("click", async () => {
        const nivel = Number(el.dataset.resgatar);
        const r = await window.NRRecompensas.resgatar(nivel);
        if (r.ok && window.NRAnimacoes) window.NRAnimacoes.mostrarRecompensa(_descricaoRecompensa(r), "🎁");
        _render();
      });
    });

    janela.querySelector("#nrPerfilFechar").addEventListener("click", fechar);
    janela.querySelector("#nrPerfilNome").addEventListener("click", _renomear);

    const fotoInput = janela.querySelector("#nrPerfilFotoInput");
    janela.querySelector("#nrPerfilFotoBadge").addEventListener("click", () => fotoInput.click());
    fotoInput.addEventListener("change", () => _trocarFoto(fotoInput));

    janela.querySelectorAll(".nr-p-tab").forEach(tab => {
      tab.addEventListener("click", () => { _abaAtual = tab.dataset.tab; _render(); });
    });

    const cardFoto = janela.querySelector("#nrPerfilCardFoto");
    if (cardFoto) cardFoto.addEventListener("click", () => fotoInput.click());
    const cardRemoverFoto = janela.querySelector("#nrPerfilCardRemoverFoto");
    if (cardRemoverFoto) cardRemoverFoto.addEventListener("click", async () => {
      await window.NRAvatares.removerFotoPersonalizada();
      _render();
    });
    janela.querySelectorAll("[data-moldura]").forEach(el => {
      el.addEventListener("click", async () => {
        const r = await window.NRMolduras.equipar(el.dataset.moldura);
        if (r.ok) _render();
      });
    });
    janela.querySelectorAll("[data-titulo]").forEach(el => {
      el.addEventListener("click", async () => {
        const r = await window.NRTitulos.equipar(el.dataset.titulo);
        if (r.ok) _render();
      });
    });
  }

  // ── Abrir / Fechar ────────────────────────────────────────────
  function abrir() {
    _injetarEstilos();
    if (_overlay) { _render(); return; }
    _overlay = document.createElement("div");
    _overlay.id = "nrPerfilOverlay";
    _overlay.innerHTML = `<div id="nrPerfilJanela"></div>`;
    _overlay.addEventListener("click", (e) => { if (e.target === _overlay) fechar(); });
    document.body.appendChild(_overlay);
    _render();
  }

  function fechar() {
    if (_overlay) { _overlay.remove(); _overlay = null; }
  }

  window.NRPerfilUI = { abrir, fechar };
})();