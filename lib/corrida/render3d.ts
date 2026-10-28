// Corrida em 3D de verdade com three.js. A pista é remontada a cada quadro em
// coordenadas relativas à câmera, a partir dos mesmos segmentos do motor
// pseudo-3D: curvas, morros e colisões continuam idênticos; só o desenho muda.

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { Backdrop } from "./draw";
import {
  BUILDING_TYPES,
  buildBillboard,
  buildCar,
  buildGate,
  buildingGeometry,
  buildingMaterial,
  buildLamp,
  buildOverpass,
  buildPole,
  buildTree,
  buildTruck,
  CAR_LEN,
  CAR_W,
  CarParts,
  glow,
  heartGeometry,
  neonTexture,
  paint,
  S,
} from "./models3d";
import { LANES, ROAD_WIDTH, SEGMENT_LENGTH } from "./track";
import { PlayerScreen, RaceRenderer, RaceView } from "./view";

const W = ROAD_WIDTH;
const BACK = 8;
const DRAW = 260;
const TRIS_PER_SEG = 14;

class StripMesh {
  readonly mesh: THREE.Mesh;
  private pos: Float32Array;
  private col: Float32Array;
  private n = 0;
  private geometry = new THREE.BufferGeometry();

  constructor(capacityTris: number, material: THREE.Material) {
    this.pos = new Float32Array(capacityTris * 9);
    this.col = new Float32Array(capacityTris * 9);
    const normals = new Float32Array(capacityTris * 9);
    for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("color", new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.frustumCulled = false;
  }

  begin() {
    this.n = 0;
  }

  private vert(x: number, y: number, z: number, c: THREE.Color) {
    const i = this.n * 3;
    this.pos[i] = x;
    this.pos[i + 1] = y;
    this.pos[i + 2] = z;
    this.col[i] = c.r;
    this.col[i + 1] = c.g;
    this.col[i + 2] = c.b;
    this.n++;
  }

  // Quadrilátero entre o começo (p1) e o fim (p2) de um segmento: de xa a xb.
  quad(
    xa1: number,
    xb1: number,
    y1: number,
    z1: number,
    xa2: number,
    xb2: number,
    y2: number,
    z2: number,
    c: THREE.Color,
  ) {
    if ((this.n + 6) * 3 > this.pos.length) return;
    this.vert(xa1, y1, z1, c);
    this.vert(xb1, y1, z1, c);
    this.vert(xb2, y2, z2, c);
    this.vert(xa1, y1, z1, c);
    this.vert(xb2, y2, z2, c);
    this.vert(xa2, y2, z2, c);
  }

  end() {
    this.geometry.setDrawRange(0, this.n);
    (this.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
  }
}

interface Pool {
  items: THREE.Object3D[];
  used: number;
}

interface Entry {
  i: number;
  segIndex: number;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  z1: number;
}

function hash(n: number) {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export class Renderer3D implements RaceRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(52, 16 / 9, 0.5, 1600);
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private lit: StripMesh;
  private paintStrip: StripMesh;
  private sky = document.createElement("canvas");
  private skyCtx: CanvasRenderingContext2D;
  private skyTex: THREE.CanvasTexture;
  private backdrop = new Backdrop();
  private hemi = new THREE.HemisphereLight("#6a4c9c", "#120a1c", 1.4);
  private moon = new THREE.DirectionalLight("#b9a8ff", 0.9);
  private headlight = new THREE.SpotLight("#fff1d6", 500, 170, 0.42, 0.55, 1.4);
  private player: CarParts | null = null;
  private playerKey = "";
  private pools = new Map<string, Pool>();
  private width = 1;
  private height = 1;
  private smoothX = 0;
  private wheelTurn = 0;
  private lastPos = 0;
  private colors = new Map<string, THREE.Color>();
  private entries: Entry[] = [];

  constructor(
    canvas: HTMLCanvasElement,
    private font: string,
    useBloom: boolean,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(1);
    // Neutral preserva o matiz das cores fortes (o ACES deixava o vermelho salmão).
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    const ctx = this.sky.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D indisponível");
    this.skyCtx = ctx;
    this.skyTex = new THREE.CanvasTexture(this.sky);
    this.skyTex.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = this.skyTex;
    this.scene.fog = new THREE.FogExp2("#24103a", 0.004);

    this.scene.add(this.hemi);
    this.moon.position.set(-40, 80, -60);
    this.scene.add(this.moon);
    this.headlight.castShadow = false;
    this.scene.add(this.headlight);
    this.scene.add(this.headlight.target);

    this.scene.environment = this.neonEnvironment();
    this.scene.environmentIntensity = 0.9;

    const litMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.05 });
    const paintMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.lit = new StripMesh((DRAW + BACK) * 6, litMat);
    this.paintStrip = new StripMesh((DRAW + BACK) * (TRIS_PER_SEG - 6), paintMat);
    this.scene.add(this.lit.mesh, this.paintStrip.mesh);

    if (useBloom) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.75, 0.45, 0.9);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }
  }

  // Ambiente de reflexo: uma sala escura com painéis de neon rosa, ciano e
  // âmbar. É o que aparece refletido na pintura e nos vidros do carro.
  private neonEnvironment() {
    const env = new THREE.Scene();
    env.add(
      new THREE.Mesh(
        new THREE.BoxGeometry(100, 100, 100),
        new THREE.MeshBasicMaterial({ color: "#06030c", side: THREE.BackSide }),
      ),
    );
    const panel = (color: string, intensity: number, x: number, y: number, z: number, w: number, h: number) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(color).multiplyScalar(intensity),
          side: THREE.DoubleSide,
        }),
      );
      m.position.set(x, y, z);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    panel("#ff2d95", 3, -45, 8, 0, 40, 18);
    panel("#3df2ff", 2.5, 45, 6, -10, 36, 14);
    panel("#ffc890", 4, 0, 45, -20, 60, 8);
    panel("#b26bff", 1.5, 0, 10, 45, 50, 20);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const tex = pmrem.fromScene(env, 0.04).texture;
    pmrem.dispose();
    return tex;
  }

  resize(width: number, height: number) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.composer?.setSize(this.width, this.height);
    this.bloom?.resolution.set(this.width / 2, this.height / 2);
    this.sky.width = Math.min(1024, Math.round(this.width / 2));
    this.sky.height = Math.min(576, Math.round(this.height / 2));
  }

  dispose() {
    this.composer?.dispose();
    this.renderer.dispose();
  }

  private color(hex: string) {
    let c = this.colors.get(hex);
    if (!c) {
      c = new THREE.Color(hex);
      this.colors.set(hex, c);
    }
    return c;
  }

  private take(key: string, make: () => THREE.Object3D) {
    let p = this.pools.get(key);
    if (!p) {
      p = { items: [], used: 0 };
      this.pools.set(key, p);
    }
    if (p.used >= p.items.length) {
      const o = make();
      this.scene.add(o);
      p.items.push(o);
    }
    const o = p.items[p.used++];
    o.visible = true;
    return o;
  }

  private ensurePlayer(view: RaceView) {
    const c = view.car;
    if (this.player && this.playerKey === c.id) return this.player;
    if (this.player) this.scene.remove(this.player.group);
    const underglow = c.id === "lucid" ? "#b26bff" : c.accent === "#111018" ? "#ffcc1a" : c.accent;
    this.player = buildCar(
      { color: c.color, accent: c.accent, spoiler: c.spoiler, stripes: c.stripes, plate: c.plate, underglow },
      true,
    );
    this.playerKey = c.id;
    this.scene.add(this.player.group);
    return this.player;
  }

  render(view: RaceView): PlayerScreen {
    const segs = view.segments;
    const n = segs.length;
    const pal = view.palette;
    const baseIndex = Math.floor(view.position / SEGMENT_LENGTH) % n;
    const basePercent = (view.position % SEGMENT_LENGTH) / SEGMENT_LENGTH;
    const pz = view.position + view.playerZ;
    const playerSeg = segs[Math.floor(pz / SEGMENT_LENGTH) % n];
    const playerPercent = (pz % SEGMENT_LENGTH) / SEGMENT_LENGTH;
    const playerY = playerSeg.p1.world.y + (playerSeg.p2.world.y - playerSeg.p1.world.y) * playerPercent;
    const shiftX = view.playerX * W;

    // 1. Centro da pista de cada segmento, relativo à câmera (como no pseudo-3D).
    this.entries.length = 0;
    let x = 0;
    let dx = -(segs[baseIndex].curve * basePercent);
    for (let i = -BACK; i < DRAW; i++) {
      const seg = segs[(((baseIndex + i) % n) + n) % n];
      let x1 = 0;
      let x2 = 0;
      if (i >= 0) {
        x1 = x;
        x2 = x + dx;
        x += dx;
        dx += seg.curve;
      }
      let z1 = seg.p1.world.z - view.position;
      if (z1 < -view.trackLength / 2) z1 += view.trackLength;
      if (z1 > view.trackLength / 2) z1 -= view.trackLength;
      this.entries.push({
        i,
        segIndex: seg.index,
        x1: x1 - shiftX,
        x2: x2 - shiftX,
        y1: seg.p1.world.y - playerY,
        y2: seg.p2.world.y - playerY,
        z1,
      });
    }

    // 2. Asfalto, acostamento, chão, zebras e faixas.
    const road = [this.color(pal.road[0]), this.color(pal.road[1])];
    const rumble = [this.color(pal.rumble[0]), this.color(pal.rumble[1])];
    const ground = [this.color(pal.ground[0]), this.color(pal.ground[1])];
    const water = this.color(pal.water);
    const lane = this.color(pal.lane);
    this.lit.begin();
    this.paintStrip.begin();
    const R = W * (1 + 1 / 7);
    for (const e of this.entries) {
      const seg = segs[e.segIndex];
      const d = seg.dark ? 1 : 0;
      const X1 = e.x1 * S;
      const X2 = e.x2 * S;
      const Y1 = e.y1 * S;
      const Y2 = e.y2 * S;
      const Z1 = -e.z1 * S;
      const Z2 = -(e.z1 + SEGMENT_LENGTH) * S;
      const w = W * S;
      const r = R * S;
      const far = W * 40 * S;
      this.lit.quad(X1 - w, X1 + w, Y1, Z1, X2 - w, X2 + w, Y2, Z2, road[d]);
      this.lit.quad(
        X1 - far,
        X1 - r,
        Y1 - 0.02,
        Z1,
        X2 - far,
        X2 - r,
        Y2 - 0.02,
        Z2,
        view.stage.lake ? water : ground[d],
      );
      this.lit.quad(X1 + r, X1 + far, Y1 - 0.02, Z1, X2 + r, X2 + far, Y2 - 0.02, Z2, ground[d]);
      this.paintStrip.quad(X1 - r, X1 - w, Y1 + 0.01, Z1, X2 - r, X2 - w, Y2 + 0.01, Z2, rumble[d]);
      this.paintStrip.quad(X1 + w, X1 + r, Y1 + 0.01, Z1, X2 + w, X2 + r, Y2 + 0.01, Z2, rumble[d]);
      if (!seg.dark) {
        const lw = (W / 40) * S;
        for (let l = 1; l < LANES; l++) {
          const off = -w + ((2 * w) / LANES) * l;
          this.paintStrip.quad(
            X1 + off - lw / 2,
            X1 + off + lw / 2,
            Y1 + 0.02,
            Z1,
            X2 + off - lw / 2,
            X2 + off + lw / 2,
            Y2 + 0.02,
            Z2,
            lane,
          );
        }
      }
    }
    this.lit.end();
    this.paintStrip.end();

    // 3. Objetos da beira da estrada, prédios e tráfego.
    for (const p of this.pools.values()) p.used = 0;
    const t = view.t;
    for (const e of this.entries) {
      const seg = segs[e.segIndex];
      const X = e.x1 * S;
      const Y = e.y1 * S;
      const Z = -e.z1 * S;
      for (const sprite of seg.sprites) {
        if (sprite.kind === "heart" && view.collected.has(sprite.id)) continue;
        if (!view.spriteVisible(sprite.kind, sprite.offset)) continue;
        const side = sprite.offset < 0 ? -1 : 1;
        const sx = X + sprite.offset * W * S;
        switch (sprite.kind) {
          case "lamp": {
            const o = this.take(`lamp:${side}`, () => buildLamp(side));
            o.position.set(sx, Y, Z);
            break;
          }
          case "tree": {
            const o = this.take("tree", buildTree);
            o.position.set(sx + side * 3.5, Y, Z);
            o.rotation.y = sprite.id;
            const eyes = o.getObjectByName("eyes");
            if (eyes) {
              eyes.visible = !!view.stage.eyes && Math.sin(t * 0.9 + sprite.id * 1.7) > 0.2;
              eyes.rotation.y = -sprite.id;
            }
            break;
          }
          case "pole": {
            const o = this.take("pole", buildPole);
            o.position.set(sx, Y, Z);
            const blink = o.getObjectByName("blink");
            if (blink) blink.visible = Math.sin(t * 3 + sprite.id) > 0;
            break;
          }
          case "billboard": {
            const o = this.take("billboard", buildBillboard);
            o.position.set(sx + side * 8.5, Y, Z);
            o.rotation.y = -side * 0.35;
            const face = o.getObjectByName("face") as THREE.Mesh | undefined;
            if (face) {
              const texts = view.stage.billboards;
              const tex = neonTexture(texts[sprite.id % texts.length], sprite.hue ?? "#ff2d95", this.font);
              const m = face.material as THREE.MeshBasicMaterial;
              if (m.map !== tex) {
                m.map = tex;
                m.needsUpdate = true;
              }
            }
            break;
          }
          case "heart": {
            const o = this.take("heart", () => new THREE.Mesh(heartGeometry(), glow("#ff2d95", 2.4)));
            o.position.set(sx, Y + 3.2 + Math.sin(t * 4 + sprite.id) * 0.5, Z);
            o.rotation.y = t * 2.2 + sprite.id;
            break;
          }
          case "gate": {
            const o = this.take("gate", () => buildGate(W * S));
            o.position.set(X, Y, Z);
            const banner = o.getObjectByName("banner") as THREE.Mesh | undefined;
            if (banner) {
              const label = seg.index === 0 && view.lap < 0 ? "LARGADA" : "CHECKPOINT";
              const hue = Math.floor(t * 4) % 2 === 0 ? "#3df2ff" : "#ff2d95";
              const tex = neonTexture(label, hue, this.font);
              const m = banner.material as THREE.MeshBasicMaterial;
              if (m.map !== tex) {
                m.map = tex;
                m.needsUpdate = true;
              }
            }
            break;
          }
          case "overpass": {
            const o = this.take("overpass", () => buildOverpass(W * S));
            o.position.set(X, Y, Z);
            const train = o.getObjectByName("train");
            if (train) {
              const period = 7 + (sprite.id % 3);
              const p = ((t + sprite.id * 2.3) % period) / period;
              const span = W * S * 4.2 + 70;
              const dir = sprite.id % 2 === 0 ? 1 : -1;
              train.position.x = dir * (-span + p * span * 2);
              train.visible = p < 0.95;
            }
            break;
          }
          default:
            break;
        }
      }

      // Prédios dos dois lados, a cada 8 segmentos.
      if (e.i >= 0 && seg.index % 8 === 0) {
        for (const side of [-1, 1]) {
          if (side < 0 && view.stage.lake) continue;
          const h1 = hash(seg.index * 2 + (side > 0 ? 1 : 0));
          const h2 = hash(seg.index * 7 + (side > 0 ? 3 : 5));
          const type = Math.floor(h1 * BUILDING_TYPES.length);
          const [bw] = BUILDING_TYPES[type];
          const o = this.take(`bld:${type}`, () => new THREE.Mesh(buildingGeometry(type), buildingMaterial()));
          o.position.set(X + side * (W * S * 3.2 + h2 * 45 + bw / 2), Y - 0.5, Z);
        }
      }

      for (const car of seg.cars) {
        const cx = (e.x1 + (e.x2 - e.x1) * car.percent + car.offset * W) * S;
        const cy = (e.y1 + (e.y2 - e.y1) * car.percent) * S;
        const cz = -(e.z1 + car.percent * SEGMENT_LENGTH) * S;
        const o = car.truck
          ? this.take(`truck:${car.color}`, () => buildTruck(car.color))
          : this.take(`car:${car.color}`, () => buildCar({ color: car.color }, false).group);
        o.position.set(cx, cy, cz);
        o.rotation.y = -Math.atan2(e.x2 - e.x1, SEGMENT_LENGTH);
      }
    }
    for (const p of this.pools.values()) for (let i = p.used; i < p.items.length; i++) p.items[i].visible = false;

    // 4. Carro do jogador.
    const parts = this.ensurePlayer(view);
    const pe = this.entries[BACK + Math.max(0, Math.floor(view.playerZ / SEGMENT_LENGTH))];
    const pFrac = (view.playerZ % SEGMENT_LENGTH) / SEGMENT_LENGTH;
    const carX = (pe.x1 + (pe.x2 - pe.x1) * pFrac + shiftX) * S;
    const carZ = -view.playerZ * S;
    const roadYaw = -Math.atan2(pe.x2 - pe.x1, SEGMENT_LENGTH);
    const pitch = Math.atan2(playerSeg.p2.world.y - playerSeg.p1.world.y, SEGMENT_LENGTH);
    const g = parts.group;
    g.visible = !view.hidden;
    g.position.set(carX - shiftX * S, 0, carZ);
    const driftYaw = view.drifting ? -view.driftDir * (0.32 + 0.04 * Math.sin(t * 30)) : 0;
    g.rotation.set(pitch, roadYaw + driftYaw - view.steer * 0.06, -view.steer * 0.035 * view.speedPercent, "YXZ");
    const travelled = (view.position - this.lastPos + view.trackLength) % view.trackLength;
    this.lastPos = view.position;
    this.wheelTurn -= (travelled * S) / 0.95;
    for (const w of parts.wheels) w.rotation.x = this.wheelTurn;
    parts.brake.color.setRGB(view.braking ? 1.6 : 1, view.braking ? 0.08 : 0.02, view.braking ? 0.14 : 0.06);
    const paintMat = paint(view.carColor);
    for (const m of parts.paintMeshes) if (m.material !== paintMat) m.material = paintMat;

    // Faróis do jogador iluminando o asfalto à frente.
    this.headlight.position.set(g.position.x, 3.2, carZ - CAR_LEN * 0.4);
    this.headlight.target.position.set(g.position.x - Math.sin(g.rotation.y) * 60, 0, carZ - 60);

    // 5. Câmera de perseguição, com atraso lateral e tremida nas batidas.
    this.smoothX += (view.playerX - this.smoothX) * 0.12;
    const lag = Math.max(-3, Math.min(3, (this.smoothX - view.playerX) * W * S));
    const camBack = this.entries[Math.max(0, BACK - 3)];
    const camGround = Math.max(0, camBack.y1 * S);
    const shake = view.shake * 1.2;
    this.camera.position.set(
      g.position.x + lag + (Math.random() - 0.5) * shake,
      camGround + 8.2 + (Math.random() - 0.5) * shake,
      carZ + 21,
    );
    this.camera.fov = 52 + Math.min(12, view.boostTime > 0 ? 10 : view.speedPercent * 4);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(g.position.x + lag * 0.3, 2.4, carZ - 34);
    this.camera.rotation.z += view.drifting ? view.driftDir * 0.03 : -view.steer * 0.012;

    // 6. Céu (o mesmo desenho do modo 2D) alinhado com o horizonte da câmera.
    const horizon = new THREE.Vector3(this.camera.position.x, this.camera.position.y, this.camera.position.z - 5000);
    horizon.project(this.camera);
    const horizonFrac = Math.max(0.15, Math.min(0.85, (1 - horizon.y) / 2));
    const sw = this.sky.width;
    const sh = this.sky.height;
    this.backdrop.resize(sw, Math.round(horizonFrac * sh * 2));
    this.backdrop.draw(this.skyCtx, pal, view.skyOffset, view.cityOffset, t);
    this.skyCtx.fillStyle = pal.fog;
    this.skyCtx.fillRect(0, Math.round(horizonFrac * sh), sw, sh);
    this.skyTex.needsUpdate = true;

    const fog = this.scene.fog as THREE.FogExp2;
    fog.color.set(pal.fog);
    fog.density = Math.sqrt(view.fogDensity) / (DRAW * SEGMENT_LENGTH * S);
    this.hemi.color.set(pal.skyMid).lerp(this.color("#8a70c0"), 0.5);
    this.hemi.groundColor.set(pal.ground[0]);
    this.hemi.intensity = 1.4 + view.lightning * 6;

    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);

    // Traseira do carro na tela, pras partículas e chamas do HUD.
    const rearZ = carZ + (CAR_LEN / 2) * Math.cos(g.rotation.y);
    const a = new THREE.Vector3(g.position.x - CAR_W / 2, 0.4, rearZ).project(this.camera);
    const b = new THREE.Vector3(g.position.x + CAR_W / 2, 0.4, rearZ).project(this.camera);
    const roof = new THREE.Vector3(g.position.x, CAR_LEN * 0.3, carZ).project(this.camera);
    const toX = (v: number) => ((v + 1) / 2) * this.width;
    const toY = (v: number) => ((1 - v) / 2) * this.height;
    return {
      x: (toX(a.x) + toX(b.x)) / 2,
      y: (toY(a.y) + toY(b.y)) / 2,
      w: Math.abs(toX(b.x) - toX(a.x)),
      top: toY(roof.y),
    };
  }
}
