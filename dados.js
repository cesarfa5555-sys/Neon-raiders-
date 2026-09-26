// ══════════════════════════════════════════════════════════════════
// DADOS.JS — camada central de acesso aos dados do jogador
// (Firebase Auth + Realtime Database, estrutura usuarios/{uid}/...)
//
// Por que esse arquivo existe: antes, cada página (loja.js, boss.js,
// modos.js, vanguard-core.js) lia/escrevia direto no localStorage e,
// às vezes, direto no Firebase — cada uma com seu próprio jeito. Isso
// gerava dados espalhados e alguns sistemas (Vanguard, conquistas,
// progresso por nível) que nunca chegavam a sincronizar de verdade.
//
// Esse arquivo centraliza tudo: qualquer página chama window.NRDados.*
// e a sincronização com a conta logada acontece igual em todo lugar.
//
// NÃO usa type="module" de propósito (mesma regra do resto do jogo: o
// preview do Spck Editor precisa de tudo em escopo global). Por isso
// o Firebase é carregado com import() dinâmico (funciona dentro de
// função async mesmo em script comum), em vez de "import" estático.
//
// Carregar este script ANTES de qualquer outro que use window.NRDados
// (loja.js, boss.js, modos.js, vanguard-core.js, menu.html).
// ══════════════════════════════════════════════════════════════════

