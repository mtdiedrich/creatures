// All audio is synthesized with WebAudio: tool sounds, UI sounds, species calls, stage stings and a light music loop.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI -> Hz

export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.listenerPos = null;
  }

  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = ctx.createGain(); this.master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master);
    this.music = ctx.createGain(); this.music.gain.value = 0.28; this.music.connect(this.master);
    // Simple generated-impulse reverb shared by music and stings.
    this.reverb = ctx.createConvolver();
    const len = ctx.sampleRate * 2.2;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    this.reverb.buffer = ir;
    this.revGain = ctx.createGain(); this.revGain.gain.value = 0.35;
    this.reverb.connect(this.revGain).connect(this.master);
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.startMusic();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  // ---- primitives ----
  tone({ type = 'sine', f = 440, f2 = null, t = 0, dur = 0.2, vol = 0.3, attack = 0.005, out = this.sfx, rev = 0, vib = 0, detune = 0 }) {
    const ctx = this.ctx, now = ctx.currentTime + t;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, now); o.detune.value = detune;
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, now + dur);
    if (vib) {
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = 6; lg.gain.value = vib; l.connect(lg).connect(o.frequency); l.start(now); l.stop(now + dur + 0.1);
    }
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(vol, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0008, now + dur);
    o.connect(g).connect(out);
    if (rev) { const s = ctx.createGain(); s.gain.value = rev; g.connect(s).connect(this.reverb); }
    o.start(now); o.stop(now + dur + 0.05);
  }

  noise({ t = 0, dur = 0.2, vol = 0.3, type = 'lowpass', f = 1200, f2 = null, q = 1, out = this.sfx }) {
    const ctx = this.ctx, now = ctx.currentTime + t;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, now); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, now + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.0008, now + dur);
    src.connect(fl).connect(g).connect(out);
    src.start(now, Math.random() * 0.5); src.stop(now + dur + 0.05);
  }

  play(name) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'dig':
        this.noise({ dur: 0.18, vol: 0.5, f: 900, f2: 200 });
        this.tone({ f: 140, f2: 60, dur: 0.15, vol: 0.35 });
        this.noise({ t: 0.08, dur: 0.12, vol: 0.2, f: 2500, type: 'bandpass', q: 0.8 });
        break;
      case 'smash': // junk: tinny clatter
        this.noise({ dur: 0.25, vol: 0.45, f: 3000, type: 'bandpass', q: 1.5 });
        [1240, 1870, 2630].forEach((f, i) => this.tone({ type: 'square', f, dur: 0.18 + i * 0.05, vol: 0.05, t: i * 0.03 }));
        this.tone({ f: 110, f2: 55, dur: 0.18, vol: 0.4 });
        break;
      case 'rock':
        this.noise({ dur: 0.22, vol: 0.55, f: 1800, f2: 300 });
        this.tone({ type: 'triangle', f: 95, f2: 50, dur: 0.2, vol: 0.5 });
        this.tone({ type: 'square', f: 620, dur: 0.06, vol: 0.06 });
        break;
      case 'rockBreak':
        this.play('rock');
        this.noise({ t: 0.05, dur: 0.45, vol: 0.4, f: 1200, f2: 150 });
        break;
      case 'water':
        this.noise({ dur: 0.5, vol: 0.25, type: 'bandpass', f: 1800, f2: 700, q: 1.2 });
        for (let i = 0; i < 5; i++) this.tone({ f: 600 + Math.random() * 700, f2: 1400 + Math.random() * 600, dur: 0.07, vol: 0.08, t: 0.05 + i * 0.07 });
        break;
      case 'refill':
        this.noise({ dur: 0.7, vol: 0.2, type: 'bandpass', f: 600, f2: 1600, q: 2 });
        this.tone({ f: 300, f2: 900, dur: 0.6, vol: 0.08 });
        break;
      case 'plant':
        this.tone({ f: 520, f2: 260, dur: 0.12, vol: 0.3 });
        this.noise({ dur: 0.1, vol: 0.2, f: 700 });
        this.tone({ type: 'triangle', f: 880, dur: 0.15, vol: 0.12, t: 0.06 });
        break;
      case 'nope':
        this.tone({ type: 'triangle', f: 220, f2: 180, dur: 0.15, vol: 0.2 });
        break;
      case 'menu':
        this.tone({ type: 'triangle', f: 760, dur: 0.07, vol: 0.18 });
        this.tone({ type: 'triangle', f: 1020, dur: 0.06, vol: 0.12, t: 0.04 });
        break;
      case 'buy':
        [72, 76, 79, 84].forEach((n, i) => this.tone({ type: 'triangle', f: NOTE(n), dur: 0.3, vol: 0.18, t: i * 0.06, rev: 0.3 }));
        break;
      case 'coin':
        this.tone({ type: 'square', f: NOTE(83), dur: 0.08, vol: 0.08 });
        this.tone({ type: 'square', f: NOTE(88), dur: 0.35, vol: 0.08, t: 0.08 });
        this.tone({ type: 'sine', f: NOTE(100), dur: 0.3, vol: 0.06, t: 0.08, rev: 0.4 });
        break;
      case 'munch':
        for (let i = 0; i < 6; i++) this.noise({ t: i * 0.45, dur: 0.08, vol: 0.18, type: 'bandpass', f: 1500 + Math.random() * 900, q: 2 });
        break;
      case 'grow':
        this.tone({ f: 660, f2: 990, dur: 0.18, vol: 0.06, rev: 0.4 });
        break;
      case 'sting-appear':
        // Curious, questioning motif.
        [[67, 0], [71, 0.15], [74, 0.3], [73, 0.5]].forEach(([n, t]) => this.tone({ type: 'triangle', f: NOTE(n), dur: 0.5, vol: 0.2, t, rev: 0.6, vib: 3 }));
        this.tone({ f: NOTE(43), dur: 1.0, vol: 0.15, rev: 0.4 });
        break;
      case 'sting-visit':
        [[72, 0], [76, 0.12], [79, 0.24], [77, 0.4], [81, 0.55]].forEach(([n, t]) => this.tone({ type: 'triangle', f: NOTE(n), dur: 0.35, vol: 0.18, t, rev: 0.5 }));
        this.tone({ f: NOTE(48), dur: 0.9, vol: 0.15, rev: 0.4 });
        break;
      case 'sting-resident':
        // Bright fanfare: arpeggio up into a held major chord.
        [60, 64, 67, 72, 76].forEach((n, i) => this.tone({ type: 'triangle', f: NOTE(n), dur: 0.4, vol: 0.18, t: i * 0.08, rev: 0.5 }));
        [72, 76, 79, 84].forEach((n) => {
          this.tone({ type: 'sawtooth', f: NOTE(n), dur: 1.6, vol: 0.035, t: 0.42, attack: 0.08, rev: 0.6, detune: 6 });
          this.tone({ type: 'triangle', f: NOTE(n), dur: 1.6, vol: 0.09, t: 0.42, attack: 0.02, rev: 0.6 });
        });
        for (let i = 0; i < 6; i++) this.tone({ f: NOTE(96 + (i % 3) * 3), dur: 0.2, vol: 0.05, t: 0.5 + i * 0.09, rev: 0.7 });
        break;
    }
  }

  // Species calls, attenuated by distance to the camera focus.
  call(key, pos) {
    if (!this.ctx || this.muted) return;
    let vol = 1;
    if (pos && this.listenerPos) vol = Math.max(0.25, 1 - this.listenerPos.distanceTo(pos) / 35);
    if (key === 'A') {
      // Puffkin: bouncy "pip-pip-piiip"
      [0, 0.13, 0.26].forEach((t, i) => this.tone({ f: 1250 + i * 120, f2: 1900 + i * 200, dur: i === 2 ? 0.22 : 0.09, vol: 0.16 * vol, t, rev: 0.3 }));
    } else if (key === 'C') {
      // Bumblet: a soft buzz that rises into a happy two-note hum
      this.tone({ type: 'sawtooth', f: 180, f2: 240, dur: 0.45, vol: 0.05 * vol, vib: 25, rev: 0.2 });
      this.tone({ type: 'triangle', f: 660, f2: 700, dur: 0.18, vol: 0.12 * vol, t: 0.3, vib: 20, rev: 0.4 });
      this.tone({ type: 'triangle', f: 880, f2: 860, dur: 0.3, vol: 0.12 * vol, t: 0.48, vib: 20, rev: 0.4 });
    } else {
      // Glimmer: warbling two-note whistle with a shimmer
      this.tone({ f: 980, f2: 1460, dur: 0.35, vol: 0.13 * vol, vib: 40, rev: 0.5 });
      this.tone({ f: 1460, f2: 820, dur: 0.5, vol: 0.13 * vol, t: 0.32, vib: 50, rev: 0.5 });
      this.tone({ f: 2920, dur: 0.6, vol: 0.03 * vol, t: 0.1, rev: 0.7 });
    }
  }

  // ---- music: a gentle chamber-orchestra style loop (pizzicato, strings pad, flute melody) ----
  startMusic() {
    const bpm = 92, beat = 60 / bpm;
    // F major: F - Dm - Bb - C, then F - Am - Bb - C
    const chords = [[53, 57, 60], [50, 53, 57], [46, 50, 53], [48, 52, 55], [53, 57, 60], [45, 48, 52], [46, 50, 53], [48, 52, 55]];
    const melody = [
      [72, 1], [74, 0.5], [76, 0.5], [77, 1], [76, 1], [74, 1.5], [72, 0.5], [69, 2], [70, 1], [72, 1], [74, 1], [72, 1], [67, 3], [null, 1],
      [72, 1], [74, 0.5], [76, 0.5], [77, 1], [79, 1], [81, 1.5], [79, 0.5], [76, 2], [77, 1], [76, 1], [74, 1], [70, 1], [72, 3], [null, 1],
    ];
    const barLen = beat * 4;
    const loopLen = barLen * chords.length;
    let loopStart = this.ctx.currentTime + 0.3;
    const out = this.music;
    const scheduleLoop = (t0) => {
      chords.forEach((ch, bi) => {
        const bt = t0 + bi * barLen;
        // String pad
        ch.forEach((n) => {
          for (const det of [-7, 7]) this.tone({ type: 'sawtooth', f: NOTE(n + 12), t: bt - this.ctx.currentTime, dur: barLen * 1.05, vol: 0.022, attack: 0.6, out, rev: 0.5, detune: det });
        });
        // Pizzicato bass + arpeggio
        const pat = [ch[0] - 12, ch[1], ch[2], ch[1], ch[0], ch[2], ch[1] + 12, ch[2]];
        pat.forEach((n, i) => this.tone({ type: 'triangle', f: NOTE(n), t: bt + i * beat * 0.5 - this.ctx.currentTime, dur: 0.28, vol: i === 0 ? 0.16 : 0.08, out, rev: 0.4 }));
      });
      // Flute melody
      let mt = t0;
      for (const [n, len] of melody) {
        if (n) this.tone({ type: 'sine', f: NOTE(n), t: mt - this.ctx.currentTime, dur: len * beat * 0.95, vol: 0.07, attack: 0.06, out, rev: 0.6, vib: 4 });
        mt += len * beat;
      }
    };
    const tick = () => {
      if (!this.ctx) return;
      if (this.ctx.currentTime > loopStart - 1.5) {
        scheduleLoop(loopStart);
        loopStart += loopLen;
      }
    };
    tick();
    setInterval(tick, 500);
  }
}
