// Cena da tela inicial: o Juice encostado no carro (visto de lado) numa rua
// molhada de Chicago, de madrugada. Ao apertar JOGAR, ele anda até a porta,
// entra, os faróis acendem e o carro arranca. Tudo desenhado em vetor no canvas.

import { CarDef } from "./cars";
import { Backdrop, makeScanlines, Palette } from "./draw";
import { STAGES } from "./stages";

const NIGHT: Palette = STAGES[0].palette;

const SKIN = "#7a4b32";
const SKIN_SHADE = "#5c3523";
const HAIR = "#161010";
const HAIR_HI = "#3b2a2c";
const HOODIE = "#e6dff0";
const HOODIE_SHADE = "#b9aecb";
const PANTS = "#262640";
const PANTS_SHADE = "#1a1a2e";
const SHOE = "#f2eefa";

type Vec = { x: number; y: number };

// Ângulos em radianos. Membros: 0 = apontando pra baixo, positivo = pra frente
// (direita). O segundo número de cada par é a dobra do cotovelo/joelho.
interface Pose {
  torso: number;
  head: number;
  nearArm: [number, number];
  farArm: [number, number];
  nearLeg: [number, number];
  farLeg: [number, number];
}

// Encostado no carro: mão no bolso do moletom, a outra apoiada na lataria
// e a perna da frente cruzada.
const LEAN: Pose = {
  torso: -0.1,
  head: 0.06,
  farArm: [-0.4, 0.2],
  nearArm: [0.15, -1.2],
  farLeg: [0.1, 0],
  nearLeg: [-0.2, 0.42],
};

const STAND: Pose = {
  torso: 0,
  head: 0,
  farArm: [0.06, 0.15],
  nearArm: [-0.04, 0.15],
  farLeg: [0.03, 0],
  nearLeg: [-0.03, 0],
};

const REACH: Pose = {
  torso: 0.1,
  head: 0.1,
  farArm: [0.1, 0.2],
  nearArm: [1.25, 0.25],
  farLeg: [-0.1, 0],
  nearLeg: [0.2, -0.1],
};

const CROUCH: Pose = {
  torso: 0.55,
  head: -0.2,
  farArm: [0.6, 0.4],
  nearArm: [1.2, 0.3],
  farLeg: [0.3, -1.2],
  nearLeg: [1.1, -1.5],
};

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function mixPose(a: Pose, b: Pose, t: number): Pose {
  const pair = (x: [number, number], y: [number, number]): [number, number] => [
    lerp(x[0], y[0], t),
    lerp(x[1], y[1], t),
  ];
  return {
    torso: lerp(a.torso, b.torso, t),
    head: lerp(a.head, b.head, t),
    nearArm: pair(a.nearArm, b.nearArm),
    farArm: pair(a.farArm, b.farArm),
    nearLeg: pair(a.nearLeg, b.nearLeg),
    farLeg: pair(a.farLeg, b.farLeg),
  };
}

function walkPose(phase: number): Pose {
  const leg = (p: number): [number, number] => [0.42 * Math.sin(p), -0.95 * Math.pow(Math.max(0, Math.cos(p)), 1.5)];
  return {
    torso: 0.06,
    head: 0,
    nearLeg: leg(phase),
    farLeg: leg(phase + Math.PI),
    nearArm: [-0.32 * Math.sin(phase), 0.35],
    farArm: [0.32 * Math.sin(phase), 0.35],
  };
}

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

// Comprimentos do esqueleto, em unidades de 1/100 da altura do personagem.
const THIGH = 24;
const SHIN = 23;
const TORSO = 30;
const UPPER_ARM = 16;
const FOREARM = 15;

function along(from: Vec, angle: number, len: number): Vec {
  return { x: from.x + Math.sin(angle) * len, y: from.y + Math.cos(angle) * len };
}

const OUTLINE = "#0b0812";

