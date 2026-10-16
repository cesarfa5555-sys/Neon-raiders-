// ══════════════════════════════════════════════════════════════════
// CONTROLES.JS — como o jogador move o Caçador.
//   • CELULAR: joystick flutuante — encoste o dedo em qualquer lugar da tela
//     e arraste; o joystick nasce embaixo do dedo (como no Survivor.io).
//   • TECLADO: WASD ou setas para mover, ESPAÇO para o dash.
//   • Botão DASH: um toque (o jogo cuida do botão na tela).
// A mira é automática: o Caçador atira sozinho no inimigo mais próximo.
// ══════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  function criar(zona, joyEl, baseEl, botEl) {
    var vec = { mx: 0, mz: 0 }, dashPend = false, ativo = true;
    var RAIO = 56, ZONA_MORTA = 0.12;
    var idToque = null, ox = 0, oy = 0;
    var teclas = {};

    function mostrar(x, y) { joyEl.style.display = 'block'; joyEl.style.left = x + 'px'; joyEl.style.top = y + 'px'; }
    function esconder() { joyEl.style.display = 'none'; botEl.style.transform = 'translate(-50%,-50%)'; }

    function inicio(e) {
      if (!ativo || idToque !== null) return;
      var t = e.changedTouches ? e.changedTouches[0] : e;
      idToque = e.changedTouches ? t.identifier : 'mouse';
      ox = t.clientX; oy = t.clientY; mostrar(ox, oy);
      e.preventDefault();
    }
    function mover(e) {
      if (idToque === null) return;
      var t = null;
      if (e.changedTouches) { for (var i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === idToque) t = e.changedTouches[i]; }
      else if (idToque === 'mouse') t = e;
      if (!t) return;
      var dx = t.clientX - ox, dy = t.clientY - oy, d = Math.hypot(dx, dy);
      if (d > RAIO) { // o centro "acompanha" o dedo quando ele passa do limite (movimento mais confortável)
        ox += dx / d * (d - RAIO); oy += dy / d * (d - RAIO); dx = t.clientX - ox; dy = t.clientY - oy; d = RAIO; mostrar(ox, oy);
      }
      var m = d / RAIO;
      if (m < ZONA_MORTA) { vec.mx = vec.mz = 0; } else { vec.mx = dx / d * Math.min(1, m * 1.15); vec.mz = dy / d * Math.min(1, m * 1.15); }
      botEl.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
      e.preventDefault();
    }
    function fim(e) {
      if (idToque === null) return;
      if (e.changedTouches) { var achou = false; for (var i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === idToque) achou = true; if (!achou) return; }
      idToque = null; vec.mx = vec.mz = 0; esconder();
    }
    zona.addEventListener('touchstart', inicio, { passive: false });
    zona.addEventListener('touchmove', mover, { passive: false });
    zona.addEventListener('touchend', fim); zona.addEventListener('touchcancel', fim);
    // mouse (para testar no computador)
    zona.addEventListener('mousedown', inicio); window.addEventListener('mousemove', mover); window.addEventListener('mouseup', fim);

    // teclado
    function teclado() {
      var x = (teclas.ArrowRight || teclas.KeyD ? 1 : 0) - (teclas.ArrowLeft || teclas.KeyA ? 1 : 0);
      var z = (teclas.ArrowDown || teclas.KeyS ? 1 : 0) - (teclas.ArrowUp || teclas.KeyW ? 1 : 0);
      return { x: x, z: z };
    }
    window.addEventListener('keydown', function (e) {
      if (!ativo) return;
      teclas[e.code] = true;
      if (e.code === 'Space') { dashPend = true; e.preventDefault(); }
    });
    window.addEventListener('keyup', function (e) { teclas[e.code] = false; });
    window.addEventListener('blur', function () { teclas = {}; vec.mx = vec.mz = 0; });

    return {
      // vetor de movimento atual (-1..1 em cada eixo; z positivo = para baixo na tela)
      ler: function () {
        var k = teclado();
        if (k.x || k.z) { var m = Math.hypot(k.x, k.z); return { mx: k.x / m, mz: k.z / m }; }
        return { mx: vec.mx, mz: vec.mz };
      },
      pedirDash: function () { dashPend = true; },
      consumirDash: function () { var d = dashPend; dashPend = false; return d; },
      ativar: function (v) { ativo = v; if (!v) { idToque = null; vec.mx = vec.mz = 0; esconder(); teclas = {}; } },
    };
  }

  window.NRControles = { criar: criar };
})();