(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyBetMNuPB8BDfvcanmgEUIWw3bLNgbi9aM",
    authDomain: "neon-raiders.firebaseapp.com",
    projectId: "neon-raiders",
    storageBucket: "neon-raiders.firebasestorage.app",
    messagingSenderId: "307351573602",
    appId: "1:307351573602:web:a1ce6488ed420d5b99ad3b",
    databaseURL: "https://neon-raiders-default-rtdb.firebaseio.com"
  };

  let _firebasePromise = null;

  // Carrega o Firebase (app + auth + database) uma única vez, não
  // importa quantas páginas/scripts diferentes chamem isso ao mesmo tempo
  function _getFirebase() {
    if (!_firebasePromise) {
      _firebasePromise = (async () => {
        const { initializeApp, getApps } = await import("https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js");
        const { getAuth, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js");
        const dbMod = await import("https://www.gstatic.com/firebasejs/12.14.0/firebase-database.js");
        const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = dbMod.getDatabase(app);
        return { app, auth, db, dbMod, onAuthStateChanged };
      })();
    }
    return _firebasePromise;
  }

  // Espera o usuário estar autenticado. Como toda página do jogo passa
  // pela trava de login antes de carregar, isso normalmente resolve na
  // hora — mas espera o Firebase confirmar a sessão se ainda não confirmou.
  async function _uid() {
    const { auth, onAuthStateChanged } = await _getFirebase();
    if (auth.currentUser) return auth.currentUser.uid;
    return new Promise((resolve, reject) => {
      const unsub = onAuthStateChanged(auth, (user) => {
        unsub();
        if (user) resolve(user.uid);
        else reject(new Error("NRDados: nenhum usuário logado"));
      });
    });
  }

  // ── DETECÇÃO DE TROCA DE CONTA ───────────────────────────────────
  // BUG CORRIGIDO: várias partes do jogo (menu.html, boss.js) guardam
  // uma cópia do progresso no localStorage pra tela carregar rápido
  // (mapaDesbloqueado, nivelDesbloqueado_mapaN, joiasMochila, etc.).
  // Esse cache nunca era limpo ao trocar de conta no mesmo aparelho —
  // então a conta B "herdava" o progresso salvo pela conta A. Isso
  // resolve limpando esse cache sempre que o UID logado for diferente
  // do último UID que rodou nesse aparelho.
  const CHAVES_PROGRESSO_LOCAL = [
    "mapaDesbloqueado", "naveAtual", "navesCompradas", "moedas",
    "nivelDesbloqueado_mapa1", "nivelDesbloqueado_mapa2", "nivelDesbloqueado_mapa3",
    "nivelDesbloqueado_mapa4", "nivelDesbloqueado_mapa5", "nivelDesbloqueado_mapa6",
    "joiasMochila", "joiasEquipadas",
    "vanguardPartes", "vanguardSkinsCompradas",
    "nr_total_kills", "nr_total_bosses", "nr_total_vitorias", "nr_total_mortes", "nr_total_moedas",
    "nrPerfilCache"
  ];

  function _limparCacheLocalDeOutraConta(uidAtual) {
    try {
      const ultimoUid = localStorage.getItem("nrUltimoUid");
      if (ultimoUid && ultimoUid !== uidAtual) {
        CHAVES_PROGRESSO_LOCAL.forEach(function (chave) { localStorage.removeItem(chave); });
        // O sistema antigo de conquistas (nitro/score) salva por NOME de
        // conta, não por uid — limpa qualquer chave nesse formato também
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && k.indexOf("neonraiders_conquistas_") === 0) localStorage.removeItem(k);
        }
      }
      localStorage.setItem("nrUltimoUid", uidAtual);
    } catch (e) {}
  }

  // ── CACHE EM MEMÓRIA + LOCALSTORAGE ──────────────────────────────
  // O perfil inteiro fica cacheado depois do primeiro carregarPerfil(),
  // e espelhado no localStorage (chave nrPerfilCache) só como fallback
  // pra tela não ficar em branco se abrir offline — o Firebase continua
  // sendo a fonte de verdade sempre que disponível.
  let _perfilCache = null;

  function _salvarCacheLocal() {
    try { localStorage.setItem("nrPerfilCache", JSON.stringify(_perfilCache)); } catch (e) {}
  }

  async function carregarPerfil(forcarRecarregar) {
    if (_perfilCache && !forcarRecarregar) return _perfilCache;
    const { db, dbMod } = await _getFirebase();
    const uid = await _uid();
    _limparCacheLocalDeOutraConta(uid);
    const snap = await dbMod.get(dbMod.ref(db, "usuarios/" + uid));
    _perfilCache = snap.exists() ? snap.val() : null;
    if (_perfilCache) {
      _salvarCacheLocal();
    } else {
      // Conta sem nenhum dado no Firebase (recém-criada ou apagada de
      // propósito) — limpa o cache local de fallback também. Sem isso,
      // perfilLocal() continuaria devolvendo o retrato antigo (salvo
      // antes do dado ser apagado) pro resto do jogo achar que existe.
      try { localStorage.removeItem("nrPerfilCache"); } catch (e) {}
    }
    return _perfilCache;
  }

  // Devolve o último perfil carregado, sem esperar rede — útil pra
  // páginas que precisam de um valor síncrono na primeira renderização
  function perfilLocal() {
    if (_perfilCache) return _perfilCache;
    try { return JSON.parse(localStorage.getItem("nrPerfilCache") || "null"); }
    catch (e) { return null; }
  }

  // Atualiza parcialmente um ramo do perfil (ex: "progresso", "naves")
  // sem sobrescrever o resto — usa update(), não set()
  async function _salvarCampo(ramo, patch) {
    const { db, dbMod } = await _getFirebase();
    const uid = await _uid();
    await dbMod.update(dbMod.ref(db, "usuarios/" + uid + "/" + ramo), patch);
    if (_perfilCache) {
      _perfilCache[ramo] = Object.assign({}, _perfilCache[ramo] || {}, patch);
      _salvarCacheLocal();
    }
  }

  // Desbloqueia uma conquista/missão (grava só se ainda não existir,
  // pra não sobrescrever o timestamp original com um novo)
  async function desbloquearConquista(id) {
    const { db, dbMod } = await _getFirebase();
    const uid = await _uid();
    const caminho = "usuarios/" + uid + "/conquistas/" + id;
    const snap = await dbMod.get(dbMod.ref(db, caminho));
    if (snap.exists()) return false;
    const agora = Date.now();
    await dbMod.set(dbMod.ref(db, caminho), agora);
    if (_perfilCache) {
      _perfilCache.conquistas = _perfilCache.conquistas || {};
      _perfilCache.conquistas[id] = agora;
      _salvarCacheLocal();
    }
    return true;
  }

  // Salva uma compra/equipagem da Vanguard de forma ATÔMICA: moedas
  // (progresso) + peças (vanguard) vão numa única gravação multi-caminho.
  // Ou grava tudo, ou não grava nada — assim nunca dá pra ficar com a peça
  // sem ter pago, nem pagar sem receber a peça. `dados` aceita qualquer
  // combinação de: moedas (número), partesEquipadas (objeto),
  // skinsCompradas (array).
  async function salvarCompraVanguard(dados) {
    const { db, dbMod } = await _getFirebase();
    const uid = await _uid();
    const patch = {};
    if (typeof dados.moedas === "number") patch["progresso/moedas"] = dados.moedas;
    if (dados.partesEquipadas) patch["vanguard/partesEquipadas"] = dados.partesEquipadas;
    if (dados.skinsCompradas) patch["vanguard/skinsCompradas"] = dados.skinsCompradas;
    if (!Object.keys(patch).length) return;
    await dbMod.update(dbMod.ref(db, "usuarios/" + uid), patch);
    if (_perfilCache) {
      if (typeof dados.moedas === "number") {
        _perfilCache.progresso = Object.assign({}, _perfilCache.progresso || {}, { moedas: dados.moedas });
      }
      if (dados.partesEquipadas || dados.skinsCompradas) {
        const v = {};
        if (dados.partesEquipadas) v.partesEquipadas = dados.partesEquipadas;
        if (dados.skinsCompradas) v.skinsCompradas = dados.skinsCompradas;
        _perfilCache.vanguard = Object.assign({}, _perfilCache.vanguard || {}, v);
      }
      _salvarCacheLocal();
    }
  }

  window.NRDados = {
    carregarPerfil: carregarPerfil,
    perfilLocal: perfilLocal,
    salvarProgresso: function (patch) { return _salvarCampo("progresso", patch); },
    salvarNaves: function (patch) { return _salvarCampo("naves", patch); },
    salvarVanguard: function (patch) { return _salvarCampo("vanguard", patch); },
    salvarCompraVanguard: salvarCompraVanguard,
    salvarConfiguracoes: function (patch) { return _salvarCampo("configuracoes", patch); },
    salvarEstatisticas: function (patch) { return _salvarCampo("estatisticas", patch); },
    // Branch usuarios/{uid}/informacoes (nome, email, fotoPerfil etc.),
    // criado desde o cadastro em login.html — usar pra editar nome,
    // NUNCA salvarPerfil (que é outro branch, só cosméticos novos)
    salvarInformacoes: function (patch) { return _salvarCampo("informacoes", patch); },
    // Branch novo do sistema de Perfil/XP/Nível (usuarios/{uid}/perfil).
    // Só guarda avatarId/molduraId/tituloId/recompensasResgatadas —
    // nivel/xp ficam em progresso (já existiam desde o cadastro).
    // Irmão de conquistas/progresso/estatisticas — não sobrescreve nada.
    salvarPerfil: function (patch) { return _salvarCampo("perfil", patch); },
    desbloquearConquista: desbloquearConquista,
    uid: _uid,
    _getFirebase: _getFirebase, // exposto pra páginas que precisam do db/auth crus (ex: ranking)
  };
})();