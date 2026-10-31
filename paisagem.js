// ══════════════════════════════════════════════════════════════════
// PAISAGEM.JS — o jogo é 100% DEITADO (paisagem).
//  • Se o celular estiver em pé, cobre a tela com "GIRE O CELULAR"
//    (e a partida em andamento pausa sozinha, ver partida.js).
//  • No primeiro toque tenta entrar em tela cheia e travar a orientação
//    em paisagem (funciona no app/WebView e no Chrome do Android).
// Incluir em TODAS as páginas.
// ══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var css = document.createElement('style');
  css.textContent = '#gire{position:fixed;inset:0;z-index:99999;background:radial-gradient(ellipse at center,#150a35,#05050c 75%);display:none;flex-direction:column;align-items:center;justify-content:center;gap:22px;text-align:center;font-family:Orbitron,Arial,sans-serif;color:#e8f6ff;padding:24px}' +
    '#gire b{font-size:20px;letter-spacing:5px;text-shadow:0 0 18px #2ee6ff}#gire span{font-size:11px;letter-spacing:3px;color:#8fb9d4}' +
    '#gire i{display:block;width:92px;height:52px;border:4px solid #2ee6ff;border-radius:10px;box-shadow:0 0 22px #2ee6ff;position:relative;animation:gireAnim 2.4s ease-in-out infinite}' +
    '#gire i::after{content:"";position:absolute;right:-12px;top:50%;width:4px;height:14px;margin-top:-7px;background:#2ee6ff;border-radius:2px}' +
    '@keyframes gireAnim{0%,20%{transform:rotate(90deg)}60%,100%{transform:rotate(0)}}';
  document.head.appendChild(css);
  var ov = document.createElement('div'); ov.id = 'gire';
  ov.innerHTML = '<i></i><b>GIRE O CELULAR</b><span>NEON RAIDERS É JOGADO NA HORIZONTAL</span>';
  function montar() { document.body.appendChild(ov); checar(); }
  var ultimo = null;
  function checar() {
    var retrato = window.innerHeight > window.innerWidth;
    ov.style.display = retrato ? 'flex' : 'none';
    if (retrato !== ultimo) { ultimo = retrato; window.dispatchEvent(new Event(retrato ? 'nr:retrato' : 'nr:paisagem')); }
  }
  function travar() {
    try {
      var el = document.documentElement;
      if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(function () {});
      if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(function () {});
    } catch (e) { /* alguns navegadores não permitem: o aviso "gire o celular" cobre */ }
  }
  if (document.body) montar(); else document.addEventListener('DOMContentLoaded', montar);
  window.addEventListener('resize', checar); window.addEventListener('orientationchange', function () { setTimeout(checar, 150); });
  window.addEventListener('pointerdown', travar, { once: true });
  try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(function () {}); } catch (e) {}
})();
