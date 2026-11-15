// Tiny synthesized sound kit (no audio files). Starts on first user gesture.
export class Audio {
  constructor() { this.ctx = null; this.muted = false; this.amb = null; }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.6;
    this.master.connect(this.ctx.destination);
    this.startAmbience();
  }

  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.6, this.ctx.currentTime, 0.05); }

  tone(freq, dur = 0.08, type = 'sine', vol = 0.2, slide = 0, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur = 0.2, vol = 0.2, freq = 800) {
    if (!this.ctx || this.muted) return;
    const len = Math.floor(this.ctx.sampleRate * dur), buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = buf; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = vol;
    s.connect(f).connect(g).connect(this.master); s.start();
  }

  click() { this.tone(1400, 0.04, 'triangle', 0.08); }
  select() { this.tone(660, 0.06, 'triangle', 0.1); this.tone(990, 0.08, 'triangle', 0.08, 0, 0.04); }
  build() { this.tone(180, 0.12, 'square', 0.06, 0.6); this.noise(0.12, 0.12, 1800); }
  road() { this.noise(0.08, 0.1, 900); this.tone(240, 0.05, 'triangle', 0.05); }
  zone() { this.tone(520, 0.05, 'sine', 0.1); this.tone(780, 0.07, 'sine', 0.08, 0, 0.05); }
  bulldoze() { this.noise(0.35, 0.25, 500); this.tone(90, 0.3, 'sawtooth', 0.06, 0.5); }
  error() { this.tone(220, 0.12, 'square', 0.07); this.tone(165, 0.16, 'square', 0.07, 0, 0.1); }
  cash() { this.tone(1318, 0.08, 'triangle', 0.08); this.tone(1760, 0.14, 'triangle', 0.08, 0, 0.07); }
  milestone() { [523, 659, 784, 1046].forEach((f, k) => this.tone(f, 0.28, 'triangle', 0.1, 0, k * 0.1)); }

  startAmbience() {
    const c = this.ctx, len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = last * 0.985 + (Math.random() * 2 - 1) * 0.015; d[i] = last * 6; }
    const s = c.createBufferSource(); s.buffer = buf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
    const g = c.createGain(); g.gain.value = 0;
    s.connect(f).connect(g).connect(this.master); s.start();
    this.amb = g;
  }

  setCityLevel(pop) { if (this.amb) this.amb.gain.setTargetAtTime(Math.min(0.35, 0.04 + Math.log10(1 + pop) * 0.07), this.ctx.currentTime, 1.5); }
}
