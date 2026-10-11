// ══════════════════════════════════════════════════════════════════
// PACOTE-PLASMA.JS — o cartão "NAVE + PILOTO" do hangar (aba JOIAS, em cima da joia Nexus)
// Mostra a nave de plasma e o piloto (imagem fixa embutida em pacote-plasma-img.js).
//
// POR QUE IMAGEM FIXA: a primeira versão montava uma cena 3D (Three.js + WebGL) dentro do cartão, mas isso dependia de
// carregar bibliotecas da internet e de um segundo WebGL (o WebView só aguenta 1, e a joia Nexus já usa o dele).
// Em vez disso, o cartão desenha uma imagem pronta: aparece sempre, na hora, sem custo de GPU.
// API (a mesma de antes, para o loja.js não mudar):
//   NRPacotePlasma.mostrar(callback)  → desenha a imagem e chama o callback na hora
//   NRPacotePlasma.parar()            → (não faz nada: não há animação)
// ══════════════════════════════════════════════════════════════════
var NRPacotePlasma = (function () {
  'use strict';
  var pronta = null, falhou = false;
  function carregar(cb) {
    if (pronta || falhou) return cb();
    var img = new Image();
    img.onload = function () { pronta = img; cb(); };
    img.onerror = function () { falhou = true; cb(); };
    img.src = (typeof NR_PACOTE_PLASMA_IMG === 'string') ? NR_PACOTE_PLASMA_IMG : 'pacote-nave-piloto.png'; // se o arquivo embutido faltar, tenta o .png da pasta
  }
  function desenhar() {
    var tela = document.getElementById('pacotePlasmaCanvas'), msg = document.getElementById('pacotePlasmaCarregando');
    if (msg) msg.style.display = 'none';
    if (!tela) return;
    var ctx = tela.getContext('2d'); ctx.clearRect(0, 0, tela.width, tela.height);
    if (pronta) ctx.drawImage(pronta, 0, 0, tela.width, tela.height);
    else if (msg) { msg.textContent = 'IMAGEM DO PACOTE NÃO ENCONTRADA'; msg.style.display = 'flex'; }
  }
  function mostrar(depois) { carregar(function () { desenhar(); depois && depois(); }); }
  function parar() {}
  return { mostrar: mostrar, parar: parar };
})();
