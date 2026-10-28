// Loop do jogo: física, drift e turbo, tráfego, colisões, etapas, modo 999 e HUD.
// A projeção da pista segue a técnica clássica de "pseudo-3D" por segmentos.

import { Sound } from "./audio";
import { CarDef, carById, CarStats, effectiveStats } from "./cars";
import {
  Backdrop,
  drawBrokenHeart,
  drawButterfly,
  drawCar,
  drawFlames,
  drawGate,
  drawHeart,
  drawOverpass,
  drawRoadside,
  drawSegment,
  GOLD,
  makeScanlines,
  mixPalette,
  Palette,
} from "./draw";
import { loadProgress, recordRun, updateProgress } from "./progress";
import { Stage, stageAt } from "./stages";
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
  spriteHitboxes,
} from "./track";

export type Phase = "attract" | "countdown" | "playing" | "paused" | "over";

export interface RunResult {
  score: number;
  best: number;
  newBest: boolean;
  stage: number;
  stageName: string;
  distanceKm: number;
  hearts: number;
  earned: number;
  wallet: number;
  maxMult: number;
  nearMisses: number;
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
const BOOST_SPEED = 1.25;
const BASE_CARS = 50;
const MAX_CARS = 130;
const MAX_MULT = 9;
const NEAR_GAP = 0.52; // até onde (em larguras de pista) uma passada conta como raspão
const STAGE_CARD = 4; // segundos que o nome da etapa fica na tela

// Carga do drift necessária pra cada nível de turbo, e quanto cada um dura.
const DRIFT_LEVELS = [0.9, 2, 3.4];
const BOOST_TIME = [0, 0.9, 1.5, 2.3];
const DRIFT_COLORS = ["#ffffff", "#3df2ff", "#ff9a3d", "#ff2d95"];

const CAR_COLORS = ["#3df2ff", "#e9e3f5", "#2b4bff", "#ff8a3d", "#1fd18b", "#a9a9c2", "#ff3d7f"];
const TRUCK_COLORS = ["#5b4a73", "#8a8aa0", "#3a2f4d", "#6d2a3a"];
const BUTTERFLY_COLORS = ["#ffd166", "#ff2d95", "#3df2ff", "#b26bff"];

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

interface Particle {
  kind: "spark" | "smoke" | "butterfly";
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  color: string;
  phase: number;
}

type Key = "left" | "right" | "up" | "down" | "drift";

const KEYMAP: Record<string, Key> = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  Space: "drift",
  ShiftLeft: "drift",
  ShiftRight: "drift",
  KeyX: "drift",
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
  private scanlines: HTMLCanvasElement | null = null;
  private crt = true;
  private idle = false;
  private segments: Segment[];
  private trackLength: number;
  private cars: Car[] = [];
  private width = 0;
  private height = 0;
  private font = "";

  private car: CarDef;
  private stats: CarStats;

  private phase: Phase = "attract";
  private pausedFrom: Phase = "playing";
  private keys: Record<Key, boolean> = { left: false, right: false, up: false, down: false, drift: false };
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
  private earned = 0;
  private combo = 0;
  private nineTime = 0;
  private invuln = 0;
  private best = 0;

  private drifting = false;
  private driftDir = 0;
  private driftCharge = 0;
  private driftPoints = 0;
  private boostTime = 0;
  private boostLevel = 0;
  private mult = 1;
  private multTimer = 0;
  private maxMult = 1;
  private nearMisses = 0;

  private stageNum = 1;
  private stage: Stage = stageAt(1);
  private palette: Palette = this.stage.palette;
  private fromPalette: Palette = this.stage.palette;
  private paletteT = 1;
  private fogDensity = this.stage.fog;
  private stageCard = 0;

  private messages: Message[] = [];
  private particles: Particle[] = [];
  private rain: Drop[] = [];
  private rainAmount = 0;
  private lightning = 0;
  private nextLightning = 3;
  private heartbreak = -1;
  private shake = 0;
  private skyOffset = 0;
  private cityOffset = 0;
  private playerScreen = { x: 0, y: 0, w: 0 };
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
    const progress = loadProgress();
    this.best = progress.best;
    this.car = carById(progress.car);
    this.stats = effectiveStats(this.car, progress.upgrades);
    for (let i = 0; i < 160; i++) {
      this.rain.push({
        x: Math.random(),
        y: Math.random(),
        len: 0.02 + Math.random() * 0.04,
        v: 1.2 + Math.random() * 0.8,
      });
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
    this.scanlines = makeScanlines(this.width, this.height);
  }

