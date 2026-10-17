// ══════════════════════════════════════════════════════════════════
// MENU-CENARIO.JS — fundo animado do menu: skyline cyberpunk em 3 camadas
// (parallax), janelas acesas, letreiros de neon piscando, carros voadores
// e chuva. Desenhado num <canvas> 2D (leve, sem imagens nem vídeo).
// ══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var cv = document.getElementById('fundo'); if (!cv) return;
  var g = cv.getContext('2d'), W = 0, H = 0, t = 0, ult = performance.now();
  var seed = 11; function r() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  var camadas = [], carros = [], gotas = [], letreiros = [];
  var CORES = ['#2ee6ff', '#ff3da6', '#ffd23d', '#b04dff'];

  function montar() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed = 11; camadas = []; letreiros = [];
    [{ alt: 0.5, esc: 0.35, cor: '#0b0a22', luz: 0.25, vel: 4 }, { alt: 0.62, esc: 0.5, cor: '#0d0b2b', luz: 0.4, vel: 9 }, { alt: 0.78, esc: 0.75, cor: '#12103a', luz: 0.6, vel: 16 }].forEach(function (c, ci) {
      var preds = [], x = -40;
      while (x < W + 200) {
        var w = (30 + r() * 60) * (0.8 + c.esc), h = H * c.alt * (0.35 + r() * 0.65) * (0.7 + c.esc * 0.5);
        var janelas = []; for (var jy = 8; jy < h - 6; jy += 9) for (var jx = 5; jx < w - 5; jx += 8) if (r() < c.luz) janelas.push([jx, jy, CORES[(r() * 4) | 0], r()]);
        preds.push({ x: x, w: w, h: h, janelas: janelas });
        if (ci > 0 && r() < 0.22) letreiros.push({ x: x + w / 2, y: H - h + 12 + r() * 40, w: 26 + r() * 20, c: CORES[(r() * 4) | 0], f: r() * 6 });
        x += w + r() * 6;
      }
      camadas.push({ p: preds, cfg: c });
    });
    gotas = []; for (var i = 0; i < 90; i++) gotas.push({ x: r() * W, y: r() * H, v: 500 + r() * 400, l: 10 + r() * 14 });
    carros = []; for (var k = 0; k < 6; k++) carros.push({ x: r() * W, y: H * (0.18 + r() * 0.3), v: (r() < 0.5 ? -1 : 1) * (30 + r() * 60), c: CORES[(r() * 4) | 0] });
  }
  function quadro(now) {
    requestAnimationFrame(quadro);
    var dt = Math.min(0.05, (now - ult) / 1000); ult = now; t += dt;
    if (cv.clientWidth && cv.clientWidth !== W) montar();   // a tela pode ter sido mostrada depois (ex.: abertura)
    if (!W) return;
    var gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#12062e'); gr.addColorStop(0.55, '#2a0f4a'); gr.addColorStop(1, '#06040f');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // lua/brilho no horizonte
    var lg = g.createRadialGradient(W * 0.75, H * 0.28, 0, W * 0.75, H * 0.28, H * 0.35); lg.addColorStop(0, 'rgba(255,61,166,.35)'); lg.addColorStop(1, 'rgba(255,61,166,0)'); g.fillStyle = lg; g.fillRect(0, 0, W, H);
    camadas.forEach(function (c, ci) {
      var off = (t * c.cfg.vel) % 8;
      c.p.forEach(function (b) {
        var bx = b.x - Math.sin(t * 0.15) * c.cfg.vel * 0.5, by = H - b.h;
        g.fillStyle = c.cfg.cor; g.fillRect(bx, by, b.w, b.h);
        g.fillStyle = 'rgba(46,230,255,0.12)'; g.fillRect(bx, by, b.w, 1.5);
        b.janelas.forEach(function (j) { g.globalAlpha = 0.25 + 0.5 * Math.abs(Math.sin(t * 0.6 + j[3] * 20)) * c.cfg.luz + 0.2; g.fillStyle = j[2]; g.fillRect(bx + j[0], by + j[1], 4, 5); });
        g.globalAlpha = 1;
      });
    });
    letreiros.forEach(function (l) {
      var on = Math.sin(t * 2 + l.f) > -0.7 && !(Math.sin(t * 17 + l.f * 5) > 0.96);
      if (!on) return; g.shadowColor = l.c; g.shadowBlur = 14; g.fillStyle = l.c; g.fillRect(l.x - l.w / 2, l.y, l.w, 4); g.fillRect(l.x - l.w / 2, l.y + 9, l.w * 0.6, 3); g.shadowBlur = 0;
    });
    carros.forEach(function (c) {
      c.x += c.v * dt; if (c.x < -30) c.x = W + 30; if (c.x > W + 30) c.x = -30;
      g.shadowColor = c.c; g.shadowBlur = 10; g.fillStyle = c.c; g.fillRect(c.x, c.y, 10, 2); g.fillStyle = '#fff'; g.fillRect(c.x + (c.v > 0 ? 8 : 0), c.y, 2, 2); g.shadowBlur = 0;
    });
    g.strokeStyle = 'rgba(160,215,255,0.28)'; g.lineWidth = 1; g.beginPath();
    gotas.forEach(function (d) { d.y += d.v * dt; d.x -= d.v * dt * 0.12; if (d.y > H) { d.y = -20; d.x = r() * W * 1.2; } g.moveTo(d.x, d.y); g.lineTo(d.x - d.l * 0.12, d.y - d.l); });
    g.stroke();
  }
  montar(); window.addEventListener('resize', montar); requestAnimationFrame(quadro);
})();
