// Som 100% sintetizado com Web Audio. A trilha é um beat emo rap em meio-tempo:
// violão dedilhado (síntese Karplus-Strong) com reverb, 808 com slide, palmas
// no 3, hi-hats de trap com rolls e chiado de vinil. Cada etapa escolhe uma
// das progressões abaixo.

const BPM = 140;
const STEP = 60 / BPM / 4; // semicolcheia

interface Chord {
  notes: number[]; // 5 notas do dedilhado, do grave pro agudo (MIDI)
  root: number; // 808
}

const PROGRESSIONS: Chord[][] = [
  [
    { notes: [45, 52, 57, 60, 64], root: 33 }, // Am
    { notes: [41, 48, 53, 57, 60], root: 29 }, // F
    { notes: [48, 55, 60, 64, 67], root: 36 }, // C
    { notes: [43, 50, 55, 59, 62], root: 31 }, // G
  ],
  [
    { notes: [52, 59, 64, 67, 71], root: 28 }, // Em
    { notes: [48, 55, 60, 64, 67], root: 36 }, // C
    { notes: [43, 50, 55, 59, 62], root: 31 }, // G
    { notes: [50, 57, 62, 66, 69], root: 38 }, // D
  ],
  [
    { notes: [50, 57, 62, 65, 69], root: 38 }, // Dm
    { notes: [46, 53, 58, 62, 65], root: 34 }, // Bb
    { notes: [43, 50, 55, 58, 62], root: 31 }, // Gm
    { notes: [45, 52, 57, 61, 64], root: 33 }, // A
  ],
  [
    { notes: [41, 48, 53, 57, 60], root: 29 }, // F
    { notes: [43, 50, 55, 59, 62], root: 31 }, // G
    { notes: [52, 59, 64, 67, 71], root: 28 }, // Em
    { notes: [45, 52, 57, 60, 64], root: 33 }, // Am
  ],
];