  // Parado atrás da tela inicial: não simula nem desenha.
  setIdle(idle: boolean) {
    this.idle = idle;
    this.last = performance.now();
    this.acc = 0;
  }

  setCrt(on: boolean) {
    this.crt = on;
  }

  // Família da fonte de display (vinda do CSS), usada no HUD e nos letreiros.
  setFont(family: string) {
    this.font = family.trim();
  }

  // Relê o carro escolhido e os upgrades depois de mexer na garagem.
  refreshCar() {
    const progress = loadProgress();
    this.car = carById(progress.car);
    this.stats = effectiveStats(this.car, progress.upgrades);
    this.best = progress.best;
  }

  getPhase() {
    return this.phase;
  }

  getBest() {
    return this.best;
  }

  start() {
    this.sound.init();
    this.sound.setVariant(stageAt(1).music);
    this.sound.startMusic();
    this.sound.setMuffled(false);
    this.refreshCar();
    this.resetRun();
    this.countdown = 3.999;
    this.sound.beep(false);
    this.setPhase("countdown");
  }

  togglePause() {
    if (this.phase === "playing" || this.phase === "countdown") {
      this.pausedFrom = this.phase;
      this.endDrift(false);
      this.setPhase("paused");
      this.sound.setMuffled(true);
    } else if (this.phase === "paused") {
      this.setPhase(this.pausedFrom);
      this.sound.setMuffled(false);
    }
  }

  quitToMenu() {
    // Os corações pegos até aqui vão pra garagem mesmo saindo no meio.
    if (this.phase !== "over" && this.earned > 0) {
      const earned = this.earned;
      updateProgress((p) => {
        p.hearts += earned;
      });
      this.earned = 0;
    }
    this.endDrift(false);
    this.boostTime = 0;
    this.nineTime = 0;
    this.setPhase("attract");
    this.speed = Math.max(this.speed, MAX_SPEED * 0.3);
    this.sound.setMuffled(true);
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
    this.earned = 0;
    this.combo = 0;
    this.nineTime = 0;
    this.invuln = 0;
    this.drifting = false;
    this.driftCharge = 0;
    this.boostTime = 0;
    this.mult = 1;
    this.multTimer = 0;
    this.maxMult = 1;
    this.nearMisses = 0;
    this.heartbreak = -1;
    this.setStage(1, true);
    this.messages = [];
    this.particles = [];
    this.shake = 0;
    for (let i = 0; i < BASE_CARS; i++) this.addCar(true);
  }

