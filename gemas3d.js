// ════════════════════════════════════════════════════════════════
// NEON RAIDERS — GEMAS 3D
// Gera as 4 joias da loja como malhas 3D proceduradas (Three.js),
// substituindo os PNGs estáticos antigos.
//
// Formas de uso:
//   1) NRGemas3D.obterThumb(paletaId)  → devolve um data URL (PNG)
//      pré-renderizado, cacheado, OU null se o Three.js ainda não
//      tiver carregado. Usado nos lugares que só precisam de uma
//      imagem parada (mochila, ícones pequenos).
//   2) NRGemas3D.obterFramesGiro(paletaId, quadros, tamanhoPx) →
//      devolve um array de data URLs, cada um a gema renderizada de
//      verdade num ângulo diferente (tipo um filme quadro a quadro),
//      OU null se o Three.js ainda não carregou. Quem chama troca a
//      <img> entre os quadros com um setInterval pra parecer girando
//      em 3D de verdade — sem manter nenhum contexto WebGL aberto
//      contínuo, então dá pra ter várias juntas na tela ao mesmo
//      tempo com segurança (era isso que quebrava antes: WebGL "ao
//      vivo" demais ao mesmo tempo). Usado na grade da loja.
//   3) NRGemas3D.montarAoVivo(container, paletaId) → cria uma cena de
//      verdade, girando sozinha e respondendo a arrastar com o dedo,
//      dentro do elemento. Esse sim mantém WebGL aberto de verdade —
//      só liga quando o usuário toca na joia, e nunca mais de
//      LIMITE_VIVO por vez.
//
// Requer Three.js r128. Este arquivo carrega o Three.js SOZINHO (não
// depende mais de você colocar a tag <script> do CDN em ordem certa
// no HTML) — só precisa de:
//   <script src="gemas3d.js"></script>
//
// Como o carregamento é assíncrono, NÃO chame NRGemas3D.obterThumb(),
// .obterFramesGiro() ou .montarAoVivo() direto sem checar — todas
// devolvem null se chamadas cedo demais. Pra reagir assim que ficar
// pronto:
//   NRGemas3D.pronto(function() {
//     // aqui dentro já é seguro usar as funções acima
//   });
// Se já estiver pronto quando você chamar, o callback roda na hora.
//
// Sem import/export ES module — tudo em window.NRGemas3D, pra manter
// compatibilidade com o WebView do Spck.
// ════════════════════════════════════════════════════════════════

