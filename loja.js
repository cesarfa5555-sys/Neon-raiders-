// ══════════════════════════════════════════════════════════════════
// LOJA.JS — o Hangar. Só existem 2 itens à venda: o CAÇADOR CYBER (persona)
// e o RIFLE PLASMA (arma). Preços e textos ficam em data.js (LOJA).
// A aba MELHORIAS (upgrades permanentes) some com LOJA.melhorias = false.
// ══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var D = window.NRData, A = window.NRAudio, C = window.NRConta;
  var lo = null, saldo = 0, foco = 'cacador', ocupado = false;

  function toast(txt, tipo) { var t = $('toast'); t.textContent = txt; t.className = 'on ' + (tipo || ''); clearTimeout(toast._t); toast._t = setTimeout(function () { t.className = ''; }, 2600); }
  var fmt = function (n) { return Number(n).toLocaleString('pt-BR'); };

  // ── VITRINE 3D: o herói girando; "RIFLE" aproxima a câmera da arma ──
  var prev = { foco: 0 };
  function vitrine() {
    var T = window.THREE, cv = $('prev'); if (!T || !cv) return;
    var renderer; try { renderer = new T.WebGLRenderer({ canvas: cv, alpha: true, antialias: true }); } catch (e) { return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setClearColor(0, 0);
    var scene = new T.Scene(), cam = new T.PerspectiveCamera(32, 1, 0.1, 60);
    scene.add(new T.HemisphereLight(0x8899ff, 0x220044, 1.0));
    var key = new T.DirectionalLight(0xffffff, 0.9); key.position.set(3, 6, 5); scene.add(key);
    var l1 = new T.PointLight(0x2ee6ff, 2.2, 14); l1.position.set(-3, 2.5, -2.5); scene.add(l1);
    var l2 = new T.PointLight(0xff3da6, 2, 14); l2.position.set(3.2, 1.5, -2); scene.add(l2);
    // a vitrine sempre mostra o visual COMPLETO (o que o jogador ganha ao comprar)
    var m = window.NRModelos.criarCacador({ cor: 0x2ee6ff, basico: false, rifle: true });
    m.grupo.scale.setScalar(1.3); scene.add(m.grupo);
    var plat = new T.Mesh(new T.CylinderGeometry(1.5, 1.7, 0.12, 36), new T.MeshPhongMaterial({ color: 0x0c1230, shininess: 90 })); plat.position.y = -0.06; scene.add(plat);
    var an = new T.Mesh(new T.RingGeometry(1.45, 1.55, 48), new T.MeshBasicMaterial({ color: 0x2ee6ff, transparent: true, opacity: .8, side: T.DoubleSide, blending: T.AdditiveBlending })); an.rotation.x = -Math.PI / 2; an.position.y = 0.01; scene.add(an);
    function ajustar() { var w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    ajustar(); window.addEventListener('resize', ajustar);
    var t = 0, ult = performance.now(), ang = 0.4, alvo = new T.Vector3(0, 1.5, 0), pos = new T.Vector3(0, 2.2, 8.5);
    (function q(now) {
      requestAnimationFrame(q); var dt = Math.min(0.05, (now - ult) / 1000); ult = now; t += dt; ang += dt * 0.5;
      var arma = foco === 'rifle';
      var d = Math.max(7.5, 9.2 / Math.min(1, cam.aspect * 1.3));
      var ap = arma ? new T.Vector3(1.2, 2.1, 4.2) : new T.Vector3(0, 2.2, d), al = arma ? new T.Vector3(0.1, 1.55, 0.8) : new T.Vector3(0, 1.5, 0);
      pos.lerp(ap, Math.min(1, dt * 4)); alvo.lerp(al, Math.min(1, dt * 4)); cam.position.copy(pos); cam.lookAt(alvo);
      var a2 = arma ? 0.55 + Math.sin(t * 0.6) * 0.25 : ang;
      m.animar(dt, t, 0, Math.sin(a2), Math.cos(a2), false);
      m.grupo.position.y = Math.sin(t * 1.6) * 0.04; an.rotation.z = t * 0.7; l1.intensity = 2 + Math.sin(t * 2) * .5;
      if (!document.hidden) renderer.render(scene, cam);
    })(performance.now());
  }

  // ── ITENS ──
  function pintarItens() {
    $('descCacador').textContent = D.LOJA.cacador.desc; $('descRifle').textContent = D.LOJA.rifle.desc;
    [['cacador', 'btnCacador'], ['rifle', 'btnRifle']].forEach(function (p) {
      var b = $(p[1]), tem = lo[p[0]];
      b.textContent = tem ? 'ADQUIRIDO ✔' : '◈ ' + fmt(D.LOJA[p[0]].preco); b.disabled = tem; b.className = 'btn ' + (tem ? 'sec' : 'ouro'); b.disabled = tem;
    });
    $('selo').classList.toggle('oculto', !lo[foco]); $('itemCacador').classList.toggle('sel', foco === 'cacador'); $('itemRifle').classList.toggle('sel', foco === 'rifle');
  }
  async function comprar(id) {
    if (ocupado) return; ocupado = true;
    try {
      if (saldo < D.LOJA[id].preco) { A.tocar('erro'); toast('Moedas insuficientes. Jogue partidas para ganhar mais!', 'erro'); return; }
      var r = await C.comprar(id);
      if (!r.ok) { A.tocar('erro'); toast(r.erro, 'erro'); return; }
      A.tocar('comprar'); toast(D.LOJA[id].nome + ' adquirido!', 'ok'); await recarregar();
    } catch (e) { console.error(e); A.tocar('erro'); toast('Falha na compra: ' + e.message, 'erro'); }
    finally { ocupado = false; }
  }

  // ── MELHORIAS PERMANENTES ──
  function pintarUp() {
    var h = '';
    Object.keys(D.LOJA.up).forEach(function (id) {
      var d = D.LOJA.up[id], n = lo.up[id], max = n >= d.max, preco = max ? 0 : D.precoMelhoria(id, n), pips = '';
      for (var i = 0; i < d.max; i++) pips += '<i class="' + (i < n ? 'on' : '') + '"></i>';
      var bonus = id === 'vida' ? '+' + (n * d.porNivel) + ' vida' : '+' + Math.round(n * d.porNivel * 100) + '% ' + d.unidade;
      h += '<div class="up"><div class="ic">' + d.icone + '</div><div class="tx"><h3>' + d.nome + ' <span style="color:#ffd23d">' + n + '/' + d.max + '</span></h3><div class="pips">' + pips + '</div><div class="info">' + bonus + '</div></div>' +
        '<button class="btn ' + (max ? 'sec' : 'ouro') + '" data-up="' + id + '"' + (max ? ' disabled' : '') + '>' + (max ? 'MÁXIMO' : '◈ ' + fmt(preco)) + '</button></div>';
    });
    $('abaUp').innerHTML = h;
    $('abaUp').querySelectorAll('button[data-up]').forEach(function (b) { b.onclick = function () { melhorar(b.dataset.up); }; });
  }
  async function melhorar(id) {
    if (ocupado) return; ocupado = true;
    try {
      var preco = D.precoMelhoria(id, lo.up[id]);
      if (saldo < preco) { A.tocar('erro'); toast('Moedas insuficientes.', 'erro'); return; }
      var r = await C.melhorar(id);
      if (!r.ok) { A.tocar('erro'); toast(r.erro, 'erro'); return; }
      A.tocar('comprar'); toast(D.LOJA.up[id].nome + ' nível ' + r.nivel + '!', 'ok'); await recarregar();
    } catch (e) { console.error(e); A.tocar('erro'); toast('Falha: ' + e.message, 'erro'); }
    finally { ocupado = false; }
  }

  async function recarregar() {
    lo = await C.loadout(true); saldo = await C.moedas(true); $('moedasTxt').textContent = fmt(saldo); pintarItens(); pintarUp();
  }

  async function iniciar() {
    await recarregar(); vitrine();
    if (!D.LOJA.melhorias) $('abaMelhorias').classList.add('oculto');
    $('btnVoltar').onclick = function () { A.tocar('voltar'); location.href = 'menu.html'; };
    $('btnCacador').onclick = function () { comprar('cacador'); }; $('btnRifle').onclick = function () { comprar('rifle'); };
    $('itemCacador').onclick = function () { foco = 'cacador'; pintarItens(); A.tocar('clique'); }; $('itemRifle').onclick = function () { foco = 'rifle'; pintarItens(); A.tocar('clique'); };
    document.querySelectorAll('.aba').forEach(function (b) {
      b.onclick = function () {
        document.querySelectorAll('.aba').forEach(function (x) { x.classList.toggle('on', x === b); }); A.tocar('clique');
        var up = b.dataset.aba === 'melhorias'; $('abaItens').classList.toggle('oculto', up); $('abaUp').classList.toggle('oculto', !up);
      };
    });
    ['pointerdown', 'touchstart'].forEach(function (ev) { window.addEventListener(ev, function () { A.destravar(); }, { once: true }); });
  }
  window.addEventListener('load', function () { iniciar().catch(function (e) { console.error(e); toast('Erro: ' + e.message, 'erro'); }); });
})();