  private setStage(n: number, instant = false) {
    this.stageNum = n;
    this.stage = stageAt(n);
    this.fromPalette = instant ? this.stage.palette : this.palette;
    this.paletteT = instant ? 1 : 0;
    if (instant) {
      this.palette = this.stage.palette;
      this.fogDensity = this.stage.fog;
    }
    this.sound.setVariant(this.stage.music);
    this.stageCard = instant ? 0 : STAGE_CARD;
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
      near: false,
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

  private bumpMult(by: number) {
    this.mult = Math.min(MAX_MULT, this.mult + by);
    this.maxMult = Math.max(this.maxMult, this.mult);
    this.multTimer = 5;
  }

  private driftLevel() {
    let level = 0;
    for (const need of DRIFT_LEVELS) if (this.driftCharge >= need) level++;
    return level;
  }

  // Sai do drift. Com boost=true, o nível carregado vira turbo e pontos.
  private endDrift(boost: boolean) {
    if (!this.drifting) return;
    const level = this.driftLevel();
    this.drifting = false;
    this.sound.setDrift(false, 0);
    if (!boost || level === 0) return;
    this.boostLevel = level;
    this.boostTime = BOOST_TIME[level] * (0.8 + 0.2 * this.stats.turbo);
    const points = Math.round(this.driftPoints * this.mult);
    this.score += points;
    this.bumpMult(level);
    this.sound.boost(level);
    this.say(`DRIFT +${points}`, DRIFT_COLORS[level], 1.2);
    this.say(level === 3 ? "TURBO MÁXIMO" : "TURBO", DRIFT_COLORS[level], 1);
  }

  private frame = (now: number) => {
    if (this.idle) {
      this.sound.setEngine(0, false);
      this.raf = requestAnimationFrame(this.frame);
      return;
    }
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
    if (this.drifting) this.sound.setDrift(true, this.driftLevel());
    this.raf = requestAnimationFrame(this.frame);
  };

  private update(dt: number) {
    this.t += dt;
    const playing = this.phase === "playing";
    const playerSegment = this.findSegment(this.position + PLAYER_Z);
    const speedPercent = this.speed / MAX_SPEED;
    const dx = dt * 2 * speedPercent;
    const startPosition = this.position;
    const steer = this.keys.left ? -1 : this.keys.right ? 1 : 0;

    this.updateCars(dt, playerSegment);

    if (startPosition + dt * this.speed >= this.trackLength) {
      this.lap++;
      this.collected.clear();
    }
    this.position = increase(this.position, dt * this.speed, this.trackLength);

    // Drift: segurar o botão de drift virando em alta velocidade.
    if (playing) {
      const onRoad = Math.abs(this.playerX) <= 1;
      if (!this.drifting && this.keys.drift && steer !== 0 && this.speed > MAX_SPEED * 0.45 && onRoad) {
        this.drifting = true;
        this.driftDir = steer;
        this.driftCharge = 0;
        this.driftPoints = 0;
      } else if (this.drifting) {
        if (!this.keys.drift) this.endDrift(true);
        else if (Math.abs(this.playerX) > 1.25 || this.speed < MAX_SPEED * 0.3) this.endDrift(false);
      }
    }

    if (playing) {
      if (this.drifting) {
        // A traseira escorrega pra dentro da curva; a direção só dosa o ângulo.
        // Virando junto fecha a curva, soltando escorrega pouco e contra-esterçando volta.
        const same = steer === this.driftDir ? 1 : steer === -this.driftDir ? -1 : 0;
        this.playerX += this.driftDir * dx * (same === 1 ? 0.75 : same === 0 ? 0.3 : -0.4);
        const before = this.driftLevel();
        this.driftCharge += dt * (1 + Math.abs(playerSegment.curve) * 0.35) * speedPercent * this.stats.turbo;
        this.driftPoints += (this.speed * dt) / 60;
        const after = this.driftLevel();
        if (after > before) this.sound.pickup(after * 3);
      } else {
        this.playerX += steer * dx;
      }
    } else {
      // Piloto automático da tela de menu: compensa a curva e volta pro centro.
      this.playerX += dx * speedPercent * playerSegment.curve * CENTRIFUGAL;
      this.playerX += limit(-this.playerX, -dx, dx) * 0.5;
    }
    const centrifugal = (this.drifting ? 0.3 : 1) / (playing ? this.stats.grip : 1);
    this.playerX -= dx * speedPercent * playerSegment.curve * CENTRIFUGAL * centrifugal;

    let maxSpeed = MAX_SPEED * (playing ? this.stats.speed : 1);
    if (this.nineTime > 0) maxSpeed *= NINE_SPEED;
    if (this.boostTime > 0) maxSpeed *= BOOST_SPEED;
    if (playing) {
      const gas = this.keys.up || (this.autoGas && !this.keys.down);
      const accel = ACCEL * this.stats.accel;
      if (this.boostTime > 0) this.speed += accel * 2.5 * dt;
      else if (this.keys.down) this.speed += BREAKING * dt;
      else if (this.keys.drift && !this.drifting) this.speed += BREAKING * 0.6 * dt;
      else if (gas) this.speed += accel * dt * (this.speed > MAX_SPEED ? 0.3 : 1);
      else this.speed += DECEL * dt;
      if (this.drifting) this.speed += DECEL * 0.25 * dt;
    } else if (this.phase === "attract") {
      this.speed += (this.speed < MAX_SPEED * 0.55 ? ACCEL : DECEL) * dt;
    } else {
      this.speed += DECEL * 1.5 * dt;
    }

    if (this.playerX < -1 || this.playerX > 1) {
      if (this.speed > OFF_ROAD_LIMIT) this.speed += OFF_ROAD_DECEL * dt * (this.boostTime > 0 ? 0.5 : 1);
      if (playing) {
        for (const sprite of playerSegment.sprites) {
          if (!this.spriteVisible(sprite.kind, sprite.offset)) continue;
          if (!spriteHitboxes(sprite).some((box) => overlap(this.playerX, CAR_WIDTH, box.x, box.w))) continue;
          if (this.speed > MAX_SPEED / 5) {
            this.sound.bump();
            this.shake = 0.35;
          }
          this.speed = MAX_SPEED / 5;
          this.boostTime = 0;
          this.setPositionBack(increase(playerSegment.p1.world.z, -PLAYER_Z, this.trackLength));
          break;
        }
      }
    }

    if (playing) {
      if (this.checkTraffic(playerSegment)) return;
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
          this.stageCard = STAGE_CARD;
          this.setPhase("playing");
        }
      }
    }

