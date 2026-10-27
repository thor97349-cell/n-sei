// Tudo é desenhado com primitivas do canvas, sem imagens: carros, placas,
// postes e o skyline são gerados na hora a partir de formas simples.

import { mulberry32, RoadSprite } from "./track";

export interface Palette {
  skyTop: string;
  skyMid: string;
  horizon: string;
  fog: string;
  ground: [string, string];
  road: [string, string];
  rumble: [string, string];
  lane: string;
}

export const NIGHT: Palette = {
  skyTop: "#03020a",
  skyMid: "#140a2a",
  horizon: "#4a1046",
  fog: "#24103a",
  ground: ["#0a0613", "#0d0818"],
  road: ["#17121f", "#1b1525"],
  rumble: ["#ff2d55", "#efe6ff"],
  lane: "#bba6ff",
};

// Modo 999: o negativo vira positivo e a noite esquenta.
export const GOLD: Palette = {
  skyTop: "#0a0410",
  skyMid: "#2a0c2c",
  horizon: "#a2324a",
  fog: "#3a1430",
  ground: ["#140812", "#190a16"],
  road: ["#1f1418", "#24171c"],
  rumble: ["#ffd166", "#fff4d6"],
  lane: "#ffe8a3",
};

function polygon(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.lineTo(x4, y4);
  ctx.closePath();
  ctx.fill();
}

export function drawSegment(
  ctx: CanvasRenderingContext2D,
  width: number,
  lanes: number,
  x1: number,
  y1: number,
  w1: number,
  x2: number,
  y2: number,
  w2: number,
  fog: number,
  dark: boolean,
  pal: Palette,
) {
  const i = dark ? 1 : 0;
  const r1 = w1 / 7;
  const r2 = w2 / 7;

  ctx.fillStyle = pal.ground[i];
  ctx.fillRect(0, y2, width, y1 - y2);

  polygon(ctx, x1 - w1 - r1, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 - r2, y2, pal.rumble[i]);
  polygon(ctx, x1 + w1 + r1, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 + r2, y2, pal.rumble[i]);
  polygon(ctx, x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2, pal.road[i]);

  if (!dark) {
    const l1 = w1 / 40;
    const l2 = w2 / 40;
    const lw1 = (w1 * 2) / lanes;
    const lw2 = (w2 * 2) / lanes;
    let lx1 = x1 - w1 + lw1;
    let lx2 = x2 - w2 + lw2;
    for (let lane = 1; lane < lanes; lane++) {
      polygon(ctx, lx1 - l1 / 2, y1, lx1 + l1 / 2, y1, lx2 + l2 / 2, y2, lx2 - l2 / 2, y2, pal.lane);
      lx1 += lw1;
      lx2 += lw2;
    }
  }

  if (fog < 1) {
    ctx.globalAlpha = 1 - fog;
    ctx.fillStyle = pal.fog;
    ctx.fillRect(0, y2, width, y1 - y2);
    ctx.globalAlpha = 1;
  }
}

interface Star {
  x: number;
  y: number;
  r: number;
  phase: number;
}

// Céu, lua, estrelas e duas camadas de prédios com parallax.
export class Backdrop {
  private stars: Star[] = [];
  private far: HTMLCanvasElement | null = null;
  private near: HTMLCanvasElement | null = null;
  private moon: HTMLCanvasElement | null = null;
  private width = 0;
  private height = 0;

  constructor() {
    const rand = mulberry32(42);
    for (let i = 0; i < 140; i++) {
      this.stars.push({ x: rand(), y: rand() * 0.42, r: 0.4 + rand() * 1.2, phase: rand() * Math.PI * 2 });
    }
  }

  resize(width: number, height: number) {
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.far = this.skyline(width, height, 7, 0.16, "#120a22", "rgba(178,107,255,0.35)", 0.04);
    this.near = this.skyline(width, height, 11, 0.24, "#0a0614", "rgba(255,209,140,0.55)", 0.09);
    this.moon = this.crescent(Math.round(height * 0.07));
  }

