// Cena da tela inicial em 2D: o carro de lado numa rua molhada de Chicago, de
// madrugada. Ao apertar JOGAR, a porta abre e fecha, os faróis acendem e o carro
// arranca. É a versão de reserva enquanto (ou se) o personagem 3D não carrega.

import { CarDef } from "./cars";
import { Backdrop, makeScanlines, Palette } from "./draw";
import { STAGES } from "./stages";

const NIGHT: Palette = STAGES[0].palette;

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

interface CarSideOpts {
  doorOpen: number;
  lights: number;
  wheelSpin: number;
  glow: number;
}

// Carro de lado, virado pra direita. (cx, gy) é o centro no chão; L o comprimento.
function drawCarSide(ctx: CanvasRenderingContext2D, cx: number, gy: number, L: number, car: CarDef, o: CarSideOpts) {
  const P = (x: number, y: number): [number, number] => [cx + x * L, gy + y * L];
  ctx.save();

  // Underglow neon na cor de detalhe do carro.
  const glowColor = car.id === "lucid" ? "#b26bff" : car.accent === "#111018" ? "#ffcc1a" : car.accent;
  const ug = ctx.createRadialGradient(cx, gy, 0, cx, gy, L * 0.62);
  ug.addColorStop(0, hexA(glowColor, 0.38 * o.glow));
  ug.addColorStop(1, hexA(glowColor, 0));
  ctx.fillStyle = ug;
  ctx.beginPath();
  ctx.ellipse(cx, gy, L * 0.62, L * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();

  const body = () => {
    ctx.beginPath();
    ctx.moveTo(...P(-0.5, -0.075));
    ctx.lineTo(...P(-0.505, -0.17));
    ctx.quadraticCurveTo(...P(-0.5, -0.2), ...P(-0.44, -0.205));
    ctx.lineTo(...P(-0.27, -0.212));
    ctx.quadraticCurveTo(...P(-0.17, -0.29), ...P(-0.08, -0.295));
    ctx.lineTo(...P(0.04, -0.293));
    ctx.quadraticCurveTo(...P(0.1, -0.29), ...P(0.22, -0.208));
    ctx.lineTo(...P(0.43, -0.175));
    ctx.quadraticCurveTo(...P(0.5, -0.165), ...P(0.505, -0.12));
    ctx.lineTo(...P(0.495, -0.065));
    ctx.lineTo(...P(0.405, -0.06));
    ctx.arc(...P(0.31, -0.06), 0.095 * L, 0, Math.PI, true);
    ctx.lineTo(...P(-0.205, -0.06));
    ctx.arc(...P(-0.3, -0.06), 0.095 * L, 0, Math.PI, true);
    ctx.closePath();
  };

  const paint = ctx.createLinearGradient(0, gy - 0.3 * L, 0, gy);
  paint.addColorStop(0, lighten(car.color, 0.35));
  paint.addColorStop(0.45, car.color);
  paint.addColorStop(1, darken(car.color, 0.55));
  ctx.fillStyle = paint;
  body();
  ctx.fill();

  // Vidros.
  ctx.fillStyle = "#120c1e";
  ctx.beginPath();
  ctx.moveTo(...P(-0.235, -0.215));
  ctx.quadraticCurveTo(...P(-0.16, -0.278), ...P(-0.08, -0.282));
  ctx.lineTo(...P(0.035, -0.28));
  ctx.quadraticCurveTo(...P(0.09, -0.276), ...P(0.185, -0.215));
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(220,200,255,0.18)";
  ctx.beginPath();
  ctx.moveTo(...P(-0.05, -0.28));
  ctx.lineTo(...P(0.0, -0.28));
  ctx.lineTo(...P(-0.07, -0.218));
  ctx.lineTo(...P(-0.12, -0.218));
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = darken(car.color, 0.4);
  ctx.fillRect(...P(-0.07, -0.282), 0.012 * L, 0.068 * L);

  if (car.stripes) {
    ctx.fillStyle = car.accent;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(...P(-0.5, -0.135));
    ctx.lineTo(...P(0.5, -0.13));
    ctx.lineTo(...P(0.5, -0.115));
    ctx.lineTo(...P(-0.5, -0.12));
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Porta: o vão escuro aparece quando ela abre, girando na dobradiça da frente.
  const doorL = -0.1;
  const doorR = 0.18;
  if (o.doorOpen > 0) {
    ctx.fillStyle = "#07040c";
    ctx.beginPath();
    ctx.moveTo(...P(doorL, -0.07));
    ctx.lineTo(...P(doorL, -0.212));
    ctx.lineTo(...P(doorR - 0.01, -0.212));
    ctx.lineTo(...P(doorR, -0.07));
    ctx.closePath();
    ctx.fill();
  }
  const k = 1 - 0.62 * o.doorOpen;
  const dx = (x: number) => doorR + (x - doorR) * k;
  const drop = 0.03 * o.doorOpen;
  ctx.fillStyle = o.doorOpen > 0 ? lighten(car.color, 0.1) : "rgba(0,0,0,0)";
  ctx.strokeStyle = darken(car.color, 0.5);
  ctx.lineWidth = Math.max(1, L * 0.003);
  ctx.beginPath();
  ctx.moveTo(...P(dx(doorL), -0.07 + drop));
  ctx.lineTo(...P(dx(doorL), -0.212 - drop * 0.4));
  ctx.lineTo(...P(doorR - 0.01, -0.212));
  ctx.lineTo(...P(doorR, -0.07));
  ctx.closePath();
  if (o.doorOpen > 0) ctx.fill();
  ctx.stroke();
  ctx.fillStyle = darken(car.color, 0.5);
  ctx.fillRect(...P(dx(doorL + 0.03), -0.18), 0.03 * L * k, 0.008 * L);

  // Aerofólio.
  if (car.spoiler) {
    ctx.fillStyle = darken(car.color, 0.6);
    ctx.fillRect(...P(-0.44, -0.235), 0.012 * L, 0.03 * L);
    ctx.fillStyle = car.accent === "#111018" ? "#111018" : car.accent;
    ctx.beginPath();
    ctx.moveTo(...P(-0.5, -0.245));
    ctx.lineTo(...P(-0.38, -0.25));
    ctx.lineTo(...P(-0.38, -0.236));
    ctx.lineTo(...P(-0.5, -0.232));
    ctx.closePath();
    ctx.fill();
  }

  // Lanternas e faróis.
  ctx.fillStyle = "#e0123a";
  ctx.shadowColor = "#ff1f4b";
  ctx.shadowBlur = L * 0.03 * (0.4 + o.lights);
  ctx.fillRect(...P(-0.505, -0.175), 0.022 * L, 0.03 * L);
  ctx.fillStyle = o.lights > 0.1 ? "#fffbe8" : "#a9a3b8";
  ctx.shadowColor = "#fff4c8";
  ctx.shadowBlur = L * 0.04 * o.lights;
  ctx.beginPath();
  ctx.moveTo(...P(0.47, -0.16));
  ctx.lineTo(...P(0.505, -0.14));
  ctx.lineTo(...P(0.505, -0.125));
  ctx.lineTo(...P(0.46, -0.14));
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // Rodas com aro de 5 raios.
  for (const wx of [-0.3, 0.31]) {
    const [x, y] = P(wx, -0.06);
    const r = 0.078 * L;
    ctx.fillStyle = "#0a0810";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3a3448";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.66, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#b8b2c8";
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.beginPath();
    for (let s = 0; s < 5; s++) {
      const a = o.wheelSpin + (s * Math.PI * 2) / 5;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6);
    }
    ctx.stroke();
    ctx.fillStyle = "#d9d4e6";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }

  // Brilho de verniz no teto e no capô.
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = Math.max(1, L * 0.004);
  ctx.beginPath();
  ctx.moveTo(...P(-0.1, -0.292));
  ctx.lineTo(...P(0.03, -0.29));
  ctx.moveTo(...P(0.24, -0.203));
  ctx.lineTo(...P(0.42, -0.176));
  ctx.stroke();
  ctx.restore();
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function shade(hex: string, f: (v: number) => number) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(f(v)))));
  return "#" + ((1 << 24) + (c[0] << 16) + (c[1] << 8) + c[2]).toString(16).slice(1);
}
const lighten = (hex: string, t: number) => shade(hex, (v) => v + (255 - v) * t);
const darken = (hex: string, t: number) => shade(hex, (v) => v * (1 - t));

