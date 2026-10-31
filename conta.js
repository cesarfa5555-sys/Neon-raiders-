// ══════════════════════════════════════════════════════════════════
// CONTA.JS — tudo que o jogo guarda na conta do jogador (Firebase):
//   • o que ele comprou (Caçador Cyber, Rifle Plasma, melhorias)
//   • moedas, XP e recorde
//   • recompensa de uma partida SOLO (no online, quem paga é o servidor)
//
// Estrutura no banco:  usuarios/{uid}/survivor = { cacador, rifle, up:{vida,dano,...}, recorde:{...} }
//                      usuarios/{uid}/progresso = { moedas, xp, nivel }   (já existia)
//
// Carregar depois de dados.js e data.js (e level.js/xp.js se quiser XP de conta).
// ══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var D = window.NRData;

  async function perfil(forcar) { return window.NRDados.carregarPerfil(!!forcar); }

  // Devolve o que o jogador possui (sempre saneado: números dentro dos limites)
  async function loadout(forcar) {
    var p = await perfil(forcar);
    return D.sanearLoadout(p && p.survivor);
  }
  async function moedas(forcar) {
    var p = await perfil(forcar);
    return Number(p && p.progresso && p.progresso.moedas) || 0;
  }
  async function nome() {
    var p = await perfil();
    var n = (p && p.informacoes && p.informacoes.nome) || localStorage.getItem('jogadorNome') || 'Raider';
    return String(n).slice(0, 16);
  }

  // COMPRA de persona/arma — ATÔMICA: debita as moedas e libera o item na mesma gravação
  async function comprar(id) {
    var item = D.LOJA[id];
    if (!item || !item.preco && item.preco !== 0) return { ok: false, erro: 'Item inválido.' };
    var lo = await loadout(true), saldo = await moedas(true);
    if (lo[id]) return { ok: false, erro: 'Você já possui este item.' };
    if (saldo < item.preco) return { ok: false, erro: 'Moedas insuficientes.' };
    var patch = { 'progresso/moedas': saldo - item.preco }; patch['survivor/' + id] = true;
    await window.NRDados.atualizarUsuario(patch);
    return { ok: true, saldo: saldo - item.preco };
  }

  // EQUIPAR (só o que já foi comprado): slot 'eqP' = personagem, 'eqA' = arma
  async function equipar(slot, id) {
    var lo = await loadout(true);
    if (!lo[id]) return { ok: false, erro: 'Compre este item primeiro.' };
    var patch = {}; patch['survivor/' + (slot === 'arma' ? 'eqA' : 'eqP')] = id;
    await window.NRDados.atualizarUsuario(patch);
    return { ok: true };
  }

  // MELHORIA permanente (vida, dano, velocidade...) — também atômica
  async function melhorar(id) {
    var def = D.LOJA.up[id]; if (!def) return { ok: false, erro: 'Melhoria inválida.' };
    var lo = await loadout(true), saldo = await moedas(true), nv = lo.up[id];
    if (nv >= def.max) return { ok: false, erro: 'Nível máximo.' };
    var preco = D.precoMelhoria(id, nv);
    if (saldo < preco) return { ok: false, erro: 'Moedas insuficientes.' };
    var patch = { 'progresso/moedas': saldo - preco }; patch['survivor/up/' + id] = nv + 1;
    await window.NRDados.atualizarUsuario(patch);
    return { ok: true, saldo: saldo - preco, nivel: nv + 1, preco: preco };
  }

  // Recompensa de uma partida SOLO. `r` vem de sim.recompensa(): { moedas, xpConta, pontos }
  // `res` = resultado da partida ({ onda, tempo, abates, chefes }).
  async function pagarPartida(r, res) {
    var p = await perfil(true), saldo = Number(p && p.progresso && p.progresso.moedas) || 0;
    var est = (p && p.estatisticas) || {}, rec = (p && p.survivor && p.survivor.recorde) || {};
    var nomeJ = await nome();
    var patch = {
      'progresso/moedas': saldo + r.moedas,
      'estatisticas/totalMoedasGanhas': (Number(est.totalMoedasGanhas) || 0) + r.moedas,
      'estatisticas/totalKills': (Number(est.totalKills) || 0) + res.abates,
      'estatisticas/totalBosses': (Number(est.totalBosses) || 0) + res.chefes,
      'estatisticas/tempoJogado': (Number(est.tempoJogado) || 0) + res.tempo,
      'estatisticas/partidas': (Number(est.partidas) || 0) + 1,
      'survivor/recorde/onda': Math.max(Number(rec.onda) || 0, res.onda),
      'survivor/recorde/abates': Math.max(Number(rec.abates) || 0, res.abates),
      'survivor/recorde/tempo': Math.max(Number(rec.tempo) || 0, res.tempo),
      'survivor/recorde/pontos': Math.max(Number(rec.pontos) || 0, r.pontos),
    };
    await window.NRDados.atualizarUsuario(patch);
    // XP da conta (nível do perfil): usa o sistema que já existia (xp.js dispara os avisos de level-up)
    var subiu = false;
    if (window.NRXP && r.xpConta > 0) {
      try { var x = await window.NRXP.ganharXP(r.xpConta); subiu = !!(x && x.subiuDeNivel); } catch (e) { /* sem XP não quebra o resto */ }
    }
    // ranking global: só grava se bateu o recorde pessoal
    try {
      var fb = await window.NRDados._getFirebase(), uid = await window.NRDados.uid();
      var ref = fb.dbMod.ref(fb.db, 'ranking/' + uid), atual = (await fb.dbMod.get(ref)).val();
      if (!atual || (atual.score || 0) < r.pontos) {
        var perf2 = await perfil();
        await fb.dbMod.set(ref, { name: nomeJ, score: r.pontos, level: Number(perf2 && perf2.progresso && perf2.progresso.nivel) || 1, onda: res.onda, at: Date.now() });
        return { novoRecorde: true, subiuNivel: subiu };
      }
    } catch (e) { console.warn('ranking:', e); }
    return { novoRecorde: false, subiuNivel: subiu };
  }

  // TOP N do ranking global (público).
  // Se o Firebase ainda não tiver o índice ".indexOn": ["score"] nas regras, o jogo busca tudo e ordena aqui mesmo
  // (funciona igual; só fica mais lento quando o ranking tiver milhares de jogadores).
  async function ranking(n) {
    var fb = await window.NRDados._getFirebase(), ref = fb.dbMod.ref(fb.db, 'ranking'), lista = [];
    try {
      var snap = await fb.dbMod.get(fb.dbMod.query(ref, fb.dbMod.orderByChild('score'), fb.dbMod.limitToLast(n || 10)));
      snap.forEach(function (c) { lista.push(c.val()); });
    } catch (e) {
      var todos = await fb.dbMod.get(ref); lista = [];
      todos.forEach(function (c) { lista.push(c.val()); });
    }
    return lista.filter(Boolean).sort(function (a, b) { return (b.score || 0) - (a.score || 0); }).slice(0, n || 10);
  }

  // token do Firebase para entrar nas salas online (o servidor confere quem você é)
  async function token() { var f = await window.NRDados._getFirebase(); await window.NRDados.uid(); return f.auth.currentUser.getIdToken(); }

  window.NRConta = { token: token, perfil: perfil, loadout: loadout, moedas: moedas, nome: nome, comprar: comprar, equipar: equipar, melhorar: melhorar, pagarPartida: pagarPartida, ranking: ranking };
})();
