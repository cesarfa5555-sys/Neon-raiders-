// ══════════════════════════════════════════════════════════════════
// SALA.JS — lobby do co-op online. Fluxo:
//   1) mede o ping (e acorda o servidor se ele estiver dormindo)
//   2) PARTIDA RÁPIDA / CRIAR SALA / ENTRAR COM CÓDIGO
//   3) cada jogador marca PRONTO; o host (👑) inicia
//   4) no "iniciar" vai para jogo.html?online=1, que RECONECTA na mesma sala
// ══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var A = window.NRAudio, R = null, ultimoEstado = null, indo = false;
  var CORES = ['#2ee6ff', '#ff3da6', '#ffd23d', '#39ff88'];

  function toast(txt, tipo) { var t = $('toast'); t.textContent = txt; t.className = 'on ' + (tipo || ''); clearTimeout(toast._t); toast._t = setTimeout(function () { t.className = ''; }, 3200); }
  function mostrar(sala) { $('telaEntrar').classList.toggle('oculto', sala); $('telaSala').classList.toggle('oculto', !sala); }

  async function testarServidor() {
    var s = $('statusServidor');
    for (var i = 0; i < 8; i++) {
      var p = await R.medirPing(3);
      $('pingDot').className = p.qualidade;
      if (p.ms !== null) { $('pingTxt').textContent = p.ms + ' ms'; s.innerHTML = 'Online ' + NRIcones.svg('check') + ' — conexão <b>' + p.qualidade.toUpperCase() + '</b> (' + p.ms + ' ms)'; return true; }
      $('pingTxt').textContent = '--';
      s.textContent = p.qualidade === 'acordando' ? 'Servidor acordando… isso pode levar até 1 minuto (tentativa ' + (i + 1) + ').' : 'Sem resposta do servidor. Tentando de novo…';
      await new Promise(function (r) { setTimeout(r, 4000); });
    }
    s.textContent = 'Não foi possível conectar ao servidor. Verifique sua internet.'; return false;
  }

  function desenhar(st) {
    ultimoEstado = st; mostrar(true); $('codigo').textContent = st.codigo;
    var h = '', ordenados = st.jogadores.slice().sort(function (a, b) { return a.slot - b.slot; });
    for (var s = 0; s < st.max; s++) {
      var j = null; ordenados.forEach(function (x) { if (x.slot === s) j = x; });
      var c = CORES[s % 4];
      if (!j) { h += '<div class="slot vazio">AGUARDANDO JOGADOR…</div>'; continue; }
      var estado = j.host ? '<div class="st host">' + NRIcones.svg('coroa') + ' HOST</div>' : j.pronto ? '<div class="st ok">PRONTO ' + NRIcones.svg('check') + '</div>' : '<div class="st nao">NÃO PRONTO</div>';
      h += '<div class="slot" style="--c:' + c + '"><div class="av">' + (j.nome || '?').charAt(0).toUpperCase() + '</div><div class="nm"><b>' + j.nome + (j.eu ? ' (VOCÊ)' : '') + '</b><small>NÍVEL ' + j.nivel + ' · ' + (j.conectado ? (j.ping ? j.ping + ' ms' : '…') : 'RECONECTANDO') + '</small></div>' + estado +
        (st.souHost && !j.eu ? '<button class="x" data-id="' + j.id + '">' + NRIcones.svg('fechar') + '</button>' : '') + '</div>';
    }
    $('slots').innerHTML = h;
    $('slots').querySelectorAll('.x').forEach(function (b) { b.onclick = function () { R.expulsar(b.dataset.id); }; });
    var eu = ordenados.filter(function (x) { return x.eu; })[0];
    $('btnPronto').classList.toggle('oculto', st.souHost); $('btnIniciar').classList.toggle('oculto', !st.souHost);
    if (eu && !st.souHost) { $('btnPronto').textContent = eu.pronto ? 'CANCELAR (ESTOU PRONTO)' : 'ESTOU PRONTO'; $('btnPronto').className = 'btn ' + (eu.pronto ? 'sec' : 'ouro'); }
    var todos = ordenados.every(function (x) { return x.host || x.pronto; });
    $('btnIniciar').disabled = !todos; $('btnIniciar').textContent = todos ? (ordenados.length > 1 ? 'INICIAR PARTIDA (' + ordenados.length + ' JOGADORES)' : 'INICIAR SOLO NA SALA') : 'AGUARDANDO TODOS FICAREM PRONTOS';
  }

  async function entrar(fn) {
    try { A.tocar('confirmar'); await fn(); } catch (e) { A.tocar('erro'); toast(String((e && e.message) || e), 'erro'); }
  }

  async function iniciar() {
    $('btnVoltar').onclick = function () { A.tocar('voltar'); if (R && R.sala()) R.sair(); location.href = 'menu.html'; };
    ['pointerdown', 'touchstart'].forEach(function (ev) { window.addEventListener(ev, function () { A.destravar(); }, { once: true }); });
    try { await window.NRRede.carregarBiblioteca(); } catch (e) { $('statusServidor').textContent = 'Erro: ' + e.message; return; }
    R = window.NRRede;
    R.iniciar({ url: window.NR_SERVIDOR, getToken: window.NRConta.token });
    R.on('estado', desenhar);
    R.on('erro', function (m) { toast(m, 'erro'); });
    R.on('ping', function (ms) { $('pingTxt').textContent = ms + ' ms'; });
    R.on('saiu', function (d) { if (indo) return; mostrar(false); if (d.queda) toast('Conexão com a sala perdida.', 'erro'); });
    R.on('iniciar', function (info) {
      indo = true; A.tocar('contagemGo');
      R.marcarPartida('jogo.html?online=1');            // permite voltar sozinho se cair
      setTimeout(function () { location.href = 'jogo.html?online=1'; }, 250);
    });
    testarServidor();
    $('btnRapida').onclick = function () { entrar(function () { return R.partidaRapida(); }); };
    $('btnCriar').onclick = function () { entrar(function () { return R.criarSala({ privada: true }); }); };
    $('btnEntrar').onclick = function () { var c = $('inputCodigo').value.trim().toUpperCase(); if (c.length < 5) { toast('Digite o código de 5 letras.', 'erro'); return; } entrar(function () { return R.entrarPorCodigo(c); }); };
    $('btnPronto').onclick = function () { A.tocar('clique'); var eu = ultimoEstado && ultimoEstado.jogadores.filter(function (x) { return x.eu; })[0]; R.pronto(!(eu && eu.pronto)); };
    $('btnIniciar').onclick = function () { A.tocar('confirmar'); R.iniciarPartida(); };
    $('btnSairSala').onclick = function () { A.tocar('voltar'); R.sair(); mostrar(false); };
    $('btnCopiar').onclick = async function () {
      var cod = $('codigo').textContent, txt = 'Entre na minha sala do NEON RAIDERS! Código: ' + cod;
      try { if (navigator.share) await navigator.share({ text: txt }); else { await navigator.clipboard.writeText(cod); toast('Código copiado!', 'ok'); } } catch (e) { toast('Código: ' + cod, 'ok'); }
    };
    // caso volte do fim de uma partida (?sala=1) ou a conexão ainda esteja viva: tenta reentrar na sala
    if (/[?&]sala=1/.test(location.search)) { var r = await R.reconectar(); if (!r) mostrar(false); }
  }
  window.addEventListener('load', function () { iniciar().catch(function (e) { console.error(e); toast('Erro: ' + e.message, 'erro'); }); });
})();
