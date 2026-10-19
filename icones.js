// ══════════════════════════════════════════════════════════════════
// ICONES.JS — conjunto de ícones SVG do jogo (no lugar de emojis).
// Todos desenhados em grade 24x24, no mesmo estilo (traço arredondado, neon).
// A cor vem do texto ao redor (currentColor), então basta mudar o "color" no CSS.
//
//   NRIcones.svg('rifle')                 → string <svg>… (para usar em innerHTML)
//   <span data-ico="moeda"></span>        → qualquer elemento com data-ico recebe o ícone
//                                           (o preenchimento roda sozinho ao carregar a página)
// Para trocar/criar um ícone: edite a tabela ICONES abaixo.
// Convenção: classe "f" = parte preenchida; sem classe = só contorno.
// ══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var ICONES = {
    // ── armas e habilidades ──
    rifle: '<path d="M2 12h13l2.2-2.2H22v4.2h-4.6l-1.2 2H12.6l-.9 4.4H8.6l1-4.4H2z"/><path d="M6 12V9.5h6"/>',
    katana: '<path d="M21 3L8.5 15.5"/><path d="M7 13.5l3.5 3.5"/><path d="M6.2 17.8L3 21"/><path d="M5 15.6l3.4 3.4" class="f"/>',
    drones: '<circle cx="12" cy="12" r="3"/><path d="M9.8 9.8L6 6M14.2 9.8L18 6M9.8 14.2L6 18M14.2 14.2L18 18"/><circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/>',
    emp: '<circle cx="12" cy="12" r="2.2" class="f"/><circle cx="12" cy="12" r="5.5"/><path d="M12 2.5a9.5 9.5 0 0 1 9.5 9.5M12 21.5A9.5 9.5 0 0 1 2.5 12"/>',
    tesla: '<path d="M13.5 2L4.5 13.5h6.5l-1.5 8.5 9-12h-6.5z" class="f"/>',
    granada: '<circle cx="11.5" cy="14" r="7"/><path d="M9 7.5h5M13.5 7l3.5-3.5M17 3.5l2.5 1M17 3.5l.5 2.6"/><path d="M8.5 13.5a3.2 3.2 0 0 1 3-2.8"/>',
    orbital: '<circle cx="12" cy="13" r="5"/><circle cx="12" cy="13" r="1.4" class="f"/><path d="M12 2v5M12 19v3M2.5 13h4M17.5 13h4"/>',
    // ── passivas ──
    dano: '<path d="M12 2.5c.8 3.6 5.2 5.6 5.2 10.6a5.2 5.2 0 0 1-10.4 0c0-2.6 1.6-3.8 2.2-6 1.3 1 2.4 2 3 3.4.6-2.4-.6-4.6 0-8z"/>',
    cadencia: '<circle cx="12" cy="13" r="8"/><path d="M12 8.5V13l3 2M9.5 2.5h5"/>',
    vel: '<path d="M4.5 5.5L11 12l-6.5 6.5M12.5 5.5L19 12l-6.5 6.5"/>',
    escudo: '<path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10.5-4.6-1.9-8-5.5-8-10.5v-6z"/><path d="M12 8v7M8.5 11.5h7"/>',
    regen: '<path d="M12 21S3.5 15.5 3.5 9.7A4.6 4.6 0 0 1 12 7.3a4.6 4.6 0 0 1 8.5 2.4C20.5 15.5 12 21 12 21z"/><path d="M12 10v5M9.5 12.5h5"/>',
    ima: '<path d="M5.5 3v9a6.5 6.5 0 0 0 13 0V3h-4v9a2.5 2.5 0 0 1-5 0V3z"/><path d="M5.5 6.5h4M14.5 6.5h4"/>',
    critico: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="1.5" class="f"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
    dash: '<path d="M3 8h6M2 12h8M3 16h6"/><path d="M13 5.5l7 6.5-7 6.5"/>',
    xp: '<path d="M3 20h4v-5h4v-5h4V5h6" /><path d="M17 3.5h4.5V8"/>',
    // ── itens e economia ──
    cura: '<rect x="3.5" y="7" width="17" height="13" rx="2"/><path d="M9 7V4.5h6V7M12 10.5v6M9 13.5h6"/>',
    moeda: '<path d="M12 2.5l8.5 9.5-8.5 9.5L3.5 12z"/><path d="M12 7.5l4 4.5-4 4.5-4-4.5z" class="f"/>',
    sucata: '<path d="M19.4 13a7.5 7.5 0 0 0 0-2l2-1.5-2-3.4-2.3.9a7.6 7.6 0 0 0-1.7-1L15 3h-4l-.4 2.5a7.6 7.6 0 0 0-1.7 1l-2.3-.9-2 3.4 2 1.5a7.5 7.5 0 0 0 0 2l-2 1.5 2 3.4 2.3-.9c.5.4 1.1.7 1.7 1L11 21h4l.4-2.5c.6-.3 1.2-.6 1.7-1l2.3.9 2-3.4z"/><circle cx="13" cy="12" r="2.8"/>',
    engrenagem: '<path d="M19.4 13a7.5 7.5 0 0 0 0-2l2-1.5-2-3.4-2.3.9a7.6 7.6 0 0 0-1.7-1L15 3h-4l-.4 2.5a7.6 7.6 0 0 0-1.7 1l-2.3-.9-2 3.4 2 1.5a7.5 7.5 0 0 0 0 2l-2 1.5 2 3.4 2.3-.9c.5.4 1.1.7 1.7 1L11 21h4l.4-2.5c.6-.3 1.2-.6 1.7-1l2.3.9 2-3.4z"/><circle cx="13" cy="12" r="2.8"/>',
    abates: '<path d="M12 3a8 8 0 0 0-8 8c0 3 1.6 4.9 3.2 5.9V20h9.6v-3.1C18.4 15.9 20 14 20 11a8 8 0 0 0-8-8z"/><circle cx="9" cy="11" r="1.7" class="f"/><circle cx="15" cy="11" r="1.7" class="f"/><path d="M10 20v-2.5M14 20v-2.5M12 13.5l-.8 2h1.6z"/>',
    bau: '<path d="M3.5 11h17v9h-17z"/><path d="M3.5 11a8.5 5.5 0 0 1 17 0"/><rect x="10.3" y="10" width="3.4" height="4.4" rx=".8" class="f"/>',
    caixa: '<path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9"/>',
    trofeu: '<path d="M7.5 3.5h9v6a4.5 4.5 0 0 1-9 0z"/><path d="M7.5 5.5H4v2a3.5 3.5 0 0 0 3.5 3.5M16.5 5.5H20v2a3.5 3.5 0 0 1-3.5 3.5M12 14v4M8 20.5h8M9.5 18h5"/>',
    presente: '<rect x="3.5" y="9" width="17" height="11" rx="1.5"/><path d="M12 9v11M3.5 13h17"/><path d="M12 9c-1-4-5.5-4-5 -1 .3 1.5 3 1 5 1zM12 9c1-4 5.5-4 5-1-.3 1.5-3 1-5 1z"/>',
    // ── interface ──
    pausa: '<path d="M8 5v14M16 5v14" stroke-width="3.2"/>',
    som: '<path d="M4 9.5h4l5-4v13l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
    mudo: '<path d="M4 9.5h4l5-4v13l-5-4H4z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/>',
    check: '<path d="M4.5 12.5l5 5 10-11"/>',
    fechar: '<path d="M5.5 5.5l13 13M18.5 5.5l-13 13"/>',
    voltar: '<path d="M14.5 4.5L7 12l7.5 7.5"/>',
    play: '<path d="M7 4.5v15l12-7.5z" class="f"/>',
    retornar: '<path d="M9 5L4 10l5 5"/><path d="M4 10h10a6 6 0 0 1 0 12h-3"/>',
    reroll: '<path d="M20 11a8 8 0 0 0-14-4.5L4 9"/><path d="M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14 4.5L20 15"/><path d="M20 20v-5h-5"/>',
    alerta: '<path d="M12 3.5L2.5 20h19z"/><path d="M12 10v4.5"/><circle cx="12" cy="17.3" r=".9" class="f"/>',
    estrela: '<path d="M12 2.8l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17.4l-5.9 3.2 1.3-6.5L2.5 9.6l6.6-.8z" class="f"/>',
    subir: '<path d="M12 20V5M5.5 11.5L12 5l6.5 6.5"/>',
    coroa: '<path d="M3.5 18.5l-1-11 5 4 4.5-7 4.5 7 5-4-1 11z" class="f"/>',
    ponto: '<circle cx="12" cy="12" r="6" class="f"/>',
    circulo: '<circle cx="12" cy="12" r="7"/>',
    cadeado: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    etiqueta: '<path d="M3.5 12.2V4.5h7.7l9.3 9.3-7.7 7.7z"/><circle cx="8" cy="9" r="1.4" class="f"/>',
    moldura: '<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M3.5 16l5-5 4 4 3-3 5 5"/><circle cx="16" cy="9" r="1.6" class="f"/>',
    lapis: '<path d="M4 20l1-4.5L16.5 4a2 2 0 0 1 3 0l.5.5a2 2 0 0 1 0 3L8.5 19z"/><path d="M14.5 6l3.5 3.5"/>',
    foguete: '<path d="M12 2.5c4 2.5 5.5 7 4.5 12h-9c-1-5 .5-9.5 4.5-12z"/><circle cx="12" cy="9.5" r="1.8"/><path d="M7.5 14.5L4.5 17.5l3 1M16.5 14.5l3 3-3 1M10 17.5l2 4 2-4"/>',
    festa: '<path d="M12 2l2 5.5 5.5-2-2 5.5L23 12l-5.5 1.5 2 5.5-5.5-2-2 5.5-2-5.5-5.5 2 2-5.5L1 12l5.5-1.5-2-5.5 5.5 2z"/>',
    baixar: '<path d="M12 3.5v12M6.5 10L12 15.5 17.5 10M4 20.5h16"/>',
    cristal: '<path d="M12 2.5l4 6.5-4 12.5L8 9z"/><path d="M8 9h8"/>',
    usuarios: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.6 2.7-6 6-6s6 2.4 6 6"/><circle cx="17" cy="9" r="2.6"/><path d="M16.5 14.2c3 .3 5 2.3 5 5.3"/>',
    // ── personagens ──
    cacador: '<path d="M4.5 14a7.5 7.5 0 0 1 15 0v5.5h-15z"/><path d="M7.5 13.5h9v3h-9z" class="f"/><path d="M12 3V1.5M4.5 19.5h15"/>',
    kunoichi: '<circle cx="11" cy="11" r="5.2"/><path d="M5.8 9.5h10.4"/><path d="M16 7c4.5 0 5.8 5.5 3 11.5-.8 1.6-2.2 2.8-3.4 3" /><path d="M8.5 12.5h5" />',
    avatar: '<circle cx="12" cy="9" r="4"/><path d="M4.5 21c0-4.2 3.3-7 7.5-7s7.5 2.8 7.5 7"/>',
  };

  function svg(nome, extra) {
    var d = ICONES[nome];
    if (!d) return '';
    return '<svg class="ico' + (extra ? ' ' + extra : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';
  }
  // preenche todo elemento [data-ico="nome"] (e mantém os que forem adicionados depois por innerHTML via preencher())
  function preencher(raiz) {
    var els = (raiz || document).querySelectorAll('[data-ico]');
    for (var i = 0; i < els.length; i++) { if (!els[i].firstChild || els[i].dataset.icoOk !== '1') { els[i].innerHTML = svg(els[i].dataset.ico); els[i].dataset.icoOk = '1'; } }
  }

  // estilo único dos ícones (injetado aqui para valer em qualquer página que carregue este arquivo)
  var st = document.createElement('style');
  st.textContent = '.ico{width:1em;height:1em;display:inline-block;vertical-align:-.17em;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}' +
    '.ico .f,.ico path.f,.ico circle.f,.ico rect.f{fill:currentColor;stroke:none}[data-ico]{display:inline-flex;align-items:center;justify-content:center}';
  (document.head || document.documentElement).appendChild(st);

  window.NRIcones = { svg: svg, preencher: preencher, nomes: Object.keys(ICONES) };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { preencher(); }); else preencher();
})();
