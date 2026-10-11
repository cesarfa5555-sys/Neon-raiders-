// ══════════════════════════════════════════════════════════════════
// PROFUNDIDADE3D.JS — nave pra FRENTE e pra TRÁS (só no jogo solo)
//
// Como o jogador controla (escolhido no menu ⚙ > PROFUNDIDADE):
//   • DESLIZAR (padrão): segure o botão de TIRO e deslize o polegar pra CIMA (frente) ou pra BAIXO (trás).
//                        O polegar continua atirando; o outro dedo continua movendo a nave.
//   • INCLINAR: incline o celular — topo pra longe de você = frente, topo pra perto = trás.
//   • DESLIGADO: a nave fica na profundidade de sempre.
//
// Efeitos (tudo ajustável no bloco PROF abaixo):
//   • FRENTE: mais perto dos inimigos → mais dano e mais pontos, mas as balas chegam mais rápido (mais risco)
//   • TRÁS:   mais tempo pra desviar, mas o tiro causa menos dano
//
// No ONLINE (?online=1) este arquivo não faz nada — a profundidade ainda não existe no multiplayer.
// Carregar em game3d.html DEPOIS do boss3d.js.
// ══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (new URLSearchParams(location.search).get('online') === '1') return; // multiplayer: nave continua na profundidade fixa
  if (typeof shipGroup === 'undefined' || typeof VOO === 'undefined') return;

  // ── AJUSTES (mexa aqui para equilibrar) ───────────────────────
  var PROF = {
    zFrente: -20.5,       // até onde a nave vai pra frente (z negativo = mais longe da câmera, mais perto dos inimigos)
    zTras: 2.5,          // até onde a nave vai pra trás
    velDeslizar: 10.0,    // unidades/s com o polegar no máximo da pista
    alcancePx: 80,       // quantos pixels o polegar precisa deslizar pra chegar na velocidade máxima
    zonaMortaPx: 8,      // deslize menor que isso é ignorado (evita andar sem querer)
    retorno: 0.7,        // unidades/s: sem empurrar, a nave volta devagar pra posição neutra (0 = fica onde parou)
    suavizacao: 14,      // quanto maior, mais "colada" no comando
    danoFrente: 0.25,    // +25% de dano no máximo à frente
    danoTras: -0.15,     // -15% de dano no máximo atrás
    pontosFrente: 0.15,  // +15% de pontos por abate no máximo à frente (atrás não perde pontos)
    inclinarGraus: 18,   // inclinação que leva ao limite
    zonaMortaGraus: 3,   // inclinação pequena é ignorada
    seguirFrente: 0.35,  // quanto da profundidade a câmera acompanha ao ir pra FRENTE (0 = câmera parada: a nave encolhe e sobe; 1 = câmera cola na nave e só o cenário muda)
    seguirTras: 0.7,     // idem ao ir pra TRÁS (maior = a nave cresce menos, assim ela não sai da tela nos cantos)
  };

  var modo = localStorage.getItem('modoProfundidade') || 'deslizar'; // 'deslizar' | 'inclinar' | 'off'
  if (modo === 'off') { window.NRProf = { ativo: false, multPontos: function () { return 1; } }; return; }

  var z = 0, alvoZ = 0, eixo = 0, tAnterior = performance.now();   // eixo: -1 (trás) … +1 (frente)
  var dedoId = null, y0 = 0, tocando = false;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  // fração de "frente" (0..1) e de "trás" (0..1) conforme a posição atual
  function fFrente() { return z < 0 ? clamp(z / PROF.zFrente, 0, 1) : 0; }
  function fTras() { return z > 0 ? clamp(z / PROF.zTras, 0, 1) : 0; }

  // ── EFEITOS NO JOGO ───────────────────────────────────────────
  var danoOriginal = window.calcularDanoJogador;
  if (typeof danoOriginal === 'function') {
    window.calcularDanoJogador = function () {
      return danoOriginal.apply(this, arguments) * (1 + PROF.danoFrente * fFrente() + PROF.danoTras * fTras());
    };
  }

  // ── CÂMERA: o jogo chama atualizarCamera() 1x por frame; atualizamos a profundidade logo antes ──
  // O jogo põe a câmera sempre a uma distância fixa da nave — se ela seguisse 100% o Z, a nave nunca pareceria andar.
  // Por isso a câmera acompanha só uma parte (seguirFrente/seguirTras): a nave encolhe e sobe rumo ao horizonte ao ir pra frente,
  // e cresce ao voltar. Os cálculos de jogo (mira, colisão, tiros) usam a posição REAL da nave.
  var cameraOriginal = window.atualizarCamera;
  window.atualizarCamera = function () {
    atualizar();
    var zReal = shipGroup.position.z;
    shipGroup.position.z = VOO.zFixo + z * (z < 0 ? PROF.seguirFrente : PROF.seguirTras);
    var r = cameraOriginal.apply(this, arguments);
    shipGroup.position.z = zReal;
    return r;
  };

  function atualizar() {
    var agora = performance.now(), dt = Math.min(0.05, (agora - tAnterior) / 1000); tAnterior = agora;
    if (typeof jogoAtivo !== 'undefined' && !jogoAtivo) return;
    if (typeof naveDestruida !== 'undefined' && naveDestruida) return;
    if (modo === 'deslizar') {
      if (eixo !== 0) { alvoZ = clamp(alvoZ - eixo * PROF.velDeslizar * dt, PROF.zFrente, PROF.zTras); if (Math.abs(alvoZ) > 1) try { localStorage.setItem('nrProfUsou', '1'); } catch (e) {} }
      else if (PROF.retorno > 0 && alvoZ !== 0) { // sem empurrar: volta devagar ao neutro
        var passo = PROF.retorno * dt;
        alvoZ = Math.abs(alvoZ) <= passo ? 0 : alvoZ - Math.sign(alvoZ) * passo;
      }
    }
    z += (alvoZ - z) * Math.min(1, PROF.suavizacao * dt);
    shipGroup.position.z = VOO.zFixo + z;
    if (typeof shipState !== 'undefined') shipState.z = z;
    atualizarMedidor();
  }

  // ── SENSOR DESLIZANTE NO BOTÃO DE TIRO ────────────────────────
  var btn = document.getElementById('shootBtn');
  var pista = null, pontoEl = null, medidor = null, medidorMarca = null, dicaEl = null;

  function css(txt) { var s = document.createElement('style'); s.textContent = txt; document.head.appendChild(s); }
  css(
    '#nrPista{position:fixed;width:60px;height:' + (PROF.alcancePx * 2 + 40) + 'px;border:1.5px solid #ffffffcc;border-radius:30px;background:rgba(255,255,255,.05);' +
    'box-shadow:0 0 14px rgba(255,255,255,.25),inset 0 0 12px rgba(255,255,255,.08);z-index:9998;pointer-events:none;display:none;overflow:hidden}' +
    '#nrPista .seta{position:absolute;left:0;right:0;text-align:center;font:900 22px sans-serif;color:#fff;text-shadow:0 0 8px #00eaff;opacity:.35;transition:opacity .1s}' +
    '#nrPista .cima{top:6px;animation:nrSobe 1s ease-in-out infinite}#nrPista .baixo{bottom:6px;animation:nrDesce 1s ease-in-out infinite}' +
    '#nrPista .cima.on,#nrPista .baixo.on{opacity:1}' +
    '#nrPista .meio{position:absolute;left:12px;right:12px;top:50%;height:1px;background:#ffffff66}' +
    '#nrPista .ponto{position:absolute;left:50%;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:#00eaff;box-shadow:0 0 14px #00eaff;top:50%}' +
    '@keyframes nrSobe{0%,100%{transform:translateY(4px);opacity:.25}50%{transform:translateY(-4px);opacity:.9}}' +
    '@keyframes nrDesce{0%,100%{transform:translateY(-4px);opacity:.25}50%{transform:translateY(4px);opacity:.9}}' +
    '#nrMedidor{position:fixed;width:6px;height:90px;border:1px solid #ffffff88;border-radius:4px;background:rgba(255,255,255,.06);z-index:9997;pointer-events:none;display:none}' +
    '#nrMedidor .marca{position:absolute;left:-3px;right:-3px;height:4px;border-radius:2px;background:#00eaff;box-shadow:0 0 8px #00eaff}' +
    '#nrMedidor .neutro{position:absolute;left:-2px;right:-2px;top:' + (100 * PROF.zFrente / (PROF.zFrente - PROF.zTras)) + '%;height:1px;background:#ffffffaa}' +
    '#nrDica{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 190px);z-index:9998;pointer-events:none;font:700 11px Orbitron,monospace;letter-spacing:1px;color:#fff;background:#04101dd9;border:1px solid #ffffff66;border-radius:10px;padding:8px 12px;text-align:center;display:none;text-shadow:0 0 8px #00eaff}' +
    '#shootBtn{touch-action:none}' +
    '#shootBtn .nrIcone{position:absolute;top:2px;right:6px;font:900 13px sans-serif;color:#fff;opacity:.55;pointer-events:none;text-shadow:0 0 6px #00eaff}'
  );

  function montarUI() {
    pista = document.createElement('div'); pista.id = 'nrPista';
    pista.innerHTML = '<div class="seta cima">▲</div><div class="meio"></div><div class="ponto"></div><div class="seta baixo">▼</div>';
    document.body.appendChild(pista); pontoEl = pista.querySelector('.ponto');
    medidor = document.createElement('div'); medidor.id = 'nrMedidor';
    medidor.innerHTML = '<div class="neutro"></div><div class="marca"></div>';
    document.body.appendChild(medidor); medidorMarca = medidor.querySelector('.marca');
    dicaEl = document.createElement('div'); dicaEl.id = 'nrDica'; document.body.appendChild(dicaEl);
    if (modo === 'deslizar' && btn) { var ic = document.createElement('span'); ic.className = 'nrIcone'; ic.textContent = '↕'; btn.appendChild(ic); }
  }

  function posicionarPista() {
    var r = btn.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    pista.style.left = (cx - 30) + 'px'; pista.style.top = (cy - (PROF.alcancePx + 20)) + 'px';
    medidor.style.left = (r.left - 14) + 'px'; medidor.style.top = (cy - 45) + 'px';
  }

  function atualizarMedidor() {
    if (!medidor) return;
    var visivel = tocando || Math.abs(z) > 0.05;
    medidor.style.display = 'block';
    medidor.style.opacity = visivel ? '1' : '0.35';
    if (btn) { posicionarPista(); medidorMarca.style.top = 'calc(' + (100 * (z - PROF.zFrente) / (PROF.zTras - PROF.zFrente)) + '% - 2px)'; }
    if (pista && tocando) {
      pontoEl.style.top = (50 - eixo * 40) + '%';
      pista.querySelector('.cima').classList.toggle('on', eixo > 0.15);
      pista.querySelector('.baixo').classList.toggle('on', eixo < -0.15);
    }
  }

  function mostrarDica(txt, ms) {
    dicaEl.textContent = txt; dicaEl.style.display = 'block';
    setTimeout(function () { dicaEl.style.display = 'none'; }, ms || 4500);
  }

  function ligarDeslizar() {
    btn.addEventListener('touchstart', function (e) {
      if (dedoId !== null) return;
      var t = e.changedTouches[0]; dedoId = t.identifier; y0 = t.clientY; tocando = true; eixo = 0;
      posicionarPista(); pista.style.display = 'block';
    }, { passive: true });
    btn.addEventListener('touchmove', function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === dedoId) {
        var dy = y0 - e.changedTouches[i].clientY; // positivo = deslizou pra cima = frente
        var ab = Math.abs(dy);
        eixo = ab < PROF.zonaMortaPx ? 0 : Math.sign(dy) * clamp((ab - PROF.zonaMortaPx) / (PROF.alcancePx - PROF.zonaMortaPx), 0, 1);
      }
    }, { passive: true });
    var solta = function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === dedoId) {
        dedoId = null; tocando = false; eixo = 0; pista.style.display = 'none';
      }
    };
    btn.addEventListener('touchend', solta, { passive: true });
    btn.addEventListener('touchcancel', solta, { passive: true });
    // teclado (teste no PC): W/S ou setas ↑↓
    window.addEventListener('keydown', function (e) { if (e.key === 'w' || e.key === 'ArrowUp') eixo = 1; if (e.key === 's' || e.key === 'ArrowDown') eixo = -1; });
    window.addEventListener('keyup', function (e) { if (['w', 's', 'ArrowUp', 'ArrowDown'].indexOf(e.key) >= 0) eixo = 0; });
  }

  // ── INCLINAR O CELULAR ────────────────────────────────────────
  var neutroBeta = null, ultimoBeta = null;
  function ligarInclinar() {
    var pedir = function () {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().catch(function () { mostrarDica('Sem permissão para o sensor de inclinação', 5000); });
      }
    };
    document.addEventListener('touchend', pedir, { once: true, passive: true }); // iPhone só libera o sensor depois de um toque
    window.addEventListener('deviceorientation', function (e) {
      if (typeof e.beta !== 'number') return;
      ultimoBeta = e.beta;
      if (neutroBeta === null) neutroBeta = e.beta; // calibra: a posição em que você está segurando agora é o "neutro"
      var d = neutroBeta - e.beta; // topo do celular pra longe de você (beta diminui) = frente
      var ab = Math.abs(d); if (ab < PROF.zonaMortaGraus) { alvoZ = 0; return; }
      var f = clamp((ab - PROF.zonaMortaGraus) / (PROF.inclinarGraus - PROF.zonaMortaGraus), 0, 1) * Math.sign(d);
      alvoZ = f > 0 ? f * PROF.zFrente : -f * PROF.zTras;
    });
    // recalibra no GO e ao reviver: o neutro passa a ser a posição atual do celular
    var jaAtivo = false;
    setInterval(function () {
      var ativo = typeof jogoAtivo !== 'undefined' && jogoAtivo && !(typeof naveDestruida !== 'undefined' && naveDestruida);
      if (ativo && !jaAtivo && ultimoBeta !== null) neutroBeta = ultimoBeta;
      jaAtivo = ativo;
    }, 250);
  }

  // ── BÔNUS DE PONTOS (usado pelo boss3d.js ao abater inimigos) ──
  window.NRProf = {
    ativo: true,
    z: function () { return z; },
    multPontos: function () { return 1 + PROF.pontosFrente * fFrente(); },
    multDano: function () { return 1 + PROF.danoFrente * fFrente() + PROF.danoTras * fTras(); },
    _debug: { eixo: function (v) { eixo = v; }, setAlvo: function (v) { alvoZ = v; } },
  };

  montarUI();
  if (modo === 'deslizar' && btn) { ligarDeslizar(); mostrarDicaInicial(); }
  if (modo === 'inclinar') { ligarInclinar(); mostrarDicaInicial(); }

  function mostrarDicaInicial() {
    if (localStorage.getItem('nrProfUsou') === '1') return; // já aprendeu
    setTimeout(function () {
      mostrarDica(modo === 'deslizar' ? 'SEGURE O TIRO E DESLIZE ↑ FRENTE · ↓ TRÁS' : 'INCLINE O CELULAR: ↑ FRENTE · ↓ TRÁS', 6000);
    }, 3500); // depois do 3-2-1
  }
})();
