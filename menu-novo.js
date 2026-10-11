/* ══════════════════════════════════════════════════════════════════
   MENU-NOVO.JS — lógica do menu novo (o visual está em menu-novo.css)
   O menu antigo continua no HTML, escondido, porque todo o JS dele (mapas, moedas, perfil, login) depende dos
   elementos de lá. Os botões novos só "apertam" os antigos ou abrem as mesmas páginas:
     JOGAR            → aperta o #btn-primary de sempre (mapa escolhido, mapa bloqueado, aviso, transição...)
     SELECIONAR MAPA  → abre uma janela com o seletor de mapas de sempre (#mapaStack)
     ONLINE           → multiplayer.html          RANKED → top3-global.html
     CONQUISTAS · VANGUARD · HANGAR → os .btn-badge de sempre (já têm onclick)
   Os 3 botões da direita fazem a "jogada": dão um tranco e saem voando para a esquerda sumindo, e só então abrem.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function som() { try { if (typeof tocarCliqueUI === 'function') tocarCliqueUI(); } catch (e) {} try { if (typeof vibrar === 'function') vibrar(12); } catch (e) {} }

  // Economiza bateria: as animações de fundo do menu antigo (planeta, partículas) estão escondidas, então param.
  try { window._animacoesPausadas = true; } catch (e) {}

  // ── JOGAR: aperta o botão antigo (ele sabe o mapa, se está bloqueado, a transição...) ──
  var jogar = $('nrJogar'), velho = $('btn-primary');
  if (jogar) {
    jogar.addEventListener('click', function () { if (velho) velho.click(); });
    var espelhar = function () { jogar.classList.toggle('nr-bloqueado', !!velho && velho.classList.contains('btn-locked')); };
    if (velho && window.MutationObserver) new MutationObserver(espelhar).observe(velho, { attributes: true, attributeFilter: ['class'] });
    espelhar();
  }

  // ── A "JOGADA" (sai para a esquerda sumindo) e só depois executa a ação ──
  var ocupado = false;
  function lancar(botao, acao, voltar) {
    if (ocupado) return; ocupado = true; som();
    var caixa = botao.closest('.nr-opt');
    caixa.classList.remove('nr-volta'); caixa.classList.add('nr-lancar');
    setTimeout(function () {
      try { acao(); } finally {
        if (voltar) { // a ação não saiu da página (ex.: abrir a janela do mapa): o botão volta depois
          setTimeout(function () { caixa.classList.remove('nr-lancar'); caixa.classList.add('nr-volta'); ocupado = false; }, 120);
        } else {
          setTimeout(function () { ocupado = false; caixa.classList.remove('nr-lancar'); }, 1500); // segurança, se a navegação demorar
        }
      }
    }, 340);
  }
  var bOnline = $('nrBtnOnline'), bRanked = $('nrBtnRanked'), bMapa = $('nrBtnMapa');
  if (bOnline) bOnline.addEventListener('click', function () { lancar(bOnline, function () { location.href = 'multiplayer.html'; }); });
  if (bRanked) bRanked.addEventListener('click', function () { lancar(bRanked, function () { location.href = 'top3-global.html'; }); });

  // ── SELECIONAR MAPA: janela com o seletor de mapas de sempre ──
  var modal = $('nrMapaModal'), slot = $('nrMapaSlot'), pilha = $('mapaStack'), pai = pilha ? pilha.parentNode : null, irmao = pilha ? pilha.nextSibling : null;
  function abrirMapa() {
    if (!modal || !pilha) return;
    slot.appendChild(pilha);                         // o seletor vem para dentro da janela (o JS antigo continua achando tudo pelos ids)
    modal.classList.add('aberto'); modal.setAttribute('aria-hidden', 'false');
    try { if (typeof posicionarCards === 'function') posicionarCards(); if (typeof atualizarSeletorMapa === 'function') atualizarSeletorMapa(); } catch (e) {} // recalcula os cartões já com tamanho
  }
  // ── CARTÕES LADO A LADO ──────────────────────────────────────────────────────────────
  // O menu antigo empilhava os mapas na vertical (posicionarCards). Aqui, com a janela aberta, o mesmo posicionarCards
  // continua rodando (classes, brilho, som...) e DEPOIS a gente reposiciona os cartões na horizontal. O desenho do cartão não muda.
  // Ajustes (mexa à vontade):  passo = quanto cada vizinho se afasta (em % da largura do cartão do meio)
  //   escala = tamanho do vizinho · giro = inclinação 3D (graus) · desce = quanto o vizinho fica mais baixo (%) · escuro = brilho do vizinho
  var LADO = { passo: 68, escala: 0.82, giro: 14, desce: 5, escuro: 0.62 };
  function aplicarLado() {
    if (!modal || !modal.classList.contains('aberto') || typeof _cardEls === 'undefined' || typeof _mapaMenu === 'undefined') return;
    _cardEls.forEach(function (card, idx) {
      var diff = (idx + 1) - _mapaMenu, a = Math.abs(diff), s = diff < 0 ? -1 : 1, t, op, z, filtro = '';
      if (diff === 0) { t = 'translateX(0%) translateY(0%) scale(1) rotateY(0deg)'; op = 1; z = 60; }
      else if (a === 1) { t = 'translateX(' + (s * LADO.passo) + '%) translateY(' + LADO.desce + '%) scale(' + LADO.escala + ') rotateY(' + (-s * LADO.giro) + 'deg)'; op = 1; z = 40; filtro = 'brightness(' + LADO.escuro + ') saturate(.85)'; }
      else { t = 'translateX(' + (s * (LADO.passo + 52)) + '%) translateY(' + (LADO.desce + 3) + '%) scale(' + (LADO.escala - 0.1) + ') rotateY(' + (-s * (LADO.giro + 6)) + 'deg)'; op = 0; z = 10; filtro = 'brightness(.5)'; }
      card.style.transform = t; card.style.opacity = op; card.style.zIndex = z; card.style.filter = filtro;
      card.style.pointerEvents = a <= 1 ? 'auto' : 'none'; // tocar no vizinho também troca de mapa
      if (!card._nrLado) { // 1 vez por cartão: toque no cartão do lado = vai para ele
        card._nrLado = true;
        card.addEventListener('click', function () { var d = (idx + 1) - _mapaMenu; if (d === 1 && typeof irProximo === 'function') irProximo(); else if (d === -1 && typeof irAnterior === 'function') irAnterior(); });
      }
    });
  }
  var posOriginal = window.posicionarCards;
  if (typeof posOriginal === 'function') window.posicionarCards = function () { var r = posOriginal.apply(this, arguments); aplicarLado(); return r; };

  function fecharMapa() {
    if (!modal) return;
    if (typeof _cardEls !== 'undefined') _cardEls.forEach(function (c) { c.style.filter = ''; }); // limpa o escurecimento dos vizinhos
    modal.classList.remove('aberto'); modal.setAttribute('aria-hidden', 'true');
    if (pai && pilha) pai.insertBefore(pilha, irmao);  // devolve o seletor ao lugar antigo (escondido)
    var caixa = bMapa && bMapa.closest('.nr-opt');
    if (caixa) { caixa.classList.remove('nr-lancar'); caixa.classList.add('nr-volta'); }
    ocupado = false;
  }
  if (bMapa) bMapa.addEventListener('click', function () { lancar(bMapa, abrirMapa, true); });
  var bVoltar = $('nrMapaVoltar'); if (bVoltar) bVoltar.addEventListener('click', function () { som(); fecharMapa(); });
  if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) fecharMapa(); }); // tocar fora também fecha
  window.addEventListener('pageshow', function (e) { if (e.persisted) { ocupado = false; document.querySelectorAll('.nr-opt.nr-lancar').forEach(function (c) { c.classList.remove('nr-lancar'); c.classList.add('nr-volta'); }); } });

  // ── MOEDAS: Créditos = moedas do jogador (a linha de Tech Points foi removida do menu) ──
  function fmt(n) { n = Math.max(0, Math.floor(Number(n) || 0)); return n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K' : String(n); }
  function lerMoedas() {
    var cred = 0;
    try { cred = Number(localStorage.getItem('moedas')) || 0; } catch (e) {}
    try { var p = window.NRDados && NRDados.perfilLocal && NRDados.perfilLocal(); if (p && p.progresso) { if (p.progresso.moedas != null) cred = Number(p.progresso.moedas) || cred; } } catch (e) {}
    var a = $('nrValCreditos');
    if (a) a.textContent = fmt(cred);
  }
  lerMoedas(); setInterval(lerMoedas, 2000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) lerMoedas(); });
  window.addEventListener('storage', lerMoedas);
})();
