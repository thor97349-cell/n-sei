// Loop do jogo: física, tráfego, colisões, checkpoints, modo 999 e HUD.
// A projeção da pista segue a técnica clássica de "pseudo-3D" por segmentos.

import { Sound } from "./audio";
import { Backdrop, drawCar, drawGate, drawHeart, drawRoadside, drawSegment, GOLD, NIGHT } from "./draw";
import { loadBest, saveBest } from "./storage";
import {
  buildTrack,
  Car,
  CAR_WIDTH,
  CHECKPOINT_SEGMENTS,
  exponentialFog,
  HEART_WIDTH,
  increase,
  interpolate,
  LANES,
  limit,
  overlap,
  percentRemaining,
  ROAD_WIDTH,
  RoadPoint,
  SEGMENT_LENGTH,
  Segment,
  spriteHitbox,
} from "./track";

export type Phase = "attract" | "countdown" | "playing" | "paused" | "over";

export interface RunResult {
  score: number;
  best: number;
  newBest: boolean;
  stage: number;
  distanceKm: number;
  hearts: number;
  reason: "time" | "crash";
}

export interface GameCallbacks {
  onPhase: (phase: Phase) => void;
  onGameOver: (result: RunResult) => void;
}

const STEP = 1 / 60;
const FIELD_OF_VIEW = 100;
const CAMERA_HEIGHT = 1000;
const CAMERA_DEPTH = 1 / Math.tan(((FIELD_OF_VIEW / 2) * Math.PI) / 180);
const PLAYER_Z = CAMERA_HEIGHT * CAMERA_DEPTH;
const DRAW_DISTANCE = 300;
const FOG_DENSITY = 5;
const MAX_SPEED = SEGMENT_LENGTH / STEP;
const ACCEL = MAX_SPEED / 5;
const BREAKING = -MAX_SPEED;
const DECEL = -MAX_SPEED / 5;
const OFF_ROAD_DECEL = -MAX_SPEED / 2;
const OFF_ROAD_LIMIT = MAX_SPEED / 4;
const CENTRIFUGAL = 0.3;
const KMH_AT_MAX = 290;

const START_TIME = 35;
const MAX_LIVES = 3;
const NINE_DURATION = 9;
const NINE_SPEED = 1.15;
const BASE_CARS = 50;
const MAX_CARS = 130;

const CAR_COLORS = ["#3df2ff", "#e9e3f5", "#2b4bff", "#ff8a3d", "#1fd18b", "#a9a9c2", "#ff3d7f"];
const TRUCK_COLORS = ["#5b4a73", "#8a8aa0", "#3a2f4d", "#6d2a3a"];

interface Message {
  text: string;
  color: string;
  age: number;
  life: number;
  big?: boolean;
}

interface Drop {
  x: number;
  y: number;
  len: number;
  v: number;
}

type Key = "left" | "right" | "up" | "down";

const KEYMAP: Record<string, Key> = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  Space: "down",
};

function project(p: RoadPoint, cameraX: number, cameraY: number, cameraZ: number, width: number, height: number) {
  p.camera.x = p.world.x - cameraX;
  p.camera.y = p.world.y - cameraY;
  p.camera.z = p.world.z - cameraZ;
  p.screen.scale = CAMERA_DEPTH / p.camera.z;
  p.screen.x = Math.round(width / 2 + (p.screen.scale * p.camera.x * width) / 2);
  p.screen.y = Math.round(height / 2 - (p.screen.scale * p.camera.y * height) / 2);
  p.screen.w = Math.round((p.screen.scale * ROAD_WIDTH * width) / 2);
}

export class Game {
  readonly sound = new Sound();
  autoGas = false;

  private ctx: CanvasRenderingContext2D;
  private backdrop = new Backdrop();
  private segments: Segment[];
  private trackLength: number;
  private cars: Car[] = [];
  private width = 0;
  private height = 0;

  private phase: Phase = "attract";
  private pausedFrom: Phase = "playing";
  private keys: Record<Key, boolean> = { left: false, right: false, up: false, down: false };
  private position = 0;
  private lap = 0;
  private playerX = 0;
  private speed = 0;
  private lastHeartSegment = 0;
  private collected = new Set<number>();
  private nextCheckpoint = 0;

  private timeLeft = START_TIME;
  private countdown = 0;
  private lives = MAX_LIVES;
  private score = 0;
  private hearts = 0;
  private combo = 0;
  private nineTime = 0;
  private invuln = 0;
  private stage = 1;
  private best = 0;

