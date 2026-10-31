// RANKING.JS — Top 30 global (ranking/{uid}: name, score, level, onda). Quem joga aparece destacado.
(function () {
  'use strict';
  document.getElementById('btnVoltar').onclick = function () { location.href = 'menu.html'; };
  window.addEventListener('load', async function () {
    var box = document.getElementById('lista');
    try {
      var uid = await window.NRDados.uid(), lista = await window.NRConta.ranking(30);
      if (!lista.length) { box.innerHTML = '<div id="msg">Ninguém no ranking ainda. Seja o primeiro!</div>'; return; }
      box.innerHTML = lista.map(function (r, i) {
        return '<div class="lin p' + (i + 1) + '" data-n="' + (r.name || '') + '"><div class="pos">' + (i + 1) + '</div><div class="nm"><b>' + String(r.name || 'Raider').replace(/</g, '&lt;') + '</b><small>NÍVEL ' + (r.level || 1) + ' · ONDA ' + (r.onda || '-') + '</small></div><div class="pt">' + Number(r.score || 0).toLocaleString('pt-BR') + '</div></div>';
      }).join('');
      var nomeEu = await window.NRConta.nome();
      box.querySelectorAll('.lin').forEach(function (l) { if (l.dataset.n === nomeEu) l.classList.add('eu'); });
    } catch (e) { console.error(e); box.innerHTML = '<div id="msg">Não foi possível carregar o ranking.<br>' + e.message + '</div>'; }
  });
})();
