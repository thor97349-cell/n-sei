// FAÍSCA — efeitos sonoros e música sintetizados com WebAudio (sem arquivos de áudio).
"use strict";
window.F = window.F || {};

(function (F) {
  let ctx = null, master = null, sfxBus = null, musicBus = null;
  const last = {}; // limita o mesmo som a poucas vezes por segundo
  const A = (F.audio = { sfxOn: true, musicOn: true });

  A.init = function () {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.55;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = A.sfxOn ? 1 : 0; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = A.musicOn ? 0.32 : 0; musicBus.connect(master);
  };
  A.setSfx = (on) => { A.sfxOn = on; if (sfxBus) sfxBus.gain.value = on ? 1 : 0; };
  A.setMusic = (on) => { A.musicOn = on; if (musicBus) musicBus.gain.value = on ? 0.32 : 0; };

  function gate(name, ms) {
    const now = performance.now();
    if (last[name] && now - last[name] < ms) return false;
    last[name] = now; return true;
  }

  // a demonstração da tela de título e a simulação não fazem barulho
  const quiet = () => F.G && (F.G.mode === "attract" || F.G.mode === "sim");
  function tone(freq, dur, type, vol, slide, bus, when) {
    if (!ctx || (bus !== musicBus && quiet())) return;
    const t = (when || ctx.currentTime);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || "square";
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || sfxBus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  let noiseBuf = null;
  function noise(dur, vol, filterFreq, bus, when) {
    if (!ctx || (bus !== musicBus && quiet())) return;
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = when || ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = filterFreq || 2000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus || sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  const semis = (base, n) => base * Math.pow(2, n / 12);
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

  A.shoot = () => gate("shoot", 70) && tone(880 + Math.random() * 120, 0.05, "square", 0.025, 0.5);
  A.hit = () => gate("hit", 45) && tone(220 + Math.random() * 60, 0.05, "triangle", 0.05, 0.6);
  // A cada abate em sequência o som sobe na escala: o combo "canta".
  A.kill = (combo) => {
    if (!gate("kill", 38)) return;
    const step = PENTA[combo % PENTA.length] + 12 * Math.min(2, Math.floor(combo / PENTA.length) % 3);
    tone(semis(330, step), 0.08, "square", 0.05, 1.5);
  };
  A.gem = (streak) => {
    if (!gate("gem", 30)) return;
    tone(semis(988, PENTA[streak % 8]), 0.06, "sine", 0.07);
  };
  A.coin = () => gate("coin", 50) && (tone(1568, 0.06, "square", 0.04), tone(2093, 0.1, "square", 0.04, 1, null, ctx && ctx.currentTime + 0.05));
  A.zap = () => gate("zap", 90) && noise(0.12, 0.08, 6000);
  A.boom = () => gate("boom", 80) && (noise(0.25, 0.14, 900), tone(110, 0.2, "sine", 0.12, 0.4));
  A.nova = () => gate("nova", 120) && tone(160, 0.35, "sawtooth", 0.06, 3);
  A.laser = () => gate("laser", 120) && tone(1400, 0.22, "sawtooth", 0.035, 0.25);
  A.hurt = () => gate("hurt", 120) && (tone(140, 0.22, "sawtooth", 0.16, 0.5), noise(0.15, 0.1, 1500));
  A.levelUp = () => {
    if (!ctx) return; const t = ctx.currentTime;
    [0, 4, 7, 12, 16].forEach((n, i) => tone(semis(523, n), 0.22, "square", 0.06, 1, null, t + i * 0.06));
  };
  A.pick = () => tone(1318, 0.09, "triangle", 0.09, 1.5);
  A.rare = () => {
    if (!ctx) return; const t = ctx.currentTime;
    [0, 7, 12, 19, 24].forEach((n, i) => tone(semis(659, n), 0.3, "triangle", 0.07, 1, null, t + i * 0.05));
  };
  A.chest = () => {
    if (!ctx) return; const t = ctx.currentTime;
    [0, 4, 7, 11, 12, 16, 19, 24].forEach((n, i) => tone(semis(392, n), 0.25, "square", 0.05, 1, null, t + i * 0.07));
  };
  A.tick = () => tone(1800 + Math.random() * 300, 0.03, "square", 0.03);
  A.warn = () => {
    if (!ctx) return; const t = ctx.currentTime;
    for (let i = 0; i < 3; i++) tone(180, 0.3, "sawtooth", 0.09, 1.6, null, t + i * 0.4);
  };
  A.bossDie = () => {
    if (!ctx) return; const t = ctx.currentTime;
    noise(1.2, 0.25, 700); tone(80, 1.2, "sine", 0.2, 0.3);
    [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => tone(semis(523, n), 0.4, "square", 0.05, 1, null, t + 0.3 + i * 0.09));
  };
  A.heal = () => tone(660, 0.25, "sine", 0.08, 2);
  A.bomb = () => { noise(0.8, 0.3, 500); tone(60, 0.8, "sine", 0.25, 0.4); };
  A.ui = () => tone(1046, 0.04, "square", 0.03);
  A.combo = () => {
    if (!ctx) return; const t = ctx.currentTime;
    [0, 7, 12].forEach((n, i) => tone(semis(784, n), 0.12, "square", 0.05, 1, null, t + i * 0.05));
  };
  A.achievement = () => {
    if (!ctx) return; const t = ctx.currentTime;
    [0, 4, 7, 12].forEach((n, i) => tone(semis(880, n), 0.18, "triangle", 0.07, 1, null, t + i * 0.08));
  };

  // Música: baixo + arpejo + bateria eletrônica, com intensidade que cresce com o tempo de jogo.
  const music = { on: false, step: 0, next: 0, timer: null, intensity: 0, bpm: 124 };
  const PROG = [[0, 3, 7], [-4, 0, 3], [-7, -3, 0], [-2, 2, 5]]; // i - VI - IV - VII (menor)
  A.musicIntensity = (v) => { music.intensity = v; };
  function schedule() {
    if (!ctx || !music.on) return;
    const spb = 60 / music.bpm / 4; // semicolcheia
    while (music.next < ctx.currentTime + 0.12) {
      const s = music.step, t = music.next;
      const bar = Math.floor(s / 16) % 4, pos = s % 16, chord = PROG[bar];
      const root = 110 * Math.pow(2, chord[0] / 12);
      if (pos % 4 === 0) { tone(55 * Math.pow(2, chord[0] / 12), 0.18, "sine", 0.5, 0.5, musicBus, t); }
      if (pos % 2 === 0) tone(root, 0.12, "sawtooth", 0.09, 1, musicBus, t);
      if (music.intensity > 0.15 && pos % 4 === 2) noise(0.04, 0.12, 8000, musicBus, t);
      if (music.intensity > 0.35 && (pos === 4 || pos === 12)) noise(0.12, 0.2, 2500, musicBus, t);
      if (music.intensity > 0.55) {
        const n = chord[(pos >> 1) % 3] + (pos % 8 < 4 ? 12 : 24);
        tone(220 * Math.pow(2, n / 12), 0.09, "square", 0.035, 1, musicBus, t);
      }
      if (music.intensity > 0.8 && pos % 8 === 0) tone(880 * Math.pow(2, chord[1] / 12), 0.3, "triangle", 0.03, 1, musicBus, t);
      music.step++; music.next += spb;
    }
  }
  A.startMusic = () => {
    if (!ctx || music.on) return;
    music.on = true; music.next = ctx.currentTime + 0.05; music.step = 0;
    music.timer = setInterval(schedule, 40);
  };
  A.stopMusic = () => { music.on = false; clearInterval(music.timer); };
})(window.F);