// Membro em dois segmentos com contorno escuro de desenho animado.
function limb(ctx: CanvasRenderingContext2D, a: Vec, b: Vec, c: Vec, w1: number, w2: number, color: string) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const [stroke, extra] of [
    [OUTLINE, 2.4],
    [color, 0],
  ] as const) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = w1 + extra;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.lineWidth = w2 + extra;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();
  }
}

interface DrawJuiceOpts {
  blink: boolean;
  nod: number;
  breathe: number;
  sway: number;
}

// Desenha o personagem com os pés em (x, groundY) e altura h em pixels.
function drawJuice(ctx: CanvasRenderingContext2D, x: number, groundY: number, h: number, pose: Pose, o: DrawJuiceOpts) {
  const u = h / 103;
  ctx.save();
  ctx.translate(x, groundY);
  ctx.scale(u, u);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Pernas primeiro, pra achar a altura da bacia que deixa o pé mais baixo no chão.
  const legEnd = (hip: Vec, l: [number, number]) => {
    const knee = along(hip, l[0], THIGH);
    return { knee, ankle: along(knee, l[0] + l[1], SHIN) };
  };
  const probeNear = legEnd({ x: 0, y: 0 }, pose.nearLeg);
  const probeFar = legEnd({ x: 0, y: 0 }, pose.farLeg);
  const pelvis: Vec = { x: 0, y: -Math.max(probeNear.ankle.y, probeFar.ankle.y) - 3 };

  const nearLeg = legEnd({ x: pelvis.x + 2.5, y: pelvis.y }, pose.nearLeg);
  const farLeg = legEnd({ x: pelvis.x - 3, y: pelvis.y }, pose.farLeg);
  const hipNear = { x: pelvis.x + 2.5, y: pelvis.y };
  const hipFar = { x: pelvis.x - 3, y: pelvis.y };

  const tSin = Math.sin(pose.torso);
  const tCos = Math.cos(pose.torso);
  const local = (lx: number, ly: number): Vec => ({
    x: pelvis.x + lx * tCos - ly * tSin,
    y: pelvis.y + lx * tSin + ly * tCos,
  });
  const lift = o.breathe * 0.4;
  const neck = local(0.5, -TORSO - lift);
  const shoulderNear = local(5.5, -26 - lift);
  const shoulderFar = local(-7, -26 - lift);
  const arm = (sh: Vec, a: [number, number]) => {
    const elbow = along(sh, a[0], UPPER_ARM);
    return { elbow, hand: along(elbow, a[0] + a[1], FOREARM) };
  };
  const nearArm = arm(shoulderNear, pose.nearArm);
  const farArm = arm(shoulderFar, pose.farArm);

  const shoe = (ankle: Vec, color: string) => {
    ctx.fillStyle = color;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(ankle.x - 4, ankle.y - 3.2);
    ctx.quadraticCurveTo(ankle.x + 2, ankle.y - 5.4, ankle.x + 6.5, ankle.y - 1.2);
    ctx.quadraticCurveTo(ankle.x + 11, ankle.y + 0.2, ankle.x + 10.5, ankle.y + 2.8);
    ctx.lineTo(ankle.x - 4.5, ankle.y + 2.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ff2d55";
    ctx.beginPath();
    ctx.moveTo(ankle.x - 1.5, ankle.y - 2);
    ctx.quadraticCurveTo(ankle.x + 3, ankle.y - 2.6, ankle.x + 6, ankle.y - 0.4);
    ctx.lineTo(ankle.x + 1, ankle.y - 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#4a4258";
    ctx.fillRect(ankle.x - 4.4, ankle.y + 1.5, 14.8, 1.2);
  };

  const hand = (at: Vec, from: Vec) => {
    const a = Math.atan2(at.x - from.x, at.y - from.y);
    const hx = at.x + Math.sin(a) * 2;
    const hy = at.y + Math.cos(a) * 2;
    ctx.fillStyle = SKIN;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.ellipse(hx, hy, 3.1, 3.5, -a, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };

  const sleeve = (sh: Vec, a: { elbow: Vec; hand: Vec }, color: string, showHand: boolean) => {
    if (showHand) hand(a.hand, a.elbow);
    limb(ctx, sh, a.elbow, a.hand, 9, 8, color);
    // Punho do moletom.
    const back = Math.atan2(a.elbow.x - a.hand.x, a.elbow.y - a.hand.y);
    const cuff = along(a.hand, back, 2);
    ctx.strokeStyle = HOODIE_SHADE;
    ctx.lineWidth = 8.4;
    ctx.beginPath();
    ctx.moveTo(cuff.x, cuff.y);
    ctx.lineTo(a.hand.x, a.hand.y);
    ctx.stroke();
  };

  // Braço de trás (apoiado no carro) e perna de trás.
  sleeve(shoulderFar, farArm, HOODIE_SHADE, true);
  limb(ctx, hipFar, farLeg.knee, farLeg.ankle, 10.5, 9, PANTS_SHADE);
  shoe(farLeg.ankle, "#cfc8de");

  // Moletom largo, com luz rosa de um lado e ciano do outro.
  ctx.save();
  ctx.translate(pelvis.x, pelvis.y);
  ctx.rotate(pose.torso);
  const grad = ctx.createLinearGradient(-12, 0, 12, 0);
  grad.addColorStop(0, "#f6bfe0");
  grad.addColorStop(0.35, HOODIE);
  grad.addColorStop(1, "#c4e6f2");
  ctx.fillStyle = grad;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-9.5, -28.5 - lift);
  ctx.quadraticCurveTo(0, -31 - lift, 8.5, -28.5 - lift);
  ctx.quadraticCurveTo(12.5, -25, 11.8, -17);
  ctx.lineTo(11.2, 3.5);
  ctx.quadraticCurveTo(0, 6.5, -12.2, 3.5);
  ctx.lineTo(-12.8, -17);
  ctx.quadraticCurveTo(-12.8, -26.5, -9.5, -28.5 - lift);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Dobras do tecido.
  ctx.strokeStyle = "rgba(90,70,120,0.35)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-9, -12);
  ctx.quadraticCurveTo(-6, -8, -8, -2);
  ctx.moveTo(8.5, -14);
  ctx.quadraticCurveTo(6.5, -9, 8, -3);
  ctx.stroke();
  // Barra e bolso canguru.
  ctx.fillStyle = HOODIE_SHADE;
  ctx.fillRect(-12, 0.8, 23, 3);
  ctx.strokeStyle = "rgba(90,70,120,0.6)";
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(-7, -1.5);
  ctx.lineTo(-5.4, -9.5);
  ctx.lineTo(5.4, -9.5);
  ctx.lineTo(7, -1.5);
  ctx.stroke();
  // Capuz caído atrás do pescoço e cordões.
  ctx.fillStyle = HOODIE_SHADE;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.ellipse(-3.5, -29, 8.6, 3.8, -0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "#7f7298";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-1, -26.5);
  ctx.lineTo(-1.6, -19.5);
  ctx.moveTo(2.6, -26.5);
  ctx.lineTo(3, -20);
  ctx.stroke();
  // Estampa 999.
  ctx.fillStyle = "#1c1430";
  ctx.font = "italic 900 7.5px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("999", 0.5, -19);
  ctx.restore();

  // Pescoço.
  const neckBase = local(-0.5, -27.5);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 7.6;
  ctx.beginPath();
  ctx.moveTo(neckBase.x, neckBase.y);
  ctx.lineTo(neck.x, neck.y - 2);
  ctx.stroke();
  ctx.strokeStyle = SKIN_SHADE;
  ctx.lineWidth = 5.8;
  ctx.stroke();

  // Corrente com o pingente 999.
  const chainL = local(-4.5, -27.5);
  const chainR = local(4.5, -27.5);
  const pendant = local(1, -19.5);
  ctx.strokeStyle = "#e4e7f2";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(chainL.x, chainL.y);
  ctx.quadraticCurveTo(pendant.x - 4, pendant.y, pendant.x, pendant.y - 1);
  ctx.quadraticCurveTo(pendant.x + 4, pendant.y, chainR.x, chainR.y);
  ctx.stroke();
  ctx.shadowColor = "#ffffff";
  ctx.shadowBlur = 5;
  ctx.fillStyle = "#f2f3fa";
  ctx.beginPath();
  ctx.ellipse(pendant.x, pendant.y + 1, 3.6, 2.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#1c1430";
  ctx.font = "900 2.6px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("999", pendant.x, pendant.y + 1.1);

  // Perna da frente, cruzada.
  limb(ctx, hipNear, nearLeg.knee, nearLeg.ankle, 11, 9.4, PANTS);
  ctx.strokeStyle = "rgba(160,170,255,0.12)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(nearLeg.knee.x + 2.5, nearLeg.knee.y + 1);
  ctx.lineTo(nearLeg.ankle.x + 2, nearLeg.ankle.y - 3);
  ctx.stroke();
  shoe(nearLeg.ankle, SHOE);

  // Cabeça em 3/4 olhando pra direita.
  ctx.save();
  ctx.translate(neck.x, neck.y);
  ctx.rotate(pose.torso + pose.head + o.nod);
  const c = { x: 1.2, y: -10.5 };
  const dread = (sx: number, sy: number, ex: number, ey: number, bend: number) => {
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo((sx + ex) / 2 + bend, (sy + ey) / 2, ex, ey);
    ctx.stroke();
    ctx.strokeStyle = HAIR;
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.strokeStyle = HAIR_HI;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(sx + 0.4, sy + 0.4);
    ctx.quadraticCurveTo((sx + ex) / 2 + bend + 0.4, (sy + ey) / 2, ex + 0.3, ey - 0.6);
    ctx.stroke();
  };
  // Dreads de trás, até a nuca.
  for (let i = 0; i < 8; i++) {
    const a = Math.PI + 0.15 + i * 0.2;
    const sx = c.x + Math.cos(a) * 7;
    const sy = c.y + Math.sin(a) * 7.5;
    dread(sx, sy, sx - 2.5 - (i % 3), sy + 12 + (i % 2) * 2 + o.sway * 0.4, -1.5);
  }
  // Rosto.
  ctx.fillStyle = SKIN;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(c.x - 7.5, c.y - 2);
  ctx.quadraticCurveTo(c.x - 7.8, c.y - 10.5, c.x + 1, c.y - 10.5);
  ctx.quadraticCurveTo(c.x + 9.2, c.y - 10, c.x + 9.4, c.y - 1.5);
  ctx.quadraticCurveTo(c.x + 11, c.y + 1.5, c.x + 9.5, c.y + 3);
  ctx.quadraticCurveTo(c.x + 9.2, c.y + 8.5, c.x + 4.5, c.y + 9.6);
  ctx.quadraticCurveTo(c.x - 1.5, c.y + 10.2, c.x - 5, c.y + 6);
  ctx.quadraticCurveTo(c.x - 7.6, c.y + 3, c.x - 7.5, c.y - 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Sombra do lado do rosto e orelha.
  ctx.fillStyle = "rgba(60,30,20,0.35)";
  ctx.beginPath();
  ctx.ellipse(c.x - 4.5, c.y + 2, 3, 6, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = SKIN_SHADE;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(c.x - 3.8, c.y + 1, 1.8, 2.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Olhos semicerrados, sobrancelhas, nariz e boca.
  for (const ex of [c.x + 2.8, c.x + 7.2]) {
    if (o.blink) {
      ctx.strokeStyle = "#140c0c";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(ex - 1.3, c.y - 0.4);
      ctx.lineTo(ex + 1.3, c.y - 0.4);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#f4eee8";
      ctx.beginPath();
      ctx.ellipse(ex, c.y - 0.3, 1.5, 0.95, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a0f0c";
      ctx.beginPath();
      ctx.ellipse(ex + 0.35, c.y - 0.2, 0.85, 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      // Pálpebra pesada, olhar relaxado.
      ctx.fillStyle = SKIN_SHADE;
      ctx.fillRect(ex - 1.7, c.y - 1.5, 3.4, 0.85);
    }
  }
  ctx.strokeStyle = "#1a100e";
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(c.x + 1.2, c.y - 2.9);
  ctx.quadraticCurveTo(c.x + 2.8, c.y - 3.5, c.x + 4.3, c.y - 3.1);
  ctx.moveTo(c.x + 5.9, c.y - 3.2);
  ctx.quadraticCurveTo(c.x + 7.4, c.y - 3.5, c.x + 8.6, c.y - 2.8);
  ctx.stroke();
  ctx.strokeStyle = SKIN_SHADE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(c.x + 8.3, c.y + 0.2);
  ctx.quadraticCurveTo(c.x + 10.4, c.y + 3, c.x + 8.2, c.y + 3.6);
  ctx.stroke();
  ctx.fillStyle = "#5a2c22";
  ctx.beginPath();
  ctx.moveTo(c.x + 4.2, c.y + 5.8);
  ctx.quadraticCurveTo(c.x + 6.2, c.y + 6.6, c.x + 8, c.y + 5.6);
  ctx.quadraticCurveTo(c.x + 6.2, c.y + 7.6, c.x + 4.2, c.y + 5.8);
  ctx.fill();
  // Cabelo: base no topo e dreads da frente caindo sobre a testa.
  ctx.fillStyle = HAIR;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(c.x - 8.4, c.y - 1);
  ctx.quadraticCurveTo(c.x - 9.5, c.y - 12.5, c.x + 1.5, c.y - 12.2);
  ctx.quadraticCurveTo(c.x + 10.5, c.y - 11.5, c.x + 10, c.y - 4.5);
  ctx.quadraticCurveTo(c.x + 4, c.y - 7.5, c.x - 2, c.y - 6);
  ctx.quadraticCurveTo(c.x - 6, c.y - 4.5, c.x - 8.4, c.y - 1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  for (let i = 0; i < 7; i++) {
    const sx = c.x - 4 + i * 2.3;
    const sy = c.y - 8.5 - Math.sin((i / 6) * Math.PI) * 1.5;
    const len = 6 + (i % 3) * 1.6 + (i > 3 ? 1.5 : 0);
    dread(sx, sy, sx + 1.8 + i * 0.25, sy + len + o.sway * 0.25, 1.2);
  }
  ctx.restore();

  // Braço da frente, com a mão escondida no bolso do moletom.
  sleeve(shoulderNear, nearArm, HOODIE, false);

  ctx.restore();
}

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
const T_STAND = 0.35;
const T_WALK = 1.45;
const T_DOOR = 1.85;
const T_IN = 2.45;
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
  private nextBlink = 2;
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
      doorOpen = clamp01((it - T_WALK) / (T_DOOR - T_WALK)) * (1 - clamp01((it - T_IN) / (T_CLOSE - T_IN)));
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

    // Personagem: posição e pose de acordo com a entrada.
    const jh = L * 0.47;
    const leanX = baseCx - L * 0.34;
    const doorX = baseCx - L * 0.13;
    let jx = leanX;
    let jy = gy + L * 0.035;
    let pose: Pose;
    let visible = true;
    let enterClip = 0;
    const nod = Math.sin(t * Math.PI * 2 * (70 / 60) * 0.5) * 0.05;
    if (it < 0) {
      pose = LEAN;
    } else if (it < T_STAND) {
      pose = mixPose(LEAN, STAND, ease(it / T_STAND));
    } else if (it < T_WALK) {
      const p = (it - T_STAND) / (T_WALK - T_STAND);
      jx = lerp(leanX, doorX, ease(p));
      pose = mixPose(walkPose(p * Math.PI * 4), STAND, p > 0.85 ? (p - 0.85) / 0.15 : 0);
    } else if (it < T_DOOR) {
      jx = doorX;
      pose = mixPose(STAND, REACH, ease((it - T_WALK) / (T_DOOR - T_WALK)));
    } else if (it < T_IN) {
      const p = ease((it - T_DOOR) / (T_IN - T_DOOR));
      jx = lerp(doorX, baseCx + L * 0.02, p);
      jy = lerp(gy + L * 0.035, gy - L * 0.04, p);
      pose = mixPose(REACH, CROUCH, p);
      enterClip = p;
    } else {
      visible = false;
      pose = CROUCH;
    }

    if (this.nextBlink < t - 0.15) this.nextBlink = t + 2.5 + Math.random() * 3;
    const juiceOpts: DrawJuiceOpts = {
      blink: t > this.nextBlink,
      nod: it < 0 ? nod : 0,
      breathe: Math.sin(t * 2.2),
      sway: Math.sin(t * 1.3),
    };
    const glow = 0.75 + 0.25 * Math.sin(t * 2.4);
    const carOpts: CarSideOpts = { doorOpen, lights, wheelSpin, glow };

    // Reflexo no asfalto molhado.
    ctx.save();
    ctx.translate(0, gy * 2);
    ctx.scale(1, -1);
    ctx.globalAlpha = 0.22;
    drawCarSide(ctx, carX, gy, L, this.car, carOpts);
    if (visible && enterClip === 0) drawJuice(ctx, jx, gy, jh, pose, juiceOpts);
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

    // Juice encostado fica na frente do carro; entrando, fica no vão da porta.
    if (visible && enterClip > 0) {
      drawCarSide(ctx, carX, gy, L, this.car, carOpts);
      ctx.save();
      ctx.beginPath();
      // Só o que está dentro do vão da porta aparece: ele abaixa a cabeça e some lá dentro.
      ctx.rect(carX - L * 0.1, gy - L * 0.28, L * 0.28, L * 0.21);
      ctx.clip();
      ctx.globalAlpha = 1 - enterClip * 0.35;
      drawJuice(ctx, jx, jy, jh * (1 - 0.12 * enterClip), pose, juiceOpts);
      ctx.restore();
      ctx.save();
      // Porta aberta por cima dele.
      drawDoorOnly(ctx, carX, gy, L, this.car, doorOpen);
      ctx.restore();
    } else {
      drawCarSide(ctx, carX, gy, L, this.car, carOpts);
      if (visible) {
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.ellipse(jx + jh * 0.03, gy + L * 0.035, jh * 0.17, jh * 0.025, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.shadowColor = "rgba(255,45,149,0.55)";
        ctx.shadowBlur = jh * 0.06;
        drawJuice(ctx, jx, jy, jh, pose, juiceOpts);
        ctx.restore();
      }
    }

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

// Só a porta aberta (desenhada por cima do personagem entrando).
function drawDoorOnly(ctx: CanvasRenderingContext2D, cx: number, gy: number, L: number, car: CarDef, open: number) {
  const P = (x: number, y: number): [number, number] => [cx + x * L, gy + y * L];
  const doorL = -0.1;
  const doorR = 0.18;
  const k = 1 - 0.62 * open;
  const dx = (x: number) => doorR + (x - doorR) * k;
  const drop = 0.03 * open;
  ctx.fillStyle = lighten(car.color, 0.1);
  ctx.strokeStyle = darken(car.color, 0.5);
  ctx.lineWidth = Math.max(1, L * 0.003);
  ctx.beginPath();
  ctx.moveTo(...P(dx(doorL), -0.07 + drop));
  ctx.lineTo(...P(dx(doorL), -0.212 - drop * 0.4));
  ctx.lineTo(...P(doorR - 0.01, -0.212));
  ctx.lineTo(...P(doorR, -0.07));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}
