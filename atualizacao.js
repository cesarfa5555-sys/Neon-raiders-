// ══════════════════════════════════════════════════════════════════
// ATUALIZACAO.JS
// Sistema de anúncio de atualização em tempo real, via Firebase.
// Inclua este script (type="module") em TODAS as páginas do jogo
// (menu.html, game.html, loja.html, loja-vanguard.html, conquistas.html
// etc) — ele funciona de forma independente em cada uma.
//
// Como funciona:
//   1) O admin publica uma atualização no adm.html (agora ou agendada)
//   2) Isso grava em sistema/atualizacao no Firebase, com um timestamp
//      novo (publicadoEm) e, opcionalmente, um horário futuro
//      (agendadoPara)
//   3) TODO jogador conectado já está "escutando" esse dado em tempo
//      real. Assim que muda, cada celular calcula sozinho se já é hora
//      de mostrar a trava (ou agenda um timer local pro horário certo)
//   4) Jogador que abre o jogo depois também é pego, porque ao carregar
//      a página a gente já checa: "esse publicadoEm é mais novo que o
//      último que eu já vi?" — se for, mostra a trava
//   5) Ao clicar ATUALIZAR: barra de progresso (~3s) → recarrega pro
//      menu já "atualizado" → mostra a tela de novidades
// ══════════════════════════════════════════════════════════════════

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBetMNuPB8BDfvcanmgEUIWw3bLNgbi9aM",
  authDomain: "neon-raiders.firebaseapp.com",
  projectId: "neon-raiders",
  storageBucket: "neon-raiders.firebasestorage.app",
  messagingSenderId: "307351573602",
  appId: "1:307351573602:web:a1ce6488ed420d5b99ad3b",
  databaseURL: "https://neon-raiders-default-rtdb.firebaseio.com"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getDatabase(app);

// Chave no localStorage: guarda o "publicadoEm" da última atualização
// que esse jogador já viu/aplicou. Se o que vier do Firebase for mais
// novo que isso, ele ainda não atualizou.
const CHAVE_VERSAO_VISTA = 'nr_atualizacao_vista';

// Chave temporária (sessionStorage) só pra saber, logo depois do
// reload, que acabamos de sair da tela de "atualizando" e devemos
// mostrar a tela de novidades
const CHAVE_MOSTRAR_NOVIDADES = 'nr_mostrar_novidades';

let _timerAgendado = null;
let _dadosAtuais = null;

function getVersaoVista() {
  return Number(localStorage.getItem(CHAVE_VERSAO_VISTA)) || 0;
}

// ── ESCUTA EM TEMPO REAL ──────────────────────────────────────
onValue(ref(db, 'sistema/atualizacao'), (snap) => {
  if (!snap.exists()) return;
  const dados = snap.val();
  _dadosAtuais = dados;
  avaliarEAgendar(dados);
});

// Decide se mostra a trava agora, agenda pra mostrar mais tarde, ou
// não faz nada (o jogador já viu essa atualização)
function avaliarEAgendar(dados) {
  if (!dados || !dados.publicadoEm) return;

  // Já vi essa atualização (ou uma mais nova)? Não faz nada.
  if (dados.publicadoEm <= getVersaoVista()) return;

  if (_timerAgendado) { clearTimeout(_timerAgendado); _timerAgendado = null; }

  const agora = Date.now();
  const horarioAlvo = dados.agendadoPara || dados.publicadoEm;

  if (agora >= horarioAlvo) {
    mostrarTravaAtualizacao(dados);
  } else {
    // Agenda pra mostrar exatamente na hora certa, sem precisar
    // recarregar a página ou ficar checando em loop
    const espera = horarioAlvo - agora;
    _timerAgendado = setTimeout(() => mostrarTravaAtualizacao(dados), espera);
  }
}

// ── TELA DE TRAVA (bloqueia o jogo até atualizar) ─────────────
function mostrarTravaAtualizacao(dados) {
  if (document.getElementById('telaAtualizacao')) return; // já está mostrando

  // Pausa a partida se estiver rodando (mesmo padrão do modo manutenção)
  if (typeof G !== 'undefined') G.running = false;

  const tela = document.createElement('div');
  tela.id = 'telaAtualizacao';
  tela.style.cssText = 'position:fixed;inset:0;z-index:99999;background:radial-gradient(ellipse at center,rgba(0,10,40,0.98) 0%,rgba(0,0,0,1) 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;font-family:Orbitron,monospace;padding:24px;text-align:center;';

  tela.innerHTML = `
    <div style="font-size:42px;">🚀</div>
    <div style="font-size:clamp(20px,7vw,32px);font-weight:900;color:#40daf2;text-shadow:0 0 20px #40daf2,0 0 50px #40daf266;letter-spacing:3px;">NOVA ATUALIZAÇÃO</div>
    <div style="font-family:'Share Tech Mono',monospace;font-size:12px;color:#ffffff88;letter-spacing:2px;">Tamanho: <span style="color:#ffd700;">${dados.tamanho || '—'}</span></div>
    <p style="font-family:'Share Tech Mono',monospace;font-size:11px;color:#ffffff55;letter-spacing:1px;max-width:280px;line-height:1.7;">É preciso atualizar pra continuar jogando. Não demora nada!</p>

    <button id="btnAtualizarAgora" style="font-family:'Orbitron',monospace;font-size:13px;font-weight:700;letter-spacing:3px;color:#000;background:linear-gradient(135deg,#40daf2,#cf54c9);border:none;border-radius:14px;padding:16px 36px;cursor:pointer;margin-top:8px;box-shadow:0 0 24px #40daf288;">⬇ ATUALIZAR</button>

    <div id="progressoWrap" style="display:none;flex-direction:column;align-items:center;gap:10px;width:100%;max-width:300px;margin-top:8px;">
      <div style="width:100%;height:10px;background:rgba(255,255,255,0.08);border:1px solid rgba(64,218,242,0.3);border-radius:6px;overflow:hidden;">
        <div id="progressoFill" style="height:100%;width:0%;background:linear-gradient(90deg,#40daf2,#cf54c9);box-shadow:0 0 10px #40daf2;transition:width 0.15s linear;"></div>
      </div>
      <div id="progressoTexto" style="font-family:'Share Tech Mono',monospace;font-size:11px;color:#40daf2;letter-spacing:2px;">BAIXANDO... 0%</div>
    </div>
  `;

  document.body.appendChild(tela);

  document.getElementById('btnAtualizarAgora').addEventListener('click', () => {
    iniciarProgressoAtualizacao(dados);
  });
}