  private skyline(
    width: number,
    height: number,
    seed: number,
    maxH: number,
    body: string,
    windowColor: string,
    density: number,
  ) {
    const c = document.createElement("canvas");
    const w = width * 2;
    const h = Math.ceil(height * maxH);
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    if (!g) return c;
    const rand = mulberry32(seed);
    const unit = Math.max(2, width / 320);
    let x = 0;
    while (x < w) {
      const bw = Math.round(unit * (8 + rand() * 22));
      const bh = Math.round(h * (0.25 + rand() * 0.75));
      g.fillStyle = body;
      g.fillRect(x, h - bh, bw, bh);
      if (rand() < 0.25) g.fillRect(x + bw / 2 - unit / 2, h - bh - unit * 6, Math.max(1, unit / 2), unit * 6);
      g.fillStyle = windowColor;
      for (let wy = h - bh + unit * 2; wy < h - unit; wy += unit * 3) {
        for (let wx = x + unit; wx < x + bw - unit; wx += unit * 2.5) {
          if (rand() < density) g.fillRect(wx, wy, unit, unit * 1.2);
        }
      }
      x += bw + Math.round(rand() * unit * 2);
    }
    return c;
  }

  private crescent(r: number) {
    const c = document.createElement("canvas");
    c.width = c.height = r * 4;
    const g = c.getContext("2d");
    if (!g) return c;
    g.fillStyle = "#f4ecff";
    g.beginPath();
    g.arc(r * 2, r * 2, r, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = "destination-out";
    g.beginPath();
    g.arc(r * 2.55, r * 1.75, r * 0.9, 0, Math.PI * 2);
    g.fill();
    return c;
  }

  draw(ctx: CanvasRenderingContext2D, pal: Palette, skyOffset: number, cityOffset: number, t: number) {
    const { width, height } = this;
    const horizonY = height / 2;

    const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
    sky.addColorStop(0, pal.skyTop);
    sky.addColorStop(0.55, pal.skyMid);
    sky.addColorStop(1, pal.horizon);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, horizonY + 1);
    ctx.fillStyle = pal.ground[0];
    ctx.fillRect(0, horizonY, width, height - horizonY);

    ctx.fillStyle = "#ffffff";
    for (const s of this.stars) {
      const x = (((s.x - skyOffset * 0.3) % 1) + 1) % 1;
      ctx.globalAlpha = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.6 + s.phase));
      ctx.fillRect(x * width, s.y * height, s.r, s.r);
    }
    ctx.globalAlpha = 1;

    if (this.moon) {
      const r = this.moon.width / 4;
      const mx = ((((0.74 - skyOffset * 0.3) % 1) + 1) % 1) * width;
      const my = height * 0.16;
      const glow = ctx.createRadialGradient(mx, my, r * 0.5, mx, my, r * 5);
      glow.addColorStop(0, "rgba(220,190,255,0.25)");
      glow.addColorStop(1, "rgba(220,190,255,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(mx - r * 5, my - r * 5, r * 10, r * 10);
      ctx.drawImage(this.moon, mx - r * 2, my - r * 2);
    }

    this.layer(ctx, this.far, skyOffset * 0.6, horizonY);
    this.layer(ctx, this.near, cityOffset, horizonY);
  }

  private layer(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement | null, offset: number, horizonY: number) {
    if (!img) return;
    const w = img.width;
    let x = -((((offset * w) % w) + w) % w);
    const y = horizonY - img.height + 1;
    while (x < this.width) {
      ctx.drawImage(img, x, y);
      x += w;
    }
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// Carro visto de trás. (x, y) é o centro da base; w é a largura na tela.
export function drawCar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  color: string,
  opts: { lean?: number; braking?: boolean; truck?: boolean; plate?: string } = {},
) {
  if (w < 2) return;
  const lean = opts.lean ?? 0;
  const glow = w > 30;
  const h = opts.truck ? w * 0.95 : w * 0.52;

  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.ellipse(x, y, w * 0.55, w * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#050308";
  ctx.fillRect(x - w * 0.46, y - h * 0.2, w * 0.18, h * 0.2);
  ctx.fillRect(x + w * 0.28, y - h * 0.2, w * 0.18, h * 0.2);

  if (opts.truck) {
    ctx.fillStyle = color;
    roundRect(ctx, x - w * 0.5, y - h, w, h * 0.86, w * 0.04);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = Math.max(1, w * 0.015);
    ctx.beginPath();
    ctx.moveTo(x, y - h * 0.95);
    ctx.lineTo(x, y - h * 0.2);
    ctx.stroke();
  } else {
    const cabTop = y - h;
    const cabBottom = y - h * 0.58;
    const shift = lean * w * 0.06;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.4, cabBottom);
    ctx.lineTo(x - w * 0.27 + shift, cabTop);
    ctx.lineTo(x + w * 0.27 + shift, cabTop);
    ctx.lineTo(x + w * 0.4, cabBottom);
    ctx.closePath();
    ctx.fill();

    const glass = ctx.createLinearGradient(0, cabTop, 0, cabBottom);
    glass.addColorStop(0, "#2a1d44");
    glass.addColorStop(1, "#0b0714");
    ctx.fillStyle = glass;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.34, cabBottom - h * 0.03);
    ctx.lineTo(x - w * 0.24 + shift, cabTop + h * 0.07);
    ctx.lineTo(x + w * 0.24 + shift, cabTop + h * 0.07);
    ctx.lineTo(x + w * 0.34, cabBottom - h * 0.03);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = color;
    roundRect(ctx, x - w * 0.5, cabBottom, w, h * 0.46, w * 0.06);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(x - w * 0.5, y - h * 0.2, w, h * 0.08);
  }

  const lightY = opts.truck ? y - h * 0.32 : y - h * 0.44;
  const lightH = Math.max(1, h * (opts.truck ? 0.06 : 0.1));
  ctx.fillStyle = opts.braking ? "#ff5a6e" : "#e0123a";
  if (glow) {
    ctx.shadowColor = "#ff1f4b";
    ctx.shadowBlur = w * (opts.braking ? 0.25 : 0.12);
  }
  ctx.fillRect(x - w * 0.46, lightY, w * 0.26, lightH);
  ctx.fillRect(x + w * 0.2, lightY, w * 0.26, lightH);
  ctx.shadowBlur = 0;

  if (opts.plate && w > 70) {
    const pw = w * 0.2;
    const ph = h * 0.12;
    ctx.fillStyle = "#e9e3f5";
    ctx.fillRect(x - pw / 2, y - h * 0.31, pw, ph);
    ctx.fillStyle = "#1a1030";
    ctx.font = `900 ${Math.round(ph * 0.85)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(opts.plate, x, y - h * 0.31 + ph / 2 + 1);
  }
}

export function drawHeart(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color = "#ff2d95") {
  if (s < 1.5) return;
  ctx.fillStyle = color;
  if (s > 8) {
    ctx.shadowColor = color;
    ctx.shadowBlur = s * 0.8;
  }
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.35);
  ctx.bezierCurveTo(cx - s * 0.1, cy + s * 0.25, cx - s * 0.5, cy + s * 0.05, cx - s * 0.5, cy - s * 0.18);
  ctx.bezierCurveTo(cx - s * 0.5, cy - s * 0.42, cx - s * 0.15, cy - s * 0.5, cx, cy - s * 0.28);
  ctx.bezierCurveTo(cx + s * 0.15, cy - s * 0.5, cx + s * 0.5, cy - s * 0.42, cx + s * 0.5, cy - s * 0.18);
  ctx.bezierCurveTo(cx + s * 0.5, cy + s * 0.05, cx + s * 0.1, cy + s * 0.25, cx, cy + s * 0.35);
  ctx.fill();
  ctx.shadowBlur = 0;
}

// Desenha um objeto de beira de estrada. k = pixels por unidade de mundo
// naquela distância; side = -1 (esquerda da pista) ou 1 (direita).
export function drawRoadside(
  ctx: CanvasRenderingContext2D,
  sprite: RoadSprite,
  x: number,
  y: number,
  k: number,
  t: number,
) {
  const side = sprite.offset < 0 ? -1 : 1;
  switch (sprite.kind) {
    case "lamp": {
      const h = 2300 * k;
      const pw = Math.max(1, 50 * k);
      const arm = 520 * k * -side;
      ctx.fillStyle = "#2a2236";
      ctx.fillRect(x - pw / 2, y - h, pw, h);
      ctx.fillRect(Math.min(x, x + arm), y - h, Math.abs(arm), pw);
      const lx = x + arm;
      const ly = y - h + pw * 1.5;
      const r = 320 * k;
      if (r > 1) {
        const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, r);
        g.addColorStop(0, "rgba(255,214,170,0.9)");
        g.addColorStop(0.25, "rgba(255,160,200,0.35)");
        g.addColorStop(1, "rgba(255,120,200,0)");
        ctx.fillStyle = g;
        ctx.fillRect(lx - r, ly - r, r * 2, r * 2);
      }
      break;
    }
    case "billboard": {
      const w = 1700 * k;
      const panelH = 1000 * k;
      const postH = 900 * k;
      const cx = x + (side * w) / 2;
      const hue = sprite.hue ?? "#ff2d95";
      ctx.fillStyle = "#1a1424";
      ctx.fillRect(cx - w * 0.3, y - postH, Math.max(1, 60 * k), postH);
      ctx.fillRect(cx + w * 0.3, y - postH, Math.max(1, 60 * k), postH);
      ctx.fillStyle = "#0e0818";
      ctx.fillRect(cx - w / 2, y - postH - panelH, w, panelH);
      const flicker = Math.sin(t * 13 + sprite.id) > 0.97 ? 0.35 : 1;
      ctx.globalAlpha *= flicker;
      ctx.strokeStyle = hue;
      ctx.lineWidth = Math.max(1, 40 * k);
      if (w > 40) {
        ctx.shadowColor = hue;
        ctx.shadowBlur = 60 * k;
      }
      ctx.strokeRect(cx - w / 2 + 60 * k, y - postH - panelH + 60 * k, w - 120 * k, panelH - 120 * k);
      if (w > 30 && sprite.text) {
        const size = Math.min(panelH * 0.5, (w * 1.6) / Math.max(3, sprite.text.length));
        ctx.fillStyle = hue;
        ctx.font = `900 ${Math.round(size)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(sprite.text, cx, y - postH - panelH / 2);
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha /= flicker;
      break;
    }
    case "tree": {
      const h = 1800 * k;
      const cx = x + side * 350 * k;
      ctx.strokeStyle = "#1c1229";
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(1, 90 * k);
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.lineTo(cx, y - h);
      ctx.moveTo(cx, y - h * 0.55);
      ctx.lineTo(cx - h * 0.25, y - h * 0.85);
      ctx.moveTo(cx, y - h * 0.7);
      ctx.lineTo(cx + h * 0.22, y - h * 0.95);
      ctx.moveTo(cx, y - h * 0.4);
      ctx.lineTo(cx + h * 0.18, y - h * 0.58);
      ctx.stroke();
      ctx.lineCap = "butt";
      break;
    }
    case "pole": {
      const h = 2600 * k;
      const pw = Math.max(1, 70 * k);
      ctx.fillStyle = "#1e1530";
      ctx.fillRect(x - pw / 2, y - h, pw, h);
      ctx.fillRect(x - 400 * k, y - h * 0.92, 800 * k, Math.max(1, 50 * k));
      if (k * 2600 > 20) {
        ctx.fillStyle = Math.sin(t * 3 + sprite.id) > 0 ? "#ff2d55" : "#5a1020";
        ctx.fillRect(x - pw, y - h - pw * 2, pw * 2, pw * 2);
      }
      break;
    }
    case "heart": {
      const s = 420 * k;
      const bob = Math.sin(t * 4 + sprite.id) * s * 0.12;
      drawHeart(ctx, x, y - s * 0.9 + bob, s);
      break;
    }
    default:
      break;
  }
}

