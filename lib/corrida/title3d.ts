// Tela inicial em 3D: o Juice (modelo .glb com esqueleto) encostado no carro
// numa rua molhada de Chicago, com chuva e reflexo no asfalto. Ao jogar, ele
// anda até a porta, entra, os faróis acendem e o carro arranca.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { Reflector } from "three/addons/objects/Reflector.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { CarDef } from "./cars";
import { Backdrop, makeScanlines } from "./draw";
import {
  additive,
  buildBillboard,
  buildCar,
  buildingGeometry,
  buildingMaterial,
  buildLamp,
  CAR_LEN,
  CAR_W,
  CarParts,
  neonTexture,
  paint,
} from "./models3d";
import { PoseSpec, Rig, V3 } from "./rig";
import { STAGES } from "./stages";
import { TitleSounds } from "./title";

const NIGHT = STAGES[0].palette;
const JUICE_HEIGHT = 4.9; // unidades da cena (o carro tem 12,5 de comprimento)

const LEAN: PoseSpec = {
  lean: [-0.12, 0.03, 0.15],
  spine: [0.05, -0.1, 0],
  head: [0.1, 0.25, 0.06],
  armL: [
    [0.25, -0.9, -0.3],
    [0.1, -0.9, -0.45],
  ],
  armR: [
    [-0.4, -0.85, 0.35],
    [0.85, 0.05, 0.55],
  ],
  legL: [
    [0.12, -1, 0.3],
    [0.08, -1, 0.15],
  ],
  legR: [
    [0.1, -1, 0.28],
    [0.35, -1, 0.05],
  ],
  fingers: 0.5,
};

const STAND: PoseSpec = {
  head: [0.05, 0, 0],
  armL: [
    [0.25, -1, 0],
    [0.12, -1, 0.15],
  ],
  armR: [
    [-0.25, -1, 0],
    [-0.12, -1, 0.15],
  ],
  legL: [
    [0.06, -1, 0],
    [0.04, -1, 0],
  ],
  legR: [
    [-0.06, -1, 0],
    [-0.04, -1, 0],
  ],
  fingers: 0.45,
};

const REACH: PoseSpec = {
  spine: [0.15, 0, 0],
  head: [0.15, 0, 0],
  armL: [
    [0.3, -0.5, 0.8],
    [0.15, -0.2, 1],
  ],
  armR: [
    [-0.25, -1, 0.05],
    [-0.1, -1, 0.2],
  ],
  legL: [
    [0.08, -1, 0.15],
    [0.05, -1, 0],
  ],
  legR: [
    [-0.08, -1, -0.12],
    [-0.05, -1, -0.15],
  ],
  fingers: 0.3,
};

const CROUCH: PoseSpec = {
  hip: [0, -18, 0],
  spine: [0.75, 0, 0],
  head: [0.5, 0, 0],
  armL: [
    [0.25, -0.4, 0.9],
    [0.1, -0.3, 1],
  ],
  armR: [
    [-0.3, -0.6, 0.7],
    [-0.1, -0.6, 0.8],
  ],
  legL: [
    [0.1, -0.6, 0.8],
    [0.05, -1, -0.35],
  ],
  legR: [
    [-0.1, -0.75, 0.6],
    [-0.05, -1, -0.25],
  ],
  fingers: 0.5,
};

function walk(phase: number): PoseSpec {
  const leg = (p: number): [V3, V3] => {
    const s = Math.sin(p);
    const lift = Math.max(0, Math.cos(p));
    return [
      [0, -1, s * 0.5],
      [0, -1, s * 0.5 - lift * 0.9],
    ];
  };
  const arm = (p: number, side: number): [V3, V3] => [
    [side * 0.22, -1, -Math.sin(p) * 0.4],
    [side * 0.1, -1, -Math.sin(p) * 0.3 + 0.35],
  ];
  return {
    lean: [0.05, Math.sin(phase) * 0.03, Math.sin(phase) * 0.06],
    hip: [0, -Math.abs(Math.cos(phase)) * 2.5, 0],
    head: [0.05, 0, 0],
    legL: leg(phase),
    legR: leg(phase + Math.PI),
    armL: arm(phase + Math.PI, 1),
    armR: arm(phase, -1),
    fingers: 0.45,
  };
}

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Linha do tempo da entrada no carro, em segundos.
const T_STAND = 0.45;
const T_WALK = 1.75;
const T_TURN = 2.15;
const T_IN = 2.8;
const T_CLOSE = 3.05;
const T_LIGHTS = 3.3;
const T_GO = 4.5;

