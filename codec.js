// ══════════════════════════════════════════════════════════════════
// CODEC.JS — transforma o estado do jogo em bytes (servidor) e de volta
// em objetos (celular). Roda nos dois lados, igual ao sim.js.
//
// Por que binário: uma partida com 200 inimigos em JSON passaria de
// 20 KB por pacote. Em binário fica ~2 KB, então dá para mandar 15
// pacotes por segundo até no 4G sem travar.
//
// O objeto decodificado tem o MESMO formato do estado do sim.js
// (jogadores, inimigos, projeteis, gemas...), então o desenhista (3D)
// não precisa saber se o jogo é solo ou online.
// ══════════════════════════════════════════════════════════════════
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./data.js'));
  else root.NRCodec = factory(root.NRData);
})(typeof self !== 'undefined' ? self : this, function (D) {
  'use strict';

  const ESC = 256;                                   // posição = inteiro de 16 bits / 256 (alcance ±127)
  const q = function (v) { return Math.max(-32767, Math.min(32767, Math.round(v * ESC))); };
  const u8 = function (v, max) { return Math.max(0, Math.min(255, Math.round(v / max * 255))); };

  let bufGrande = new ArrayBuffer(1 << 16);

  // ── SERVIDOR: estado → bytes ─────────────────────────────────────
  // S = estado do sim; eventos = lista de eventos desde o último pacote
  function codificar(S, eventos) {
    let dv = new DataView(bufGrande), o = 0;
    function garantir(n) {
      if (o + n > bufGrande.byteLength) {
        const nb = new ArrayBuffer(bufGrande.byteLength * 2);
        new Uint8Array(nb).set(new Uint8Array(bufGrande, 0, o));
        bufGrande = nb; dv = new DataView(bufGrande);
      }
    }
    const w8 = function (v) { garantir(1); dv.setUint8(o, v); o += 1; };
    const w16 = function (v) { garantir(2); dv.setUint16(o, v, true); o += 2; };
    const wi16 = function (v) { garantir(2); dv.setInt16(o, v, true); o += 2; };
    const wf = function (v) { garantir(4); dv.setFloat32(o, v, true); o += 4; };

    w8(1);                                           // versão do protocolo
    wf(S.t); w16(S.onda); wf(S.ondaT); w8(S.fim ? 1 : 0); wf(S.abatesTotal); w8(S.fase === 'loja' ? 1 : 0); wf(S.lojaT);
    // jogadores
    w8(S.jogadores.length);
    for (let i = 0; i < S.jogadores.length; i++) {
      const p = S.jogadores[i];
      w8(p.slot); wf(p.x); wf(p.z);
      wi16(Math.round(p.fx * 120)); wi16(Math.round(p.fz * 120));
      w16(Math.round(p.hp)); w16(p.hpMax);
      w8((p.vivo ? 1 : 0) | (p.fora ? 2 : 0) | (p.dashT > 0 ? 4 : 0) | (p.cartas ? 8 : 0) | (p.invul > 0 ? 16 : 0) | (p.sofreu > 0 ? 32 : 0) | (p.lojaPronto ? 64 : 0));
      w16(p.nivel); w16(Math.round(p.xp / p.xpProx * 65535));
      wf(p.droneAng); w8(u8(p.reviveProg, 1)); w8(u8(Math.max(0, p.dashCd), 6));
      wf(p.vel); wf(p.moedaAcum); wf(p.abates); wf(p.dashRecarga); wf(p.sucata);
      for (let k = 0; k < D.ORDEM_HAB.length; k++) w8(p.hab[D.ORDEM_HAB[k]] || 0);
      for (let k = 0; k < D.ORDEM_PAS.length; k++) w8(p.pas[D.ORDEM_PAS[k]] || 0);
    }
    // inimigos
    w16(S.inimigos.length);
    for (let i = 0; i < S.inimigos.length; i++) {
      const e = S.inimigos[i];
      w16(e.id & 0xffff); w8(e.t | (e.chefe ? 128 : 0)); wi16(q(e.x)); wi16(q(e.z));
      w8(u8(e.hp, e.hpMax)); w8((e.elite ? 1 : 0) | (e.flash > 0 ? 2 : 0) | (e.lento > 0 ? 4 : 0) | (e.prep > 0 ? 8 : 0) | (e.carga > 0 ? 16 : 0));
    }
    // projéteis
    w16(S.projeteis.length);
    for (let i = 0; i < S.projeteis.length; i++) {
      const b = S.projeteis[i];
      w16(b.id & 0xffff); w8(b.kind); wi16(q(b.x)); wi16(q(b.z));
      garantir(2); dv.setInt8(o, Math.max(-127, Math.min(127, Math.round(b.vx * 5)))); dv.setInt8(o + 1, Math.max(-127, Math.min(127, Math.round(b.vz * 5)))); o += 2;
    }
    // gemas
    w16(S.gemas.length);
    for (let i = 0; i < S.gemas.length; i++) { const g = S.gemas[i]; wi16(q(g.x)); wi16(q(g.z)); w8(g.tipo | (g.puxada ? 128 : 0)); }
    // itens
    w8(Math.min(255, S.itens.length));
    for (let i = 0; i < Math.min(255, S.itens.length); i++) { const it = S.itens[i]; wi16(q(it.x)); wi16(q(it.z)); w8(it.kind); }
    // zonas (avisos no chão, chamas)
    w8(Math.min(255, S.zonas.length));
    for (let i = 0; i < Math.min(255, S.zonas.length); i++) {
      const z = S.zonas[i];
      w8(z.tipo === 'chama' ? 1 : z.tipo === 'orbital' ? 2 : 3); wi16(q(z.x)); wi16(q(z.z)); w8(u8(z.r, 12)); w8(u8(Math.min(z.t, 5), 5));
    }
    // granadas em voo
    w8(Math.min(255, S.granadas.length));
    for (let i = 0; i < Math.min(255, S.granadas.length); i++) {
      const g = S.granadas[i];
      wi16(q(g.x0)); wi16(q(g.z0)); wi16(q(g.x1)); wi16(q(g.z1)); w8(u8(g.t / g.dur, 1));
    }
    // eventos
    w16(eventos.length);
    for (let i = 0; i < eventos.length; i++) {
      const e = eventos[i];
      w8(e.length); for (let k = 0; k < e.length; k++) wf(+e[k] || 0);
    }
    return new Uint8Array(bufGrande.slice(0, o));
  }

  // ── CELULAR: bytes → estado ─────────────────────────────────────
  function decodificar(bytes) {
    const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
    let o = 0;
    const r8 = function () { return dv.getUint8(o++); };
    const r16 = function () { const v = dv.getUint16(o, true); o += 2; return v; };
    const ri16 = function () { const v = dv.getInt16(o, true); o += 2; return v; };
    const rf = function () { const v = dv.getFloat32(o, true); o += 4; return v; };

    const ver = r8(); if (ver !== 1) return null;
    const V = { t: rf(), onda: r16(), ondaT: rf(), fim: !!r8(), abatesTotal: rf(), fase: r8() ? 'loja' : 'luta', lojaT: rf(), jogadores: [], inimigos: [], projeteis: [], gemas: [], itens: [], zonas: [], granadas: [], eventos: [], chefe: null };
    const np = r8();
    for (let i = 0; i < np; i++) {
      const p = { slot: r8(), x: rf(), z: rf(), fx: ri16() / 120, fz: ri16() / 120, hp: r16(), hpMax: r16() };
      const f = r8(); p.vivo = !!(f & 1); p.fora = !!(f & 2); p.dashT = (f & 4) ? 1 : 0; p.cartas = (f & 8) ? true : null; p.invul = (f & 16) ? 1 : 0; p.sofreu = (f & 32) ? 1 : 0; p.lojaPronto = !!(f & 64);
      p.nivel = r16(); p.xp = r16() / 65535; p.xpProx = 1; p.droneAng = rf(); p.reviveProg = r8() / 255; p.dashCd = r8() / 255 * 6;
      p.vel = rf(); p.moedaAcum = rf(); p.abates = rf(); p.dashRecarga = rf(); p.sucata = rf();
      p.hab = {}; p.pas = {};
      for (let k = 0; k < D.ORDEM_HAB.length; k++) { const l = r8(); if (l) p.hab[D.ORDEM_HAB[k]] = l; }
      for (let k = 0; k < D.ORDEM_PAS.length; k++) { const l = r8(); if (l) p.pas[D.ORDEM_PAS[k]] = l; }
      V.jogadores.push(p);
    }
    const ne = r16();
    for (let i = 0; i < ne; i++) {
      const id = r16(), tt = r8(), x = ri16() / ESC, z = ri16() / ESC, hp = r8() / 255, f = r8();
      const e = { id: id, t: tt & 127, chefe: !!(tt & 128), x: x, z: z, hp: hp, hpMax: 1, elite: !!(f & 1), flash: (f & 2) ? 1 : 0, lento: (f & 4) ? 1 : 0, prep: (f & 8) ? 1 : 0, carga: (f & 16) ? 1 : 0 };
      V.inimigos.push(e); if (e.chefe) V.chefe = e;
    }
    const nb = r16();
    for (let i = 0; i < nb; i++) {
      const b = { id: r16(), kind: r8(), x: ri16() / ESC, z: ri16() / ESC };
      b.vx = dv.getInt8(o) / 5; b.vz = dv.getInt8(o + 1) / 5; o += 2;
      V.projeteis.push(b);
    }
    const ng = r16();
    for (let i = 0; i < ng; i++) { const x = ri16() / ESC, z = ri16() / ESC, f = r8(); V.gemas.push({ x: x, z: z, tipo: f & 3, puxada: !!(f & 128) }); }
    const ni = r8();
    for (let i = 0; i < ni; i++) V.itens.push({ x: ri16() / ESC, z: ri16() / ESC, kind: r8() });
    const nz = r8();
    for (let i = 0; i < nz; i++) {
      const k = r8(), x = ri16() / ESC, z = ri16() / ESC, rr = r8() / 255 * 12, t = r8() / 255 * 5;
      V.zonas.push({ tipo: k === 1 ? 'chama' : k === 2 ? 'orbital' : 'chefe', x: x, z: z, r: rr, t: t });
    }
    const ngr = r8();
    for (let i = 0; i < ngr; i++) V.granadas.push({ x0: ri16() / ESC, z0: ri16() / ESC, x1: ri16() / ESC, z1: ri16() / ESC, t: r8() / 255, dur: 1 });
    const nev = r16();
    for (let i = 0; i < nev; i++) { const n = r8(), e = []; for (let k = 0; k < n; k++) e.push(rf()); V.eventos.push(e); }
    return V;
  }

  return { codificar: codificar, decodificar: decodificar };
});