// Pórtico de checkpoint atravessando a pista. roadW = meia-largura na tela.
export function drawGate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  roadW: number,
  k: number,
  label: string,
  t: number,
) {
  const h = 3000 * k;
  const pw = Math.max(2, 150 * k);
  const left = x - roadW * 1.2;
  const right = x + roadW * 1.2;
  const bannerH = 600 * k;
  ctx.fillStyle = "#2b1d3d";
  ctx.fillRect(left - pw / 2, y - h, pw, h);
  ctx.fillRect(right - pw / 2, y - h, pw, h);
  ctx.fillStyle = "#0e0818";
  ctx.fillRect(left, y - h, right - left, bannerH);
  const hue = Math.floor(t * 4) % 2 === 0 ? "#3df2ff" : "#ff2d95";
  ctx.strokeStyle = hue;
  ctx.lineWidth = Math.max(1, 40 * k);
  if (roadW > 30) {
    ctx.shadowColor = hue;
    ctx.shadowBlur = 80 * k;
  }
  ctx.strokeRect(left, y - h, right - left, bannerH);
  if (roadW > 25) {
    ctx.fillStyle = hue;
    ctx.font = `italic 900 ${Math.round(bannerH * 0.6)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x, y - h + bannerH / 2);
  }
  ctx.shadowBlur = 0;
}