const LEAN_POS = new THREE.Vector3(-2.6, 0, CAR_W / 2 + 1.05);
const DOOR_POS = new THREE.Vector3(0.6, 0, CAR_W / 2 + 1.7);
const SEAT_POS = new THREE.Vector3(0.3, -0.4, 0.6);

export class Title3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.5, 900);
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private reflector: Reflector | null = null;
  private sky = document.createElement("canvas");
  private skyCtx: CanvasRenderingContext2D;
  private skyTex: THREE.CanvasTexture;
  private backdrop = new Backdrop();
  private scanlineCanvas: HTMLCanvasElement | null = null;
  private overlay: CanvasRenderingContext2D | null;
  private crt = true;
  private dim = 0;
  private juice: THREE.Object3D;
  private rig: Rig;
  private carRoot = new THREE.Group();
  private car: CarParts | null = null;
  private carDef: CarDef;
  private door = new THREE.Group();
  private doorPanel: THREE.Mesh;
  private headMat = new THREE.MeshBasicMaterial({ toneMapped: false, color: "#3a3640" });
  private beam: THREE.Mesh;
  private headlight = new THREE.SpotLight("#fff1d6", 0, 90, 0.45, 0.5, 1.2);
  private rain: THREE.LineSegments;
  private rainPos: Float32Array;
  private raf = 0;
  private start = performance.now();
  private last = performance.now();
  private intro = -1;
  private onDone: (() => void) | null = null;
  private fired = new Set<string>();
  private width = 0;
  private height = 0;

  static async load(url: string) {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync(url);
    return gltf.scene;
  }

  constructor(
    private canvas: HTMLCanvasElement,
    private overlayCanvas: HTMLCanvasElement,
    juice: THREE.Object3D,
    car: CarDef,
    private sounds: TitleSounds,
    private font: string,
    lowPower: boolean,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(1);
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.overlay = overlayCanvas.getContext("2d");
    const ctx = this.sky.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D indisponível");
    this.skyCtx = ctx;
    this.skyTex = new THREE.CanvasTexture(this.sky);
    this.skyTex.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = this.skyTex;
    this.scene.fog = new THREE.Fog("#1a0c2c", 60, 260);
    this.carDef = car;

    this.buildLights();
    this.buildStreet(lowPower);

    // Personagem: escala de cm pra unidades da cena e sombra falsa nos pés.
    this.juice = juice;
    const box = new THREE.Box3().setFromObject(juice);
    const s = JUICE_HEIGHT / (box.max.y - box.min.y);
    juice.scale.setScalar(s);
    juice.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.frustumCulled = false;
    });
    this.scene.add(juice);
    this.rig = new Rig(juice);
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0.45, depthWrite: false }),
    );
    shadow.name = "shadow";
    shadow.scale.set(1.1, 1, 0.8);
    this.scene.add(shadow);

    // Carro de lado, virado pra direita da tela.
    this.carRoot.rotation.y = -Math.PI / 2;
    this.scene.add(this.carRoot);
    this.doorPanel = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.8, 0.14), paint(car.color));
    this.doorPanel.position.set(-1.7, 0, 0);
    this.door.add(this.doorPanel);
    this.scene.add(this.door);
    this.setCar(car);

    // Faróis: luz de verdade + feixe visível na chuva.
    this.headlight.position.set(CAR_LEN / 2, 1.8, 0);
    this.headlight.target.position.set(CAR_LEN / 2 + 30, 0, 0);
    this.scene.add(this.headlight, this.headlight.target);
    const beamGeo = new THREE.ConeGeometry(4.5, 26, 24, 1, true).rotateZ(Math.PI / 2).translate(13, 0, 0);
    this.beam = new THREE.Mesh(
      beamGeo,
      new THREE.MeshBasicMaterial({
        color: "#fff1d6",
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.beam.position.set(CAR_LEN / 2, 1.7, 0);
    this.scene.add(this.beam);

    // Chuva: segmentos caindo numa caixa em volta da cena.
    const N = lowPower ? 450 : 900;
    this.rainPos = new Float32Array(N * 6);
    for (let i = 0; i < N; i++) this.resetDrop(i, Math.random() * 30);
    const rg = new THREE.BufferGeometry();
    rg.setAttribute("position", new THREE.BufferAttribute(this.rainPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.rain = new THREE.LineSegments(
      rg,
      new THREE.LineBasicMaterial({ color: "#b8a8ff", transparent: true, opacity: 0.35 }),
    );
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);

    if (!lowPower) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.5, 0.88);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }

    this.raf = requestAnimationFrame(this.frame);
  }

  private resetDrop(i: number, y: number) {
    const x = (Math.random() - 0.5) * 70;
    const z = -20 + Math.random() * 50;
    const p = this.rainPos;
    p.set([x, y, z, x + 0.15, y + 1.1, z], i * 6);
  }

  private buildLights() {
    this.scene.add(new THREE.HemisphereLight("#5a4488", "#100818", 0.8));
    // Luz rosa de neon vindo de trás-esquerda e ciano da direita: contorno no personagem.
    const pink = new THREE.DirectionalLight("#ff3d9a", 2.6);
    pink.position.set(-12, 8, -10);
    const cyan = new THREE.DirectionalLight("#3df2ff", 1.6);
    cyan.position.set(14, 5, 6);
    const key = new THREE.DirectionalLight("#ffd8c0", 1.9);
    key.position.set(-6, 9, 16);
    this.scene.add(pink, cyan, key);
    // Poste aceso atrás do carro.
    const lampLight = new THREE.PointLight("#ffc2a0", 120, 40, 1.6);
    lampLight.position.set(-22, 11.5, -4);
    this.scene.add(lampLight);

    const env = new THREE.Scene();
    env.add(
      new THREE.Mesh(
        new THREE.BoxGeometry(100, 100, 100),
        new THREE.MeshBasicMaterial({ color: "#06030c", side: THREE.BackSide }),
      ),
    );
    const panel = (color: string, k: number, x: number, y: number, z: number, w: number, h: number) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }),
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
    this.scene.environment = pmrem.fromScene(env, 0.04).texture;
    this.scene.environmentIntensity = 0.7;
    pmrem.dispose();
  }

  private buildStreet(lowPower: boolean) {
    // Asfalto molhado: espelho embaixo de uma camada escura semitransparente.
    if (!lowPower) {
      this.reflector = new Reflector(new THREE.PlaneGeometry(400, 400), {
        textureWidth: 512,
        textureHeight: 512,
        color: new THREE.Color("#8a7aa0"),
      });
      this.reflector.rotation.x = -Math.PI / 2;
      this.reflector.position.y = -0.02;
      this.scene.add(this.reflector);
    }
    const asphalt = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({
        color: "#120c1a",
        roughness: 0.35,
        metalness: 0.4,
        transparent: !lowPower,
        opacity: lowPower ? 1 : 0.72,
      }),
    );
    this.scene.add(asphalt);
    // Calçada e meio-fio atrás do carro.
    const curb = new THREE.Mesh(
      new THREE.BoxGeometry(400, 0.5, 12),
      new THREE.MeshStandardMaterial({ color: "#1d1528", roughness: 0.6 }),
    );
    curb.position.set(0, 0.25, -11);
    this.scene.add(curb);
    // Faixa amarela tracejada na rua, à frente.
    for (let i = -10; i <= 10; i++) {
      const dash = new THREE.Mesh(
        new THREE.PlaneGeometry(4, 0.3).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: "#9c8a4a" }),
      );
      dash.position.set(i * 8, 0.01, 12);
      this.scene.add(dash);
    }

    const lamp = buildLamp(1);
    lamp.position.set(-17, 0.5, -7);
    this.scene.add(lamp);
    const lamp2 = buildLamp(1);
    lamp2.position.set(40, 0.5, -7);
    this.scene.add(lamp2);

    const bb = buildBillboard();
    bb.position.set(20, 0.5, -34);
    bb.rotation.y = -0.3;
    bb.scale.setScalar(0.7);
    const face = bb.getObjectByName("face") as THREE.Mesh;
    (face.material as THREE.MeshBasicMaterial).map = neonTexture("999", "#ff2d95", this.font);
    this.scene.add(bb);

    // Prédios atrás da calçada, com janelas acesas.
    let x = -150;
    let k = 0;
    while (x < 150) {
      const type = (k * 5 + 3) % 6;
      const b = new THREE.Mesh(buildingGeometry(type), buildingMaterial());
      const depth = 120 + ((k * 37) % 50);
      b.position.set(x, 0, -depth);
      b.scale.setScalar(0.55);
      this.scene.add(b);
      x += 14 + ((k * 13) % 10);
      k++;
    }
    const glowPool = new THREE.Mesh(new THREE.PlaneGeometry(18, 10).rotateX(-Math.PI / 2), additive("#ff8fc0", 0.25));
    glowPool.position.set(-22, 0.03, -2);
    this.scene.add(glowPool);
  }

  setCar(car: CarDef) {
    this.carDef = car;
    if (this.car) this.carRoot.remove(this.car.group);
    const underglow = car.id === "lucid" ? "#b26bff" : car.accent === "#111018" ? "#ffcc1a" : car.accent;
    this.car = buildCar(
      { color: car.color, accent: car.accent, spoiler: car.spoiler, stripes: car.stripes, plate: car.plate, underglow },
      true,
    );
    const heads = this.car.group.getObjectByName("heads") as THREE.Mesh | undefined;
    if (heads) heads.material = this.headMat;
    this.carRoot.add(this.car.group);
    this.doorPanel.material = paint(car.color);
  }

  setCrt(on: boolean) {
    this.crt = on;
  }

  setDim(d: number) {
    this.dim = d;
  }

  playIntro(onDone: () => void) {
    this.intro = 0;
    this.onDone = onDone;
    this.fired.clear();
  }

  skipIntro() {
    if (this.intro >= 0) this.finish();
  }

  reset() {
    this.intro = -1;
    this.onDone = null;
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.composer?.dispose();
    this.reflector?.dispose();
    this.renderer.dispose();
    this.overlay?.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
  }

  private finish() {
    const done = this.onDone;
    this.intro = -1;
    this.onDone = null;
    done?.();
  }

  private once(key: string, at: number, fn?: () => void) {
    if (this.intro >= at && !this.fired.has(key)) {
      this.fired.add(key);
      fn?.();
    }
  }

  private resize(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.overlayCanvas.width = w;
    this.overlayCanvas.height = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.composer?.setSize(w, h);
    this.bloom?.resolution.set(w / 2, h / 2);
    this.sky.width = Math.min(1024, Math.round(w / 2));
    this.sky.height = Math.min(640, Math.round(h / 2));
    this.scanlineCanvas = makeScanlines(w, h);
  }

  private frame = (now: number) => {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.round(this.canvas.clientWidth * ratio);
    const h = Math.round(this.canvas.clientHeight * ratio);
    // Até 0,1 s por quadro: em celular lento a entrada não vira câmera lenta.
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (w > 0 && h > 0) {
      if (w !== this.width || h !== this.height) this.resize(w, h);
      if (this.intro >= 0) this.intro += dt;
      this.update((now - this.start) / 1000, dt);
      this.draw((now - this.start) / 1000);
      if (this.intro >= T_GO + 0.3) this.finish();
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private update(t: number, dt: number) {
    const it = this.intro;
    const juice = this.juice;
    let pos = LEAN_POS.clone();
    let rotY = 0.22;
    let visible = true;

    let pose: () => void = () => undefined;
    if (it < 0) {
      // Parado, balançando a cabeça no ritmo da música e respirando.
      const nod = Math.sin(t * Math.PI * 2 * 0.7);
      pose = () =>
        this.rig.apply({
          ...LEAN,
          head: [0.1 + nod * 0.05, 0.25 + Math.sin(t * 0.4) * 0.08, 0.06],
          spine: [0.05 + Math.sin(t * 1.9) * 0.012, -0.1, 0],
        });
    } else if (it < T_STAND) {
      const p = ease(it / T_STAND);
      rotY = lerp(0.22, Math.PI / 2, ease((it - 0.15) / 0.3));
      pose = () => this.rig.blend(LEAN, STAND, p);
    } else if (it < T_WALK) {
      const p = (it - T_STAND) / (T_WALK - T_STAND);
      pos = LEAN_POS.clone().lerp(DOOR_POS, ease(p));
      rotY = Math.PI / 2;
      const settle = p > 0.85 ? (p - 0.85) / 0.15 : 0;
      pose = () => this.rig.blend(walk(p * Math.PI * 5), STAND, settle);
    } else if (it < T_TURN) {
      const p = ease((it - T_WALK) / (T_TURN - T_WALK));
      pos = DOOR_POS.clone();
      rotY = lerp(Math.PI / 2, Math.PI, p);
      pose = () => this.rig.blend(STAND, REACH, p);
    } else if (it < T_IN - 0.12) {
      const p = ease((it - T_TURN) / (T_IN - T_TURN));
      pos = DOOR_POS.clone().lerp(SEAT_POS, p);
      rotY = Math.PI;
      pose = () => this.rig.blend(REACH, CROUCH, Math.min(1, p * 1.6));
    } else {
      visible = false;
    }
    // Posição e giro antes da pose: a pose usa a orientação atual do corpo.
    juice.position.copy(pos);
    juice.rotation.y = rotY;
    juice.updateMatrixWorld(true);
    if (visible) pose();
    juice.visible = visible;
    const shadow = this.scene.getObjectByName("shadow");
    if (shadow) {
      shadow.visible = visible;
      shadow.position.set(pos.x + 0.3, 0.04, pos.z - 0.2);
    }

    // Porta, faróis e arrancada.
    let doorOpen = 0;
    let lights = 0;
    let carX = 0;
    if (it >= 0) {
      doorOpen = clamp01((it - (T_WALK + 0.1)) / 0.35) * (1 - clamp01((it - (T_IN - 0.05)) / (T_CLOSE - T_IN + 0.05)));
      lights = clamp01((it - T_CLOSE) / (T_LIGHTS - T_CLOSE));
      const go = Math.max(0, it - T_LIGHTS - 0.25);
      carX = go * go * 26;
      this.once("door", T_WALK + 0.1, this.sounds.door);
      this.once("close", T_CLOSE - 0.05, this.sounds.door);
      this.once("rev", T_CLOSE + 0.1, this.sounds.rev);
    }
    this.carRoot.position.x = carX;
    const L = CAR_LEN;
    this.door.position.set(carX + 0.18 * L, 0.875 + 0.9, CAR_W / 2 + 0.07);
    this.door.rotation.y = doorOpen * 1.15;
    this.doorPanel.visible = doorOpen > 0.001;
    this.headMat.color.setRGB(0.25 + lights * 1.9, 0.24 + lights * 1.8, 0.27 + lights * 1.5);
    if (this.car) this.car.brake.color.setRGB(0.6 + lights * 1.4, 0.03, 0.06);
    this.headlight.intensity = lights * 700;
    this.headlight.position.x = carX + L / 2;
    this.headlight.target.position.x = carX + L / 2 + 30;
    this.beam.position.x = carX + L / 2;
    (this.beam.material as THREE.MeshBasicMaterial).opacity = lights * 0.05;
    if (this.car) {
      const spin = carX / 0.95;
      for (const wheel of this.car.wheels) wheel.rotation.x = -spin;
    }

    // Chuva.
    const p = this.rainPos;
    for (let i = 0; i < p.length; i += 6) {
      p[i + 1] -= 32 * dt;
      p[i + 4] -= 32 * dt;
      if (p[i + 1] < 0) this.resetDrop(i / 6, 28 + Math.random() * 4);
    }
    (this.rain.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
  }

  private draw(t: number) {
    const w = this.width;
    const h = this.height;
    const it = this.intro;
    // Câmera: o carro fica à direita em tela larga e no centro em tela em pé.
    const wide = w / h >= 1.1;
    const sway = Math.sin(t * 0.18) * 0.12;
    // Durante a entrada a câmera abre pra pegar o carro inteiro arrancando.
    const open = it >= 0 ? ease((it - T_TURN) / 1.4) : 0;
    const dist = (wide ? 17 : 24) + open * (wide ? 9 : 12);
    // Em pé, a câmera olha abaixo do personagem pra ele subir na tela, acima dos botões.
    const target = wide
      ? new THREE.Vector3(lerp(-4.2, 1.5, open), 3, 2.6)
      : new THREE.Vector3(lerp(-2.4, 1.5, open), lerp(0.2, 1.6, open), 2.6);
    this.camera.fov = wide ? 30 : 40;
    this.camera.position.set(
      target.x + Math.sin(-0.32 + sway) * dist,
      2.3 + open * 1.2,
      target.z + Math.cos(-0.32 + sway) * dist,
    );
    this.camera.lookAt(target);
    this.camera.updateProjectionMatrix();

    // Céu desenhado em 2D (mesmo do jogo), alinhado ao horizonte da câmera.
    const horizon = new THREE.Vector3(this.camera.position.x, 0, this.camera.position.z - 2000).project(this.camera);
    const frac = Math.max(0.2, Math.min(0.85, (1 - horizon.y) / 2));
    this.backdrop.resize(this.sky.width, Math.round(frac * this.sky.height * 2));
    this.backdrop.draw(this.skyCtx, NIGHT, t * 0.004, t * 0.008, t);
    this.skyCtx.fillStyle = "#0a0612";
    this.skyCtx.fillRect(0, Math.round(frac * this.sky.height), this.sky.width, this.sky.height);
    this.skyTex.needsUpdate = true;

    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);

    // Camada 2D por cima: fade da arrancada, escurecimento dos menus e TV antiga.
    const o = this.overlay;
    if (!o) return;
    o.clearRect(0, 0, w, h);
    if (it >= T_GO - 0.5) {
      o.fillStyle = `rgba(0,0,0,${clamp01((it - (T_GO - 0.5)) / 0.6)})`;
      o.fillRect(0, 0, w, h);
    }
    if (this.dim > 0) {
      o.fillStyle = `rgba(4,2,10,${this.dim})`;
      o.fillRect(0, 0, w, h);
    }
    if (this.crt && this.scanlineCanvas) o.drawImage(this.scanlineCanvas, 0, 0);
  }
}
