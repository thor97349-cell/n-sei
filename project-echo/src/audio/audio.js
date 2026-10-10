// Procedural tactical audio (Web Audio API). Every sound is synthesized.
// Spatialisation is deliberately cheap: manual distance gain, wall-occlusion
// lowpass, stereo panning and a shared feedback-delay "room" bus per zone.
import { AUDIO } from '../config.js';

export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.listener = { x: 0, y: 0, z: 0, yaw: 0 };
    this.voices = 0;
    this.volume = AUDIO.masterVolume;
  }

  // Must be called from a user gesture (browser autoplay policy).
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    // Shared white-noise buffer.
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    // Reverb buses.
    this.buses = {};
    for (const [name, z] of Object.entries(AUDIO.zones)) {
      const input = ctx.createGain();
      const delay = ctx.createDelay(0.5);
      delay.delayTime.value = z.delay;
      const fb = ctx.createGain(); fb.gain.value = z.feedback;
      const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = z.tone;
      input.connect(delay); delay.connect(tone); tone.connect(fb); fb.connect(delay);
      tone.connect(this.master);
      this.buses[name] = { input, send: z.send };
    }
    this.enabled = true;
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }
  suspend() { this.ctx?.suspend(); }
  resume() { this.ctx?.resume(); }

  setListener(x, y, z, yaw) { const l = this.listener; l.x = x; l.y = y; l.z = z; l.yaw = yaw; }

  // Distance + occlusion -> perceived gain (0..1). Used by audio and HUD.
  perceive(def, pos, occlusion) {
    const l = this.listener;
    const d = Math.hypot(pos.x - l.x, pos.y - l.y, pos.z - l.z);
    if (d >= def.radius) return { gain: 0, d };
    const fall = 1 - d / def.radius;
    let gain = def.volume * fall * fall * (1 / (1 + d * 0.04));
    gain *= Math.pow(AUDIO.occlusionGainPerWall, occlusion);
    return { gain, d };
  }

  // Build the output chain for a positional voice. Returns the input node.
  _chain(pos, gain, occlusion, zone, t, dur) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = gain;
    let node = out;
    const l = this.listener;
    if (pos) {
      // Relative angle -> stereo pan; sounds behind are slightly duller.
      const dx = pos.x - l.x, dz = pos.z - l.z;
      const ang = Math.atan2(-dx, -dz) - l.yaw; // 0 = straight ahead
      const pan = ctx.createStereoPanner();
      pan.pan.value = Math.max(-0.95, Math.min(0.95, -Math.sin(ang)));
      const behind = Math.cos(ang) < -0.2;
      const occIdx = Math.min(AUDIO.occlusionLowpass.length - 1, Math.ceil(occlusion));
      const cutoff = AUDIO.occlusionLowpass[occIdx] * (behind ? 0.55 : 1);
      if (cutoff < 15000) {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = cutoff;
        out.connect(lp); lp.connect(pan);
      } else out.connect(pan);
      pan.connect(this.master);
    } else out.connect(this.master);
    const bus = this.buses[zone];
    if (bus && bus.send > 0) {
      const send = ctx.createGain();
      send.gain.value = bus.send;
      out.connect(send); send.connect(bus.input);
    }
    this.voices++;
    setTimeout(() => { this.voices--; try { out.disconnect(); } catch (e) { /* already gone */ } }, (dur + 0.6) * 1000);
    return node;
  }

  // ---- primitive generators -------------------------------------------
  _noise(dest, t, { dur = 0.1, type = 'bandpass', freq = 1000, q = 1, gain = 1, attack = 0.002, freqEnd = null, rate = 1 }) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  _tone(dest, t, { dur = 0.1, type = 'sine', freq = 440, freqEnd = null, gain = 0.5, attack = 0.003 }) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // ---- public API -------------------------------------------------------
  // type: key of AUDIO.events (or 'ui_*'); pos null = non-positional (own sounds)
  play(type, pos, { gain = 1, occlusion = 0, zone = 'outdoor', surface = 'concrete', distance = 0, weapon = null, delay = 0 } = {}) {
    if (!this.enabled || !this.ctx) return;
    if (gain < 0.004) return;
    if (this.voices >= AUDIO.maxVoices && gain < 0.3) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.005 + delay;
    const synth = SYNTHS[type];
    if (!synth) return;
    const dur = synth.dur || 0.4;
    const dest = this._chain(pos, gain, occlusion, zone, t - ctx.currentTime, dur);
    synth.fn(this, dest, t, { surface, distance, weapon, far: pos ? Math.min(1, distance / 60) : 0 });
  }
}

const S = AUDIO.surfaces;