    if (playing) {
      this.score += ((this.speed * dt) / 40) * this.mult * (this.nineTime > 0 ? 2 : 1);
      this.timeLeft -= dt;
      const playerDistance = this.lap * this.trackLength + this.position + PLAYER_Z;
      if (playerDistance >= this.nextCheckpoint) this.passCheckpoint();
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.endRun("time");
        return;
      }
      if (this.multTimer > 0) {
        this.multTimer -= dt;
        if (this.multTimer <= 0 && this.mult > 1) {
          this.mult--;
          this.multTimer = this.mult > 1 ? 2.5 : 0;
        }
      }
    }

    if (this.nineTime > 0) {
      this.nineTime -= dt;
      if (this.nineTime <= 0) this.say("de volta à noite", "#b26bff", 1.2);
    }
    this.boostTime = Math.max(0, this.boostTime - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.shake = Math.max(0, this.shake - dt);
    this.stageCard = Math.max(0, this.stageCard - dt);
    if (this.heartbreak >= 0) {
      this.heartbreak += dt;
      if (this.heartbreak > 1.3) this.heartbreak = -1;
    }
    for (const m of this.messages) m.age += dt;
    this.messages = this.messages.filter((m) => m.age < m.life);

    if (this.paletteT < 1) {
      this.paletteT = Math.min(1, this.paletteT + dt / 2.5);
      this.palette = mixPalette(this.fromPalette, this.stage.palette, this.paletteT);
    }
    this.fogDensity += (this.stage.fog - this.fogDensity) * dt;
    const wantRain = this.phase === "attract" ? 0.6 : this.stage.rain;
    this.rainAmount += (wantRain - this.rainAmount) * dt * 0.5;

    if (this.stage.lightning && this.phase !== "attract") {
      this.nextLightning -= dt;
      if (this.nextLightning <= 0) {
        this.lightning = 1;
        this.nextLightning = 4 + Math.random() * 6;
        this.sound.thunder();
      }
    }
    this.lightning = Math.max(0, this.lightning - dt * 2.5);

    this.updateParticles(dt);
  }

  // Colisão e raspão com o tráfego. Retorna true se a corrida acabou.
  private checkTraffic(playerSegment: Segment) {
    const n = this.segments.length;
    for (const car of playerSegment.cars) {
      if (this.speed <= car.speed || !overlap(this.playerX, CAR_WIDTH, car.offset, CAR_WIDTH, 0.8)) continue;
      car.near = false;
      if (this.nineTime > 0) {
        // No 999 o que ia te parar vira ponto: o carro é arremessado pra fora.
        car.offset = car.offset >= this.playerX ? 2.4 : -2.4;
        this.score += 300 * this.mult;
        this.say(`+${300 * this.mult}`, "#ffd166", 0.8);
        this.sound.bump();
        this.shake = 0.2;
        continue;
      }
      this.speed = car.speed * (car.speed / this.speed);
      this.setPositionBack(increase(car.z, -PLAYER_Z, this.trackLength));
      this.endDrift(false);
      this.boostTime = 0;
      if (this.invuln <= 0) {
        this.lives--;
        this.invuln = 2;
        this.combo = 0;
        this.mult = 1;
        this.multTimer = 0;
        this.shake = 0.6;
        this.heartbreak = 0;
        this.sound.heartbreak();
        if (this.lives <= 0) {
          this.endRun("crash");
          return true;
        }
        this.say("HEARTBREAK", "#ff2d55", 1.2);
      }
      return false;
    }

    // Marca quem passou perto e paga o bônus quando o carro fica pra trás.
    for (let i = 0; i <= 1; i++) {
      for (const car of this.segments[(playerSegment.index + i) % n].cars) {
        const gap = Math.abs(car.offset - this.playerX);
        if (this.speed > car.speed && gap < NEAR_GAP && gap >= CAR_WIDTH * 0.8) car.near = true;
      }
    }
    for (let i = 1; i <= 3; i++) {
      for (const car of this.segments[(playerSegment.index - i + n) % n].cars) {
        if (!car.near) continue;
        car.near = false;
        this.nearMisses++;
        this.bumpMult(1);
        const points = 250 * this.mult;
        this.score += points;
        this.sound.nearMiss(this.mult);
        this.say(`RASPÃO +${points}`, "#3df2ff", 0.9);
      }
    }
    return false;
  }

  private spriteVisible(kind: string, offset: number) {
    if (kind === "overpass") return !!this.stage.train;
    if (this.stage.lake && offset < -1.5 && kind !== "heart") return false;
    return true;
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
        this.earned += this.stage.heartValue;
        const nine = this.nineTime > 0;
        this.score += (nine ? 200 : 100) * this.mult;
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
          for (let b = 0; b < 24; b++) this.spawnButterfly(true);
        }
      }
    }
    this.lastHeartSegment = current;
  }

  private passCheckpoint() {
    const bonus = Math.max(12, Math.round(24 - (this.stageNum + 1) * 1.5));
    this.timeLeft += bonus;
    this.score += 1000;
    this.nextCheckpoint += CHECKPOINT_SEGMENTS * SEGMENT_LENGTH;
    this.sound.checkpoint();
    this.say(`CHECKPOINT  +${bonus}s`, "#3df2ff", 2);
    this.setStage(this.stageNum + 1);
    for (let i = 0; i < 8 && this.cars.length < MAX_CARS; i++) this.addCar(false);
  }

  private endRun(reason: RunResult["reason"]) {
    const score = Math.floor(this.score);
    const newBest = score > this.best;
    const earned = this.earned;
    const stageNum = this.stageNum;
    const stageName = this.stage.name;
    const carId = this.car.id;
    const progress = updateProgress((p) => {
      p.hearts += earned;
      if (newBest) p.best = score;
      recordRun(p, { score, stage: stageNum, stageName, car: carId, date: Date.now() });
    });
    this.earned = 0;
    this.best = progress.best;
    this.endDrift(false);
    this.boostTime = 0;
    this.setPhase("over");
    this.sound.setMuffled(true);
    this.callbacks.onGameOver({
      score,
      best: this.best,
      newBest,
      stage: this.stageNum,
      stageName: this.stage.name,
      // Mesma escala do velocímetro: MAX_SPEED unidades/s = KMH_AT_MAX km/h.
      distanceKm: Math.max(0, ((this.lap * this.trackLength + this.position) / MAX_SPEED) * (KMH_AT_MAX / 3600)),
      hearts: this.hearts,
      earned,
      wallet: progress.hearts,
      maxMult: this.maxMult,
      nearMisses: this.nearMisses,
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

  private spawnButterfly(burst: boolean) {
    const { width, height } = this;
    const fromCar = burst && this.playerScreen.w > 0;
    this.particles.push({
      kind: "butterfly",
      x: fromCar ? this.playerScreen.x + (Math.random() - 0.5) * this.playerScreen.w : Math.random() * width,
      y: fromCar ? this.playerScreen.y - this.playerScreen.w * 0.3 : height * (0.75 + Math.random() * 0.3),
      vx: (Math.random() - 0.5) * width * (burst ? 0.5 : 0.15),
      vy: -height * (burst ? 0.35 + Math.random() * 0.35 : 0.12 + Math.random() * 0.12),
      age: 0,
      life: burst ? 2.2 : 4.5,
      size: height * (0.018 + Math.random() * 0.018),
      color: BUTTERFLY_COLORS[Math.floor(Math.random() * BUTTERFLY_COLORS.length)],
      phase: Math.random() * 6,
    });
  }

  private updateParticles(dt: number) {
    const { x, y, w } = this.playerScreen;
    if (w > 0 && this.phase === "playing") {
      for (const side of [-1, 1]) {
        const wx = x + side * w * 0.38;
        if (this.drifting) {
          const level = this.driftLevel();
          const count = level > 0 ? 3 : 1;
          for (let i = 0; i < count; i++) {
            this.particles.push({
              kind: "spark",
              x: wx,
              y,
              vx: (-this.driftDir * (0.2 + Math.random() * 0.6) + (Math.random() - 0.5) * 0.4) * w * 2,
              vy: -(0.3 + Math.random()) * w * 1.5,
              age: 0,
              life: 0.25 + Math.random() * 0.2,
              size: w * (0.012 + Math.random() * 0.012),
              color: DRIFT_COLORS[level],
              phase: 0,
            });
          }
        }
        if (this.drifting || (Math.abs(this.playerX) > 1 && this.speed > OFF_ROAD_LIMIT)) {
          this.particles.push({
            kind: "smoke",
            x: wx,
            y: y - w * 0.02,
            vx: (Math.random() - 0.5) * w * 0.6,
            vy: -w * (0.15 + Math.random() * 0.2),
            age: 0,
            life: 0.5,
            size: w * 0.045,
            color: "200,190,230",
            phase: 0,
          });
        }
      }
    }
    const ambient = this.stage.butterflies || this.nineTime > 0 || (this.car.id === "wrld" && this.boostTime > 0);
    if (ambient && this.phase !== "attract" && Math.random() < dt * 6) this.spawnButterfly(false);

    for (const p of this.particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === "spark") p.vy += w * 6 * dt;
      if (p.kind === "smoke") p.size *= 1 + dt * 2.2;
      if (p.kind === "butterfly") {
        p.phase += dt * 18;
        p.vx += Math.sin(p.age * 3 + p.size) * this.width * 0.4 * dt;
      }
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
    if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400);
  }

  private fontSpec(size: number) {
    return this.font ? `${Math.round(size)}px ${this.font}` : `italic 900 ${Math.round(size)}px system-ui, sans-serif`;
  }

  private render() {
    const { ctx, width, height } = this;
    const nine = this.nineTime > 0;
    const pal = nine ? GOLD : this.palette;
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
    if (this.stage.sirens && !nine) this.drawSirens();

    let maxy = height;
    let x = 0;
    let dx = -(baseSegment.curve * basePercent);
    for (let i = 0; i < DRAW_DISTANCE; i++) {
      const segment = this.segments[(baseSegment.index + i) % n];
      segment.looped = segment.index < baseSegment.index;
      segment.fog = exponentialFog(i / DRAW_DISTANCE, this.fogDensity);
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
        !!this.stage.lake,
      );
      maxy = segment.p1.screen.y;
    }

    const font = this.font || "system-ui, sans-serif";
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
          if (!this.spriteVisible(sprite.kind, sprite.offset)) continue;
          const sx = segment.p1.screen.x + k * sprite.offset * ROAD_WIDTH;
          const sy = segment.p1.screen.y;
          if (sprite.kind === "gate") {
            const label = segment.index === 0 && this.lap < 0 ? "LARGADA" : "CHECKPOINT";
            drawGate(ctx, segment.p1.screen.x, sy, segment.p1.screen.w, k, label, this.t, font);
          } else if (sprite.kind === "overpass") {
            drawOverpass(ctx, segment.p1.screen.x, sy, segment.p1.screen.w, k, this.t, sprite.id);
          } else {
            const texts = this.stage.billboards;
            drawRoadside(ctx, sprite, sx, sy, k, this.t, {
              text: texts[sprite.id % texts.length],
              eyes: this.stage.eyes,
            });
          }
        }

        if (clipped) ctx.restore();
        ctx.globalAlpha = 1;
      }

      if (segment === playerSegment) this.drawPlayer(playerSegment, playerPercent);
    }

    this.drawParticles();
    this.drawRain();
    if (this.boostTime > 0) this.drawSpeedLines();

    if (nine) {
      const pulse = 0.12 + 0.06 * Math.sin(this.t * 8);
      const g = ctx.createRadialGradient(width / 2, height / 2, height * 0.3, width / 2, height / 2, width * 0.7);
      g.addColorStop(0, "rgba(255,209,102,0)");
      g.addColorStop(1, `rgba(255,170,80,${pulse})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
    }
    if (this.lightning > 0) {
      ctx.fillStyle = `rgba(230,220,255,${this.lightning * 0.45})`;
      ctx.fillRect(0, 0, width, height);
    }

    ctx.restore();

    if (this.crt && this.scanlines) ctx.drawImage(this.scanlines, 0, 0);
    if (this.phase !== "attract") this.drawHud();
  }

  private drawSirens() {
    const { ctx, width, height } = this;
    const red = Math.floor(this.t * 3) % 2 === 0;
    const g = ctx.createRadialGradient(
      red ? width * 0.2 : width * 0.8,
      height * 0.5,
      0,
      red ? width * 0.2 : width * 0.8,
      height * 0.5,
      width * 0.5,
    );
    g.addColorStop(0, red ? "rgba(255,30,60,0.28)" : "rgba(40,90,255,0.28)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height * 0.5);
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
    const w = CAR_WIDTH * ROAD_WIDTH * k;
    const yaw = this.drifting ? this.driftDir * (0.1 + 0.02 * Math.sin(this.t * 30)) : 0;
    const cx = width / 2 + (this.drifting ? -this.driftDir * w * 0.06 : 0);
    this.playerScreen = { x: cx, y: y + bounce, w };

    if (this.boostTime > 0) drawFlames(ctx, cx, y + bounce, w, this.t, DRIFT_COLORS[this.boostLevel]);
    if (this.invuln > 0 && Math.floor(this.t * 12) % 2 === 0) ctx.globalAlpha = 0.35;
    const nine = this.nineTime > 0;
    drawCar(ctx, cx, y + bounce, w, nine ? "#ffb627" : this.car.color, {
      lean,
      yaw,
      braking: this.phase === "playing" && (this.keys.down || (this.keys.drift && !this.drifting)),
      plate: this.car.plate,
      accent: nine ? "#1a1030" : this.car.accent,
      spoiler: this.car.spoiler,
      stripes: this.car.stripes,
    });
    ctx.globalAlpha = 1;
  }

  private drawParticles() {
    const { ctx } = this;
    for (const p of this.particles) {
      const a = 1 - p.age / p.life;
      if (p.kind === "spark") {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      } else if (p.kind === "smoke") {
        ctx.fillStyle = `rgba(${p.color},${0.12 * a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalAlpha = Math.min(1, a * 2);
        drawButterfly(ctx, p.x, p.y, p.size, p.phase, p.color, Math.atan2(p.vx, -p.vy) * 0.5);
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawSpeedLines() {
    const { ctx, width, height } = this;
    const cx = width / 2;
    const cy = height * 0.45;
    ctx.strokeStyle = `rgba(255,255,255,${0.12 + 0.1 * this.boostLevel})`;
    ctx.lineWidth = Math.max(1, width / 600);
    ctx.beginPath();
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const r0 = width * (0.3 + Math.random() * 0.25);
      const r1 = r0 + width * (0.08 + Math.random() * 0.15);
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.6);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.6);
    }
    ctx.stroke();
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
    const label = (size: number) => `700 ${Math.round(size * u)}px system-ui, sans-serif`;
    const big = (size: number) => this.fontSpec(size * u);

    ctx.textBaseline = "top";
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 6 * u;

    ctx.textAlign = "left";
    ctx.fillStyle = "#c9b8ff";
    ctx.font = label(12);
    ctx.fillText("TEMPO", pad, pad);
    const low = this.timeLeft <= 10 && this.phase === "playing";
    ctx.fillStyle = low ? (Math.floor(this.t * 4) % 2 ? "#ff2d55" : "#ffffff") : "#ffffff";
    ctx.font = big(44);
    ctx.fillText(String(Math.ceil(this.timeLeft)), pad, pad + 14 * u);

    ctx.shadowBlur = 0;
    for (let i = 0; i < MAX_LIVES; i++) {
      const hx = pad + 12 * u + i * 26 * u;
      const hy = pad + 80 * u;
      if (i < this.lives) drawHeart(ctx, hx, hy, 22 * u, "#ff2d55");
      else drawBrokenHeart(ctx, hx, hy, 22 * u, 0.25, "rgba(255,255,255,0.2)");
    }
    ctx.shadowBlur = 6 * u;

    ctx.textAlign = "center";
    ctx.fillStyle = "#c9b8ff";
    ctx.font = label(12);
    ctx.fillText(`ETAPA ${this.stageNum} · ${this.stage.name}`, width / 2, pad);
    ctx.fillStyle = "#ffffff";
    ctx.font = big(30);
    const scoreText = String(Math.floor(this.score)).padStart(7, "0");
    ctx.fillText(scoreText, width / 2, pad + 14 * u);
    if (this.mult > 1) {
      const sw = ctx.measureText(scoreText).width;
      const pulse = 1 + 0.08 * Math.sin(this.t * 10);
      ctx.textAlign = "left";
      ctx.fillStyle = this.mult >= MAX_MULT ? "#ffd166" : "#ff2d95";
      ctx.font = big((18 + this.mult * 1.5) * pulse);
      ctx.fillText(`x${this.mult}`, width / 2 + sw / 2 + 8 * u, pad + 16 * u);
      ctx.textAlign = "center";
    }

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
    ctx.font = label(10);
    ctx.fillText(this.nineTime > 0 ? "999 ATIVO" : "999", width / 2, pipsY + 12 * u);
    ctx.shadowBlur = 6 * u;

    ctx.textAlign = "right";
    ctx.fillStyle = "#c9b8ff";
    ctx.font = label(12);
    ctx.fillText("KM/H", width - pad, pad);
    ctx.fillStyle = this.boostTime > 0 ? DRIFT_COLORS[this.boostLevel] : this.nineTime > 0 ? "#ffd166" : "#ffffff";
    ctx.font = big(44);
    ctx.fillText(String(Math.round((this.speed / MAX_SPEED) * KMH_AT_MAX)), width - pad, pad + 14 * u);
    ctx.fillStyle = "rgba(201,184,255,0.75)";
    ctx.font = label(11);
    ctx.fillText(`♥ ${this.earned}   RECORDE ${this.best}`, width - pad, pad + 66 * u);

    // Medidor do drift logo acima do carro.
    if (this.drifting && this.playerScreen.w > 0) {
      const level = this.driftLevel();
      const mw = 22 * u;
      const gap = 5 * u;
      const mx = this.playerScreen.x - (3 * mw + 2 * gap) / 2;
      const my = this.playerScreen.y - this.playerScreen.w * 0.64;
      ctx.shadowBlur = 0;
      for (let i = 0; i < 3; i++) {
        const from = i === 0 ? 0 : DRIFT_LEVELS[i - 1];
        const fill = limit((this.driftCharge - from) / (DRIFT_LEVELS[i] - from), 0, 1);
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(mx + i * (mw + gap), my, mw, 7 * u);
        ctx.fillStyle = DRIFT_COLORS[i + 1];
        ctx.fillRect(mx + i * (mw + gap), my, mw * fill, 7 * u);
      }
      ctx.textAlign = "center";
      ctx.fillStyle = DRIFT_COLORS[level];
      ctx.font = big(14);
      ctx.fillText("DRIFT", this.playerScreen.x, my - 18 * u);
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (this.phase === "countdown") {
      const c = Math.ceil(this.countdown - 1);
      if (c > 0) {
        const p = 1 - (this.countdown - Math.floor(this.countdown));
        ctx.globalAlpha = 1 - p * 0.6;
        ctx.fillStyle = "#ffffff";
        ctx.font = big(120 * (1 + p * 0.3));
        ctx.fillText(String(c), width / 2, height * 0.38);
        ctx.globalAlpha = 1;
      }
    }

    // Cartão da etapa, como uma faixa do álbum entrando.
    if (this.stageCard > 0 && this.phase !== "countdown") {
      const age = STAGE_CARD - this.stageCard;
      const inP = Math.min(1, age * 3);
      const outP = Math.min(1, this.stageCard * 2);
      ctx.globalAlpha = Math.min(inP, outP);
      const slide = (1 - inP) * -60 * u;
      const cy = height * 0.27;
      // Faixa centralizada, estreita o bastante pra não cobrir os botões de pausa e som.
      const bw = Math.min(width - 2 * 150 * u, 620 * u);
      const bx = (width - bw) / 2;
      ctx.fillStyle = "rgba(10,4,20,0.6)";
      ctx.fillRect(bx, cy - 34 * u, bw, 68 * u);
      ctx.fillStyle = "#ff2d95";
      ctx.fillRect(bx, cy - 34 * u, bw, 2 * u);
      ctx.fillRect(bx, cy + 32 * u, bw, 2 * u);
      ctx.fillStyle = "#c9b8ff";
      ctx.font = label(12);
      ctx.fillText(`ETAPA ${this.stageNum}`, width / 2 + slide, cy - 18 * u);
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#ff2d95";
      ctx.shadowBlur = 18 * u;
      ctx.font = big(36);
      ctx.fillText(this.stage.name, width / 2 + slide, cy + 10 * u, bw * 0.94);
      ctx.globalAlpha = 1;
    }

    if (this.heartbreak >= 0) {
      const a = this.heartbreak;
      const split = limit((a - 0.15) / 0.5, 0, 1);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = a > 0.9 ? Math.max(0, 1 - (a - 0.9) / 0.4) : 1;
      drawBrokenHeart(ctx, width / 2, height * 0.42, height * 0.16, split * (2 - split), "#ff2d55");
      ctx.globalAlpha = 1;
    }

    let my = height * 0.4;
    for (const m of this.messages) {
      const p = m.age / m.life;
      const pop = Math.min(1, m.age * 8);
      ctx.globalAlpha = Math.min(1, (1 - p) * 3);
      ctx.fillStyle = m.color;
      ctx.shadowColor = m.color;
      ctx.shadowBlur = 18 * u;
      ctx.font = big((m.big ? 84 : 28) * (0.7 + 0.3 * pop));
      ctx.fillText(m.text, width / 2, my - p * 20 * u, width * 0.92);
      my += (m.big ? 90 : 38) * u;
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }
}
