// ══════════════════════════════════════════════════════════════════
// INTERFACE.JS — tudo que é DOM (HTML) durante a partida: barras, cartas
// de habilidade, pausa, tela de resultado. Não tem lógica de jogo: só
// recebe números e mostra. Quem chama é o partida.js.
// ══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var D = window.NRData;
  function $(id) { return document.getElementById(id); }

  var DICAS = [
    'Dê um DASH para atravessar inimigos: você fica invulnerável por um instante.',
    'Cápsulas douradas dão 2 melhorias grátis. Elites e chefes sempre soltam uma.',
    'Gemas azuis, verdes e roxas valem mais XP. O Ímã Quântico puxa de mais longe.',
    'Chefes aparecem a cada 5 ondas. Fique em movimento e desvie dos avisos vermelhos.',
    'Combine habilidades: Pulso EMP segura a horda, Granada e Tesla limpam o grupo.',
    'No co-op, fique ao lado de um aliado caído para revivê-lo.',
    'Você só pode levar 5 habilidades e 6 passivas: escolha uma build e foque nela.',
  ];

  function criar(cbs) {
    cbs = cbs || {};
    var timerBanner = null, timerAviso = null, cartasTimer = null, ultimaVida = -1;

    // ── carregamento ──
    $('carDica').textContent = DICAS[Math.floor(Math.random() * DICAS.length)];
    function carregando(pct, txt) { $('carPreench').style.width = pct + '%'; if (txt) $('carTexto').textContent = txt; }
    function fimCarregando() { $('carregando').classList.add('some'); setTimeout(function () { $('carregando').style.display = 'none'; }, 700); }

    // ── HUD ──
    function iconesHab(est, cacheKey) {
      var chave = JSON.stringify([est.hab, est.pas]);
      if (chave === cacheKey.v) return; cacheKey.v = chave;
      var h = '';
      D.ORDEM_HAB.forEach(function (id) { var l = est.hab[id]; if (l) { var d = D.HABILIDADES[id]; h += '<div class="habIc" style="border-color:' + d.cor + '"><span>' + d.icone + '</span><b style="color:' + d.cor + '">' + l + '</b></div>'; } });
      D.ORDEM_PAS.forEach(function (id) { var l = est.pas[id]; if (l) { var d = D.PASSIVAS[id]; h += '<div class="habIc pas" style="border-color:' + d.cor + '"><span>' + d.icone + '</span><b style="color:' + d.cor + '">' + l + '</b></div>'; } });
      $('habs').innerHTML = h;
    }
    var cacheHab = { v: '' };
    function atualizar(e) {
      $('xpPreench').style.width = Math.min(100, e.xpFrac * 100) + '%';
      $('xpTexto').textContent = 'NV ' + e.nivel;
      $('ondaNum').textContent = e.onda;
      $('ondaTempoPreench').style.width = Math.min(100, e.ondaT / e.ondaDur * 100) + '%';
      var m = Math.floor(e.tempo / 60), s = Math.floor(e.tempo % 60); $('tempoTxt').textContent = m + ':' + (s < 10 ? '0' : '') + s;
      $('abatesNum').textContent = e.abates; $('sucataNum').textContent = Math.floor(e.sucata || 0); $('moedasNum').textContent = Math.floor(e.moedas);
      var pv = Math.max(0, e.hp / e.hpMax); $('vidaPreench').style.width = (pv * 100) + '%'; $('vidaPerda').style.width = (pv * 100) + '%';
      $('vidaTexto').textContent = Math.ceil(e.hp) + ' / ' + e.hpMax;
      $('vinhetaVida').classList.toggle('on', pv < 0.3 && e.vivo);
      iconesHab(e, cacheHab);
      // dash: anel de recarga (107 = circunferência do SVG)
      var f = e.dashCd > 0 ? Math.min(1, e.dashCd / e.dashRecarga) : 0;
      $('dashAnel').style.strokeDashoffset = String(107 * f); $('btnDash').classList.toggle('carregando', f > 0);
      // chefe
      var cb = $('chefeBox');
      if (e.chefe) { cb.classList.remove('oculto'); $('chefeNome').textContent = e.chefe.nome; $('chefePreench').style.width = Math.max(0, e.chefe.frac * 100) + '%'; } else cb.classList.add('oculto');
      // aliados (co-op)
      if (e.aliados) {
        var h = '';
        e.aliados.forEach(function (a) { h += '<div class="aliado' + (a.vivo ? '' : ' caido') + '" style="border-color:' + a.cor + '"><span>' + a.nome + '</span><i><em style="width:' + Math.max(0, a.hp / a.hpMax * 100) + '%"></em></i></div>'; });
        var el = $('aliados'); if (el.dataset.h !== h) { el.innerHTML = h; el.dataset.h = h; }
      }
    }
    function mostrarHud() { $('hud').classList.remove('oculto'); }

    function banner(titulo, sub, cor) {
      var b = $('banner'); b.style.color = cor || '#fff';
      b.innerHTML = '<small>' + (sub || '') + '</small><b>' + titulo + '</b>';
      b.classList.remove('mostra'); void b.offsetWidth; b.classList.add('mostra');
    }
    function aviso(txt, ms) {
      var a = $('aviso'); a.textContent = txt; a.style.display = 'block'; clearTimeout(timerAviso);
      timerAviso = setTimeout(function () { a.style.display = 'none'; }, ms || 2500);
    }
    function dano() { var v = $('vinhetaDano'); v.style.opacity = '1'; setTimeout(function () { v.style.opacity = '0'; }, 120); }
    function flash(cor) { var f = $('flashTela'); f.style.background = cor || '#fff'; f.style.transition = 'none'; f.style.opacity = '0.7'; void f.offsetWidth; f.style.transition = 'opacity .45s'; f.style.opacity = '0'; }

    // ── CARTAS DE LEVEL UP ──
    function textoCarta(c) {
      if (c.tipo === 'hab') { var d = D.HABILIDADES[c.id]; return { ic: d.icone, nome: d.nome, cor: d.cor, desc: c.nivel === 1 ? d.desc + ' ' + d.niveis[0] + '.' : d.niveis[c.nivel - 1], nv: c.nivel === 1 ? 'NOVA HABILIDADE' : 'NÍVEL ' + (c.nivel - 1) + ' → ' + c.nivel + (c.nivel === D.CFG.nivelMaxHab ? ' (MÁX)' : ''), nova: c.nivel === 1 }; }
      if (c.tipo === 'pas') { var p = D.PASSIVAS[c.id]; return { ic: p.icone, nome: p.nome, cor: p.cor, desc: p.desc, nv: c.nivel === 1 ? 'NOVA PASSIVA' : 'NÍVEL ' + (c.nivel - 1) + ' → ' + c.nivel + (c.nivel === D.CFG.nivelMaxPas ? ' (MÁX)' : ''), nova: c.nivel === 1 }; }
      if (c.tipo === 'cura') return { ic: '💊', nome: 'KIT DE REPARO', cor: '#39ff88', desc: 'Recupera 40% da vida máxima.', nv: 'INSTANTÂNEO', nova: true };
      return { ic: '◈', nome: 'BÔNUS DE CRÉDITOS', cor: '#ffd23d', desc: '+150 moedas ao final da partida.', nv: 'INSTANTÂNEO', nova: true };
    }
    // tempoLimite > 0 = online (some sozinho e o servidor escolhe); 0 = solo (o jogo fica pausado)
    function cartas(lista, nivel, tempoLimite) {
      var el = $('cartasLista'); el.innerHTML = '';
      $('cartasNivel').textContent = 'NÍVEL ' + nivel;
      lista.forEach(function (c, i) {
        var t = textoCarta(c), d = document.createElement('div');
        d.className = 'carta'; d.style.setProperty('--c', t.cor);
        d.innerHTML = '<div class="ic">' + t.ic + '</div><div class="tx"><h3>' + t.nome + '</h3><p>' + t.desc + '</p><div class="nv' + (t.nova ? ' nova' : '') + '">' + t.nv + '</div></div>';
        var escolhido = false;
        function escolher(ev) { ev.preventDefault(); if (escolhido) return; escolhido = true; fecharCartas(); if (cbs.carta) cbs.carta(i); }
        d.addEventListener('touchend', escolher); d.addEventListener('click', escolher);
        el.appendChild(d);
      });
      $('cartasEsperando').classList.add('oculto');
      $('cartasTela').classList.remove('oculto');
      clearInterval(cartasTimer);
      if (tempoLimite > 0) {
        $('cartasTempo').classList.remove('oculto'); var t0 = performance.now();
        cartasTimer = setInterval(function () { var u = 1 - (performance.now() - t0) / 1000 / tempoLimite; $('cartasTempoPreench').style.width = Math.max(0, u * 100) + '%'; if (u <= 0) { clearInterval(cartasTimer); fecharCartas(); } }, 60);
      } else $('cartasTempo').classList.add('oculto');
    }
    function fecharCartas() { clearInterval(cartasTimer); $('cartasTela').classList.add('oculto'); }
    function cartasAbertas() { return !$('cartasTela').classList.contains('oculto'); }


    // ── LOJA ENTRE AS ONDAS ──
    // d = { ofertas:[{tipo,id,nivel,preco,vendida}], sucata, reroll, pronto, onda, tempo (online) }
    function loja(d) {
      var el = $('lojaLista'), h = '';
      $('lojaOnda').textContent = 'ONDA ' + (d.onda - 1) + ' ✔'; $('lojaSucata').textContent = Math.floor(d.sucata);
      d.ofertas.forEach(function (c, i) {
        var t = textoCarta(c), pode = !c.vendida && d.sucata >= c.preco && !d.pronto;
        h += '<div class="carta lojaCarta' + (c.vendida ? ' vendida' : pode ? '' : ' semGrana') + '" data-i="' + i + '" style="--c:' + t.cor + '"><div class="ic">' + t.ic + '</div><div class="tx"><h3>' + t.nome + '</h3><p>' + t.desc + '</p><div class="nv' + (t.nova ? ' nova' : '') + '">' + t.nv + '</div></div>' +
          '<div class="preco">' + (c.vendida ? 'COMPRADO' : '⚙ ' + c.preco) + '</div></div>';
      });
      el.innerHTML = h;
      el.querySelectorAll('.lojaCarta').forEach(function (n) {
        function comprar(ev) { ev.preventDefault(); if (n.classList.contains('vendida') || n.classList.contains('semGrana')) { if (cbs.erroLoja) cbs.erroLoja(); return; } if (cbs.comprar) cbs.comprar(parseInt(n.dataset.i, 10)); }
        n.addEventListener('click', comprar);
      });
      var rr = $('lojaReroll'); rr.textContent = 'REROLAR  ⚙ ' + d.reroll; rr.disabled = d.pronto || d.sucata < d.reroll;
      var pr = $('lojaPronto'); pr.textContent = d.pronto ? 'AGUARDANDO OS OUTROS…' : 'PRÓXIMA ONDA ▶'; pr.disabled = !!d.pronto;
      var tp = $('lojaTempo'); if (d.tempo !== undefined && d.tempo !== null && d.online) { tp.classList.remove('oculto'); tp.textContent = Math.ceil(d.tempo) + 's'; } else tp.classList.add('oculto');
      $('lojaTela').classList.remove('oculto');
    }
    function lojaFechar() { $('lojaTela').classList.add('oculto'); }
    function lojaAberta() { return !$('lojaTela').classList.contains('oculto'); }
    $('lojaReroll').addEventListener('click', function () { if (cbs.rerolar) cbs.rerolar(); });
    $('lojaPronto').addEventListener('click', function () { if (cbs.prontoLoja) cbs.prontoLoja(); });

    // ── PAUSA ──
    function pausa(v) {
      $('pausaTela').classList.toggle('oculto', !v);
      if (v) { $('volMusica').value = window.NRAudio.volumeMusica(); $('volSfx').value = window.NRAudio.volumeSfx(); }
    }
    $('btnPausa').style.pointerEvents = 'auto';
    $('btnPausa').addEventListener('click', function () { if (cbs.pausar) cbs.pausar(); });
    $('pausaContinuar').addEventListener('click', function () { if (cbs.continuar) cbs.continuar(); });
    $('pausaSair').addEventListener('click', function () { if (cbs.sair) cbs.sair(); });
    $('volMusica').addEventListener('input', function (e) { window.NRAudio.volumeMusica(parseFloat(e.target.value)); });
    $('volSfx').addEventListener('input', function (e) { window.NRAudio.volumeSfx(parseFloat(e.target.value)); window.NRAudio.tocar('clique'); });
    $('resDeNovo').addEventListener('click', function () { if (cbs.denovo) cbs.denovo(); });
    $('resMenu').addEventListener('click', function () { if (cbs.menu) cbs.menu(); });
    $('btnDash').style.pointerEvents = 'auto';
    function ligarDash(fn) { var b = $('btnDash'); b.addEventListener('touchstart', function (e) { e.preventDefault(); e.stopPropagation(); fn(); }, { passive: false }); b.addEventListener('mousedown', function (e) { e.stopPropagation(); fn(); }); }

    // ── RESULTADO ──
    function fmtTempo(s) { var m = Math.floor(s / 60), r = s % 60; return m + ':' + (r < 10 ? '0' : '') + r; }
    function resultado(res, eu, extra) {
      fecharCartas(); pausa(false);
      var morreu = res.motivo === 'morreu';
      $('resMotivo').textContent = morreu ? 'MISSÃO ENCERRADA' : 'PARTIDA FINALIZADA';
      $('resTitulo').textContent = morreu ? 'VOCÊ CAIU' : 'FIM DE JOGO'; $('resTitulo').style.color = morreu ? '#ff4d5e' : '#2ee6ff';
      $('resOnda').innerHTML = 'ONDA <b>' + res.onda + '</b>';
      var itens = [['TEMPO', fmtTempo(res.tempo)], ['ABATES', res.abates], ['CHEFES', res.chefes], ['NÍVEL', eu ? eu.nivel : '-']];
      $('resGrade').innerHTML = itens.map(function (i) { return '<div class="resItem"><small>' + i[0] + '</small><b>' + i[1] + '</b></div>'; }).join('');
      $('resRecompensa').innerHTML = eu ? 'RECOMPENSA<b>◈ ' + eu.moedas + '</b><span style="font-size:10px;color:#9fb9d4">+' + eu.xpConta + ' XP de conta</span>' : '';
      $('resExtra').innerHTML = (extra || []).map(function (l) { return '<div>' + l + '</div>'; }).join('');
      $('resultadoTela').classList.remove('oculto');
    }
    function resultadoExtra(linhas) { $('resExtra').innerHTML = linhas.map(function (l) { return '<div>' + l + '</div>'; }).join(''); }
    function botaoDeNovo(visivel) { $('resDeNovo').style.display = visivel ? '' : 'none'; }

    // ── CONTAGEM 3-2-1 ──
    function contagem(txt, cor) {
      var c = $('contagem'); c.classList.remove('oculto', 'pulsa'); c.innerHTML = '<b style="color:' + (cor || '#fff') + '">' + txt + '</b>'; void c.offsetWidth; c.classList.add('pulsa');
    }
    function fimContagem() { $('contagem').classList.add('oculto'); }

    return {
      carregando: carregando, fimCarregando: fimCarregando, mostrarHud: mostrarHud, atualizar: atualizar, banner: banner, aviso: aviso, dano: dano, flash: flash,
      loja: loja, lojaFechar: lojaFechar, lojaAberta: lojaAberta, cartas: cartas, fecharCartas: fecharCartas, cartasAbertas: cartasAbertas, pausa: pausa, resultado: resultado, resultadoExtra: resultadoExtra, botaoDeNovo: botaoDeNovo,
      contagem: contagem, fimContagem: fimContagem, ligarDash: ligarDash,
    };
  }
  window.NRInterface = { criar: criar };
})();