// Linha do tempo da entrada no carro, em segundos.
const T_WALK = 0.6;
const T_IN = 1.4;
const T_CLOSE = 2.7;
const T_LIGHTS = 3.05;
const T_GO = 4.0;

export interface TitleSounds {
  door?: () => void;
  rev?: () => void;
}

export class TitleScene {
  private ctx: CanvasRenderingContext2D;
  private backdrop = new Backdrop();
  private scanlines: HTMLCanvasElement | null = null;
  private crt = true;
  private car: CarDef;
  private raf = 0;
  private start = performance.now();
  private last = performance.now();
  private dt = 1 / 60;
  private width = 0;
  private height = 0;
  private intro = -1;
  private onDone: (() => void) | null = null;
  private fired = new Set<string>();
  private rain: { x: number; y: number; v: number }[] = [];
  private dim = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    car: CarDef,
    private sounds: TitleSounds = {},
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D indisponível");
    this.ctx = ctx;
    this.car = car;
    for (let i = 0; i < 140; i++) this.rain.push({ x: Math.random(), y: Math.random(), v: 0.8 + Math.random() * 0.6 });
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
  }

  setCar(car: CarDef) {
    this.car = car;
  }

  setCrt(on: boolean) {
    this.crt = on;
  }

  // Escurece a cena por trás de telas como garagem e opções (0..1).
  setDim(d: number) {
    this.dim = d;
  }

  playIntro(onDone: () => void) {
    this.intro = 0;
    this.onDone = onDone;
    this.fired.clear();
  }

  skipIntro() {
    if (this.intro < 0) return;
    this.finish();
  }

  // Volta pro estado parado (depois de sair de uma corrida).
  reset() {
    this.intro = -1;
    this.onDone = null;
  }

  private finish() {
    const done = this.onDone;
    this.intro = -1;
    this.onDone = null;
    done?.();
  }

  private layout() {
    const { width: w, height: h } = this;
    if (w / h >= 1.1) {
      const L = Math.min(w * 0.5, h * 1.15);
      return { L, cx: w * 0.67, gy: h * 0.86 };
    }
    const L = Math.min(w * 0.8, h * 0.5);
    return { L, cx: w * 0.6, gy: h * 0.55 };
  }

  private frame = (now: number) => {
    const canvas = this.canvas;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.dt = dt;
    const w = Math.round(canvas.clientWidth * ratio);
    const h = Math.round(canvas.clientHeight * ratio);
    if (w > 0 && h > 0) {
      if (w !== this.width || h !== this.height) {
        this.width = canvas.width = w;
        this.height = canvas.height = h;
        this.scanlines = makeScanlines(w, h);
      }
      const t = (now - this.start) / 1000;
      if (this.intro >= 0) this.intro += dt;
      this.draw(t);
      if (this.intro >= T_GO + 0.35) this.finish();
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private once(key: string, at: number, fn?: () => void) {
    if (this.intro >= at && !this.fired.has(key)) {
      this.fired.add(key);
      fn?.();
    }
  }

  private draw(t: number) {
    const { ctx, width: w, height: h } = this;
    const { L, cx: baseCx, gy } = this.layout();
    const it = this.intro;

    // Linha do tempo da entrada.
    let carX = baseCx;
    let wheelSpin = 0;
    let lights = 0.15;
    let doorOpen = 0;
    if (it >= 0) {
      doorOpen = clamp01((it - T_WALK) / 0.4) * (1 - clamp01((it - T_IN) / (T_CLOSE - T_IN)));
      lights = 0.15 + 0.85 * clamp01((it - T_CLOSE) / (T_LIGHTS - T_CLOSE));
      const go = Math.max(0, it - T_LIGHTS - 0.3);
      carX = baseCx + go * go * L * 1.8;
      wheelSpin = go * go * 14;
      this.once("door", T_WALK, this.sounds.door);
      this.once("close", T_CLOSE, this.sounds.door);
      this.once("rev", T_CLOSE + 0.1, this.sounds.rev);
    }

    // Céu e skyline: o horizonte fica um pouco acima do chão da rua.
    const horizon = gy - L * 0.16;
    this.backdrop.resize(w, Math.round(horizon * 2));
    this.backdrop.draw(ctx, NIGHT, t * 0.004, t * 0.008, t);

    // Rua molhada.
    const street = ctx.createLinearGradient(0, horizon, 0, h);
    street.addColorStop(0, "#160c24");
    street.addColorStop(0.3, "#0c0716");
    street.addColorStop(1, "#05030a");
    ctx.fillStyle = street;
    ctx.fillRect(0, horizon, w, h - horizon);
    ctx.fillStyle = "#211533";
    ctx.fillRect(0, horizon, w, Math.max(1, L * 0.012));

    // Poste com a luz batendo no chão.
    const lampX = w * (w / h >= 1.1 ? 0.95 : 0.9);
    const lampTop = horizon - L * 0.62;
    ctx.fillStyle = "#1d1528";
    ctx.fillRect(lampX - L * 0.006, lampTop, L * 0.012, gy - lampTop - L * 0.08);
    ctx.fillRect(lampX - L * 0.12, lampTop, L * 0.12, L * 0.01);
    const cone = ctx.createRadialGradient(lampX - L * 0.11, lampTop, 0, lampX - L * 0.11, lampTop, L * 0.75);
    cone.addColorStop(0, "rgba(255,214,170,0.35)");
    cone.addColorStop(1, "rgba(255,160,200,0)");
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.arc(lampX - L * 0.11, lampTop, L * 0.75, 0, Math.PI * 2);
    ctx.fill();

    const glow = 0.75 + 0.25 * Math.sin(t * 2.4);
    const carOpts: CarSideOpts = { doorOpen, lights, wheelSpin, glow };

    // Reflexo no asfalto molhado.
    ctx.save();
    ctx.translate(0, gy * 2);
    ctx.scale(1, -1);
    ctx.globalAlpha = 0.22;
    drawCarSide(ctx, carX, gy, L, this.car, carOpts);
    ctx.restore();
    const fade = ctx.createLinearGradient(0, gy, 0, gy + L * 0.35);
    fade.addColorStop(0, "rgba(8,5,16,0.25)");
    fade.addColorStop(1, "rgba(8,5,16,0.95)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, gy, w, h - gy);

    // Faróis acesos: feixe pra frente.
    if (lights > 0.3) {
      const hx = carX + L * 0.5;
      const hy = gy - L * 0.14;
      const beam = ctx.createLinearGradient(hx, 0, hx + L * 0.9, 0);
      beam.addColorStop(0, `rgba(255,246,210,${0.4 * lights})`);
      beam.addColorStop(1, "rgba(255,246,210,0)");
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(hx, hy - L * 0.01);
      ctx.lineTo(hx + L * 0.9, hy - L * 0.08);
      ctx.lineTo(hx + L * 0.9, hy + L * 0.16);
      ctx.lineTo(hx, hy + L * 0.02);
      ctx.closePath();
      ctx.fill();
    }

    // Fumaça do escapamento acelerando.
    if (it >= T_LIGHTS) {
      const go = it - T_LIGHTS;
      for (let i = 0; i < 6; i++) {
        const age = (go * 2 + i * 0.17) % 1;
        const px = carX - L * 0.52 - age * L * 0.4;
        const py = gy - L * 0.08 - age * L * 0.08;
        ctx.fillStyle = `rgba(200,190,230,${0.18 * (1 - age)})`;
        ctx.beginPath();
        ctx.arc(px, py, L * (0.03 + age * 0.07), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    drawCarSide(ctx, carX, gy, L, this.car, carOpts);

    // Chuva fina.
    ctx.strokeStyle = "rgba(190,170,255,0.22)";
    ctx.lineWidth = Math.max(1, w / 900);
    ctx.beginPath();
    for (const d of this.rain) {
      d.y += d.v * this.dt;
      d.x -= 0.09 * this.dt;
      if (d.y > 1) {
        d.y -= 1;
        d.x = Math.random() * 1.1;
      }
      if (d.x < 0) d.x += 1.1;
      const x = d.x * w;
      const y = d.y * h;
      ctx.moveTo(x, y);
      ctx.lineTo(x + h * 0.006, y - h * 0.03);
    }
    ctx.stroke();

    // Arrancada: rastros de velocidade e fade pro preto.
    if (it >= T_LIGHTS + 0.3) {
      const p = clamp01((it - T_LIGHTS - 0.3) / (T_GO - T_LIGHTS - 0.3));
      ctx.strokeStyle = `rgba(255,255,255,${0.25 * p})`;
      ctx.lineWidth = Math.max(1, h / 300);
      ctx.beginPath();
      for (let i = 0; i < 18; i++) {
        const y = gy - L * (0.02 + ((i * 37) % 30) / 100);
        const x = carX - L * (0.55 + ((i * 53) % 60) / 100);
        ctx.moveTo(x, y);
        ctx.lineTo(x - L * 0.4 * p, y);
      }
      ctx.stroke();
    }
    if (it >= T_GO - 0.4) {
      ctx.fillStyle = `rgba(0,0,0,${clamp01((it - (T_GO - 0.4)) / 0.6)})`;
      ctx.fillRect(0, 0, w, h);
    }

    if (this.dim > 0) {
      ctx.fillStyle = `rgba(4,2,10,${this.dim})`;
      ctx.fillRect(0, 0, w, h);
    }
    if (this.crt && this.scanlines) ctx.drawImage(this.scanlines, 0, 0);
  }
}
