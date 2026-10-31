// ══════════════════════════════════════════════════════════════════
// TIRO-SINTETIZADO.JS — som de tiro sintetizado camada por camada (estalo, corpo, grave, cauda, mecânica e cartucho no chão).
// Vem do arquivo tiros.html ("GunSynth"). Aqui usa o MESMO AudioContext e o volume de efeitos do audio.js (NRAudio).
//   NRGunSynth.criar(ctx, destino)  → instância   ·   inst.fire('rifle', { rapid: true, intensity: 1, leve: false })
// Armas: pistol9, pistol45, rifle (a do jogo), sniper. Cadência do rifle no arquivo original: 650 RPM (W.rifle.rpm).
// ══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
class GunSynth {
  constructor({ volume = 0.8, brightness = 0.45, ctx = null, destino = null } = {}) {
    const AC = window.AudioContext || window.webkitAudioContext;
    const c = this.ctx = ctx || new AC({ latencyHint: 'interactive' });
    this.brightness = brightness;
    this.env = 'open';

    // master: saturação leve -> limiter -> volume
    this.input = c.createGain();
    this.limiter = c.createDynamicsCompressor();
    this.limiter.threshold.value = -9; this.limiter.knee.value = 8;
    this.limiter.ratio.value = 10; this.limiter.attack.value = 0.001; this.limiter.release.value = 0.18;
    this.master = c.createGain(); this.master.gain.value = volume;
    this.input.connect(this.limiter).connect(this.master).connect(destino || c.destination);

    // reverb + eco (slapback)
    this.conv = c.createConvolver();
    this.conv.connect(this.input);
    this.delay = c.createDelay(1.5);
    const dlp = c.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2400;
    const fb = c.createGain(); fb.gain.value = 0.28;
    const eo = c.createGain(); eo.gain.value = 0.9;
    this.echoIn = c.createGain();
    this.echoIn.connect(this.delay); this.delay.connect(dlp); dlp.connect(fb); fb.connect(this.delay);
    dlp.connect(eo); eo.connect(this.input);

    // curva de saturação (dá "soco" sem chiar)
    const n = 2048, cv = new Float32Array(n), k = 1.8;
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; cv[i] = Math.tanh(k * x) / Math.tanh(k); }
    this.curve = cv;

