// Som 100% sintetizado com Web Audio: ronco do motor, uma trilha em loop
// (lá menor, i–VI–III–VII, batida trap em meio-tempo) e efeitos.

const BPM = 140;
const STEP = 60 / BPM / 4; // semicolcheia
const CHORDS = [
  { notes: [57, 60, 64], root: 33 }, // Am
  { notes: [53, 57, 60], root: 29 }, // F
  { notes: [52, 55, 60], root: 36 }, // C
  { notes: [55, 59, 62], root: 31 }, // G
];

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private sfx: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private engineOscs: OscillatorNode[] = [];
  private engineFilter: BiquadFilterNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextTime = 0;
  private step = 0;
  private muted = false;

  // Precisa ser chamado a partir de um gesto do usuário (clique/tecla).
  init() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(ctx.destination);
    this.music = ctx.createGain();
    this.music.gain.value = 0.55;
    this.music.connect(this.master);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master);

    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = "lowpass";
    this.engineFilter.frequency.value = 500;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    for (const [type, detune] of [
      ["sawtooth", 0],
      ["square", -1200],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.detune.value = detune;
      o.frequency.value = 50;
      o.connect(this.engineFilter);
      o.start();
      this.engineOscs.push(o);
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  setEngine(speedRatio: number, on: boolean) {
    if (!this.ctx || !this.engineGain || !this.engineFilter) return;
    const t = this.ctx.currentTime;
    const f = 45 + speedRatio * 125;
    for (const o of this.engineOscs) o.frequency.setTargetAtTime(f, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(350 + speedRatio * 900, t, 0.1);
    this.engineGain.gain.setTargetAtTime(on ? 0.035 + speedRatio * 0.035 : 0, t, 0.15);
  }

  startMusic() {
    if (!this.ctx || this.timer) return;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx) return;
    while (this.nextTime < ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += STEP;
      this.step = (this.step + 1) % 64;
    }
  }

  private playStep(step: number, t: number) {
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const chord = CHORDS[bar];
    if (s === 0) {
      for (const n of chord.notes) this.tone(midi(n), t, STEP * 16, "triangle", 0.05, 0.4, this.music);
    }
    if (s % 2 === 0) {
      const arp = [0, 1, 2, 1, 2, 0, 1, 2][s / 2];
      this.tone(midi(chord.notes[arp] + 12), t, STEP * 1.6, "sine", 0.035, 0.005, this.music);
    }
    if (s === 0 || s === 6 || (s === 10 && bar % 2 === 1)) this.kick(t, midi(chord.root));
    if (s === 8) this.hit(t, 0.18, 1800, 0.22, this.music);
    const roll = bar % 2 === 1 && s >= 12;
    if (s % 2 === 0 || roll) this.hit(t, 0.03, 8000, roll ? 0.035 : 0.05, this.music);
  }

  private tone(
    freq: number,
    t: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    attack: number,
    dest: AudioNode | null,
  ) {
    const ctx = this.ctx;
    if (!ctx || !dest) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private kick(t: number, tail: number) {
    const ctx = this.ctx;
    if (!ctx || !this.music) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(tail, t + 0.08);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(g);
    g.connect(this.music);
    o.start(t);
    o.stop(t + 0.75);
  }

  private hit(t: number, dur: number, freq: number, vol: number, dest: AudioNode | null) {
    const ctx = this.ctx;
    if (!ctx || !dest || !this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = freq > 4000 ? "highpass" : "bandpass";
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  private now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  pickup(combo: number) {
    const t = this.now();
    const base = 76 + Math.min(combo, 9) * 2;
    this.tone(midi(base), t, 0.12, "square", 0.06, 0.005, this.sfx);
    this.tone(midi(base + 7), t + 0.06, 0.18, "square", 0.05, 0.005, this.sfx);
  }

  crash() {
    const t = this.now();
    this.hit(t, 0.5, 600, 0.6, this.sfx);
    this.tone(70, t, 0.4, "sawtooth", 0.15, 0.005, this.sfx);
  }

  bump() {
    this.hit(this.now(), 0.15, 900, 0.35, this.sfx);
  }

  checkpoint() {
    const t = this.now();
    [69, 73, 76, 81].forEach((n, i) => this.tone(midi(n), t + i * 0.08, 0.3, "square", 0.05, 0.005, this.sfx));
  }

  nine() {
    const t = this.now();
    [57, 64, 69, 72, 76, 81].forEach((n, i) =>
      this.tone(midi(n), t + i * 0.05, 1.2, "sawtooth", 0.035, 0.01, this.sfx),
    );
  }

  beep(final: boolean) {
    this.tone(final ? 880 : 440, this.now(), final ? 0.5 : 0.2, "square", 0.08, 0.005, this.sfx);
  }

  dispose() {
    this.stopMusic();
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
    this.engineOscs = [];
  }
}
