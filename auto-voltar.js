// ══════════════════════════════════════════════════════════════════
// AUTO-VOLTAR.JS — se você saiu de uma partida online SEM QUERER, o jogo te leva de volta sozinho.
// Carregado por menu.html e multiplayer.html (não precisa do multiplayer-core.js).
//
// Como funciona: durante a partida o multiplayer-core.js guarda no aparelho (localStorage 'nrSessaoOnline')
// o token da sala, a página da partida e a hora do último "sinal de vida" (a cada 4 s).
// Quando você abre o MENU ou o LOBBY de novo, este arquivo confere:
//   • tem uma partida em andamento guardada?  • o sinal de vida tem menos de 50 s? (o servidor segura a sua
//     vaga por 60 s)  →  mostra "VOLTANDO PARA A PARTIDA..." por ~1 s (com botão CANCELAR) e te leva para ela.
// Quem saiu DE PROPÓSITO (botão SAIR) ou quando a partida acabou NÃO é puxado de volta: nesses casos a sessão
// guardada é apagada (multiplayer-core.js: sair()/fimDaPartida()).
// Proteções: no máximo 3 tentativas em 2 minutos (evita ficar em loop) e só vai para páginas deste mesmo site.
// ══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var CHAVE = 'nrSessaoOnline', TENT = 'nrAutoVoltarTent', LIMITE_S = 50, MAX_TENT = 3, JANELA_MS = 120000;
  // Voltando do fim da partida para a sala (?sala=1) NÃO pode puxar de volta para o jogo
  if (/[?&]sala=1(&|$)/.test(location.search)) return;
  function ler() { try { return JSON.parse(localStorage.getItem(CHAVE) || 'null'); } catch (e) { return null; } }
  function apagar() { try { localStorage.removeItem(CHAVE); } catch (e) {} }

  var s = ler();
  if (!s || !s.emPartida || !s.url || !s.token) return;
  var idade = (Date.now() - (Number(s.savedAt) || 0)) / 1000;
  if (!(idade >= 0) || idade > LIMITE_S) { apagar(); return; } // velha demais: o servidor já tirou você da sala
  // só vai para uma página do mesmo site (nunca para um endereço de fora)
  var alvo; try { alvo = new URL(s.url, location.href); } catch (e) { apagar(); return; }
  if (alvo.origin !== location.origin) { apagar(); return; }

  // limite de tentativas (se a volta falhar 3x, desiste e apaga a sessão)
  var t; try { t = JSON.parse(sessionStorage.getItem(TENT) || 'null'); } catch (e) { t = null; }
  if (!t || Date.now() - t.t > JANELA_MS) t = { n: 0, t: Date.now() };
  if (t.n >= MAX_TENT) { apagar(); try { sessionStorage.removeItem(TENT); } catch (e) {} return; }
  t.n++; try { sessionStorage.setItem(TENT, JSON.stringify(t)); } catch (e) {}

  var b = document.createElement('div');
  b.style.cssText = 'position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 14px);transform:translateX(-50%);z-index:2147483000;background:#05101fee;border:1px solid #00ffff;border-radius:12px;padding:12px 16px;color:#cfeaff;font:700 13px Orbitron,monospace;letter-spacing:1px;text-align:center;box-shadow:0 0 18px #0ff6;max-width:86vw';
  b.innerHTML = '↩ VOLTANDO PARA A PARTIDA...<div style="font-weight:400;font-size:11px;margin:6px 0 10px;opacity:.85">Você saiu sem querer? A sala guardou a sua vaga.</div>' +
    '<button style="font:700 12px Orbitron,monospace;padding:8px 16px;border-radius:8px;border:1px solid #ff5d73;background:#ff5d7322;color:#ff9aa8">CANCELAR (não voltar)</button>';
  function mostrar() { if (document.body) document.body.appendChild(b); else document.addEventListener('DOMContentLoaded', function () { document.body.appendChild(b); }); }
  mostrar();
  var timer = setTimeout(function () { location.replace(alvo.href); }, 1200);
  b.querySelector('button').onclick = function () { // não quer voltar: apaga a sessão (a vaga some sozinha em 60 s)
    clearTimeout(timer); apagar(); try { sessionStorage.removeItem(TENT); } catch (e) {} if (b.parentNode) b.parentNode.removeChild(b);
  };
})();