// Índices das notas do acorde tocadas em cada colcheia do compasso.
const PICKING = [0, 2, 3, 4, 1, 3, 2, 4];

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private musicFilter: BiquadFilterNode | null = null;
  private reverb: GainNode | null = null;
  private sfx: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private engineOscs: OscillatorNode[] = [];
  private engineFilter: BiquadFilterNode | null = null;
  private screech: GainNode | null = null;
  private screechFilter: BiquadFilterNode | null = null;
  private noise: AudioBuffer | null = null;
  private plucks = new Map<number, AudioBuffer>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextTime = 0;
  private step = 0;
  private variant = 0;
  private nextVariant = 0;
  private last808 = 0;
  private muted = false;
  private musicOut: GainNode | null = null;
  private musicVol = 0.8;
  private sfxVol = 0.9;
  private titleEl: HTMLAudioElement | null = null;
  private titleUrl: string | null = null;
  private titleWanted = false;
  private titleFailed = false;
  private titleFade: ReturnType<typeof setInterval> | null = null;

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

    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = "lowpass";
    this.musicFilter.frequency.value = 900;
    this.musicOut = ctx.createGain();
    this.musicOut.gain.value = this.musicVol;
    this.musicFilter.connect(this.musicOut);
    this.musicOut.connect(this.master);
    this.music = ctx.createGain();
    this.music.gain.value = 0.6;
    this.music.connect(this.musicFilter);

    const conv = ctx.createConvolver();
    conv.buffer = this.impulse(2.6);
    this.reverb = ctx.createGain();
    this.reverb.gain.value = 0.5;
    this.reverb.connect(conv);
    conv.connect(this.musicFilter);

    this.sfx = ctx.createGain();
    this.sfx.gain.value = this.sfxVol;
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

    // Cantada de pneu do drift: ruído contínuo filtrado, volume controlado.
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    this.screechFilter = ctx.createBiquadFilter();
    this.screechFilter.type = "bandpass";
    this.screechFilter.frequency.value = 2400;
    this.screechFilter.Q.value = 6;
    this.screech = ctx.createGain();
    this.screech.gain.value = 0;
    src.connect(this.screechFilter);
    this.screechFilter.connect(this.screech);
    this.screech.connect(this.sfx);
    src.start();
  }

  private impulse(seconds: number) {
    const ctx = this.ctx as AudioContext;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }

  // Karplus-Strong: um ruído curto circulando numa linha de atraso com filtro
  // vira uma corda dedilhada. Cada nota é gerada uma vez e reaproveitada.
  private pluck(note: number) {
    const cached = this.plucks.get(note);
    if (cached) return cached;
    const ctx = this.ctx as AudioContext;
    const sr = ctx.sampleRate;
    const period = Math.max(2, Math.round(sr / midi(note)));
    const len = Math.floor(sr * 2.4);
    const buf = ctx.createBuffer(1, len, sr);
    const out = buf.getChannelData(0);
    const ring = new Float32Array(period);
    let prev = 0;
    for (let i = 0; i < period; i++) {
      prev = prev * 0.5 + (Math.random() * 2 - 1) * 0.5;
      ring[i] = prev;
    }
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const next = (idx + 1) % period;
      const v = ring[idx];
      out[i] = v;
      ring[idx] = 0.4985 * (v + ring[next]);
      idx = next;
    }
    this.plucks.set(note, buf);
    return buf;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.titleEl && !this.titleFade) this.titleEl.volume = muted ? 0 : this.musicVol;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  // Abafa a trilha (menu, pausa), como se o som viesse de dentro do carro.
  setMuffled(muffled: boolean) {
    if (!this.ctx || !this.musicFilter) return;
    this.musicFilter.frequency.setTargetAtTime(muffled ? 900 : 16000, this.ctx.currentTime, 0.25);
  }

  setVariant(v: number) {
    this.nextVariant = v % PROGRESSIONS.length;
  }

  setEngine(speedRatio: number, on: boolean) {
    if (!this.ctx || !this.engineGain || !this.engineFilter) return;
    const t = this.ctx.currentTime;
    const f = 45 + speedRatio * 125;
    for (const o of this.engineOscs) o.frequency.setTargetAtTime(f, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(350 + speedRatio * 900, t, 0.1);
    this.engineGain.gain.setTargetAtTime(on ? (0.03 + speedRatio * 0.03) * this.sfxVol : 0, t, 0.15);
  }

  setDrift(on: boolean, level: number) {
    if (!this.ctx || !this.screech || !this.screechFilter) return;
    const t = this.ctx.currentTime;
    this.screech.gain.setTargetAtTime(on ? 0.05 + level * 0.015 : 0, t, on ? 0.04 : 0.08);
    this.screechFilter.frequency.setTargetAtTime(2000 + level * 500, t, 0.1);
  }

  startMusic() {
    if (!this.ctx || this.timer) return;
    this.step = 0;
    this.variant = this.nextVariant;
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
      if (this.step % 64 === 0) this.variant = this.nextVariant;
      this.playStep(this.step, this.nextTime);
      this.nextTime += STEP;
      this.step = (this.step + 1) % 128;
    }
  }

  private playStep(step: number, t: number) {
    const bar = Math.floor(step / 16) % 4;
    const s = step % 16;
    const chord = PROGRESSIONS[this.variant][bar];

    if (s % 2 === 0) {
      const note = chord.notes[PICKING[s / 2]];
      this.guitar(note, t, s === 0 ? 0.32 : 0.22);
    }

    // 808: o padrão alterna entre compassos e às vezes desliza pra oitava.
    const hits = bar % 2 === 0 ? [0, 3, 10] : [0, 7, 10];
    if (hits.includes(s)) {
      const up = bar % 2 === 1 && s === 10;
      this.bass(chord.root + (up ? 12 : 0), t, up);
    }
    if (s === 8) this.clap(t);
    const roll = (bar === 1 || bar === 3) && s >= 12;
    if (s % 2 === 0 || roll) this.hat(t, roll ? 0.03 : 0.045);
    if (roll) this.hat(t + STEP / 2, 0.025);
    if (Math.random() < 0.12) this.crackle(t + Math.random() * STEP);
  }

  private guitar(note: number, t: number, vol: number) {
    const ctx = this.ctx;
    if (!ctx || !this.music || !this.reverb) return;
    const src = ctx.createBufferSource();
    src.buffer = this.pluck(note);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 2800;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(this.music);
    g.connect(this.reverb);
    src.start(t);
    src.stop(t + 2.4);
  }

  private bass(note: number, t: number, glide: boolean) {
    const ctx = this.ctx;
    if (!ctx || !this.music) return;
    const o = ctx.createOscillator();
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * 2 - 1;
      curve[i] = Math.tanh(x * 2.2);
    }
    shaper.curve = curve;
    const g = ctx.createGain();
    const target = midi(note);
    if (glide && this.last808) {
      o.frequency.setValueAtTime(this.last808, t);
      o.frequency.exponentialRampToValueAtTime(target, t + 0.12);
    } else {
      o.frequency.setValueAtTime(target * 3, t);
      o.frequency.exponentialRampToValueAtTime(target, t + 0.04);
    }
    this.last808 = target;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.42, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    o.connect(shaper);
    shaper.connect(g);
    g.connect(this.music);
    o.start(t);
    o.stop(t + 1.15);
  }

  private clap(t: number) {
    for (let i = 0; i < 3; i++) this.hit(t + i * 0.011, 0.16, 1500, 0.2, this.music, true);
  }

  private hat(t: number, vol: number) {
    this.hit(t, 0.035, 8500, vol, this.music, false);
  }

  private crackle(t: number) {
    this.hit(t, 0.004, 3000, 0.05 + Math.random() * 0.05, this.music, false);
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

  private hit(t: number, dur: number, freq: number, vol: number, dest: AudioNode | null, wet = false) {
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
    if (wet && this.reverb) g.connect(this.reverb);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  private sweep(t: number, dur: number, from: number, to: number, vol: number) {
    const ctx = this.ctx;
    if (!ctx || !this.sfx || !this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 3;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  private now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  pickup(combo: number) {
    const t = this.now();
    const base = 76 + Math.min(combo, 9) * 2;
    this.tone(midi(base), t, 0.12, "square", 0.05, 0.005, this.sfx);
    this.tone(midi(base + 7), t + 0.06, 0.18, "square", 0.04, 0.005, this.sfx);
  }

  heartbreak() {
    const t = this.now();
    this.hit(t, 0.5, 600, 0.6, this.sfx);
    this.tone(70, t, 0.4, "sawtooth", 0.15, 0.005, this.sfx);
    [76, 72, 69].forEach((n, i) => this.tone(midi(n), t + 0.12 + i * 0.12, 0.4, "triangle", 0.07, 0.01, this.sfx));
  }

  bump() {
    this.hit(this.now(), 0.15, 900, 0.35, this.sfx);
  }

  nearMiss(mult: number) {
    const t = this.now();
    this.sweep(t, 0.28, 500, 3500, 0.4);
    this.tone(midi(84 + Math.min(mult, 9)), t + 0.05, 0.12, "triangle", 0.05, 0.005, this.sfx);
  }

  boost(level: number) {
    const t = this.now();
    this.sweep(t, 0.6, 3000, 300, 0.5);
    [0, 4, 7]
      .slice(0, level)
      .forEach((iv, i) => this.tone(midi(69 + iv + 12), t + i * 0.05, 0.3, "sawtooth", 0.035, 0.005, this.sfx));
  }

  thunder() {
    const t = this.now() + 0.25;
    const ctx = this.ctx;
    if (!ctx || !this.sfx || !this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 160;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    src.start(t);
    src.stop(t + 2.3);
  }

  checkpoint() {
    const t = this.now();
    [69, 73, 76, 81].forEach((n, i) => this.tone(midi(n), t + i * 0.08, 0.3, "square", 0.05, 0.005, this.sfx));
  }

  nine() {
    const t = this.now();
    [57, 64, 69, 72, 76, 81].forEach((n, i) => this.tone(midi(n), t + i * 0.05, 1.2, "sawtooth", 0.03, 0.01, this.sfx));
  }

  beep(final: boolean) {
    this.tone(final ? 880 : 440, this.now(), final ? 0.5 : 0.2, "square", 0.08, 0.005, this.sfx);
  }

  // Volumes de 0 a 1, ajustados na tela de opções.
  setVolumes(music: number, sfx: number) {
    this.musicVol = music;
    this.sfxVol = sfx;
    if (this.ctx && this.musicOut && this.sfx) {
      this.musicOut.gain.setTargetAtTime(music, this.ctx.currentTime, 0.05);
      this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.05);
    }
    if (this.titleEl && !this.titleFade) this.titleEl.volume = this.muted ? 0 : music;
  }

  // Música da tela inicial: um arquivo de áudio, se houver; senão a batida do
  // jogo abafada, como se tocasse no rádio do carro.
  playTitle(url: string | null) {
    this.titleWanted = true;
    if (this.titleFade) clearInterval(this.titleFade);
    this.titleFade = null;
    if (url && !this.titleFailed) {
      this.stopMusic();
      if (!this.titleEl || this.titleUrl !== url) {
        this.titleEl?.pause();
        const el = new Audio(url);
        el.loop = true;
        el.preload = "auto";
        el.addEventListener("error", () => this.titleFallback());
        this.titleEl = el;
        this.titleUrl = url;
      }
      this.titleEl.volume = this.muted ? 0 : this.musicVol;
      void this.titleEl.play().catch(() => this.titleFallback());
      return;
    }
    this.titleFallback();
  }

  private titleFallback() {
    this.titleFailed = true;
    this.titleEl?.pause();
    if (!this.titleWanted) return;
    this.setVariant(0);
    this.startMusic();
    this.setMuffled(true);
  }

  // Abaixa a música da tela inicial aos poucos (na arrancada do carro).
  stopTitle(seconds = 1.2) {
    this.titleWanted = false;
    const el = this.titleEl;
    if (!el || el.paused) return;
    if (this.titleFade) clearInterval(this.titleFade);
    const from = el.volume;
    const started = performance.now();
    this.titleFade = setInterval(() => {
      const p = Math.min(1, (performance.now() - started) / (seconds * 1000));
      el.volume = from * (1 - p);
      if (p >= 1) {
        el.pause();
        if (this.titleFade) clearInterval(this.titleFade);
        this.titleFade = null;
      }
    }, 50);
  }

  // Clique curtinho ao passar pelos botões do menu.
  tick() {
    this.tone(1320, this.now(), 0.05, "square", 0.018, 0.002, this.sfx);
  }

  door() {
    const t = this.now();
    this.hit(t, 0.12, 400, 0.5, this.sfx);
    this.tone(90, t, 0.15, "sine", 0.25, 0.003, this.sfx);
  }

  rev() {
    const ctx = this.ctx;
    if (!ctx || !this.sfx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(45, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.35);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.7);
    o.frequency.exponentialRampToValueAtTime(190, t + 1.4);
    f.type = "lowpass";
    f.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    o.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    o.start(t);
    o.stop(t + 1.7);
  }

  dispose() {
    this.titleWanted = false;
    if (this.titleFade) clearInterval(this.titleFade);
    this.titleEl?.pause();
    this.stopMusic();
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
    this.engineOscs = [];
  }
}
