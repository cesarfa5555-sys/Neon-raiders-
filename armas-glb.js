// ══════════════════════════════════════════════════════════════════
// ARMAS-GLB.JS — usa modelos 3D (.glb) de verdade para a KATANA e o RIFLE no lugar das armas de blocos.
// Configuração em heroi-config.js (NR_ARMAS_GLB). Vale para TODOS os personagens (blocos ou .glb).
//
// Como o encaixe funciona: cada arma é girada para apontar para +z (ponta/cano para frente), redimensionada para
// o comprimento desejado e deslocada para que o ponto de empunhadura fique na origem. Depois o jogo a prende
// ao tronco (recuo do rifle e varredura da katana continuam funcionando).
// Se o arquivo não carregar, a arma de blocos é usada (o jogo nunca fica sem arma).
// ══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var T = window.THREE, cache = {};

  // carrega o GLTFLoader/SkeletonUtils do three só quando precisar (e uma única vez)
  function carregarScript(url) { return new Promise(function (ok, erro) { var s = document.createElement('script'); s.src = url; s.onload = ok; s.onerror = function () { erro(new Error('falha ao carregar ' + url)); }; document.head.appendChild(s); }); }
  window.NRCarregarLoader = function () {
    if (window.__nrLoaderP) return window.__nrLoaderP;
    var p = Promise.resolve();
    if (!T.GLTFLoader) p = p.then(function () { return carregarScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js'); });
    if (!T.SkeletonUtils) p = p.then(function () { return carregarScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/utils/SkeletonUtils.js'); });
    return (window.__nrLoaderP = p);
  };
  function cfgGeral() { return window.NR_ARMAS_GLB || { ativo: false, armas: {} }; }
  function cfgDe(tipo) { var c = cfgGeral(); return c.ativo && c.armas && c.armas[tipo] && c.armas[tipo].arquivo ? c.armas[tipo] : null; }

  function precarregar() {
    var c = cfgGeral(); if (!c.ativo) return Promise.resolve();
    return window.NRCarregarLoader().then(function () {
      return Promise.all(Object.keys(c.armas || {}).filter(cfgDe).map(function (tipo) {
        if (cache[tipo] && cache[tipo].promessa) return cache[tipo].promessa;
        var cf = cfgDe(tipo), e = cache[tipo] = { cena: null, promessa: null };
        e.promessa = new Promise(function (res) {
          new T.GLTFLoader().load(cf.arquivo, function (g) { e.cena = g.scene; console.log('[armas-glb] carregada:', cf.arquivo); res(); }, undefined, function (er) { console.warn('[armas-glb] não carregou', cf.arquivo, er); res(); });
        });
        return e.promessa;
      }));
    }).catch(function (e) { console.warn('[armas-glb] desativado:', e.message); });
  }
  function disponivel(tipo) { return !!(cfgDe(tipo) && cache[tipo] && cache[tipo].cena); }

  // caixa PRECISA (por vértices, depois de todas as rotações): modelos importados costumam vir "tortos" e a caixa de cada malha engana
  function caixaPrecisa(obj) {
    obj.updateMatrixWorld(true); var min = new T.Vector3(1e9, 1e9, 1e9), max = new T.Vector3(-1e9, -1e9, -1e9), v = new T.Vector3();
    obj.traverse(function (o) {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return;
      var pos = o.geometry.attributes.position, e = o.matrixWorld.elements;
      for (var i = 0; i < pos.count; i++) {
        var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        v.set(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]);
        if (v.x < min.x) min.x = v.x; if (v.y < min.y) min.y = v.y; if (v.z < min.z) min.z = v.z; if (v.x > max.x) max.x = v.x; if (v.y > max.y) max.y = v.y; if (v.z > max.z) max.z = v.z;
      }
    });
    return { min: min, max: max };
  }

  // devolve { grupo, celula, pos, grips } no mesmo formato de NRModelos.criarArma (arma aponta para +z, origem = empunhadura)
  function criar(tipo) {
    var c = cfgDe(tipo), d = cache[tipo];
    var modelo = (T.SkeletonUtils && T.SkeletonUtils.clone) ? T.SkeletonUtils.clone(d.cena) : d.cena.clone(true);
    var interno = new T.Group(); interno.add(modelo);
    if (c.ponta) {
      // alinha pelos eixos do MODELO: "ponta" = para onde aponta a ponta/cano; "cima" = lado que deve ficar para cima (lombo da espada / alto da arma)
      var z = new T.Vector3(c.ponta.x, c.ponta.y, c.ponta.z).normalize(), up = c.cima ? new T.Vector3(c.cima.x, c.cima.y, c.cima.z) : new T.Vector3(0, 1, 0);
      up.sub(z.clone().multiplyScalar(up.dot(z))).normalize();
      var x = new T.Vector3().crossVectors(up, z), mB = new T.Matrix4().makeBasis(x, up, z);
      interno.quaternion.setFromRotationMatrix(mB).invert();               // leva o modelo para o referencial da arma (ponta em +z, cima em +y)
    } else { var g = c.giro || {}; interno.rotation.set(g.x || 0, g.y || 0, g.z || 0); }
    var caixa = caixaPrecisa(interno), tam = new T.Vector3(caixa.max.x - caixa.min.x, caixa.max.y - caixa.min.y, caixa.max.z - caixa.min.z);
    var s = tam.z > 1e-6 ? (c.comprimento || 1.5) / tam.z : 1;
    // ponto que fica na origem: centro da caixa (rifle) ou ponto de empunhadura a X% do comprimento a partir da base (katana)
    var cx = (caixa.min.x + caixa.max.x) / 2, cy = (caixa.min.y + caixa.max.y) / 2;
    var cz = c.empunhadura !== undefined ? caixa.min.z + c.empunhadura * tam.z : (caixa.min.z + caixa.max.z) / 2;
    interno.scale.setScalar(s); interno.position.set(-cx * s, -cy * s, -cz * s);
    // materiais PBR ficam escuros sem mapa de ambiente: suaviza o metal e mantém o brilho (emissivo) das peças neon
    modelo.traverse(function (o) {
      if (!o.isMesh) return; o.frustumCulled = false;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) {
        if (!m) return;
        if ('metalness' in m) m.metalness = Math.min(m.metalness, 0.45);
        if ('roughness' in m) m.roughness = Math.max(m.roughness, 0.4);
        if (m.emissiveMap) m.emissiveIntensity = Math.max(m.emissiveIntensity || 1, 1.6);
      });
    });
    var grupo = new T.Group(); grupo.add(interno); grupo.rotation.order = 'YXZ';
    return { grupo: grupo, celula: null, pos: c.pos || { x: 0.1, y: 0.34, z: 0.7 }, grips: c.maos || null };      // maos = onde as mãos seguram (no espaço da arma)
  }

  window.NRArmasGLB = { precarregar: precarregar, disponivel: disponivel, criar: criar };
})();
