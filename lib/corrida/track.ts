// Geometria da pista no estilo "pseudo-3D" dos arcades dos anos 80/90:
// a estrada é uma lista de segmentos retos; curvas e morros são só
// deslocamentos acumulados em x/y na hora de projetar.

export const SEGMENT_LENGTH = 200;
export const RUMBLE_LENGTH = 3;
export const ROAD_WIDTH = 2000; // meia-largura, em unidades de mundo
export const LANES = 3;
export const CHECKPOINT_SEGMENTS = 1000;

export type SpriteKind = "lamp" | "billboard" | "tree" | "pole" | "heart" | "gate";

export interface RoadSprite {
  kind: SpriteKind;
  offset: number; // -1..1 é a estrada; além disso é acostamento
  id: number;
  text?: string;
  hue?: string;
}

export interface Car {
  offset: number;
  z: number;
  speed: number;
  percent: number;
  color: string;
  truck: boolean;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface RoadPoint {
  world: Vec3;
  camera: Vec3;
  screen: { x: number; y: number; w: number; scale: number };
}

export interface Segment {
  index: number;
  p1: RoadPoint;
  p2: RoadPoint;
  curve: number;
  sprites: RoadSprite[];
  cars: Car[];
  dark: boolean;
  checkpoint: boolean;
  looped: boolean;
  fog: number;
  clip: number;
}

// Larguras de colisão em unidades normalizadas da estrada (1 = meia-largura).
export const CAR_WIDTH = 0.3;
export const HEART_WIDTH = 0.28;

// Caixa de colisão de um objeto de beira de estrada, casando com o desenho
// em draw.ts (placas crescem para fora da pista, árvores têm o tronco deslocado).
export function spriteHitbox(sprite: RoadSprite): { x: number; w: number } | null {
  const side = sprite.offset < 0 ? -1 : 1;
  switch (sprite.kind) {
    case "lamp":
    case "pole":
      return { x: sprite.offset, w: 0.08 };
    case "tree":
      return { x: sprite.offset + side * 0.175, w: 0.1 };
    case "billboard":
      return { x: sprite.offset + side * 0.425, w: 0.85 };
    default:
      return null;
  }
}

export const BILLBOARD_TEXTS = ["999", "LUCID", "♥ 24H", "MOTEL", "NO VACANCY", "LEGENDS", "OPEN", "GOODBYE", "♥"];
export const NEON_HUES = ["#ff2d95", "#b26bff", "#3df2ff", "#ff4d4d", "#ffd166"];

export function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const easeIn = (a: number, b: number, p: number) => a + (b - a) * Math.pow(p, 2);
export const easeInOut = (a: number, b: number, p: number) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5);
export const interpolate = (a: number, b: number, p: number) => a + (b - a) * p;
export const limit = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));
export const percentRemaining = (n: number, total: number) => (n % total) / total;
export const accelerate = (v: number, accel: number, dt: number) => v + accel * dt;
export const exponentialFog = (distance: number, density: number) =>
  1 / Math.pow(Math.E, distance * distance * density);

export function increase(start: number, increment: number, max: number) {
  let result = start + increment;
  while (result >= max) result -= max;
  while (result < 0) result += max;
  return result;
}

export function overlap(x1: number, w1: number, x2: number, w2: number, percent = 1) {
  const half = percent / 2;
  const min1 = x1 - w1 * half;
  const max1 = x1 + w1 * half;
  const min2 = x2 - w2 * half;
  const max2 = x2 + w2 * half;
  return !(max1 < min2 || min1 > max2);
}

const LENGTH = { SHORT: 25, MEDIUM: 50, LONG: 100 };
const HILL = { LOW: 20, MEDIUM: 40, HIGH: 60 };
const CURVE = { EASY: 2, MEDIUM: 4, HARD: 6 };

function point(y: number, z: number): RoadPoint {
  return { world: { x: 0, y, z }, camera: { x: 0, y: 0, z: 0 }, screen: { x: 0, y: 0, w: 0, scale: 0 } };
}

class TrackBuilder {
  segments: Segment[] = [];

  lastY() {
    return this.segments.length === 0 ? 0 : this.segments[this.segments.length - 1].p2.world.y;
  }

  addSegment(curve: number, y: number) {
    const n = this.segments.length;
    this.segments.push({
      index: n,
      p1: point(this.lastY(), n * SEGMENT_LENGTH),
      p2: point(y, (n + 1) * SEGMENT_LENGTH),
      curve,
      sprites: [],
      cars: [],
      dark: Math.floor(n / RUMBLE_LENGTH) % 2 === 1,
      checkpoint: false,
      looped: false,
      fog: 1,
      clip: 0,
    });
  }

  addRoad(enter: number, hold: number, leave: number, curve: number, height: number) {
    const startY = this.lastY();
    const endY = startY + height * SEGMENT_LENGTH;
    const total = enter + hold + leave;
    for (let n = 0; n < enter; n++) this.addSegment(easeIn(0, curve, n / enter), easeInOut(startY, endY, n / total));
    for (let n = 0; n < hold; n++) this.addSegment(curve, easeInOut(startY, endY, (enter + n) / total));
    for (let n = 0; n < leave; n++)
      this.addSegment(easeInOut(curve, 0, n / leave), easeInOut(startY, endY, (enter + hold + n) / total));
  }

  straight(num = LENGTH.MEDIUM) {
    this.addRoad(num, num, num, 0, 0);
  }

  hill(num: number, height: number) {
    this.addRoad(num, num, num, 0, height);
  }

  curve(num: number, curve: number, height = 0) {
    this.addRoad(num, num, num, curve, height);
  }