    this.white = this._makeNoise(3, false);
    this.pink = this._makeNoise(3, true);
    this.IR = {};
    this.IR.open = this._makeIR(this.ENV.open.ir, this.ENV.open.dark);      // só o ambiente "Campo" é gerado (os outros nascem sob demanda: setEnv)
    this.setEnv('open');
  }

  resume() { return this.ctx.state === 'suspended' ? this.ctx.resume() : Promise.resolve(); }
  setVolume(v) { this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02); }
  setBrightness(b) { this.brightness = b; }
  setEnv(name) {
    this.env = name;
    if (!this.IR[name]) this.IR[name] = this._makeIR(this.ENV[name].ir, this.ENV[name].dark);
    this.conv.buffer = this.IR[name];
    this.delay.delayTime.setTargetAtTime(this.ENV[name].delay, this.ctx.currentTime, 0.05);
  }
  setListener(pos, fwd = [0, 0, -1], up = [0, 1, 0]) {
    const L = this.ctx.listener;
    if (L.positionX) {
      L.positionX.value = pos[0]; L.positionY.value = pos[1]; L.positionZ.value = pos[2];
      L.forwardX.value = fwd[0]; L.forwardY.value = fwd[1]; L.forwardZ.value = fwd[2];
      L.upX.value = up[0]; L.upY.value = up[1]; L.upZ.value = up[2];
    } else { L.setPosition(...pos); L.setOrientation(...fwd, ...up); }
  }

  /** Dispara. opts: { intensity, rapid, leve, distance (m), x (m, + = direita), atraso (s) } */
  fire(name = 'pistol9', o = {}) {
    const c = this.ctx; if (c.state === 'suspended') c.resume();
    const W = this.W[name] || this.W.pistol9, E = this.ENV[this.env];
    const r = (a, b) => a + Math.random() * (b - a);
    const t = c.currentTime + 0.012 + (o.atraso || 0);      // folga de 12 ms (+ atraso opcional) para o navegador agendar sem "estalo" quando a tela está ocupada
    const I = (o.intensity ?? 1) * r(0.92, 1.06);
    const p = r(0.95, 1.05);
    const rapid = !!o.rapid, leve = !!o.leve;       // leve = tiro de aliado: sem clique de mecânica nem cartucho (economiza nós de áudio)
    const dist = o.distance || 0;

    // ── LIMITE DE VOZES: metralhar sem parar não pode empilhar áudio (isso fazia o som estourar e depois calar) ──
    const agora = c.currentTime;
    this.vivos = (this.vivos || []).filter(e => e > agora);
    if (this.vivos.length >= 14) return;             // saturado: pula este tiro
    const cheio = this.vivos.length >= 8;            // muitas vozes: só estalo + corpo + soco + grave
    this.vivos.push(agora + 0.45);

    // bus do tiro: soma -> saturação -> filtro de brilho (-> filtro de distância / pan 3D, só quando o tiro tem posição)
    //   Sem posição (o caso do jogo) a cadeia é CRIADA UMA VEZ e reaproveitada: antes cada tiro criava a sua e a mantinha 5 s no ar.
    const espacial = !!(o.position || dist > 0 || o.x);
    let bus, limpa = null;
    if (!espacial) {
      bus = this._cadeia(name, W, E, rapid); this._out = bus;
    } else {
      // TIRO À DISTÂNCIA (o "Distância (m)" do tiros.html), versão leve: usa a mesma cadeia compartilhada e só cria 3 nós por tiro.
      //   volume = 1/distância (mesma curva do PannerNode "inverse": 4 m de referência, rolloff 0.9) · agudos somem com a distância · pan esquerda/direita por o.x
      const atenua = Math.max(0.04, 4 / (4 + 0.9 * (Math.max(dist, 4) - 4)));
      if (atenua * I < 0.02) return;                               // longe demais para ouvir: nem cria nós
      const pre = c.createGain(); pre.gain.value = atenua;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.5;
      lp.frequency.value = Math.max(1200, Math.min(18000, 18000 / (1 + dist / 22)));
      pre.connect(lp);
      let ult = lp, st = null;
      if (c.createStereoPanner) { st = c.createStereoPanner(); st.pan.value = Math.max(-0.85, Math.min(0.85, (o.x || 0) / 25)); lp.connect(st); ult = st; }
      ult.connect(this._cadeia(name, W, E, rapid));
      this._out = pre; bus = pre; limpa = [pre, lp, st];
    }

    // 1) estalo — o "crack" (suavizado para não cansar o ouvido)
    this._noise(t, { buf: 'white', type: 'bandpass', f: W.crack.f * p * r(0.92, 1.08), q: W.crack.q, atk: 0.0005, dec: W.crack.dec, gain: W.crack.gain * I });
    if (W.snap && !cheio) this._noise(t, { buf: 'white', type: 'bandpass', f: 4800 * p, q: 0.5, atk: 0.0004, dec: 0.009, gain: W.snap * I });
    // 2) corpo — massa do disparo
    this._noise(t, { buf: 'pink', type: 'lowpass', f: W.body.f * p, q: 0.7, atk: 0.001, dec: W.body.dec, gain: W.body.gain * I });
    if (!cheio) this._noise(t, { buf: 'pink', type: 'bandpass', f: W.mid.f * p, q: W.mid.q, atk: 0.002, dec: W.mid.dec, gain: W.mid.gain * I });
    // 3) soco + grave
    this._tone(t, { f: W.thump.f * p, f2: W.thump.f2 * p, dec: W.thump.dec, gain: W.thump.gain * I });
    this._tone(t, { f: W.boom.f * p, f2: W.boom.f2 * p, dec: W.boom.dec, gain: W.boom.gain * I, atk: 0.006 });
    // 4) cauda — o "ar" do disparo
    if (!cheio) this._noise(t + 0.01, { buf: 'pink', type: 'lowpass', f: W.tail.f, f2: W.tail.f2, q: 0.5, atk: 0.01, dec: W.tail.dec * (rapid ? 0.55 : 1), gain: W.tail.gain * I * (rapid ? 0.6 : 1) });

    // 5) mecânica + cartucho caindo
    if (leve || cheio) { /* sem mecânica */ } else if (W.mech === 'slide') {
      this._click(t + 0.045, 2300, 0.10, 0.018); this._click(t + 0.095, 1500, 0.08, 0.02);
    } else if (W.mech === 'bolt') {
      this._click(t + 0.03, 2100, 0.07, 0.015);
    } else if (W.mech === 'sniper') {
      const b = t + 0.62;
      this._click(b, 1900, 0.16, 0.02); this._tone(b + 0.1, { f: 210, f2: 120, dec: 0.06, gain: 0.12 });
      this._click(b + 0.11, 2500, 0.14, 0.02); this._click(b + 0.27, 2000, 0.13, 0.02); this._click(b + 0.37, 1500, 0.12, 0.025);
    }
    if (!leve && !cheio && (!rapid || Math.random() < 0.12)) {
      const ct = t + r(0.22, 0.5), cf = r(0.9, 1.15);
      this._modal(ct, [4300, 5900, 7600], 0.045 * (E.rev > 0.6 ? 1 : 0.8), cf, 0.11);
      this._modal(ct + r(0.07, 0.12), [4300, 5900, 7600], 0.022, cf * 1.04, 0.08);
    }
    if (limpa) setTimeout(() => { try { limpa.forEach(n => n && n.disconnect()); } catch (e) {} }, 2500);
  }

  /** Cadeia permanente (soma → saturação → brilho → saída/reverb/eco), uma por arma/modo. */
  _cadeia(name, W, E, rapid) {
    this._ch = this._ch || {};
    const k = name + (rapid ? 'r' : 'n'); if (this._ch[k]) return this._ch[k];
    const c = this.ctx, bus = c.createGain(); bus.gain.value = 0.6;
    const sat = c.createWaveShaper(); sat.curve = this.curve; sat.oversample = '2x';
    const tone = c.createBiquadFilter(); tone.type = 'lowpass'; tone.Q.value = 0.5; tone.frequency.value = Math.max(1500, Math.min(3500 + this.brightness * 11000, 18000));
    const rs = c.createGain(); rs.gain.value = E.rev * W.rev * (rapid ? 0.6 : 1);
    const es = c.createGain(); es.gain.value = E.echo * (rapid ? 0.7 : 1) * 0.5;
    bus.connect(sat); sat.connect(tone); tone.connect(this.input); tone.connect(rs); rs.connect(this.conv); tone.connect(es); es.connect(this.echoIn);
    return (this._ch[k] = bus);
  }

  /** Clique de pente vazio */
  dryFire() {
    const t = this.ctx.currentTime + 0.003;
    const b = this.ctx.createGain(); b.gain.value = 0.7; b.connect(this.input); this._out = b;
    this._click(t, 2000, 0.28, 0.014); this._tone(t, { f: 900, f2: 500, dec: 0.025, gain: 0.08 });
    setTimeout(() => b.disconnect(), 600);
  }

  /** Recarga (retorna duração em segundos) */
  reload() {
    const c = this.ctx, t = c.currentTime + 0.02;
    const b = c.createGain(); b.gain.value = 0.75; b.connect(this.input);
    const rs = c.createGain(); rs.gain.value = this.ENV[this.env].rev * 0.35; b.connect(rs); rs.connect(this.conv);
    this._out = b;
    this._click(t, 2200, 0.24, 0.02); this._tone(t, { f: 160, f2: 90, dec: 0.05, gain: 0.18 });
    this._noise(t + 0.18, { buf: 'pink', type: 'bandpass', f: 1200, f2: 600, q: 1, atk: 0.01, dec: 0.14, gain: 0.12 });
    const m = t + 0.95;
    this._tone(m, { f: 230, f2: 130, dec: 0.07, gain: 0.34 }); this._click(m, 2800, 0.28, 0.02); this._click(m + 0.035, 1600, 0.2, 0.02);
    const h = t + 1.45;
    this._noise(h, { buf: 'pink', type: 'bandpass', f: 2000, f2: 1000, q: 1, atk: 0.006, dec: 0.08, gain: 0.15 });
    this._click(h + 0.03, 2000, 0.3, 0.02); this._click(h + 0.12, 1500, 0.3, 0.025);
    setTimeout(() => { try { b.disconnect(); rs.disconnect(); } catch (e) {} }, 3000);
    return 1.7;
  }

  /* ---------- blocos ---------- */
  _noise(t, o) {
    const c = this.ctx, s = c.createBufferSource(), buf = o.buf === 'pink' ? this.pink : this.white;
    s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.f, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + o.atk + o.dec);
    f.Q.value = o.q ?? 0.7;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.gain, t + o.atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.atk + o.dec);
    s.connect(f).connect(g).connect(this._out);
    s.start(t, Math.random() * (buf.duration - 1.5), o.atk + o.dec + 0.05);
  }
  _tone(t, o) {
    const c = this.ctx, osc = c.createOscillator(); osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + o.dec);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.gain, t + (o.atk || 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dec);
    osc.connect(g).connect(this._out); osc.start(t); osc.stop(t + o.dec + 0.05);
  }
  _click(t, f, gain, dec, q = 3) {
    this._noise(t, { buf: 'white', type: 'bandpass', f, q, atk: 0.0005, dec, gain });
  }
  _modal(t, freqs, gain, mul, dec) {
    freqs.forEach((f, i) => this._tone(t, { f: f * mul * (1 + (Math.random() - 0.5) * 0.03), dec: dec * (1 - i * 0.18), gain: gain / (1 + i * 0.6), atk: 0.001 }));
  }
  _makeNoise(sec, pink) {
    const c = this.ctx, n = c.sampleRate * sec, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, pk = 0;
    for (let k = 0; k < n; k++) {
      const w = Math.random() * 2 - 1; let v = w;
      if (pink) {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        v = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926;
      }
      d[k] = v; if (Math.abs(v) > pk) pk = Math.abs(v);
    }
    for (let k = 0; k < n; k++) d[k] /= pk;
    return b;
  }
  _makeIR(sec, dark = 0.3) {
    const c = this.ctx, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch); let lp = 0;
      for (let k = 0; k < n; k++) {
        const tt = k / n, w = Math.random() * 2 - 1;
        lp += (w - lp) * (0.5 - (0.5 - dark * 0.1) * Math.min(1, tt * 1.4));
        d[k] = lp * Math.pow(1 - tt, 2.4) * (k < 400 ? k / 400 : 1);
      }
    }
    return b;
  }
}