// Synth recipes. `far` (0..1) dulls distant sounds.
const SYNTHS = {
  step_run: { dur: 0.25, fn: (a, d, t, o) => step(a, d, t, o, 1) },
  step_walk: { dur: 0.25, fn: (a, d, t, o) => step(a, d, t, o, 0.6) },
  step_crouch: { dur: 0.25, fn: (a, d, t, o) => step(a, d, t, o, 0.45) },
  land: {
    dur: 0.3, fn: (a, d, t, o) => {
      step(a, d, t, o, 1.3);
      a._tone(d, t, { dur: 0.12, freq: 90, freqEnd: 45, gain: 0.5 });
    },
  },
  shot_rifle: {
    dur: 0.9, fn: (a, d, t, o) => {
      const cut = 9000 * (1 - o.far) + 700;
      a._noise(d, t, { dur: 0.16, type: 'lowpass', freq: cut, freqEnd: cut * 0.3, q: 0.7, gain: 1.0, attack: 0.001 });
      a._noise(d, t, { dur: 0.05, type: 'highpass', freq: 3000 * (1 - o.far) + 400, q: 0.5, gain: 0.6 * (1 - o.far), attack: 0.0005 });
      a._tone(d, t, { dur: 0.14, freq: 140, freqEnd: 45, gain: 0.9, attack: 0.001 });
      a._noise(d, t + 0.03, { dur: 0.7, type: 'lowpass', freq: 900, freqEnd: 200, q: 0.5, gain: 0.25 + o.far * 0.2, attack: 0.02 });
    },
  },
  shot_pistol: {
    dur: 0.7, fn: (a, d, t, o) => {
      const cut = 7000 * (1 - o.far) + 900;
      a._noise(d, t, { dur: 0.1, type: 'bandpass', freq: cut * 0.5, freqEnd: 800, q: 0.8, gain: 1.0, attack: 0.001 });
      a._noise(d, t, { dur: 0.03, type: 'highpass', freq: 4500 * (1 - o.far) + 500, gain: 0.5 * (1 - o.far), attack: 0.0005 });
      a._tone(d, t, { dur: 0.08, freq: 220, freqEnd: 90, gain: 0.6, attack: 0.001 });
      a._noise(d, t + 0.02, { dur: 0.45, type: 'lowpass', freq: 1300, freqEnd: 300, q: 0.5, gain: 0.18, attack: 0.02 });
    },
  },
  reload: {
    dur: 2.5, fn: (a, d, t, o) => {
      const rt = o.weapon?.reloadTime || 2.2;
      click(a, d, t + 0.05, 2200, 0.6); // mag release
      a._noise(d, t + 0.15, { dur: 0.12, type: 'bandpass', freq: 700, q: 2, gain: 0.3 }); // mag out slide
      click(a, d, t + rt * 0.58, 1500, 0.8); // mag in
      click(a, d, t + rt * 0.82, 2600, 0.7); // bolt / slide
      click(a, d, t + rt * 0.86, 1900, 0.6);
    },
  },
  dryfire: { dur: 0.1, fn: (a, d, t) => click(a, d, t, 3000, 0.5) },
  draw: { dur: 0.3, fn: (a, d, t) => { a._noise(d, t, { dur: 0.15, type: 'bandpass', freq: 1800, q: 3, gain: 0.25 }); click(a, d, t + 0.12, 2400, 0.4); } },
  door: {
    dur: 0.9, fn: (a, d, t) => {
      a._tone(d, t, { dur: 0.5, type: 'sawtooth', freq: 70, freqEnd: 95, gain: 0.25, attack: 0.05 });
      a._noise(d, t, { dur: 0.5, type: 'bandpass', freq: 500, q: 1.5, gain: 0.25, attack: 0.05 });
      a._noise(d, t + 0.42, { dur: 0.25, type: 'lowpass', freq: 380, q: 1, gain: 0.9 });
      a._tone(d, t + 0.42, { dur: 0.2, freq: 110, freqEnd: 60, gain: 0.5 });
    },
  },
  barricade_hit: {
    dur: 0.25, fn: (a, d, t) => {
      a._noise(d, t, { dur: 0.09, type: 'bandpass', freq: 520 + Math.random() * 200, q: 3, gain: 0.9 });
      a._tone(d, t, { dur: 0.08, freq: 210, freqEnd: 120, gain: 0.4 });
    },
  },
  barricade_break: {
    dur: 1.4, fn: (a, d, t) => {
      a._noise(d, t, { dur: 0.5, type: 'bandpass', freq: 1100, freqEnd: 400, q: 1.2, gain: 1.0, attack: 0.002 });
      for (let i = 0; i < 6; i++) {
        const tt = t + 0.05 + i * 0.07 + Math.random() * 0.05;
        a._noise(d, tt, { dur: 0.1, type: 'bandpass', freq: 380 + Math.random() * 400, q: 3, gain: 0.7 });
        a._tone(d, tt, { dur: 0.09, freq: 180 + Math.random() * 120, freqEnd: 90, gain: 0.35 });
      }
      a._tone(d, t, { dur: 0.35, freq: 80, freqEnd: 35, gain: 0.9 });
    },
  },
  terminal_start: {
    dur: 0.8, fn: (a, d, t) => {
      [880, 1320, 1760].forEach((f, i) => a._tone(d, t + i * 0.12, { dur: 0.1, type: 'square', freq: f, gain: 0.18 }));
    },
  },
  terminal_done: {
    dur: 1.8, fn: (a, d, t) => {
      for (let i = 0; i < 6; i++) a._tone(d, t + i * 0.25, { dur: 0.22, type: 'square', freq: i % 2 ? 950 : 700, gain: 0.22, attack: 0.01 });
    },
  },
  extract_start: { dur: 0.8, fn: (a, d, t) => a._tone(d, t, { dur: 0.6, freq: 300, freqEnd: 900, gain: 0.3, attack: 0.02 }) },
  impact: {
    dur: 0.25, fn: (a, d, t, o) => {
      const s = S[o.surface] || S.concrete;
      a._noise(d, t, { dur: 0.05, type: 'bandpass', freq: s.freq * 2, q: 1, gain: 0.6 });
      if (s.ring) a._tone(d, t, { dur: 0.12, freq: s.ring * 2.2, gain: 0.12 });
    },
  },
  // ---- UI / first-person feedback (non-positional) ----
  ui_hit: { dur: 0.1, fn: (a, d, t) => a._tone(d, t, { dur: 0.05, type: 'triangle', freq: 1700, gain: 0.35 }) },
  ui_headshot: { dur: 0.2, fn: (a, d, t) => { a._tone(d, t, { dur: 0.12, type: 'triangle', freq: 2400, gain: 0.4 }); a._tone(d, t, { dur: 0.15, freq: 3600, gain: 0.15 }); } },
  ui_kill: { dur: 0.3, fn: (a, d, t) => { a._tone(d, t, { dur: 0.1, type: 'triangle', freq: 1200, gain: 0.35 }); a._tone(d, t + 0.08, { dur: 0.16, type: 'triangle', freq: 1800, gain: 0.35 }); } },
  ui_hurt: { dur: 0.3, fn: (a, d, t) => { a._tone(d, t, { dur: 0.18, freq: 160, freqEnd: 70, gain: 0.7 }); a._noise(d, t, { dur: 0.12, type: 'lowpass', freq: 600, gain: 0.5 }); } },
  ui_buy: { dur: 0.2, fn: (a, d, t) => { click(a, d, t, 2000, 0.5); a._tone(d, t + 0.04, { dur: 0.08, type: 'triangle', freq: 1400, gain: 0.25 }); } },
  ui_deny: { dur: 0.3, fn: (a, d, t) => a._tone(d, t, { dur: 0.2, type: 'square', freq: 140, gain: 0.15 }) },
  ui_win: { dur: 1.2, fn: (a, d, t) => [523, 659, 784, 1046].forEach((f, i) => a._tone(d, t + i * 0.12, { dur: 0.35, type: 'triangle', freq: f, gain: 0.3 })) },
  ui_lose: { dur: 1.2, fn: (a, d, t) => [392, 330, 262].forEach((f, i) => a._tone(d, t + i * 0.18, { dur: 0.4, type: 'triangle', freq: f, gain: 0.3 })) },
  ui_tick: { dur: 0.1, fn: (a, d, t) => a._tone(d, t, { dur: 0.04, type: 'square', freq: 1000, gain: 0.08 }) },
  ui_pickup: { dur: 0.4, fn: (a, d, t) => a._tone(d, t, { dur: 0.3, freq: 600, freqEnd: 1400, gain: 0.3 }) },
};

function step(a, d, t, o, intensity) {
  const s = S[o.surface] || S.concrete;
  const v = 0.85 + Math.random() * 0.3;
  a._noise(d, t, { dur: s.decay * (0.8 + intensity * 0.3), type: 'bandpass', freq: s.freq * v, q: s.q, gain: 0.9 * intensity, attack: 0.003 });
  a._noise(d, t + 0.025, { dur: 0.05, type: 'lowpass', freq: 300, q: 0.7, gain: 0.4 * intensity });
  if (s.ring) a._tone(d, t, { dur: 0.14, type: 'triangle', freq: s.ring * v, gain: 0.12 * intensity });
}

function click(a, d, t, freq, gain) {
  a._noise(d, t, { dur: 0.035, type: 'bandpass', freq, q: 4, gain, attack: 0.001 });
  a._tone(d, t, { dur: 0.03, type: 'square', freq: freq * 0.6, gain: gain * 0.15 });
}