  lowRollingHills(num = LENGTH.SHORT, height = HILL.LOW) {
    this.addRoad(num, num, num, 0, height / 2);
    this.addRoad(num, num, num, 0, -height);
    this.addRoad(num, num, num, CURVE.EASY, height);
    this.addRoad(num, num, num, 0, 0);
    this.addRoad(num, num, num, -CURVE.EASY, height / 2);
    this.addRoad(num, num, num, 0, 0);
  }

  sCurves() {
    this.addRoad(LENGTH.MEDIUM, LENGTH.MEDIUM, LENGTH.MEDIUM, -CURVE.EASY, 0);
    this.addRoad(LENGTH.MEDIUM, LENGTH.MEDIUM, LENGTH.MEDIUM, CURVE.MEDIUM, HILL.MEDIUM);
    this.addRoad(LENGTH.MEDIUM, LENGTH.MEDIUM, LENGTH.MEDIUM, CURVE.EASY, -HILL.LOW);
    this.addRoad(LENGTH.MEDIUM, LENGTH.MEDIUM, LENGTH.MEDIUM, -CURVE.EASY, HILL.MEDIUM);
    this.addRoad(LENGTH.MEDIUM, LENGTH.MEDIUM, LENGTH.MEDIUM, -CURVE.MEDIUM, -HILL.MEDIUM);
  }

  bumps() {
    for (const [len, h] of [
      [10, 5],
      [10, -2],
      [10, -5],
      [10, 8],
      [10, 5],
      [10, -7],
      [10, 5],
      [10, -2],
    ])
      this.addRoad(len, len, len, 0, h);
  }

  downhillToEnd(num = 200) {
    this.addRoad(num, num, num, -CURVE.EASY, -this.lastY() / SEGMENT_LENGTH);
  }
}

export interface Track {
  segments: Segment[];
  length: number; // em unidades de mundo
}

export function buildTrack(seed = 999): Track {
  const b = new TrackBuilder();
  b.straight(LENGTH.SHORT);
  b.lowRollingHills();
  b.sCurves();
  b.curve(LENGTH.MEDIUM, CURVE.MEDIUM, HILL.LOW);
  b.bumps();
  b.lowRollingHills();
  b.curve(LENGTH.LONG * 2, CURVE.MEDIUM, HILL.MEDIUM);
  b.straight();
  b.hill(LENGTH.MEDIUM, HILL.HIGH);
  b.sCurves();
  b.curve(LENGTH.LONG, -CURVE.MEDIUM, 0);
  b.hill(LENGTH.LONG, HILL.HIGH);
  b.curve(LENGTH.LONG, CURVE.MEDIUM, -HILL.LOW);
  b.bumps();
  b.hill(LENGTH.LONG, -HILL.MEDIUM);
  b.straight();
  b.curve(LENGTH.MEDIUM, -CURVE.HARD, HILL.LOW);
  b.sCurves();
  b.downhillToEnd();
  // Completa com reta plana até um múltiplo do intervalo de checkpoint,
  // assim os pórticos caem sempre nos mesmos lugares a cada volta.
  while (b.segments.length % CHECKPOINT_SEGMENTS !== 0) b.addSegment(0, 0);

  const segments = b.segments;
  const rand = mulberry32(seed);
  let id = 0;
  const add = (index: number, sprite: Omit<RoadSprite, "id">) => {
    if (index < 0 || index >= segments.length) return;
    segments[index].sprites.push({ ...sprite, id: id++ });
  };

  for (let i = 0; i < segments.length; i += CHECKPOINT_SEGMENTS) {
    segments[i].checkpoint = true;
    add(i, { kind: "gate", offset: 0 });
  }

  // Postes de luz dos dois lados, alternados.
  for (let i = 10; i < segments.length; i += 24) {
    add(i, { kind: "lamp", offset: -1.2 });
    add(i + 12, { kind: "lamp", offset: 1.2 });
  }

  for (let i = 60; i < segments.length; i += 70 + Math.floor(rand() * 90)) {
    const side = rand() < 0.5 ? -1 : 1;
    add(i, {
      kind: "billboard",
      offset: side * (1.6 + rand() * 0.6),
      text: BILLBOARD_TEXTS[Math.floor(rand() * BILLBOARD_TEXTS.length)],
      hue: NEON_HUES[Math.floor(rand() * NEON_HUES.length)],
    });
  }

  for (let i = 30; i < segments.length; i += 4 + Math.floor(rand() * 8)) {
    const side = rand() < 0.5 ? -1 : 1;
    add(i, { kind: rand() < 0.6 ? "tree" : "pole", offset: side * (2 + rand() * 4) });
  }

  // Corações em fileiras numa mesma faixa: pegar a fileira inteira enche o 999.
  const laneCenters = [-2 / 3, 0, 2 / 3];
  for (let i = 80; i < segments.length - 60; i += 90 + Math.floor(rand() * 80)) {
    if (i % CHECKPOINT_SEGMENTS < 10) continue;
    let lane = Math.floor(rand() * LANES);
    const count = 3 + Math.floor(rand() * 4);
    for (let k = 0; k < count; k++) {
      // Algumas fileiras trocam de faixa no meio, pra exigir uma manobra.
      if (k === Math.floor(count / 2) && rand() < 0.35) lane = limit(lane + (rand() < 0.5 ? -1 : 1), 0, LANES - 1);
      add(i + k * 8, { kind: "heart", offset: laneCenters[lane] });
    }
  }

  return { segments, length: segments.length * SEGMENT_LENGTH };
}