  private messages: Message[] = [];
  private rain: Drop[] = [];
  private rainAmount = 0;
  private shake = 0;
  private skyOffset = 0;
  private cityOffset = 0;
  private t = 0;
  private acc = 0;
  private last = 0;
  private raf = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private callbacks: GameCallbacks,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D indisponível");
    this.ctx = ctx;
    const track = buildTrack();
    this.segments = track.segments;
    this.trackLength = track.length;
    this.best = loadBest();
    for (let i = 0; i < 160; i++) this.rain.push({ x: Math.random(), y: Math.random(), len: 0, v: 0 });
    for (const d of this.rain) {
      d.len = 0.02 + Math.random() * 0.04;
      d.v = 1.2 + Math.random() * 0.8;
    }
    this.resetRun();
    this.speed = MAX_SPEED * 0.5;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.sound.dispose();
  }

  resize(width: number, height: number) {
    this.width = this.canvas.width = Math.max(1, Math.round(width));
    this.height = this.canvas.height = Math.max(1, Math.round(height));
    this.backdrop.resize(this.width, this.height);
  }

  getPhase() {
    return this.phase;
  }

  getBest() {
    return this.best;
  }

  start() {
    this.sound.init();
    this.sound.startMusic();
    this.resetRun();
    this.countdown = 3.999;
    this.sound.beep(false);
    this.setPhase("countdown");
  }

  togglePause() {
    if (this.phase === "playing" || this.phase === "countdown") {
      this.pausedFrom = this.phase;
      this.setPhase("paused");
      this.sound.stopMusic();
    } else if (this.phase === "paused") {
      this.setPhase(this.pausedFrom);
      this.sound.startMusic();
    }
  }

  quitToMenu() {
    this.setPhase("attract");
    this.speed = Math.max(this.speed, MAX_SPEED * 0.3);
    this.sound.stopMusic();
  }

  setKey(key: Key, down: boolean) {
    this.keys[key] = down;
  }

  private setPhase(phase: Phase) {
    this.phase = phase;
    this.callbacks.onPhase(phase);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const key = KEYMAP[e.code];
    if (key) {
      this.keys[key] = true;
      if (this.phase !== "attract" && this.phase !== "over") e.preventDefault();
      this.autoGas = false;
    }
    if ((e.code === "KeyP" || e.code === "Escape") && !e.repeat) this.togglePause();
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const key = KEYMAP[e.code];
    if (key) this.keys[key] = false;
  };

  private onVisibility = () => {
    if (document.hidden && (this.phase === "playing" || this.phase === "countdown")) this.togglePause();
  };

  private resetRun() {
    for (const s of this.segments) s.cars = [];
    this.cars = [];
    // Câmera alguns segmentos antes do fim da volta, pra largada aparecer na frente.
    this.position = this.trackLength - 14 * SEGMENT_LENGTH;
    this.lap = -1;
    this.playerX = 0;
    this.speed = 0;
    this.collected.clear();
    this.lastHeartSegment = this.findSegment(this.position + PLAYER_Z).index;
    this.nextCheckpoint = CHECKPOINT_SEGMENTS * SEGMENT_LENGTH;
    this.timeLeft = START_TIME;
    this.lives = MAX_LIVES;
    this.score = 0;
    this.hearts = 0;
    this.combo = 0;
    this.nineTime = 0;
    this.invuln = 0;
    this.stage = 1;
    this.messages = [];
    this.shake = 0;
    for (let i = 0; i < BASE_CARS; i++) this.addCar(true);
  }

  private addCar(initial: boolean) {
    const n = this.segments.length;
    const playerIndex = this.findSegment(this.position).index;
    // Nunca nasce dentro do campo de visão; no começo, só depois de uma folga.
    const ahead = initial
      ? 60 + Math.floor(Math.random() * (n - 120))
      : DRAW_DISTANCE + Math.floor(Math.random() * 800);
    const z = ((playerIndex + ahead) % n) * SEGMENT_LENGTH;
    const truck = Math.random() < 0.2;
    const car: Car = {
      offset: Math.random() * (Math.random() < 0.5 ? -0.8 : 0.8),
      z,
      speed: MAX_SPEED / 4 + (Math.random() * MAX_SPEED) / (truck ? 4 : 2.5),
      percent: 0,
      color: truck
        ? TRUCK_COLORS[Math.floor(Math.random() * TRUCK_COLORS.length)]
        : CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
      truck,
    };
    this.findSegment(z).cars.push(car);
    this.cars.push(car);
  }

  private findSegment(z: number) {
    return this.segments[Math.floor(z / SEGMENT_LENGTH) % this.segments.length];
  }

  private say(text: string, color: string, life = 1.4, big = false) {
    this.messages.push({ text, color, age: 0, life, big });
    if (this.messages.length > 4) this.messages.shift();
  }

  private frame = (now: number) => {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (this.phase !== "paused") {
      this.acc += dt;
      while (this.acc > STEP) {
        this.acc -= STEP;
        this.update(STEP);
      }
    }
    if (this.width > 1) this.render();
    const active = this.phase === "playing" || this.phase === "countdown";
    this.sound.setEngine(this.speed / MAX_SPEED, active);
    this.raf = requestAnimationFrame(this.frame);
  };

  private update(dt: number) {
    this.t += dt;
    const playing = this.phase === "playing";
    const playerSegment = this.findSegment(this.position + PLAYER_Z);
    const speedPercent = this.speed / MAX_SPEED;
    const dx = dt * 2 * speedPercent;
    const startPosition = this.position;

    this.updateCars(dt, playerSegment);

    if (startPosition + dt * this.speed >= this.trackLength) {
      this.lap++;
      this.collected.clear();
    }
    this.position = increase(this.position, dt * this.speed, this.trackLength);

    if (playing) {
      if (this.keys.left) this.playerX -= dx;
      else if (this.keys.right) this.playerX += dx;
    } else {
      // Piloto automático da tela de menu: compensa a curva e volta pro centro.
      this.playerX += dx * speedPercent * playerSegment.curve * CENTRIFUGAL;
      this.playerX += limit(-this.playerX, -dx, dx) * 0.5;
    }
    this.playerX -= dx * speedPercent * playerSegment.curve * CENTRIFUGAL;

    const maxSpeed = this.nineTime > 0 ? MAX_SPEED * NINE_SPEED : MAX_SPEED;
    if (playing) {
      const gas = this.keys.up || (this.autoGas && !this.keys.down);
      if (gas) this.speed += ACCEL * dt * (this.speed > MAX_SPEED ? 0.3 : 1);
      else if (this.keys.down) this.speed += BREAKING * dt;
      else this.speed += DECEL * dt;
    } else if (this.phase === "attract") {
      this.speed += (this.speed < MAX_SPEED * 0.55 ? ACCEL : DECEL) * dt;
    } else {
      this.speed += DECEL * 1.5 * dt;
    }

    if (this.playerX < -1 || this.playerX > 1) {
      if (this.speed > OFF_ROAD_LIMIT) this.speed += OFF_ROAD_DECEL * dt;
      if (playing) {
        for (const sprite of playerSegment.sprites) {
          const box = spriteHitbox(sprite);
          if (box && overlap(this.playerX, CAR_WIDTH, box.x, box.w)) {
            if (this.speed > MAX_SPEED / 5) {
              this.sound.bump();
              this.shake = 0.35;
            }
            this.speed = MAX_SPEED / 5;
            this.setPositionBack(increase(playerSegment.p1.world.z, -PLAYER_Z, this.trackLength));
            break;
          }
        }
      }
    }

    if (playing) {
      for (const car of playerSegment.cars) {
        if (this.speed <= car.speed || !overlap(this.playerX, CAR_WIDTH, car.offset, CAR_WIDTH, 0.8)) continue;
        if (this.nineTime > 0) {
          // No 999 o que ia te parar vira ponto: o carro é arremessado pra fora.
          car.offset = car.offset >= this.playerX ? 2.4 : -2.4;
          this.score += 300;
          this.say("+300", "#ffd166", 0.8);
          this.sound.bump();
          this.shake = 0.2;
          continue;
        }
        this.speed = car.speed * (car.speed / this.speed);
        this.setPositionBack(increase(car.z, -PLAYER_Z, this.trackLength));
        if (this.invuln <= 0) {
          this.lives--;
          this.invuln = 2;
          this.combo = 0;
          this.shake = 0.6;
          this.sound.crash();
          if (this.lives <= 0) {
            this.endRun("crash");
            return;
          }
          this.say("-♥", "#ff2d55");
        }
        break;
      }
      this.collectHearts();
    }

    this.playerX = limit(this.playerX, -3, 3);
    this.speed = limit(this.speed, 0, maxSpeed);

    const travelled = (this.position - startPosition + this.trackLength) % this.trackLength;
    this.skyOffset += (0.001 * playerSegment.curve * travelled) / SEGMENT_LENGTH;
    this.cityOffset += (0.002 * playerSegment.curve * travelled) / SEGMENT_LENGTH;

    if (this.phase === "countdown") {
      const before = Math.ceil(this.countdown - 1);
      this.countdown -= dt;
      const after = Math.ceil(this.countdown - 1);
      if (after !== before) {
        if (after > 0) this.sound.beep(false);
        else if (after === 0) {
          this.sound.beep(true);
          this.say("VAI!", "#3df2ff", 0.9, true);
          this.setPhase("playing");
        }
      }
    }

    if (playing) {
      this.score += ((this.speed * dt) / 40) * (this.nineTime > 0 ? 2 : 1);
      this.timeLeft -= dt;
      const playerDistance = this.lap * this.trackLength + this.position + PLAYER_Z;
      if (playerDistance >= this.nextCheckpoint) this.passCheckpoint();
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.endRun("time");
        return;
      }
    }

    if (this.nineTime > 0) {
      this.nineTime -= dt;
      if (this.nineTime <= 0) this.say("de volta à noite", "#b26bff", 1.2);
    }
    this.invuln = Math.max(0, this.invuln - dt);
    this.shake = Math.max(0, this.shake - dt);
    for (const m of this.messages) m.age += dt;
    this.messages = this.messages.filter((m) => m.age < m.life);

    const wantRain = this.phase === "attract" || this.stage % 2 === 0 ? 1 : 0;
    this.rainAmount += (wantRain - this.rainAmount) * dt * 0.5;
  }

  private setPositionBack(z: number) {
    if (z > this.position + this.trackLength / 2) this.lap--;
    this.position = z;
  }

  private collectHearts() {
    const n = this.segments.length;
    const current = this.findSegment(this.position + PLAYER_Z).index;
    let i = this.lastHeartSegment;
    let guard = 0;
    while (i !== current && guard++ < 4) {
      i = (i + 1) % n;
      for (const sprite of this.segments[i].sprites) {
        if (sprite.kind !== "heart" || this.collected.has(sprite.id)) continue;
        if (!overlap(this.playerX, CAR_WIDTH, sprite.offset, HEART_WIDTH)) continue;
        this.collected.add(sprite.id);
        this.hearts++;
        const nine = this.nineTime > 0;
        this.score += nine ? 200 : 100;
        if (nine) {
          this.sound.pickup(9);
          continue;
        }
        this.combo++;
        this.sound.pickup(this.combo);
        if (this.combo >= 9) {
          this.combo = 0;
          this.nineTime = NINE_DURATION;
          this.lives = Math.min(MAX_LIVES, this.lives + 1);
          this.sound.nine();
          this.say("999", "#ffd166", 2, true);
        }
      }
    }
    this.lastHeartSegment = current;
  }

  private passCheckpoint() {
    this.stage++;
    const bonus = Math.max(12, Math.round(24 - this.stage * 1.5));
    this.timeLeft += bonus;
    this.score += 1000;
    this.nextCheckpoint += CHECKPOINT_SEGMENTS * SEGMENT_LENGTH;
    this.sound.checkpoint();
    this.say(`CHECKPOINT  +${bonus}s`, "#3df2ff", 2);
    for (let i = 0; i < 8 && this.cars.length < MAX_CARS; i++) this.addCar(false);
  }

  private endRun(reason: RunResult["reason"]) {
    const score = Math.floor(this.score);
    const newBest = score > this.best;
    if (newBest) {
      this.best = score;
      saveBest(score);
    }
    this.sound.crash();
    this.setPhase("over");
    this.callbacks.onGameOver({
      score,
      best: this.best,
      newBest,
      stage: this.stage,
      // Mesma escala do velocímetro: MAX_SPEED unidades/s = KMH_AT_MAX km/h.
      distanceKm: Math.max(0, ((this.lap * this.trackLength + this.position) / MAX_SPEED) * (KMH_AT_MAX / 3600)),
      hearts: this.hearts,
      reason,
    });
  }

  private updateCars(dt: number, playerSegment: Segment) {
    for (const car of this.cars) {
      const oldSegment = this.findSegment(car.z);
      car.offset += this.carSteer(car, oldSegment, playerSegment);
      car.z = increase(car.z, dt * car.speed, this.trackLength);
      car.percent = percentRemaining(car.z, SEGMENT_LENGTH);
      const newSegment = this.findSegment(car.z);
      if (oldSegment !== newSegment) {
        oldSegment.cars.splice(oldSegment.cars.indexOf(car), 1);
        newSegment.cars.push(car);
      }
    }
  }

  // IA simples de desvio: olha alguns segmentos à frente e se afasta de
  // quem estiver mais lento (incluindo você).
  private carSteer(car: Car, carSegment: Segment, playerSegment: Segment) {
    const n = this.segments.length;
    if ((carSegment.index - playerSegment.index + n) % n > DRAW_DISTANCE) return 0;
    for (let i = 1; i < 20; i++) {
      const segment = this.segments[(carSegment.index + i) % n];
      if (
        segment === playerSegment &&
        car.speed > this.speed &&
        overlap(this.playerX, CAR_WIDTH, car.offset, CAR_WIDTH, 1.2)
      ) {
        const dir = this.playerX > 0.5 ? -1 : this.playerX < -0.5 ? 1 : car.offset > this.playerX ? 1 : -1;
        return ((dir * 1) / i) * ((car.speed - this.speed) / MAX_SPEED);
      }
      for (const other of segment.cars) {
        if (car.speed > other.speed && overlap(car.offset, CAR_WIDTH, other.offset, CAR_WIDTH, 1.2)) {
          const dir = other.offset > 0.5 ? -1 : other.offset < -0.5 ? 1 : car.offset > other.offset ? 1 : -1;
          return ((dir * 1) / i) * ((car.speed - other.speed) / MAX_SPEED);
        }
      }
    }
    if (car.offset < -0.9) return 0.1;
    if (car.offset > 0.9) return -0.1;
    return 0;
  }

  private render() {
    const { ctx, width, height } = this;
    const nine = this.nineTime > 0;
    const pal = nine ? GOLD : NIGHT;
    const n = this.segments.length;

    const baseSegment = this.findSegment(this.position);
    const basePercent = percentRemaining(this.position, SEGMENT_LENGTH);
    const playerSegment = this.findSegment(this.position + PLAYER_Z);
    const playerPercent = percentRemaining(this.position + PLAYER_Z, SEGMENT_LENGTH);
    const playerY = interpolate(playerSegment.p1.world.y, playerSegment.p2.world.y, playerPercent);

    ctx.save();
    if (this.shake > 0) {
      const s = this.shake * height * 0.02;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    this.backdrop.draw(ctx, pal, this.skyOffset, this.cityOffset, this.t);

    let maxy = height;
    let x = 0;
    let dx = -(baseSegment.curve * basePercent);
    for (let i = 0; i < DRAW_DISTANCE; i++) {
      const segment = this.segments[(baseSegment.index + i) % n];
      segment.looped = segment.index < baseSegment.index;
      segment.fog = exponentialFog(i / DRAW_DISTANCE, FOG_DENSITY);
      segment.clip = maxy;
      const camZ = this.position - (segment.looped ? this.trackLength : 0);
      project(segment.p1, this.playerX * ROAD_WIDTH - x, playerY + CAMERA_HEIGHT, camZ, width, height);
      project(segment.p2, this.playerX * ROAD_WIDTH - x - dx, playerY + CAMERA_HEIGHT, camZ, width, height);
      x += dx;
      dx += segment.curve;
      if (
        segment.p1.camera.z <= CAMERA_DEPTH ||
        segment.p2.screen.y >= segment.p1.screen.y ||
        segment.p2.screen.y >= maxy
      )
        continue;
      drawSegment(
        ctx,
        width,
        LANES,
        segment.p1.screen.x,
        segment.p1.screen.y,
        segment.p1.screen.w,
        segment.p2.screen.x,
        segment.p2.screen.y,
        segment.p2.screen.w,
        segment.fog,
        segment.dark,
        pal,
      );
      maxy = segment.p1.screen.y;
    }

    for (let i = DRAW_DISTANCE - 1; i >= 0; i--) {
      const segment = this.segments[(baseSegment.index + i) % n];
      if (segment.p1.camera.z > CAMERA_DEPTH) {
        ctx.globalAlpha = Math.sqrt(segment.fog);
        const clipped = segment.clip < height;
        if (clipped) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, width, segment.clip);
          ctx.clip();
        }

        for (const car of segment.cars) {
          const scale = interpolate(segment.p1.screen.scale, segment.p2.screen.scale, car.percent);
          const k = (scale * width) / 2;
          const cx = interpolate(segment.p1.screen.x, segment.p2.screen.x, car.percent) + k * car.offset * ROAD_WIDTH;
          const cy = interpolate(segment.p1.screen.y, segment.p2.screen.y, car.percent);
          drawCar(ctx, cx, cy, CAR_WIDTH * ROAD_WIDTH * k, car.color, { truck: car.truck });
        }

        const k = (segment.p1.screen.scale * width) / 2;
        for (const sprite of segment.sprites) {
          if (sprite.kind === "heart" && this.collected.has(sprite.id)) continue;
          const sx = segment.p1.screen.x + k * sprite.offset * ROAD_WIDTH;
          const sy = segment.p1.screen.y;
          if (sprite.kind === "gate") {
            const label = segment.index === 0 && this.lap < 0 ? "LARGADA" : "CHECKPOINT";
            drawGate(ctx, segment.p1.screen.x, sy, segment.p1.screen.w, k, label, this.t);
          } else {
            drawRoadside(ctx, sprite, sx, sy, k, this.t);
          }
        }

        if (clipped) ctx.restore();
        ctx.globalAlpha = 1;
      }

      if (segment === playerSegment) this.drawPlayer(playerSegment, playerPercent);
    }

    this.drawRain();

    if (nine) {
      const pulse = 0.12 + 0.06 * Math.sin(this.t * 8);
      const g = ctx.createRadialGradient(width / 2, height / 2, height * 0.3, width / 2, height / 2, width * 0.7);
      g.addColorStop(0, "rgba(255,209,102,0)");
      g.addColorStop(1, `rgba(255,170,80,${pulse})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
    }

    ctx.restore();

    if (this.phase !== "attract") this.drawHud();
  }

  private drawPlayer(playerSegment: Segment, playerPercent: number) {
    const { ctx, width, height } = this;
    const speedPercent = this.speed / MAX_SPEED;
    const k = ((CAMERA_DEPTH / PLAYER_Z) * width) / 2;
    const camY = interpolate(playerSegment.p1.camera.y, playerSegment.p2.camera.y, playerPercent);
    const y = height / 2 - ((CAMERA_DEPTH / PLAYER_Z) * camY * height) / 2 - height * 0.02;
    const bounce = Math.random() * speedPercent * (width / 640) * (Math.random() < 0.5 ? -1 : 1);
    const steering = this.phase === "playing" && this.speed > 0;
    const lean = steering ? (this.keys.left ? -1 : this.keys.right ? 1 : 0) : 0;
    if (this.invuln > 0 && Math.floor(this.t * 12) % 2 === 0) ctx.globalAlpha = 0.35;
    drawCar(ctx, width / 2, y + bounce, CAR_WIDTH * ROAD_WIDTH * k, this.nineTime > 0 ? "#ffb627" : "#7b2cff", {
      lean,
      braking: this.phase === "playing" && this.keys.down,
      plate: "999",
    });
    ctx.globalAlpha = 1;
  }

  private drawRain() {
    if (this.rainAmount < 0.02) return;
    const { ctx, width, height } = this;
    const speedPercent = this.speed / MAX_SPEED;
    const slant = 0.15 + speedPercent * 0.25;
    ctx.strokeStyle = `rgba(190,170,255,${0.28 * this.rainAmount})`;
    ctx.lineWidth = Math.max(1, width / 900);
    ctx.beginPath();
    const count = Math.floor(this.rain.length * this.rainAmount);
    for (let i = 0; i < count; i++) {
      const d = this.rain[i];
      if (this.phase !== "paused") {
        d.y += d.v * (1 + speedPercent) * STEP;
        d.x -= slant * d.v * STEP * 0.5;
        if (d.y > 1) {
          d.y -= 1;
          d.x = Math.random() * 1.2;
        }
        if (d.x < 0) d.x += 1.2;
      }
      const x = d.x * width;
      const y = d.y * height;
      ctx.moveTo(x, y);
      ctx.lineTo(x + slant * d.len * height, y - d.len * height);
    }
    ctx.stroke();
  }

  private drawHud() {
    const { ctx, width, height } = this;
    const u = Math.min(height / 540, width / 760);
    const pad = 18 * u;
    const font = (size: number, weight = 900, italic = true) =>
      `${italic ? "italic " : ""}${weight} ${Math.round(size * u)}px system-ui, sans-serif`;

    ctx.textBaseline = "top";
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 6 * u;

    ctx.textAlign = "left";
    ctx.fillStyle = "#c9b8ff";
    ctx.font = font(12, 700, false);
    ctx.fillText("TEMPO", pad, pad);
    const low = this.timeLeft <= 10 && this.phase === "playing";
    ctx.fillStyle = low ? (Math.floor(this.t * 4) % 2 ? "#ff2d55" : "#ffffff") : "#ffffff";
    ctx.font = font(44);
    ctx.fillText(String(Math.ceil(this.timeLeft)), pad, pad + 14 * u);

    for (let i = 0; i < MAX_LIVES; i++) {
      ctx.shadowBlur = 0;
      drawHeart(
        ctx,
        pad + 12 * u + i * 26 * u,
        pad + 80 * u,
        22 * u,
        i < this.lives ? "#ff2d55" : "rgba(255,255,255,0.18)",
      );
    }
    ctx.shadowBlur = 6 * u;

    ctx.textAlign = "center";
    ctx.fillStyle = "#c9b8ff";
    ctx.font = font(12, 700, false);
    ctx.fillText(`ETAPA ${this.stage}`, width / 2, pad);
    ctx.fillStyle = "#ffffff";
    ctx.font = font(30);
    ctx.fillText(String(Math.floor(this.score)).padStart(7, "0"), width / 2, pad + 14 * u);

    const pipW = 14 * u;
    const pipGap = 5 * u;
    const pipsX = width / 2 - (9 * pipW + 8 * pipGap) / 2;
    const pipsY = pad + 52 * u;
    ctx.shadowBlur = 0;
    if (this.nineTime > 0) {
      const total = 9 * pipW + 8 * pipGap;
      ctx.fillStyle = "rgba(255,209,102,0.25)";
      ctx.fillRect(pipsX, pipsY, total, 8 * u);
      ctx.fillStyle = "#ffd166";
      ctx.fillRect(pipsX, pipsY, total * (this.nineTime / NINE_DURATION), 8 * u);
    } else {
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = i < this.combo ? "#ff2d95" : "rgba(255,255,255,0.15)";
        ctx.fillRect(pipsX + i * (pipW + pipGap), pipsY, pipW, 8 * u);
      }
    }
    ctx.fillStyle = this.nineTime > 0 ? "#ffd166" : "#c9b8ff";
    ctx.font = font(10, 700, false);
    ctx.fillText(this.nineTime > 0 ? "999 ATIVO" : "999", width / 2, pipsY + 12 * u);
    ctx.shadowBlur = 6 * u;

    ctx.textAlign = "right";
    ctx.fillStyle = "#c9b8ff";
    ctx.font = font(12, 700, false);
    ctx.fillText("KM/H", width - pad, pad);
    ctx.fillStyle = this.nineTime > 0 ? "#ffd166" : "#ffffff";
    ctx.font = font(44);
    ctx.fillText(String(Math.round((this.speed / MAX_SPEED) * KMH_AT_MAX)), width - pad, pad + 14 * u);
    ctx.fillStyle = "rgba(201,184,255,0.7)";
    ctx.font = font(11, 600, false);
    ctx.fillText(`RECORDE ${this.best}`, width - pad, pad + 66 * u);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (this.phase === "countdown") {
      const c = Math.ceil(this.countdown - 1);
      if (c > 0) {
        const p = 1 - (this.countdown - Math.floor(this.countdown));
        ctx.globalAlpha = 1 - p * 0.6;
        ctx.fillStyle = "#ffffff";
        ctx.font = font(120 * (1 + p * 0.3));
        ctx.fillText(String(c), width / 2, height * 0.38);
        ctx.globalAlpha = 1;
      }
    }

    let my = height * 0.34;
    for (const m of this.messages) {
      const p = m.age / m.life;
      const pop = Math.min(1, m.age * 8);
      ctx.globalAlpha = Math.min(1, (1 - p) * 3);
      ctx.fillStyle = m.color;
      ctx.shadowColor = m.color;
      ctx.shadowBlur = 18 * u;
      ctx.font = font((m.big ? 84 : 30) * (0.7 + 0.3 * pop));
      ctx.fillText(m.text, width / 2, my - p * 20 * u);
      my += (m.big ? 90 : 40) * u;
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }
}
