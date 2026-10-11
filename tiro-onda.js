// ══════════════════════════════════════════════════════════════════
// TIRO-ONDA.JS — o SOM DO TIRO em "onda" e que acompanha o movimento da nave.
// Carregado ANTES do boss3d.js (game3d.html). O boss3d.js chama NRTiroOnda.proximo() a cada tiro e toca o som
// com o tom, o lado (esquerda/direita no fone) e o volume que ele devolver.
//
// Antes: cada tiro tinha um tom sorteado (±8%), então o som ficava repetitivo.
// Agora o tom SOBE E DESCE como uma onda, e o som "respeita" a nave:
//   • ONDA POR TIRO  — a cada tiro a onda avança um passo: o som sobe, desce, sobe... numa sequência musical.
//                      Se você atira mais rápido, a onda também fica mais rápida.
//   • ONDA LENTA     — uma segunda onda, por tempo, dá uma "respiração" (o conjunto inteiro sobe e desce devagar).
//   • POSIÇÃO        — nave mais para CIMA na tela = som mais agudo; mais para BAIXO = mais grave.
//   • LADO           — nave à esquerda → o tiro sai mais no ouvido esquerdo; à direita, no direito (fone/estéreo).
//   • MOVIMENTO      — nave correndo para o lado/para cima "empurra" o tom (efeito Doppler leve); parada = tom limpo.
//   • VOLUME         — também ondula um pouco com a onda, para o tiro "inchar e murchar".
// Para mexer no jeito do som é só mudar os números de CFG abaixo.
// ══════════════════════════════════════════════════════════════════
var NRTiroOnda = (function () {
  'use strict';
  var CFG = {
    passoFase: 0.55,     // quanto a onda avança a cada tiro (radianos). Maior = onda mais curta/rápida
    ondaAmp: 0.13,       // altura da onda por tiro (±13% no tom)
    periodoLento: 2.6,   // segundos da onda lenta ("respiração")
    ondaLentaAmp: 0.06,  // altura da onda lenta
    posYAmp: 0.10,       // quanto a altura da nave muda o tom (±10%)
    velAmp: 0.05,        // quanto o movimento empurra o tom (±5%)
    velRef: 9,           // velocidade da nave (unidades/s) que conta como "movimento cheio"
    panMax: 0.85,        // 1 = o tiro vai todo para um ouvido quando a nave está na ponta; 0 desliga o efeito de lado
    volOnda: 0.18,       // quanto o volume ondula (±18%)
    jitter: 0.015,       // um tiquinho de sorte (±1,5%) só para não ficar mecânico
    taxaMin: 0.72, taxaMax: 1.4,
    xMax: 4.2, yMin: 0.6, yMax: 9.5, // mesmos limites de voo do jogo
  };
  var fase = Math.random() * Math.PI * 2, ult = null;
  function lim(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // Devolve { taxa, pan, vol } para o tiro que está saindo AGORA.
  function proximo() {
    var agora = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
    var x = 0, y = (CFG.yMin + CFG.yMax) / 2;
    try { if (typeof shipGroup !== 'undefined') { x = shipGroup.position.x; y = shipGroup.position.y; } } catch (e) {}
    var vx = 0, vy = 0;
    if (ult) { var dt = Math.max(0.016, agora - ult.t); vx = (x - ult.x) / dt; vy = (y - ult.y) / dt; }
    ult = { t: agora, x: x, y: y };
    fase += CFG.passoFase;
    var w1 = Math.sin(fase);                                         // onda por tiro
    var w2 = Math.sin(agora * Math.PI * 2 / CFG.periodoLento);       // onda lenta
    var yn = lim(((y - CFG.yMin) / (CFG.yMax - CFG.yMin)) * 2 - 1, -1, 1);     // -1 (embaixo) .. +1 (em cima)
    var xn = lim(x / CFG.xMax, -1, 1);                                          // -1 (esquerda) .. +1 (direita)
    var mov = lim((vx * 0.6 + vy * 0.9) / CFG.velRef, -1, 1);                   // sobe/avança = tom sobe
    var taxa = 1 + CFG.ondaAmp * w1 + CFG.ondaLentaAmp * w2 + CFG.posYAmp * yn + CFG.velAmp * mov + (Math.random() - 0.5) * 2 * CFG.jitter;
    return {
      taxa: lim(taxa, CFG.taxaMin, CFG.taxaMax),
      pan: lim(xn * CFG.panMax, -1, 1),
      vol: lim(1 + CFG.volOnda * (0.6 * w1 + 0.4 * w2), 0.7, 1.25),
    };
  }
  return { proximo: proximo, cfg: CFG };
})();
