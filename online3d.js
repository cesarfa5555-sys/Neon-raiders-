// ══════════════════════════════════════════════════════════════════
// ONLINE3D.JS — multiplayer dentro da partida (co-op e PvP)
// Carregar em game3d.html DEPOIS do boss3d.js e do multiplayer-core.js.
// Só liga quando a URL tem ?online=1 (jogo solo continua igual).
//
//  • volta para a sala (a conexão cai ao trocar de página; o servidor guarda a vaga 60s)
//  • largada junta: todos carregam, o DONO da sala toca na tela e o 3-2-1 roda ao mesmo tempo
//  • envia posição/vida da sua nave ~15x/s e desenha as naves dos outros (nome, vida, tiros)
//  • CO-OP: dano e mortes dos inimigos são repassados entre os jogadores
//  • PvP 1v1: o adversário fica de frente pra você; acertos são conferidos pelo servidor
// ══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var Q = new URLSearchParams(location.search);
  if (Q.get('online') !== '1') return;

  var SERVIDOR = window.NR_SERVIDOR || 'wss://neon-raiders-servidor-1.onrender.com'; // (o endereço agora fica em config-servidor.js)
  var CORES = [0x00ffff, 0xff00cc, 0xffd24d, 0x4dff9a];
  var PVP = Q.get('modo') === 'pvp';
  var M = window.NRMultiplayer;
  var sala = null, fantasmas = {}, tirosFantasma = [], cacheMat = {};
  var ultimoEnvio = 0, ultimoX = 1e9, ultimoY = 1e9, ultimoHp = -1, ultimoVivo = -1;
  var geoTiro = null, painel = null, tAnterior = performance.now(), contPainel = 0;
  var danoPend = {}, ultimoFlush = 0, danoRecebido = {}, ultimaTentativaRecebido = 0;
  var bloqueado = false, paginaPronta = false, avisouCarregado = false, overlayEspera = null;
  var todosProntos = false, contProntos = { prontos: 0, total: 0 };
  var COOP = !PVP;
  var espectador = false, alvoEspecId = null, derrotaTotalFeita = false, bannerEspec = null, timerRevive = null;
  // Pausa do co-op / "voltar sozinho" (novo): veja o bloco "PAUSA DO CO-OP..." mais abaixo
  var pausadoCoop = false, jogoAntesPausa = false, contagemNaPausa = false, moderacaoAntes = false, terminouLocal = false;
  var REVIVE_TEMPO_S = 15; // depois disso, a tela de reviver "desiste" sozinha

  function aviso(msg, fixo) {
    var el = document.getElementById('nrOnlineAviso');
    if (!el) {
      el = document.createElement('div'); el.id = 'nrOnlineAviso';
      el.style.cssText = 'position:fixed;left:8px;right:8px;top:calc(env(safe-area-inset-top,0px) + 8px);z-index:99999;background:#1a0a14ee;border:1px solid #ff5d73;color:#ffd0d8;font:12px monospace;padding:10px;border-radius:8px;display:none';
      el.onclick = function () { el.style.display = 'none'; };
      document.body.appendChild(el);
    }
    el.textContent = '⚠ ' + msg; el.style.display = 'block';
    clearTimeout(aviso._t); if (!fixo) aviso._t = setTimeout(function () { el.style.display = 'none'; }, 6000);
  }
  if (!M) return aviso('multiplayer-core.js não carregou (confira a ordem dos scripts em game3d.html).', true);
  if (typeof scene === 'undefined' || typeof shipGroup === 'undefined') return aviso('Motor do jogo não encontrado (online3d.js precisa vir depois do boss3d.js).', true);

  // PvP: toda a lógica do modo fica em pvp-client.js (o adversário de frente, acertos, vida, resultado)
  var pvp = null;
  if (PVP) {
    if (!window.NRPvpClient) return aviso('Falta o arquivo pvp-client.js (carregue antes do online3d.js em game3d.html).', true);
    pvp = window.NRPvpClient.criar({ M: M, sala: function () { return sala; }, fantasma: function () { return primeiroFantasma(); }, aviso: aviso });
  }

  // ── LARGADA SINCRONIZADA ──────────────────────────────────────
  // O jogo normal chama iniciarContagem() sozinho quando o loading acaba. Aqui a gente "tranca" essa
  // chamada (contagemIniciada = true) e só destranca quando o servidor mandar 'comecar'.
  if (typeof contagemIniciada !== 'undefined' && typeof iniciarContagem === 'function') { contagemIniciada = true; bloqueado = true; }

  function souHost() { return !!(sala && sala.state && sala.state.hostId === sala.sessionId); }

  function mostrarEspera(txt) {
    if (!overlayEspera) {
      overlayEspera = document.createElement('div');
      overlayEspera.style.cssText = 'position:fixed;left:50%;top:22%;transform:translateX(-50%);z-index:99998;pointer-events:none;font:700 14px Orbitron,monospace;letter-spacing:2px;color:#00ffff;text-shadow:0 0 10px #00ffff;text-align:center;background:#04101dcc;border:1px solid #0ff6;border-radius:10px;padding:12px 18px;max-width:86vw;line-height:1.5';
      document.body.appendChild(overlayEspera);
    }
    overlayEspera.textContent = txt; overlayEspera.style.display = 'block';
  }

  function atualizarEsperaUI() {
    if (!bloqueado || !avisouCarregado) return;
    if (!todosProntos) return mostrarEspera('AGUARDANDO JOGADORES (' + contProntos.prontos + '/' + contProntos.total + ')');
    if (souHost()) mostrarEspera('TODOS PRONTOS\nTOQUE NA TELA PARA COMEÇAR');
    else mostrarEspera('AGUARDANDO O DONO DA SALA COMEÇAR...\n(toque na tela p/ ativar o som)');
    overlayEspera.style.whiteSpace = 'pre-line';
  }

  function liberarLargada() {
    if (overlayEspera) overlayEspera.style.display = 'none';
    if (!bloqueado) return;
    bloqueado = false; contagemIniciada = false; iniciarContagem();
  }

  // toque do DONO libera o 3-2-1 para todo mundo (qualquer outro toque só destrava o áudio do celular)
  document.addEventListener('pointerdown', function () {
    if (bloqueado && avisouCarregado && todosProntos && souHost()) M.enviar('largar');
  }, true);

  // o loading acabou? (o jogo adiciona a classe "saindo" na tela de loading)
  var vigiaLoading = setInterval(function () {
    var el = document.getElementById('telaLoading');
    if (!el || el.classList.contains('saindo')) { paginaPronta = true; clearInterval(vigiaLoading); avisarCarregado(); }
  }, 150);
  function avisarCarregado() {
    if (avisouCarregado || !paginaPronta || !sala || !bloqueado) return;
    avisouCarregado = true; M.enviar('carregado'); atualizarEsperaUI();
  }
  setTimeout(function () { if (bloqueado && !sala) liberarLargada(); }, 45000); // sem conexão nenhuma: não deixa o jogo travado

  // ── CO-OP: dano nos inimigos repassado entre os jogadores ─────
  window.NROnline = {
    dano: function (en, d) { // chamado pelo boss3d.js quando SUA bala acerta um inimigo
      if (PVP || !sala || !en || !en.nid) return;
      danoPend[en.nid] = (danoPend[en.nid] || 0) + d;
    }
  };
  // ── CO-OP: quem cada inimigo ataca ────────────────────────────
  // A cada tiro o inimigo decide sozinho em quem atirar, olhando onde os jogadores estão naquele instante:
  //  • inimigo comum → atira no jogador MAIS PERTO dele (se o jogador se afasta, ele troca de alvo)
  //  • boss → sorteia a cada disparo; quanto mais perto do boss, mais balas vão pra aquele jogador
  //    (os outros também recebem, só que menos). Ele nunca "trava" num jogador só.
  function elegiveis() { // quem pode ser alvo: está vivo e conectado
    var ids = []; if (!sala || !sala.state) return ids;
    sala.state.jogadores.forEach(function (j, id) { if (j.estado === 'vivo' && j.conectado !== false) ids.push(id); });
    ids.sort(); return ids;
  }
  window.NROnline.alvo = function (en) { // devolve null (= atira em mim) ou a posição da nave do outro jogador
    if (!COOP || !sala || !en || !en.mesh) return null;
    var ex = en.mesh.position.x, ey = en.mesh.position.y, cand = [];
    elegiveis().forEach(function (id) {
      var p = id === sala.sessionId ? shipGroup.position : (fantasmas[id] && fantasmas[id].grupo.position);
      if (p) cand.push({ id: id, p: p, d: Math.hypot(p.x - ex, p.y - ey) });
    });
    if (!cand.length) return null;
    var esc;
    if (en.isBoss) { // sorteio com peso 1/(distância+2)²: perto = muito mais balas, longe = poucas, mas ninguém fica de fora
      var soma = 0; cand.forEach(function (c) { c.w = 1 / Math.pow(c.d + 2, 2); soma += c.w; });
      var r = Math.random() * soma; esc = cand[cand.length - 1];
      for (var i = 0; i < cand.length; i++) { r -= cand[i].w; if (r <= 0) { esc = cand[i]; break; } }
    } else { // inimigo comum: o mais perto
      esc = cand.reduce(function (a, c) { return c.d < a.d ? c : a; });
    }
    return esc.id === sala.sessionId ? null : esc.p;
  };

  // ── CO-OP: cair, reviver, desistir e assistir o parceiro ──────
  function avisarEstado(e) { if (sala) M.enviar('estado', e); }
  function outrosVivos() { // alguém do time ainda pode jogar? (vivo ou na tela de reviver)
    var n = 0; if (!sala || !sala.state) return 0;
    sala.state.jogadores.forEach(function (j, id) { if (id !== sala.sessionId && j.conectado !== false && (j.estado === 'vivo' || j.estado === 'caido')) n++; });
    return n;
  }
  function pararTimerRevive() { clearInterval(timerRevive); timerRevive = null; }
  function iniciarTimerRevive() {
    var tela = document.getElementById('reviveScreen'); if (!tela) return;
    var el = document.getElementById('nrReviveTimer');
    if (!el) { el = document.createElement('div'); el.id = 'nrReviveTimer'; el.style.cssText = 'margin-top:14px;font:700 15px Orbitron,monospace;color:#ffcc00;text-shadow:0 0 12px #ffcc00;letter-spacing:1px'; tela.appendChild(el); }
    var fim = performance.now() + REVIVE_TEMPO_S * 1000;
    pararTimerRevive();
    timerRevive = setInterval(function () {
      if (pausadoCoop) fim += 250; // partida pausada (alguém reconectando): o tempo para desistir também espera
      var s = Math.max(0, Math.ceil((fim - performance.now()) / 1000));
      el.textContent = '⏱ DESISTE SOZINHO EM ' + s + 's';
      if (s <= 0) { pararTimerRevive(); if (!tela.classList.contains('hidden') && typeof desistirAposMorte === 'function') desistirAposMorte(); } // tempo acabou = clicou em DESISTIR
    }, 250);
  }
  function entrarEspectador() {
    espectador = true; pararTimerRevive();
    try { playerInvincibleTimer = 1e9; invencibilidadeEhDeDano = false; naveDestruida = true; } catch (e) {} // a nave destruída não leva mais nada
    try { document.getElementById('reviveScreen').classList.add('hidden'); document.getElementById('ui').classList.add('hidden'); } catch (e) {}
    try { elBombBtn.style.display = 'none'; } catch (e) {}
    if (!bannerEspec) {
      bannerEspec = document.createElement('div');
      bannerEspec.style.cssText = 'position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 18px);transform:translateX(-50%);z-index:9500;pointer-events:none;font:700 12px Orbitron,monospace;letter-spacing:1px;color:#00ffff;text-shadow:0 0 8px #00ffff;background:#04101dcc;border:1px solid #0ff6;border-radius:10px;padding:8px 14px;text-align:center;white-space:nowrap';
      document.body.appendChild(bannerEspec);
    }
  }
  function alvoDoEspectador() { // jogador que estou assistindo (o escolhido, ou o primeiro que esteja vivo)
    var ids = elegiveis().filter(function (id) { return id !== sala.sessionId; });
    if (!ids.length) return null;
    return ids.indexOf(alvoEspecId) >= 0 ? alvoEspecId : (alvoEspecId = ids[0]);
  }
  function seguirAlvo() {
    if (!espectador || !sala) return;
    if (derrotaTotalFeita || (typeof cinematicaFinalAtiva !== 'undefined' && cinematicaFinalAtiva)) { if (bannerEspec) bannerEspec.style.display = 'none'; return; }
    var id = alvoDoEspectador(), f = id && fantasmas[id];
    if (f) { shipState.x = f.grupo.position.x; shipState.y = f.grupo.position.y; } // a câmera do jogo segue a "nave" — que agora acompanha o parceiro
    var j = id && sala.state.jogadores.get(id);
    bannerEspec.textContent = j ? '👁 ASSISTINDO ' + String(j.nome).replace(/[<>&]/g, '') + ' · toque para trocar' : '👁 AGUARDANDO O PARCEIRO...';
  }
  document.addEventListener('pointerdown', function () { // toque troca quem você assiste (3+ jogadores)
    if (!espectador || !sala) return;
    var ids = elegiveis().filter(function (id) { return id !== sala.sessionId; });
    if (ids.length > 1) alvoEspecId = ids[(ids.indexOf(alvoEspecId) + 1) % ids.length];
  }, true);

  // Quem caiu ou está assistindo NÃO joga: sem bomba, sem NITRO (que atira, cura e pega cristais)
  function fora() { return espectador || (typeof naveDestruida !== 'undefined' && naveDestruida); }
  var bombaOriginal = window.usarBomba;
  if (COOP && typeof bombaOriginal === 'function') {
    window.usarBomba = function () { if (fora()) return; return bombaOriginal.apply(this, arguments); };
  }
  var nitroOriginal = window.atualizarNitro;
  if (COOP && typeof nitroOriginal === 'function') {
    window.atualizarNitro = function (dt, time) {
      if (fora()) { try { if (NITRO3D.mesh) NITRO3D.mesh.visible = false; } catch (e) {} return; }
      try { if (NITRO3D.mesh) NITRO3D.mesh.visible = true; } catch (e) {}
      return nitroOriginal.apply(this, arguments);
    };
  }

  // ── CO-OP: tela de fim de partida (substitui o game over normal) ──
  function fmtTempo(s) { var m = Math.floor(s / 60), r = s % 60; return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r; }
  function mostrarTelaCoopFim() {
    try { document.getElementById('gameOverScreen').classList.add('hidden'); } catch (e) {} // some a tela normal (tentar novamente / modos / menu)
    var nomes = [];
    if (sala && sala.state) sala.state.jogadores.forEach(function (j) { nomes.push(String(j.nome).replace(/[<>&]/g, '')); });
    var seg = Math.round((Date.now() - _inicioSessao3D) / 1000);
    var ov = document.createElement('div');
    ov.className = 'screen';
    ov.style.cssText = 'z-index:100001;overflow:auto;';
    var chip = 'padding:5px 10px;border:1px solid #ffffff22;border-radius:8px;background:#ffffff0a;font:11px "Share Tech Mono",monospace;color:#cfeaff;white-space:nowrap';
    ov.innerHTML =
      '<div class="titulo-fim-jogo" style="color:#ff0044;text-shadow:0 0 30px #ff0044,0 0 80px #ff004466;">DERROTA<br>DO TIME</div>' +
      '<div style="width:80%;max-width:300px;height:1px;background:linear-gradient(90deg,transparent,#ff0044,transparent);margin:10px auto;"></div>' +
      '<p class="final-score-label">SUA PONTUAÇÃO</p>' +
      '<div class="final-score-value">' + String(score).padStart(6, '0') + '</div>' +
      '<div class="final-wave">ONDA ' + wave + ' ALCANÇADA</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin:6px 0 4px"><span style="' + chip + '">⏱ ' + fmtTempo(seg) + '</span>' +
      '<span style="' + chip + '">☠ ' + (typeof ganhoKillsNestaSessao !== 'undefined' ? ganhoKillsNestaSessao : 0) + ' ABATES</span></div>' +
      (nomes.length > 1 ? '<div style="font:11px \'Share Tech Mono\',monospace;color:#00ffff;margin-bottom:6px">👥 ' + nomes.join(' · ') + '</div>' : '') +
      '<div id="rankingSectionCoop"><p class="ranking-titulo">🏆 TOP 10 GLOBAL</p>' +
      '<div class="rank-msg" id="rankMsgCoop"></div>' +
      '<div class="ranking-list-dinamica"><div style="text-align:center;color:#ffffff55;font-family:\'Share Tech Mono\',monospace;font-size:11px;">carregando...</div></div></div>' +
      '<button class="btn-primary-tela" id="nrVoltarSala">↩ VOLTAR À SALA</button>';
    document.body.appendChild(ov);
    try { renderizarRankingListas(); } catch (e) {} // o Top 10 já está carregado; se mudar, o jogo atualiza esta lista sozinho
    // espelha o "🎉 Novo recorde pessoal!" que o jogo escreve na tela escondida
    var espelho = setInterval(function () {
      var o1 = document.getElementById('rankMsg'), o2 = document.getElementById('rankMsgCoop');
      if (o1 && o2 && o1.textContent) o2.textContent = o1.textContent;
    }, 500);
    setTimeout(function () { clearInterval(espelho); }, 8000);
    document.getElementById('nrVoltarSala').onclick = function () {
      var b = this; b.disabled = true; b.textContent = 'VOLTANDO...';
      try { M.enviar('voltar'); } catch (e) {}
      setTimeout(function () { location.href = 'multiplayer.html?sala=1'; }, 350); // a vaga na sala fica guardada enquanto a página troca
    };
  }
  var encerrarOriginal = window.encerrarPartida;
  if (COOP && typeof encerrarOriginal === 'function') {
    window.encerrarPartida = function () {
      var jaEncerrada = (typeof partidaEncerrada !== 'undefined') && partidaEncerrada;
      var r = encerrarOriginal.apply(this, arguments); // salva a pontuação no ranking e fecha a partida, como sempre
      if (!jaEncerrada) mostrarTelaCoopFim();
      return r;
    };
  }

  var derrotaOriginal = window.iniciarCinematicaDerrota;
  if (COOP && typeof derrotaOriginal === 'function') {
    window.iniciarCinematicaDerrota = function () { // é chamada ao desistir, ou ao morrer de novo depois de reviver
      if (derrotaTotalFeita) return;
      avisarEstado('fora');
      if (sala && outrosVivos() > 0) { entrarEspectador(); return; } // o parceiro ainda joga: fica assistindo até ele cair
      derrotaTotalFeita = true; pararTimerRevive();
      return derrotaOriginal.apply(this, arguments); // era o último do time: derrota normal do jogo
    };
  }
  var reviveOriginal = window.mostrarTelaRevive;
  if (COOP && typeof reviveOriginal === 'function') {
    window.mostrarTelaRevive = function () {
      var r = reviveOriginal.apply(this, arguments); // mostra "VOCÊ CAIU" (e pausa o jogo)
      try { jogoAtivo = true; playerInvincibleTimer = 1e9; invencibilidadeEhDeDano = false; } catch (e) {} // no co-op o mundo não pára: o parceiro continua jogando
      avisarEstado('caido'); iniciarTimerRevive();
      return r;
    };
  }
  var reviverOriginal = window.reviverComMoedas;
  if (COOP && typeof reviverOriginal === 'function') {
    window.reviverComMoedas = function () {
      var estavaCaido = naveDestruida;
      var r = reviverOriginal.apply(this, arguments);
      if (estavaCaido && !naveDestruida) { pararTimerRevive(); avisarEstado('vivo'); } // reviveu de verdade (tinha moedas)
      return r;
    };
  }
  var desistirOriginal = window.desistirAposMorte;
  if (COOP && typeof desistirOriginal === 'function') {
    window.desistirAposMorte = function () { pararTimerRevive(); return desistirOriginal.apply(this, arguments); };
  }

  var matarOriginal = window.matarOuRessuscitar;
  if (!PVP && typeof matarOriginal === 'function') {
    window.matarOuRessuscitar = function (en) {
      var existia = enemies.indexOf(en) !== -1;
      var r = matarOriginal.apply(this, arguments);
      if (existia && enemies.indexOf(en) === -1 && en.nid && sala) M.enviar('morte', en.nid); // morreu de verdade (fênix que ressuscita não conta)
      return r;
    };
  }
  function acharInimigo(nid) { for (var i = 0; i < enemies.length; i++) if (enemies[i].nid === nid) return enemies[i]; return null; }
  function aplicarDanoRemoto(nid, d) {
    var en = acharInimigo(nid);
    if (!en) return false;
    en.hp -= d; en.hitFlashTimer = 0.12;
    if (en.hp <= 0 && typeof matarOriginal === 'function') matarOriginal(en); // sem reenviar 'morte' (evita eco)
    return true;
  }
  function flushRede(agora) {
    if (agora - ultimoFlush < 100) return;
    ultimoFlush = agora;
    var ks = Object.keys(danoPend);
    if (ks.length) { var lote = ks.map(function (k) { return [k, Math.round(danoPend[k] * 100) / 100]; }); danoPend = {}; M.enviar('dano', lote); }
    var n = pvp ? pvp.coletarAcertos() : 0; // (zera o contador local, que só serve para o efeito visual)
    // O aviso 'hit' NÃO é mais enviado: agora o servidor simula cada tiro e decide sozinho se acertou
    // (pvp.js). Antes: if (n > 0) M.enviar('hit', n);
  }
  function tentarDanoPendente(agora) { // dano que chegou antes do inimigo nascer neste celular: espera até 3s
    if (agora - ultimaTentativaRecebido < 200) return; ultimaTentativaRecebido = agora;
    Object.keys(danoRecebido).forEach(function (nid) {
      var p = danoRecebido[nid];
      if (aplicarDanoRemoto(nid, p.d) || agora - p.t > 3000) delete danoRecebido[nid];
    });
  }

  // ── FANTASMAS (naves dos outros jogadores) ────────────────────
  function materialCor(cor) { return cacheMat[cor] || (cacheMat[cor] = new THREE.MeshBasicMaterial({ color: cor })); }

  function criarLabel(f) {
    var cv = document.createElement('canvas'); cv.width = 256; cv.height = 72;
    f.cv = cv; f.tex = new THREE.CanvasTexture(cv);
    f.label = new THREE.Sprite(new THREE.SpriteMaterial({ map: f.tex, transparent: true, depthTest: false }));
    f.label.scale.set(2.4, 0.675, 1); f.label.position.set(0, PVP ? 2.2 : 1.25, 0);
    if (PVP) f.label.scale.set(3.6, 1.0, 1);
    f.grupo.add(f.label);
  }

  function desenharLabel(f, nome, pct, vivo) {
    var ctx = f.cv.getContext('2d'), cor = '#' + ('000000' + CORES[f.idx % 4].toString(16)).slice(-6);
    ctx.clearRect(0, 0, 256, 72);
    ctx.font = 'bold 26px Orbitron, monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = vivo ? cor : '#888'; ctx.shadowColor = cor; ctx.shadowBlur = vivo ? 8 : 0;
    ctx.fillText((vivo ? '' : '☠ ') + nome, 128, 30);
    ctx.shadowBlur = 0; ctx.fillStyle = '#ffffff22'; ctx.fillRect(38, 44, 180, 10);
    ctx.fillStyle = pct > 0.5 ? '#4dff9a' : pct > 0.25 ? '#ffd24d' : '#ff5d73';
    ctx.fillRect(38, 44, 180 * Math.max(0, Math.min(1, pct)), 10);
    f.tex.needsUpdate = true;
  }

  function posVisual(j) { return PVP ? pvp.posVisual(j) : { x: j.x, y: j.y, z: 0 }; }

  function criarFantasma(id, j, idx) {
    var f = { idx: idx, grupo: new THREE.Group(), pctDesenhado: -1, vivoDesenhado: null, nome: '' };
    var nave;
    try { nave = (typeof createShipPadrao === 'function') ? createShipPadrao() : null; } catch (e) { nave = null; }
    if (!nave) { nave = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 8), new THREE.MeshBasicMaterial({ color: CORES[idx % 4] })); nave.rotation.x = -Math.PI / 2; }
    nave.traverse(function (o) { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.85; } });
    if (PVP) { nave.rotation.y = Math.PI; nave.scale.multiplyScalar(pvp.ESCALA); } // de frente pra mim
    f.nave = nave; f.grupo.add(nave);
    var halo = new THREE.Mesh(new THREE.TorusGeometry(0.95 * (PVP ? pvp.ESCALA : 1), 0.035, 8, 40), new THREE.MeshBasicMaterial({ color: CORES[idx % 4] }));
    halo.position.z = -0.3; f.halo = halo; f.grupo.add(halo);
    criarLabel(f);
    var p = posVisual(j); f.grupo.position.set(p.x, p.y, p.z);
    scene.add(f.grupo);
    return f;
  }

  // ── PREVISÃO DE POSIÇÃO (compensa o atraso da rede) ───────────
  // O que chega do servidor mostra onde o outro jogador ESTAVA (metade do ping + envio + patch atrás).
  // Aqui medimos a velocidade dele entre dois pacotes e projetamos a nave um pouco à frente.
  // PREVISAO_MS = 0 DESLIGA (comportamento antigo, idêntico ao de antes). Para testar, tente 60.
  // Se a nave dele "passar do ponto" ao parar, diminua; se ainda parecer atrasada, aumente (máx. ~100).
  var PREVISAO_MS = 0;
  var SUAVIZACAO = 14;   // quão rápido a nave do outro segue o alvo (era fixo em 14)
  var VEL_MAX = 25;      // unidades/s: acima disso é erro de medição
  var LIM_X = 4.2, LIM_Y_MIN = 0.6, LIM_Y_MAX = 9.5; // mesmos limites de voo do servidor (VOO)
  function estimarPosicao(f, j, agora) {
    if (PREVISAO_MS <= 0) return { x: j.x, y: j.y };
    var e = f.est || (f.est = { x: j.x, y: j.y, t: agora, vx: 0, vy: 0 });
    if (j.x !== e.x || j.y !== e.y) { // chegou uma posição nova do servidor
      var s = (agora - e.t) / 1000;
      if (s >= 0.015 && s <= 0.35) { // intervalo plausível entre dois pacotes: mede a velocidade (suavizada)
        var vx = Math.max(-VEL_MAX, Math.min(VEL_MAX, (j.x - e.x) / s));
        var vy = Math.max(-VEL_MAX, Math.min(VEL_MAX, (j.y - e.y) / s));
        e.vx = e.vx * 0.4 + vx * 0.6; e.vy = e.vy * 0.4 + vy * 0.6;
      } else { e.vx = 0; e.vy = 0; }
      e.x = j.x; e.y = j.y; e.t = agora;
    }
    // Sem pacote novo há um tempo (ele parou, ou a rede falhou): a confiança cai a zero e a nave para de "adivinhar"
    var idade = (agora - e.t) / 1000;
    var confianca = Math.max(0, Math.min(1, 1 - (idade - 0.07) / 0.1));
    var h = (idade + PREVISAO_MS / 1000) * confianca;
    return {
      x: Math.max(-LIM_X, Math.min(LIM_X, e.x + e.vx * h)),
      y: Math.max(LIM_Y_MIN, Math.min(LIM_Y_MAX, e.y + e.vy * h))
    };
  }

  function sincronizarFantasmas(dt) {
    if (!sala || !sala.state) return;
    var presentes = {}, k = 1 - Math.exp(-dt * SUAVIZACAO), idx = 0, agoraMs = performance.now();
    sala.state.jogadores.forEach(function (j, id) {
      if (id !== sala.sessionId) {
        presentes[id] = true;
        var f = fantasmas[id] || (fantasmas[id] = criarFantasma(id, j, idx));
        var est = estimarPosicao(f, j, agoraMs); // onde ele deve estar AGORA (igual a j.x/j.y se a previsão estiver desligada)
        var p = posVisual({ x: est.x, y: est.y }), g = f.grupo, dx = p.x - g.position.x;
        g.position.x += dx * k; g.position.y += (p.y - g.position.y) * k; g.position.z = p.z;
        f.nave.rotation.z += ((-dx * 0.3) - f.nave.rotation.z) * Math.min(1, dt * 10); // inclina ao virar
        f.halo.rotation.z += dt * 1.5;
        f.nave.visible = f.halo.visible = !!j.vivo && j.conectado !== false;
        var pct = j.hpMax > 0 ? j.hp / j.hpMax : 1, pctR = Math.round(pct * 20) / 20;
        if (f.pctDesenhado !== pctR || f.vivoDesenhado !== !!j.vivo || f.nome !== j.nome) {
          f.pctDesenhado = pctR; f.vivoDesenhado = !!j.vivo; f.nome = j.nome; desenharLabel(f, j.nome, pctR, !!j.vivo);
        }
      }
      idx++;
    });
    Object.keys(fantasmas).forEach(function (id) { if (!presentes[id]) { scene.remove(fantasmas[id].grupo); delete fantasmas[id]; } });
  }

  function primeiroFantasma() { var ks = Object.keys(fantasmas); return ks.length ? fantasmas[ks[0]] : null; }

  // ── TIROS DOS OUTROS (só visual) ──────────────────────────────
  // CO-OP: usa a MESMA física da sua bala (curva até o inimigo à frente) e some ao encostar nele.
  // PvP: o tiro dele vem na minha direção (reto).
  function tiroFantasma(d) {
    var f = fantasmas[d.de]; if (!f) return;
    geoTiro = geoTiro || new THREE.SphereGeometry(0.13, 8, 8);
    var lat = d.t === 3 ? [-0.55, 0, 0.55] : [0];
    lat.forEach(function (vx) {
      var m = new THREE.Mesh(geoTiro, materialCor(CORES[f.idx % 4]));
      if (PVP) { var pt = pvp.posTiro(d); m.position.set(pt.x, pt.y, pt.z); } else m.position.set(d.x, d.y, -1.2);
      m.userData.vx = vx; scene.add(m);
      tirosFantasma.push({ m: m, vx: vx, vida: PVP ? 0.8 : 1.6 });
    });
  }

  function moverTiros(dt) {
    var vel = (typeof BULLET_SPEED !== 'undefined' ? BULLET_SPEED : 1.4) * 60;
    for (var i = tirosFantasma.length - 1; i >= 0; i--) {
      var t = tirosFantasma[i], m = t.m, morreu = false; t.vida -= dt;
      if (PVP) {
        morreu = pvp.moverTiro(m, t, vel, dt);
      } else {
        if (typeof moverBalaJogador === 'function') moverBalaJogador(m, dt); // reta ou curvando rumo ao inimigo, igual à sua
        else { m.position.z -= vel * dt; m.position.x += t.vx * 60 * dt; }
        for (var j = 0; j < enemies.length; j++) { // some ao encostar num inimigo (o dano de verdade vem pela rede)
          var en = enemies[j];
          if (en.hp > 0 && m.position.distanceTo(en.mesh.position) < (en.hitRadius || 1.6)) {
            morreu = true;
            try { JUICE.acertoInimigo(en, m.position, m.material.color, false); } catch (e) {}
            break;
          }
        }
        if (m.position.z < (typeof ENEMY_SPAWN_Z !== 'undefined' ? ENEMY_SPAWN_Z : -70) - 20) morreu = true;
      }
      if (morreu || t.vida <= 0) { scene.remove(m); tirosFantasma.splice(i, 1); }
    }
  }

  // ── ENVIO DA SUA NAVE ─────────────────────────────────────────
  // Intervalo entre envios da sua posição. Era 66 ms (~15/s); agora 50 ms (~20/s) = ~16 ms a menos de atraso médio.
  // (O comentário lá do topo ainda diz ~15x/s: o valor certo é este.)
  var ENVIO_MS = 50;
  function enviarMeuEstado(agora) {
    if (!sala || agora - ultimoEnvio < ENVIO_MS) return;
    var x = shipGroup.position.x, y = shipGroup.position.y;
    var hp = typeof playerHp !== 'undefined' ? playerHp : 1, hpMax = typeof playerMaxHp !== 'undefined' ? playerMaxHp : 1;
    var vivo = (typeof naveDestruida !== 'undefined' && naveDestruida) ? 0 : 1;
    var mudou = Math.abs(x - ultimoX) > 0.01 || Math.abs(y - ultimoY) > 0.01 || hp !== ultimoHp || vivo !== ultimoVivo;
    if (!mudou && agora - ultimoEnvio < 500) return; // parado: só um sinal de vida a cada 0,5s
    ultimoEnvio = agora; ultimoX = x; ultimoY = y; ultimoHp = hp; ultimoVivo = vivo;
    M.enviar('mov', [x, y, hp, hpMax, vivo]);
  }

  // avisa os outros quando VOCÊ atira (embrulha a função original do jogo)
  function ligarTiro() {
    if (typeof dispararTiroJogador !== 'function' || dispararTiroJogador._online) return;
    var original = dispararTiroJogador;
    var nova = function () {
      if (pvp && pvp.pausado()) return; // PvP: partida pausada (alguém reconectando) — ninguém atira
      if (pausadoCoop) return;          // co-op: idem
      var r = original.apply(this, arguments);
      try { M.enviar('tiro', (typeof jogadorPowerup !== 'undefined' && jogadorPowerup === 'TRIPLE') ? 3 : 1); } catch (e) {}
      return r;
    };
    nova._online = true; window.dispararTiroJogador = nova;
  }

  // ── PAINEL DO TIME (canto inferior esquerdo) ──────────────────
  function atualizarPainel() {
    if (!sala || !sala.state) return;
    if (!painel) {
      painel = document.createElement('div');
      painel.style.cssText = 'position:fixed;left:6px;bottom:calc(env(safe-area-inset-bottom,0px) + 6px);z-index:9000;pointer-events:none;font:10px "Share Tech Mono",monospace;color:#cfeaff;background:#05101fcc;border:1px solid #0ff5;border-radius:6px;padding:5px 7px;max-width:46vw';
      document.body.appendChild(painel);
    }
    var linhas = [], i = 0;
    sala.state.jogadores.forEach(function (j, id) {
      var cor = '#' + ('000000' + CORES[i % 4].toString(16)).slice(-6), pct = j.hpMax > 0 ? Math.round(100 * j.hp / j.hpMax) : 100;
      linhas.push('<div style="color:' + cor + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (id === sala.sessionId ? '▶ ' : '') + String(j.nome).replace(/[<>&]/g, '') +
        ' <span style="color:#9fb8d6">' + (j.vivo ? pct + '%' : '☠') + ' · ' + (j.ping || '–') + 'ms' + (j.conectado === false ? ' · caiu' : '') + '</span></div>');
      i++;
    });
    painel.innerHTML = linhas.join('');
  }

  // ══ PAUSA DO CO-OP · VOLTAR SOZINHO · BOTÃO VOLTAR (tudo deste bloco é novo) ══════════════
  // Quando a partida acaba (vitória, derrota, PvP) avisamos o multiplayer-core para NÃO nos levar de volta a ela.
  function marcarFim() { terminouLocal = true; try { if (M.fimDaPartida) M.fimDaPartida(); } catch (e) {} }
  function ligarFimDaPartida() {
    ['encerrarPartida', 'venceuJogo'].forEach(function (nome) {
      var f = window[nome];
      if (typeof f !== 'function') return;
      window[nome] = function () { marcarFim(); return f.apply(this, arguments); };
    });
  }

  // ── PAUSA DO CO-OP ──────────────────────────────────────────────
  // O servidor (SalaRoom._vigiarPausaCoop) avisa quando alguém caiu OU mandou o jogo para segundo plano (botão Home,
  // troca de app, tela bloqueada). Aqui congelamos o jogo (jogoAtivo = false: o mesmo mecanismo do Game Over) e mostramos
  // o aviso; quando todo mundo volta, continua de onde parou. Isso mantém o mundo dos celulares igual: cada celular roda a
  // própria simulação e, se só um parasse, os outros se afastariam dele.
  var ovPausaCoop = null;
  function mostrarPausaCoop(on, quem) {
    if (!ovPausaCoop) {
      ovPausaCoop = document.createElement('div');
      ovPausaCoop.style.cssText = 'position:fixed;left:50%;top:34%;transform:translateX(-50%);z-index:9600;pointer-events:none;text-align:center;font:700 14px Orbitron,monospace;letter-spacing:1px;color:#ffd24d;background:#05101fe6;border:1px solid #ffd24d88;border-radius:10px;padding:12px 18px;max-width:80vw;text-shadow:0 0 8px #000';
      document.body.appendChild(ovPausaCoop);
    }
    var nomes = (quem || []).map(function (n) { return String(n).replace(/[<>&]/g, ''); }).join(', ');
    ovPausaCoop.innerHTML = '⏸ PARTIDA PAUSADA<div style="font-size:11px;font-weight:400;margin-top:6px;opacity:.9">' + (nomes ? nomes + ' está reconectando...' : 'Um jogador está reconectando...') + '<br>Continua quando ele voltar.</div>';
    ovPausaCoop.style.display = on ? 'block' : 'none';
  }
  function pausaCoop(d) {
    if (!d) return;
    if (d.on) {
      if (!pausadoCoop) {
        var rodando = (typeof jogoAtivo !== 'undefined' && jogoAtivo) || (typeof contagemAtiva !== 'undefined' && contagemAtiva);
        if (!rodando || terminouLocal) return; // a partida não está rolando para mim (acabou, ou ainda nem largou)
        pausadoCoop = true;
        try {
          jogoAntesPausa = !!jogoAtivo; contagemNaPausa = !!contagemAtiva; moderacaoAntes = !!pausadoPorModeracao;
          jogoAtivo = false; pausadoPorModeracao = true; // (o GO do 3-2-1 não pode religar o jogo durante a pausa)
        } catch (e) { /* variáveis do jogo indisponíveis: só mostra o aviso */ }
      }
      mostrarPausaCoop(true, d.quem);
    } else if (pausadoCoop) {
      pausadoCoop = false;
      mostrarPausaCoop(false);
      try {
        pausadoPorModeracao = moderacaoAntes;
        // só religa o que NÓS desligamos (ou o 3-2-1 que terminou durante a pausa); nunca uma tela de vitória/derrota
        if (!partidaEncerrada && !terminouLocal && (jogoAntesPausa || (contagemNaPausa && !contagemAtiva))) jogoAtivo = true;
      } catch (e) { /* idem */ }
    }
  }

  // ── VOLTOU NO MEIO DA PARTIDA (a página recarregou) ─────────────
  // No co-op cada celular roda a própria partida; um jogo recarregado recomeça do zero e não alcança o time.
  // Então ele volta para a SALA e assiste (como quem desistiu) até acabar. O PvP não tem esse problema: o servidor tem tudo.
  function entrarComoTardio() {
    if (overlayEspera) overlayEspera.style.display = 'none';
    bloqueado = false; // (de propósito NÃO chama iniciarContagem: o jogo local fica parado)
    marcarFim();       // não voltar sozinho de novo: ele só assiste
    entrarEspectador();
    avisarEstado('fora');
    aviso('Você voltou no meio da partida. Seu jogo recomeçaria do zero e não alcança o time, então você assiste até acabar.');
  }

  // ── APP EM SEGUNDO PLANO / TELA BLOQUEADA ──────────────────────
  // Avisa o servidor na hora (sem esperar a conexão cair, que demora ~20 s): a partida pausa para todos.
  document.addEventListener('visibilitychange', function () {
    if (!sala || terminouLocal) return; // sem conexão agora: o 'saiu' já reconecta e, ao voltar, o estado certo é enviado
    try { M.enviar('ausente', document.hidden ? 1 : 0); } catch (e) {}
  });
  window.addEventListener('pagehide', function () { if (sala && !terminouLocal) { try { M.enviar('ausente', 1); } catch (e) {} } });

  // ── BOTÃO VOLTAR DO CELULAR ────────────────────────────────────
  // Sem isto, apertar "voltar" sai da partida na hora. Agora aparece "SAIR DA PARTIDA?" e a partida continua atrás.
  // (O Chrome ignora entradas de histórico criadas sem toque, por isso só ligamos depois do 1º toque na tela.)
  var ovSaida = null, guardaAtiva = false;
  function perguntarSaida() {
    if (ovSaida) { ovSaida.style.display = 'flex'; return; }
    ovSaida = document.createElement('div');
    ovSaida.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:#020510cc;font-family:Orbitron,monospace';
    var bt = 'font:700 13px Orbitron,monospace;padding:11px 18px;border-radius:10px;';
    ovSaida.innerHTML = '<div style="background:#05101f;border:1px solid #ff5d73;border-radius:14px;padding:18px 20px;max-width:84vw;text-align:center;color:#cfeaff">' +
      '<div style="font:700 16px Orbitron,monospace;color:#ff9aa8;letter-spacing:1px">SAIR DA PARTIDA?</div>' +
      '<div style="font-size:12px;margin:10px 0 14px;line-height:1.5;opacity:.9">' + (PVP ? 'No PvP, sair é desistir: o adversário vence.' : 'Seu time continua jogando sem você.') + '</div>' +
      '<div style="display:flex;gap:10px;justify-content:center">' +
      '<button id="nrSaidaNao" style="' + bt + 'border:1px solid #00ffff;background:#00ffff22;color:#00ffff">CONTINUAR</button>' +
      '<button id="nrSaidaSim" style="' + bt + 'border:1px solid #ff5d73;background:#ff5d7322;color:#ff9aa8">SAIR</button></div></div>';
    document.body.appendChild(ovSaida);
    ovSaida.querySelector('#nrSaidaNao').onclick = function () { ovSaida.style.display = 'none'; };
    ovSaida.querySelector('#nrSaidaSim').onclick = function () { try { M.sair(); } catch (e) {} location.replace('menu.html'); }; // saiu DE PROPÓSITO: não volta sozinho
  }
  function ativarGuardaVoltar() {
    if (guardaAtiva) return; guardaAtiva = true;
    try { history.pushState({ nr: 1 }, '', location.href); } catch (e) { return; }
    window.addEventListener('popstate', function () {
      if (terminouLocal) { try { history.back(); } catch (e) {} return; } // a partida acabou: o voltar funciona normal
      try { history.pushState({ nr: 1 }, '', location.href); } catch (e) {} // fica na página
      perguntarSaida();
    });
  }
  document.addEventListener('pointerdown', ativarGuardaVoltar, { once: true, capture: true });

  // ── LOOP PRÓPRIO (não mexe no animate() do jogo) ──────────────
  function loop() {
    requestAnimationFrame(loop);
    var agora = performance.now(), dt = Math.min(0.05, (agora - tAnterior) / 1000); tAnterior = agora;
    if (!sala) return;
    enviarMeuEstado(agora); sincronizarFantasmas(dt); moverTiros(dt);
    if (pvp) pvp.tick();
    flushRede(agora); if (!PVP) tentarDanoPendente(agora);
    if (espectador) seguirAlvo();
    if (++contPainel % 15 === 0) { atualizarPainel(); atualizarEsperaUI(); }
  }

  // ── CONEXÃO / RECONEXÃO ───────────────────────────────────────
  async function voltarParaSala(tentativa) {
    var r = await M.reconectar();
    if (r) {
      sala = r;
      try { if (M.marcarPartida) M.marcarPartida(location.href); M.enviar('ausente', document.hidden ? 1 : 0); } catch (e) { /* sem rede agora: o próximo sinal de vida corrige */ }
      aviso('Online ✔'); setTimeout(function () { var e = document.getElementById('nrOnlineAviso'); if (e) e.style.display = 'none'; }, 1500); return true; }
    if (tentativa < 4) { await new Promise(function (ok) { setTimeout(ok, 2000); }); return voltarParaSala(tentativa + 1); }
    return false;
  }

  (async function iniciar() {
    try { await M.carregarBiblioteca(); } catch (e) { liberarLargada(); return aviso(e.message, true); }
    M.iniciar({ url: SERVIDOR, getToken: function () { return Promise.resolve(null); } }); // reconectar não passa pelo login de novo
    M.on('tiro', tiroFantasma);
    M.on('erro', aviso);
    M.on('dano', function (lista) {
      var agora = performance.now();
      lista.forEach(function (par) { if (!aplicarDanoRemoto(par[0], par[1])) { var p = danoRecebido[par[0]]; if (p) p.d += par[1]; else danoRecebido[par[0]] = { d: par[1], t: agora }; } });
    });
    M.on('morte', function (nid) {
      var en = acharInimigo(nid);
      if (en && typeof matarOriginal === 'function') { en.hp = 0; matarOriginal(en); }
      delete danoRecebido[nid];
    });
    M.on('espera', function (d) { contProntos = d; atualizarEsperaUI(); });
    M.on('todos', function () { todosProntos = true; atualizarEsperaUI(); });
    M.on('comecar', function (d) {
      if (COOP && d && d.tardio) return entrarComoTardio(); // voltou no meio da partida (a página recarregou): assiste o time
      liberarLargada();
    });
    M.on('derrota-total', function () { // todos desistiram: quem estava assistindo também vê a derrota
      if (derrotaTotalFeita || !derrotaOriginal) return;
      derrotaTotalFeita = true; pararTimerRevive();
      if (bannerEspec) bannerEspec.style.display = 'none';
      derrotaOriginal();
    });
    M.on('fim', function (d) { if (pvp) pvp.fim(d); marcarFim(); });
    M.on('rodada-inicio', function (d) { if (pvp) pvp.rodadaInicio(d); });
    M.on('rodada-fim', function (d) { if (pvp) pvp.rodadaFim(d); });
    M.on('pausa', function (d) { if (pvp) pvp.pausa(d); else pausaCoop(d); }); // alguém caiu/voltou: o servidor pausa e retoma a partida
    var quedas = [];
    M.on('saiu', function (d) {
      sala = null; Object.keys(fantasmas).forEach(function (id) { scene.remove(fantasmas[id].grupo); delete fantasmas[id]; });
      if (!d.queda || terminouLocal || (pvp && pvp.terminou())) return;
      var agora = Date.now(); quedas = quedas.filter(function (t) { return agora - t < 30000; }); quedas.push(agora);
      var info = 'código ' + d.codigo + (d.motivo ? ' — ' + d.motivo : '');
      if (quedas.length >= 4) return aviso('A conexão caiu 4 vezes seguidas (' + info + '). Pare e mande um print desta tela.', true);
      aviso('Conexão perdida (' + info + '), reconectando...', true);
      voltarParaSala(0).then(function (ok) { if (!ok) aviso('Não consegui reconectar (' + info + '). Volte ao menu.', true); });
    });
    ligarTiro();
    ligarFimDaPartida();
    var ok = await voltarParaSala(0);
    if (!ok) { try { M.limparSessao(); } catch (e) {} liberarLargada(); return aviso('Não consegui voltar para a sala online (passou de 60s?). Volte ao menu e crie outra.', true); }
    avisarCarregado();
    loop();
  })();
})();