// Anima a barra de 0 a 100%, depois marca a versão como vista e recarrega
function iniciarProgressoAtualizacao(dados) {
  const btn = document.getElementById('btnAtualizarAgora');
  const wrap = document.getElementById('progressoWrap');
  const fill = document.getElementById('progressoFill');
  const texto = document.getElementById('progressoTexto');

  btn.style.display = 'none';
  wrap.style.display = 'flex';

  let progresso = 0;
  const duracaoMs = 3000; // ~3 segundos de "download"
  const passo = 100 / (duracaoMs / 60);

  const intervalo = setInterval(() => {
    progresso = Math.min(100, progresso + passo);
    fill.style.width = progresso + '%';
    texto.textContent = 'BAIXANDO... ' + Math.floor(progresso) + '%';

    if (progresso >= 100) {
      clearInterval(intervalo);
      texto.textContent = 'CONCLUÍDO! Reiniciando...';

      // Marca essa atualização como vista e guarda as novidades pra
      // mostrar assim que a página recarregar
      localStorage.setItem(CHAVE_VERSAO_VISTA, String(dados.publicadoEm));
      sessionStorage.setItem(CHAVE_MOSTRAR_NOVIDADES, JSON.stringify(dados.novidades || []));

      setTimeout(() => {
        // Sempre volta pro menu — não importa de onde o jogador foi
        // "puxado" (partida, loja, etc), o pouso natural é o menu
        window.location.href = 'menu.html?att=' + dados.publicadoEm;
      }, 500);
    }
  }, 60);
}

// ── TELA "O QUE HÁ DE NOVO" (mostrada logo após o reload) ─────
function mostrarNovidadesSePendente() {
  const bruto = sessionStorage.getItem(CHAVE_MOSTRAR_NOVIDADES);
  if (!bruto) return;
  sessionStorage.removeItem(CHAVE_MOSTRAR_NOVIDADES);

  let novidades = [];
  try { novidades = JSON.parse(bruto); } catch(e) {}
  if (!Array.isArray(novidades) || novidades.length === 0) return;

  const tela = document.createElement('div');
  tela.id = 'telaNovidades';
  tela.style.cssText = 'position:fixed;inset:0;z-index:99999;background:radial-gradient(ellipse at center,rgba(0,10,40,0.98) 0%,rgba(0,0,0,1) 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;font-family:Orbitron,monospace;padding:24px;text-align:center;';

  const itensHtml = novidades.map(n => `
    <div style="display:flex;align-items:flex-start;gap:10px;background:rgba(64,218,242,0.06);border:1px solid rgba(64,218,242,0.2);border-radius:12px;padding:12px 14px;width:100%;text-align:left;">
      <span style="color:#40daf2;font-size:16px;flex-shrink:0;">✦</span>
      <span style="font-family:'Share Tech Mono',monospace;font-size:12px;color:#ffffffcc;letter-spacing:0.5px;line-height:1.5;">${String(n).replace(/</g,'&lt;')}</span>
    </div>
  `).join('');

  tela.innerHTML = `
    <div style="font-size:38px;">🎉</div>
    <div style="font-size:clamp(20px,7vw,30px);font-weight:900;color:#40daf2;text-shadow:0 0 20px #40daf2;letter-spacing:3px;">O QUE HÁ DE NOVO</div>
    <div style="display:flex;flex-direction:column;gap:10px;width:100%;max-width:340px;max-height:50vh;overflow-y:auto;margin-top:4px;">
      ${itensHtml}
    </div>
    <button id="btnFecharNovidades" style="font-family:'Orbitron',monospace;font-size:12px;font-weight:700;letter-spacing:3px;color:#000;background:linear-gradient(135deg,#40daf2,#cf54c9);border:none;border-radius:14px;padding:14px 32px;cursor:pointer;margin-top:10px;">✓ VAMOS JOGAR</button>
  `;

  document.body.appendChild(tela);

  document.getElementById('btnFecharNovidades').addEventListener('click', () => {
    tela.remove();
  });
}

// Roda assim que a página carrega — pega o caso de quem chegou pela
// primeira vez depois do reload da atualização
mostrarNovidadesSePendente();