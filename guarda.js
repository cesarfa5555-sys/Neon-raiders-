// GUARDA.JS — trava de login: se não houver conta logada, manda para a tela de login.
// Incluir DEPOIS do dados.js em toda página que precisa de conta (menu, loja, jogo, sala...).
(function () {
  window.NRDados._getFirebase().then(function (f) {
    f.onAuthStateChanged(f.auth, function (u) { if (!u) window.location.href = 'login.html'; });
  });
})();
