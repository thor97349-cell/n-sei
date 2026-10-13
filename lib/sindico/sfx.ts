// Sons sintetizados na hora (Web Audio), sem arquivos de áudio.
// Só tocam depois de um clique do jogador, como os navegadores exigem.

type Sound = "notify" | "good" | "bad" | "vote" | "end";

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(value: boolean) {
  muted = value;
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(ac: AudioContext, freq: number, start: number, duration: number, type: OscillatorType = "sine", volume = 0.15) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, ac.currentTime + start);
  gain.gain.linearRampToValueAtTime(volume, ac.currentTime + start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + duration + 0.02);
}

export function play(sound: Sound) {
  if (muted) return;
  const ac = audio();
  if (!ac) return;
  switch (sound) {
    case "notify": // o "plim" de mensagem nova no grupo
      tone(ac, 880, 0, 0.12);
      tone(ac, 1320, 0.1, 0.18);
      break;
    case "good":
      tone(ac, 523, 0, 0.12, "triangle");
      tone(ac, 659, 0.08, 0.12, "triangle");
      tone(ac, 784, 0.16, 0.2, "triangle");
      break;
    case "bad":
      tone(ac, 220, 0, 0.25, "sawtooth", 0.06);
      tone(ac, 185, 0.12, 0.3, "sawtooth", 0.06);
      break;
    case "vote": // martelinho da assembleia
      tone(ac, 140, 0, 0.08, "square", 0.08);
      tone(ac, 140, 0.15, 0.08, "square", 0.08);
      break;
    case "end":
      [523, 659, 784, 1047].forEach((f, i) => tone(ac, f, i * 0.12, 0.3, "triangle"));
      break;
  }
}