(function () {

  var THREE_CDN_URL = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
  var _pronto = false;
  var _falhou = false;
  var _callbacksEsperando = [];

  function avisarProntos() {
    _pronto = true;
    var lista = _callbacksEsperando;
    _callbacksEsperando = [];
    lista.forEach(function (cb) { try { cb(); } catch (e) {} });
  }

  function carregarThree() {
    if (window.THREE) { avisarProntos(); return; } // já tinha carregado (outra tela, cache)
    var script = document.createElement("script");
    script.src = THREE_CDN_URL;
    script.onload = avisarProntos;
    script.onerror = function () {
      _falhou = true;
      console.error("[gemas3d] Não consegui carregar o Three.js do CDN — as joias vão usar o círculo sólido como reserva.");
      var lista = _callbacksEsperando;
      _callbacksEsperando = [];
      lista.forEach(function (cb) { try { cb(); } catch (e) {} });
    };
    document.head.appendChild(script);
  }
  carregarThree();

  // Chama seu callback assim que o Three.js estiver pronto pra uso.
  // Se já estava pronto, roda na hora (síncrono). Se o carregamento
  // já tinha falhado, roda o callback mesmo assim (pra não travar a
  // tela esperando pra sempre) — quem chamou decide o que fazer via
  // tratamento de erro normal (as funções abaixo já devolvem null sozinhas).
  function pronto(callback) {
    if (_pronto || _falhou) { callback(); return; }
    _callbacksEsperando.push(callback);
  }

  var POINTS = 10;

  // Paletas — direto do arquivo de evolução que o Hall fez.
  var PALETAS = {
    roxo: [
      0x120018, 0x1c0028, 0x270038, 0x33004a, 0x40005c,
      0x50006f, 0x620083, 0x21002f, 0x0d0012
    ],
    verde: [
      0x063d2c, 0x08704a, 0x0b9b62, 0x13bd78, 0x32d995,
      0x5be8ac, 0x82f2c2, 0x168f68, 0x0b4936
    ],
    branco: [
      0x777c86, 0x9da3ad, 0xbcc2cb, 0xd6dbe2, 0xe7ebf0,
      0xf4f6f8, 0xffffff, 0xc3d1df, 0x858e9a
    ],
    vermelho: [
      0x330006, 0x52000b, 0x710010, 0x900018, 0xb00020,
      0xc92838, 0xe04450, 0x79000e, 0x3f0007
    ]
  };

  // ── GEOMETRIA DA JOIA (idêntica à do arquivo original) ──────────
  function criarGeometriaJoia() {
    var vertices = [];
    var indices = [];

    function ring(y, radiusX, radiusZ, rotation) {
      rotation = rotation || 0;
      var start = vertices.length / 3;
      for (var i = 0; i < POINTS; i++) {
        var angle = (i / POINTS) * Math.PI * 2 + rotation;
        vertices.push(Math.cos(angle) * radiusX, y, Math.sin(angle) * radiusZ);
      }
      return start;
    }

    var top    = ring(0.62, 0.38, 0.45, Math.PI / 10);
    var crown  = ring(0.43, 0.55, 0.64);
    var girdle = ring(0.08, 0.72, 0.82, Math.PI / 10);
    var lower  = ring(-0.25, 0.52, 0.57);
    var bottom = ring(-0.72, 0.06, 0.06, Math.PI / 10);

    function connect(ringA, ringB) {
      for (var i = 0; i < POINTS; i++) {
        var next = (i + 1) % POINTS;
        indices.push(ringA + i, ringA + next, ringB + i, ringA + next, ringB + next, ringB + i);
      }
    }
    connect(top, crown);
    connect(crown, girdle);
    connect(girdle, lower);
    connect(lower, bottom);

    var topCenter = vertices.length / 3;
    vertices.push(0, 0.62, 0);
    for (var i = 0; i < POINTS; i++) {
      var next = (i + 1) % POINTS;
      indices.push(topCenter, top + next, top + i);
    }

    var bottomCenter = vertices.length / 3;
    vertices.push(0, -0.72, 0);
    for (var j = 0; j < POINTS; j++) {
      var next2 = (j + 1) % POINTS;
      indices.push(bottomCenter, bottom + j, bottom + next2);
    }

    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry.toNonIndexed();
  }

  function criarGema(paletaId) {
    var colors = PALETAS[paletaId] || PALETAS.roxo;
    var nonIndexed = criarGeometriaJoia();

    var position = nonIndexed.getAttribute("position");
    var colorArray = new Float32Array(position.count * 3);

    for (var face = 0; face < position.count / 3; face++) {
      var color = new THREE.Color(colors[(face * 5) % colors.length]);
      for (var vertex = 0; vertex < 3; vertex++) {
        var index = (face * 3 + vertex) * 3;
        colorArray[index] = color.r;
        colorArray[index + 1] = color.g;
        colorArray[index + 2] = color.b;
      }
    }
    nonIndexed.setAttribute("color", new THREE.Float32BufferAttribute(colorArray, 3));

    var material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.22,
      metalness: 0.02,
      flatShading: true
    });

    var gem = new THREE.Mesh(nonIndexed, material);
    gem.scale.set(0.82, 0.82, 0.82);

    var edges = new THREE.EdgesGeometry(nonIndexed, 20);
    var edgeMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.10 });
    gem.add(new THREE.LineSegments(edges, edgeMaterial));

    return gem;
  }

  function montarCenaBase(larguraPx, alturaPx, transparente) {
    var scene = new THREE.Scene();
    if (!transparente) scene.background = new THREE.Color(0xffffff);

    var camera = new THREE.PerspectiveCamera(38, larguraPx / alturaPx, 0.1, 100);
    camera.position.set(0, 0, 8);

    var renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: transparente,
      powerPreference: "low-power",
      preserveDrawingBuffer: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(larguraPx, alturaPx);
    if (renderer.outputEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
    if (transparente) renderer.setClearColor(0x000000, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 1.7));
    var light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(4, 5, 6);
    scene.add(light);
    var light2 = new THREE.DirectionalLight(0xffffff, 1.3);
    light2.position.set(-4, 2, 4);
    scene.add(light2);

    return { scene: scene, camera: camera, renderer: renderer };
  }

  // ── THUMBNAIL ESTÁTICO — 1 quadro só (cacheado, um render por paleta) ──
  var _cacheThumbs = {};

  function obterThumb(paletaId, tamanhoPx) {
    tamanhoPx = tamanhoPx || 160;
    var chave = paletaId + ":" + tamanhoPx;
    if (_cacheThumbs[chave]) return _cacheThumbs[chave];

    // Se o Three.js ainda não carregou, não tem como renderizar ainda.
    // Devolve null em vez de estourar erro — quem chamou decide o que
    // mostrar nesse meio tempo e chama de novo depois via .pronto().
    if (!window.THREE) return null;

    var base;
    try {
      base = montarCenaBase(tamanhoPx, tamanhoPx, true);
      var gem = criarGema(paletaId);
      gem.rotation.set(0.35, 0.7, 0);
      base.scene.add(gem);

      // Alguns WebViews restritos não renderizam de verdade num canvas
      // que nunca esteve na tela — anexa escondido, renderiza, tira a
      // "foto", remove — tudo na mesma execução, sem piscar na tela.
      base.renderer.domElement.style.position = "fixed";
      base.renderer.domElement.style.left = "-9999px";
      base.renderer.domElement.style.top = "0";
      base.renderer.domElement.style.pointerEvents = "none";
      document.body.appendChild(base.renderer.domElement);

      base.renderer.render(base.scene, base.camera);
      var dataUrl = base.renderer.domElement.toDataURL("image/png");
      if (!dataUrl || dataUrl.length < 1000) {
        throw new Error("Render provavelmente veio em branco (data URL suspeitosamente curta)");
      }
      _cacheThumbs[chave] = dataUrl;
      return dataUrl;
    } catch (e) {
      console.error("[gemas3d] obterThumb falhou:", e);
      return null;
    } finally {
      if (base && base.renderer.domElement.parentNode) {
        document.body.removeChild(base.renderer.domElement);
      }
      if (base) { base.renderer.dispose(); base.renderer.forceContextLoss(); }
    }
  }

  // ── SEQUÊNCIA DE QUADROS (giro 3D "de mentirinha", sem WebGL vivo) ──
  // Renderiza a gema em N ângulos diferentes e devolve as N imagens.
  // Quem chama troca a <img> entre elas rapidinho (setInterval) pra
  // parecer girando de verdade — porque cada quadro É um render 3D de
  // verdade, só congelado como foto. Isso é o que permite ter as 4
  // joias "girando" ao mesmo tempo na grade sem abrir 4 contextos
  // WebGL ao vivo (só teria 1 quando o dedo toca — ver montarAoVivo).
  var _cacheFrames = {};

  function obterFramesGiro(paletaId, quadros, tamanhoPx) {
    quadros = quadros || 16;
    tamanhoPx = tamanhoPx || 160;
    var chave = paletaId + ":" + quadros + ":" + tamanhoPx;
    if (_cacheFrames[chave]) return _cacheFrames[chave];

    if (!window.THREE) return null;

    var base;
    try {
      base = montarCenaBase(tamanhoPx, tamanhoPx, true);
      var gem = criarGema(paletaId);
      base.scene.add(gem);

      base.renderer.domElement.style.position = "fixed";
      base.renderer.domElement.style.left = "-9999px";
      base.renderer.domElement.style.top = "0";
      base.renderer.domElement.style.pointerEvents = "none";
      document.body.appendChild(base.renderer.domElement);

      var frames = [];
      for (var i = 0; i < quadros; i++) {
        gem.rotation.set(0.35, (i / quadros) * Math.PI * 2, 0);
        base.renderer.render(base.scene, base.camera);
        var url = base.renderer.domElement.toDataURL("image/png");
        if (!url || url.length < 1000) {
          throw new Error("Quadro " + i + " veio em branco (data URL suspeitosamente curta)");
        }
        frames.push(url);
      }
      _cacheFrames[chave] = frames;
      return frames;
    } catch (e) {
      console.error("[gemas3d] obterFramesGiro falhou:", e);
      return null;
    } finally {
      if (base && base.renderer.domElement.parentNode) {
        document.body.removeChild(base.renderer.domElement);
      }
      if (base) { base.renderer.dispose(); base.renderer.forceContextLoss(); }
    }
  }

  // Cor representativa de cada paleta, pra usar como fallback sólido
  // via CSS (sem imagem, sem canvas, sem toDataURL) quando o Three.js
  // ainda não tiver carregado — nunca mais aparece ícone quebrado.
  var CORES_REPRESENTATIVAS = {
    roxo: '#7a1fb0',
    verde: '#13bd78',
    branco: '#c3d1df',
    vermelho: '#c92838'
  };
  function corRepresentativa(paletaId) {
    return CORES_REPRESENTATIVAS[paletaId] || '#888888';
  }

  function montarFallbackSolido(container, paletaId) {
    container.innerHTML = "";
    var div = document.createElement("div");
    div.style.width = "100%";
    div.style.height = "100%";
    div.style.borderRadius = "50%";
    div.style.background = "radial-gradient(circle at 35% 30%, " + corRepresentativa(paletaId) + "ee, " + corRepresentativa(paletaId) + "55)";
    container.appendChild(div);
  }

  // ── VISUALIZADOR AO VIVO (arrasta com o dedo pra girar) ──────────
  // Esse SIM mantém um contexto WebGL aberto de verdade enquanto está
  // na tela. Cada chamada devolve um "handle" com .parar() — guarda
  // essa referência e chama .parar() antes de remover o elemento da
  // tela, senão o contexto fica rodando escondido pra sempre.
  var _instanciasAtivas = [];

  // Limite de contextos WebGL "ao vivo" (não os quadros pré-gravados
  // acima, que não contam) simultâneos. Alguns WebViews (Spck incluso,
  // aparentemente) só aguentam 1 de verdade — passar disso corrompe/
  // zera os outros. Por segurança, só 1 por vez.
  var LIMITE_VIVO = 1;

  function montarAoVivo(container, paletaId) {
    if (!container) return null;

    if (_instanciasAtivas.length >= LIMITE_VIVO) {
      montarFallbackSolido(container, paletaId);
      return null;
    }

    var largura = container.clientWidth || 160;
    var altura = container.clientHeight || 160;
    var base;
    try {
      base = montarCenaBase(largura, altura, true);
    } catch (e) {
      montarFallbackSolido(container, paletaId);
      return null;
    }
    base.renderer.domElement.style.width = "100%";
    base.renderer.domElement.style.height = "100%";
    base.renderer.domElement.style.touchAction = "none";
    base.renderer.domElement.style.display = "block";
    container.innerHTML = "";
    container.appendChild(base.renderer.domElement);

    var gem = criarGema(paletaId);
    base.scene.add(gem);

    var dragging = false, prevX = 0, prevY = 0, alvoY = 0, alvoX = 0, raf = 0, parado = false;

    function onDown(e) {
      dragging = true;
      prevX = e.clientX; prevY = e.clientY;
      e.stopPropagation();
    }
    function onMove(e) {
      if (!dragging) return;
      var dx = e.clientX - prevX, dy = e.clientY - prevY;
      alvoY += dx * 0.012;
      alvoX = Math.max(-1.2, Math.min(1.2, alvoX + dy * 0.008));
      prevX = e.clientX; prevY = e.clientY;
    }
    function onUp() { dragging = false; }

    base.renderer.domElement.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    function animar() {
      if (parado) return;
      raf = requestAnimationFrame(animar);
      if (!dragging) alvoY += 0.006; // giro lento sozinha quando ninguém mexe
      gem.rotation.y += (alvoY - gem.rotation.y) * 0.15;
      gem.rotation.x += (alvoX - gem.rotation.x) * 0.15;
      base.renderer.render(base.scene, base.camera);
    }
    animar();

    function parar() {
      if (parado) return;
      parado = true;
      cancelAnimationFrame(raf);
      base.renderer.domElement.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      base.renderer.dispose();
      base.renderer.forceContextLoss();
      var idx = _instanciasAtivas.indexOf(handle);
      if (idx !== -1) _instanciasAtivas.splice(idx, 1);
    }

    var handle = { parar: parar };
    _instanciasAtivas.push(handle);
    return handle;
  }

  // Chama antes de re-renderizar uma grade/lista (ex: grid.innerHTML = ...)
  // pra não deixar contexto WebGL órfão rodando escondido.
  function pararTodos() {
    _instanciasAtivas.slice().forEach(function (h) { h.parar(); });
  }

  window.NRGemas3D = {
    PALETAS: Object.keys(PALETAS),
    pronto: pronto,
    obterThumb: obterThumb,
    obterFramesGiro: obterFramesGiro,
    montarAoVivo: montarAoVivo,
    montarFallbackSolido: montarFallbackSolido,
    pararTodos: pararTodos
  };

})();
