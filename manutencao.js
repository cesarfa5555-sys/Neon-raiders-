// ══════════════════════════════════════════════════════════════════
// MANUTENCAO.JS — bloqueia esta página enquanto o jogo estiver em
// manutenção (ligada no admin-espectador). Ouve sistema/manutencao em
// tempo real: se for ligada com a página já aberta, redireciona na
// hora pro menu.html, que mostra a tela cheia de aviso sozinho.
//
// Incluir com <script type="module" src="manutencao.js"></script> nas
// páginas que só existem DEPOIS do login — hoje: modos.html, loja.html,
// loja-vanguard.html, bau-system.html, conquistas.html. NÃO incluir em:
//   - menu.html, que já tem sua própria tela de aviso embutida e não
//     precisa redirecionar pra lugar nenhum;
//   - login.html / index.html: redirecionar pra menu.html faria loop
//     infinito, porque o próprio menu.html manda quem não está logado
//     de volta pro login.html. Deixa esses dois passarem — assim que o
//     jogador loga, cai no menu.html e vê o aviso lá, sem loop;
//   - admin-espectador.html, porque o admin precisa continuar
//     entrando ali pra poder desligar a manutenção depois.
// game3d.html não usa este arquivo — lá quem cuida disso é o
// telemetria.js, reaproveitando a mesma conexão que o jogo já tem
// aberta com o Firebase, em vez de abrir uma segunda à toa.
// ══════════════════════════════════════════════════════════════════
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-database.js";

const firebaseConfig = { apiKey:"AIzaSyBetMNuPB8BDfvcanmgEUIWw3bLNgbi9aM",authDomain:"neon-raiders.firebaseapp.com",projectId:"neon-raiders",storageBucket:"neon-raiders.firebasestorage.app",messagingSenderId:"307351573602",appId:"1:307351573602:web:a1ce6488ed420d5b99ad3b",databaseURL:"https://neon-raiders-default-rtdb.firebaseio.com" };
// getApps() reaproveita a conexão que a página já abriu (se o script
// dela rodar antes deste) em vez de abrir uma segunda à toa
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getDatabase(app);

onValue(ref(db, 'sistema/manutencao'), (snap) => {
  const ativa = snap.exists() && snap.val() === true;
  // location.href já é menu.html: não redireciona (evita loop) — a
  // própria tela de manutenção do menu.html cuida do aviso
  if (ativa && !location.pathname.endsWith('menu.html')) {
    location.href = 'menu.html';
  }
});
