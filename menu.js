// ══════════════════════════════════════════════════════════════════
// MENU.JS — lógica do menu principal: perfil, moedas, recorde, navegação,
// música do menu, ajustes e aviso de manutenção.
// ══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var A = window.NRAudio, D = window.NRData;

  function toast(txt, tipo) { var t = $('toast'); t.textContent = txt; t.className = 'on ' + (tipo || ''); clearTimeout(toast._t); toast._t = setTimeout(function () { t.className = ''; }, 2600); }
  function ir(url) { A.tocar('confirmar'); setTimeout(function () { location.href = url; }, 120); }

  async function atualizarDados(forcar) {
    var lo = await window.NRConta.loadout(forcar), moedas = await window.NRConta.moedas(forcar);
    $('moedasTxt').textContent = moedas.toLocaleString('pt-BR');
    var p = await window.NRConta.perfil(); var rec = p && p.survivor && p.survivor.recorde;
    $('recorde').textContent = rec && rec.onda ? 'RECORDE: ONDA ' + rec.onda + '  ·  ' + (rec.abates || 0) + ' ABATES' : 'SEM RECORDE — JOGUE A PRIMEIRA PARTIDA';
    return lo;
  }

  async function iniciar() {
    var lo = await atualizarDados(true);
    if (window.NRHudPerfil) { try { window.NRHudPerfil.iniciar(); } catch (e) { console.warn('hud perfil:', e); } }
    if (window.NRMenuHeroi) window.NRMenuHeroi.iniciar(lo);

    // música do menu começa no primeiro toque (regra dos navegadores)
    var tocou = false;
    function musica() { if (tocou) return; tocou = true; A.destravar(); A.musica('menu'); }
    ['pointerdown', 'touchstart', 'keydown'].forEach(function (ev) { window.addEventListener(ev, musica, { once: true }); });

    $('btnJogar').onclick = function () { ir('jogo.html'); };
    $('btnOnline').onclick = function () { ir('sala.html'); };
    $('btnRanking').onclick = function () { ir('ranking.html'); };
    $('btnHangar').onclick = function () { ir('loja.html'); };
    $('btnBau').onclick = function () { ir('bau.html'); };

    // ajustes
    function abrirAjustes() { A.tocar('clique'); $('volMusica').value = A.volumeMusica(); $('volSfx').value = A.volumeSfx(); $('btnMudo').textContent = 'SOM: ' + (A.mudo() ? 'DESLIGADO' : 'LIGADO'); $('modalAjustes').classList.remove('oculto'); }
    $('btnAjustes').onclick = abrirAjustes; $('btnAjustes2').onclick = abrirAjustes;
    $('btnFecharAjustes').onclick = function () { A.tocar('voltar'); $('modalAjustes').classList.add('oculto'); };
    $('volMusica').oninput = function (e) { A.volumeMusica(parseFloat(e.target.value)); };
    $('volSfx').oninput = function (e) { A.volumeSfx(parseFloat(e.target.value)); A.tocar('clique'); };
    $('btnMudo').onclick = function () { A.mudo(!A.mudo()); $('btnMudo').textContent = 'SOM: ' + (A.mudo() ? 'DESLIGADO' : 'LIGADO'); };
    $('btnSair').onclick = async function () {
      try {
        var f = await window.NRDados._getFirebase(), m = await import('https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js');
        window.NRRede && window.NRRede.limparSessao && window.NRRede.limparSessao();
        try { localStorage.removeItem('nrSessaoOnline'); } catch (e) {}
        await m.signOut(f.auth); location.href = 'login.html';
      } catch (e) { toast('Não foi possível sair: ' + e.message, 'erro'); }
    };

    // manutenção ligada pelo admin: bloqueia o menu na hora
    try {
      var f = await window.NRDados._getFirebase();
      f.dbMod.onValue(f.dbMod.ref(f.db, 'sistema/manutencao'), function (s) { $('manutencao').classList.toggle('oculto', s.val() !== true); });
    } catch (e) { /* sem manutenção monitorada: segue normal */ }

    // voltando de outra página (hangar/baú): atualiza as moedas
    window.addEventListener('pageshow', function () { atualizarDados(true); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) A.suspender(); else A.retomar(); });
  }
  window.addEventListener('load', function () { iniciar().catch(function (e) { console.error(e); toast('Erro ao carregar o menu: ' + e.message, 'erro'); }); });
})();