/* ---------- ambientes ---------- */
GunSynth.prototype.ENV = {
  open:   { name: 'Campo',   ir: 0.6, dark: 0.3, rev: 0.30, echo: 0.28, delay: 0.24 },
  room:   { name: 'Sala',    ir: 0.35, dark: 0.5, rev: 0.75, echo: 0.00, delay: 0.1 },
  hall:   { name: 'Galpão',  ir: 1.8, dark: 0.4, rev: 0.85, echo: 0.08, delay: 0.16 },
  canyon: { name: 'Vale',    ir: 1.3, dark: 0.25, rev: 0.45, echo: 0.55, delay: 0.42 }
};

/* ---------- armas ---------- */
GunSynth.prototype.W = {
  pistol9: { name: 'Pistola 9mm', sub: 'seca e rápida', mag: 15, auto: false, cd: 110, rev: 0.9, mech: 'slide', snap: 0,
    crack: { f: 3100, q: 0.9, dec: 0.018, gain: 0.65 }, body: { f: 1500, dec: 0.06, gain: 0.7 }, mid: { f: 550, q: 1, dec: 0.09, gain: 0.35 },
    thump: { f: 190, f2: 75, dec: 0.11, gain: 0.6 }, boom: { f: 100, f2: 48, dec: 0.2, gain: 0.3 }, tail: { f: 2400, f2: 500, dec: 0.3, gain: 0.14 } },
  pistol45: { name: 'Pistola .45', sub: 'pesada e grave', mag: 8, auto: false, cd: 160, rev: 1.0, mech: 'slide', snap: 0,
    crack: { f: 2300, q: 0.8, dec: 0.022, gain: 0.7 }, body: { f: 1100, dec: 0.09, gain: 0.8 }, mid: { f: 420, q: 1, dec: 0.12, gain: 0.45 },
    thump: { f: 140, f2: 55, dec: 0.14, gain: 0.75 }, boom: { f: 72, f2: 38, dec: 0.3, gain: 0.45 }, tail: { f: 1800, f2: 380, dec: 0.45, gain: 0.17 } },
  rifle: { name: 'Fuzil de assalto', sub: 'automático', mag: 30, auto: true, rpm: 650, rev: 1.1, mech: 'bolt', snap: 0.35,
    crack: { f: 3700, q: 0.7, dec: 0.026, gain: 0.75 }, body: { f: 1000, dec: 0.1, gain: 0.85 }, mid: { f: 480, q: 1, dec: 0.14, gain: 0.45 },
    thump: { f: 125, f2: 50, dec: 0.15, gain: 0.8 }, boom: { f: 66, f2: 32, dec: 0.4, gain: 0.55 }, tail: { f: 2000, f2: 350, dec: 0.7, gain: 0.2 } },
  sniper: { name: 'Fuzil de precisão', sub: 'ferrolho', mag: 5, auto: false, cd: 1050, rev: 1.3, mech: 'sniper', snap: 0.45,
    crack: { f: 2800, q: 0.6, dec: 0.05, gain: 0.85 }, body: { f: 750, dec: 0.2, gain: 0.95 }, mid: { f: 360, q: 0.9, dec: 0.25, gain: 0.5 },
    thump: { f: 100, f2: 40, dec: 0.2, gain: 0.9 }, boom: { f: 52, f2: 26, dec: 0.75, gain: 0.7 }, tail: { f: 1500, f2: 250, dec: 1.2, gain: 0.24 } }
};


  window.NRGunSynth = { criar: function (ctx, destino, opcoes) { var o = opcoes || {}; return new GunSynth({ ctx: ctx, destino: destino, volume: o.volume === undefined ? 0.7 : o.volume, brightness: o.brilho === undefined ? 0.45 : o.brilho }); }, Classe: GunSynth };
})();
