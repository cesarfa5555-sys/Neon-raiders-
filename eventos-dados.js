// ══════════════════════════════════════════════════════════════════
// EVENTOS-DADOS.JS — camada de acesso aos eventos mensais
// (Firebase Realtime Database, estrutura eventos/{eventoId}/...)
//
// Segue o mesmo padrão do dados.js: nenhuma página lê/escreve direto
// no Firebase, tudo passa por window.NREventos.*
//
// Reaproveita a conexão já aberta pelo dados.js (window.NRDados.
// _getFirebase) em vez de inicializar o Firebase de novo — por isso
// este arquivo PRECISA ser carregado DEPOIS de dados.js.
//
// Estrutura no Realtime Database:
//   eventos/{eventoId}/config       → { titulo, tema, cor, mecanica,
//                                        mapaBase, motor, inicio, fim, ativo }
//   eventos/{eventoId}/placar/{uid} → { nome, wave, kills, tempo, score, timestamp }
//   usuarios/{uid}/eventos/{eventoId} → melhor score pessoal (espelho,
//                                        pra tela de perfil/hub sem
//                                        precisar varrer o placar inteiro)
//
// NÃO usa type="module" (mesma regra do resto do jogo).
// ══════════════════════════════════════════════════════════════════

(function () {
  function _requireNRDados() {
    if (!window.NRDados || !window.NRDados._getFirebase) {
      throw new Error("NREventos: dados.js precisa ser carregado ANTES deste arquivo");
    }
    return window.NRDados;
  }

  // ── LISTAR EVENTOS ────────────────────────────────────────────────
  // Devolve só os eventos com config.ativo=true E dentro da janela de
  // tempo (inicio <= agora <= fim). Eventos fora da janela não aparecem
  // no hub mesmo que ainda estejam marcados como ativos por engano.
  async function carregarEventosAtivos() {
    const { db, dbMod } = await _requireNRDados()._getFirebase();
    const snap = await dbMod.get(dbMod.ref(db, "eventos"));
    if (!snap.exists()) return [];
    const agora = Date.now();
    const todos = snap.val();
    return Object.keys(todos)
      .map(function (id) { return Object.assign({ id: id }, todos[id].config || {}); })
      .filter(function (ev) {
        return ev.ativo && ev.inicio <= agora && agora <= ev.fim;
      })
      .sort(function (a, b) { return a.fim - b.fim; }); // o que encerra primeiro aparece primeiro
  }

  // Config de um único evento (usado na tela do próprio evento, depois
  // que o jogador já clicou nele no hub)
  async function carregarEvento(eventoId) {
    const { db, dbMod } = await _requireNRDados()._getFirebase();
    const snap = await dbMod.get(dbMod.ref(db, "eventos/" + eventoId + "/config"));
    return snap.exists() ? snap.val() : null;
  }

  // ── PLACAR ────────────────────────────────────────────────────────
  // Top N do placar de um evento, ordenado por score (maior primeiro).
  async function carregarPlacar(eventoId, limite) {
    const { db, dbMod } = await _requireNRDados()._getFirebase();
    const q = dbMod.query(
      dbMod.ref(db, "eventos/" + eventoId + "/placar"),
      dbMod.orderByChild("score"),
      dbMod.limitToLast(limite || 50)
    );
    const snap = await dbMod.get(q);
    if (!snap.exists()) return [];
    const lista = [];
    snap.forEach(function (child) {
      lista.push(Object.assign({ uid: child.key }, child.val()));
    });
    return lista.reverse(); // limitToLast devolve em ordem crescente — inverte pra maior score primeiro
  }

  // Melhor score pessoal do jogador logado num evento (lê o espelho em
  // usuarios/{uid}/eventos/{eventoId}, mais barato que ler o placar inteiro)
  async function meuRecorde(eventoId) {
    const nrDados = _requireNRDados();
    const { db, dbMod } = await nrDados._getFirebase();
    const uid = await nrDados.uid();
    const snap = await dbMod.get(dbMod.ref(db, "usuarios/" + uid + "/eventos/" + eventoId));
    return snap.exists() ? snap.val() : null;
  }

  // ── ENVIAR SCORE AO FIM DE UMA PARTIDA DE EVENTO ────────────────────
  // resultado = { wave, kills, tempo, score }
  //
  // Checagem de plausibilidade no cliente (primeira barreira, não a
  // única — as regras do Realtime Database fazem a validação real,
  // já que qualquer checagem só no cliente pode ser burlada por quem
  // editar o JS direto no navegador).
  function _plausivel(r) {
    if (typeof r.wave !== "number" || typeof r.kills !== "number" ||
        typeof r.tempo !== "number" || typeof r.score !== "number") return false;
    if (r.wave < 0 || r.kills < 0 || r.tempo < 0 || r.score < 0) return false;
    if (r.tempo > 21600) return false;           // > 6h numa run só = suspeito
    if (r.kills > r.tempo * 8 + 20) return false; // não dá pra matar mais de ~8/segundo sustentado
    const scoreMaximoEsperado = (r.wave * 1000) + (r.kills * 10) + (r.tempo * 2) + 500; // +500 de folga
    if (r.score > scoreMaximoEsperado) return false;
    return true;
  }

  async function enviarScore(eventoId, resultado, nomeExibicao) {
    if (!_plausivel(resultado)) {
      console.warn("NREventos: score rejeitado no cliente por implausibilidade", resultado);
      return { enviado: false, motivo: "implausivel" };
    }

    const nrDados = _requireNRDados();
    const { db, dbMod } = await nrDados._getFirebase();
    const uid = await nrDados.uid();

    const registro = {
      nome: nomeExibicao || "Piloto",
      wave: resultado.wave,
      kills: resultado.kills,
      tempo: resultado.tempo,
      score: resultado.score,
      timestamp: dbMod.serverTimestamp()
    };

    // Só sobrescreve o placar se for melhor que o recorde já enviado —
    // evita que uma run pior apague um score bom por engano
    const recordeAtual = await meuRecorde(eventoId);
    if (!recordeAtual || resultado.score > recordeAtual.score) {
      await dbMod.set(dbMod.ref(db, "eventos/" + eventoId + "/placar/" + uid), registro);
      await dbMod.set(dbMod.ref(db, "usuarios/" + uid + "/eventos/" + eventoId), registro);
      return { enviado: true, novoRecorde: true };
    }

    return { enviado: true, novoRecorde: false };
  }

  window.NREventos = {
    carregarEventosAtivos: carregarEventosAtivos,
    carregarEvento: carregarEvento,
    carregarPlacar: carregarPlacar,
    meuRecorde: meuRecorde,
    enviarScore: enviarScore
  };
})();