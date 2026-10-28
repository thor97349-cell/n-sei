// Modelos 3D do jogo, todos gerados por código: carro (carroceria extrudada do
// perfil lateral), caminhão, poste, árvore, outdoor de neon, coração, pórtico,
// viaduto com trem e prédios com janelas acesas. Unidades: 1 = 100 do jogo.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export const S = 0.01;
export const CAR_LEN = 12.5;
export const CAR_W = 6;

const geoCache = new Map<string, THREE.BufferGeometry>();
const matCache = new Map<string, THREE.Material>();

function geo(key: string, make: () => THREE.BufferGeometry) {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
}

function mat<T extends THREE.Material>(key: string, make: () => T): T {
  let m = matCache.get(key) as T | undefined;
  if (!m) {
    m = make();
    matCache.set(key, m);
  }
  return m;
}

export function paint(color: string) {
  return mat(`paint:${color}`, () => new THREE.MeshStandardMaterial({ color, metalness: 0.25, roughness: 0.28 }));
}

export function flat(color: string) {
  return mat(`flat:${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
}

// Material que brilha sozinho (neon, lanternas): cor acima de 1 pro bloom pegar.
export function glow(color: string, intensity = 2.2) {
  return mat(`glow:${color}:${intensity}`, () => {
    const c = new THREE.Color(color).multiplyScalar(intensity);
    return new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
  });
}

const GLASS = () =>
  mat("glass", () => new THREE.MeshStandardMaterial({ color: "#0c0818", metalness: 0.9, roughness: 0.08 }));
const TIRE = () => mat("tire", () => new THREE.MeshStandardMaterial({ color: "#0a0810", roughness: 0.9 }));
const RIM = () =>
  mat("rim", () => new THREE.MeshStandardMaterial({ color: "#b9b4c8", metalness: 0.9, roughness: 0.25 }));
const DARK = () => flat("#1d1528");

function profileShape(points: [number, number][]) {
  const s = new THREE.Shape();
  s.moveTo(points[0][0] * CAR_LEN, points[0][1] * CAR_LEN);
  for (const [x, y] of points.slice(1)) s.lineTo(x * CAR_LEN, y * CAR_LEN);
  s.closePath();
  return s;
}

// Extruda um perfil lateral (x = comprimento, y = altura) na largura dada e
// deita o resultado com a frente apontando pra -Z.
function sideExtrude(points: [number, number][], width: number, bevel: number) {
  const g = new THREE.ExtrudeGeometry(profileShape(points), {
    depth: width - bevel * 2,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 4,
  });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.rotateY(Math.PI / 2);
  return g;
}

const LOWER: [number, number][] = [
  [-0.5, 0.07],
  [-0.505, 0.17],
  [-0.475, 0.203],
  [-0.27, 0.212],
  [0.22, 0.208],
  [0.43, 0.176],
  [0.495, 0.16],
  [0.505, 0.12],
  [0.495, 0.066],
];

const CABIN: [number, number][] = [
  [-0.255, 0.205],
  [-0.2, 0.258],
  [-0.12, 0.288],
  [-0.06, 0.294],
  [0.04, 0.292],
  [0.1, 0.284],
  [0.21, 0.205],
];

export interface CarLook3D {
  color: string;
  accent?: string;
  spoiler?: boolean;
  stripes?: boolean;
  plate?: string;
  underglow?: string;
}

export interface CarParts {
  group: THREE.Group;
  wheels: THREE.Object3D[];
  brake: THREE.MeshBasicMaterial;
  paintMeshes: THREE.Mesh[];
}

let plateCanvasCache = new Map<string, THREE.Texture>();

function plateTexture(text: string) {
  let t = plateCanvasCache.get(text);
  if (t) return t;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 96;
  const g = c.getContext("2d");
  if (g) {
    g.fillStyle = "#e9e3f5";
    g.fillRect(0, 0, 256, 96);
    g.strokeStyle = "#1a1030";
    g.lineWidth = 8;
    g.strokeRect(4, 4, 248, 88);
    g.fillStyle = "#1a1030";
    g.font = "900 62px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, 128, 52, 230);
  }
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  plateCanvasCache.set(text, t);
  return t;
}

export function resetModelCaches() {
  plateCanvasCache = new Map();
}

let radialTex: THREE.Texture | null = null;
// Degradê radial branco → transparente, usado em brilhos e manchas de luz.
export function radialTexture() {
  if (radialTex) return radialTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  if (g) {
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.35, "rgba(255,255,255,0.45)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  }
  radialTex = new THREE.CanvasTexture(c);
  return radialTex;
}

export function additive(color: string, opacity = 1) {
  return mat(`add:${color}:${opacity}`, () => {
    return new THREE.MeshBasicMaterial({
      map: radialTexture(),
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
  });
}

export function buildCar(look: CarLook3D, detailed: boolean): CarParts {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    geo("car:lower", () => sideExtrude(LOWER, CAR_W, 0.25)),
    paint(look.color),
  );
  group.add(body);
  const cabin = new THREE.Mesh(
    geo("car:cabin", () => sideExtrude(CABIN, CAR_W * 0.84, 0.2)),
    GLASS(),
  );
  group.add(cabin);
  const roof = new THREE.Mesh(
    geo("car:roof", () => new THREE.BoxGeometry(CAR_W * 0.8, 0.16, CAR_LEN * 0.15)),
    paint(look.color),
  );
  roof.position.set(0, CAR_LEN * 0.292, CAR_LEN * 0.01);
  group.add(roof);

  const wheels: THREE.Object3D[] = [];
  const wheelSpots: [number, number][] = [];
  for (const z of [CAR_LEN * 0.3, -CAR_LEN * 0.31])
    for (const side of [-1, 1]) wheelSpots.push([side * (CAR_W / 2 - 0.35), z]);
  if (detailed) {
    const tireG = geo("car:tire", () => new THREE.CylinderGeometry(0.95, 0.95, 0.95, 18).rotateZ(Math.PI / 2));
    const rimG = geo("car:rim", () => {
      // Aro com 5 raios, pra dar pra ver a roda girando.
      const parts: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(0.62, 0.62, 1.0, 12).rotateZ(Math.PI / 2)];
      for (let i = 0; i < 5; i++) {
        parts.push(new THREE.BoxGeometry(1.02, 0.16, 0.5).translate(0, 0.32, 0).rotateX((i * Math.PI * 2) / 5));
      }
      return mergeGeometries(parts.map((g) => g.toNonIndexed()));
    });
    for (const [wx, wz] of wheelSpots) {
      const w = new THREE.Group();
      w.add(new THREE.Mesh(tireG, TIRE()));
      w.add(new THREE.Mesh(rimG, RIM()));
      w.position.set(wx, 0.95, wz);
      group.add(w);
      wheels.push(w);
    }
  } else {
    // Tráfego: as quatro rodas numa malha só (menos chamadas de desenho no celular).
    const all = geo("car:wheels", () =>
      mergeGeometries(
        wheelSpots.map(([wx, wz]) =>
          new THREE.CylinderGeometry(0.95, 0.95, 0.95, 10).rotateZ(Math.PI / 2).translate(wx, 0.95, wz),
        ),
      ),
    );
    group.add(new THREE.Mesh(all, TIRE()));
  }

  // Lanternas e faróis ficam pra fora da carroceria (o perfil tem chanfro de 0,25).
  const REAR = CAR_LEN * 0.505 + 0.3;
  const brake = detailed
    ? new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff1f4b").multiplyScalar(1.8), toneMapped: false })
    : (glow("#ff1f4b", 1.8) as THREE.MeshBasicMaterial);
  const tails = geo("car:tails", () =>
    mergeGeometries([
      new THREE.BoxGeometry(1.8, 0.42, 0.14).translate(-1.95, 0, 0),
      new THREE.BoxGeometry(1.8, 0.42, 0.14).translate(1.95, 0, 0),
      new THREE.BoxGeometry(5.6, 0.1, 0.12).translate(0, -0.12, 0),
    ]),
  );
  const tail = new THREE.Mesh(tails, brake);
  tail.name = "tails";
  tail.position.set(0, CAR_LEN * 0.165, REAR);
  group.add(tail);
  if (detailed) {
    const heads = geo("car:heads", () =>
      mergeGeometries([
        new THREE.BoxGeometry(1.4, 0.32, 0.14).translate(-2, 0, 0),
        new THREE.BoxGeometry(1.4, 0.32, 0.14).translate(2, 0, 0),
      ]),
    );
    const head = new THREE.Mesh(heads, glow("#fff6d8", 2));
    head.name = "heads";
    head.position.set(0, CAR_LEN * 0.145, -REAR);
    group.add(head);
  }

  if (look.spoiler) {
    const wing = new THREE.Mesh(
      geo("car:wing", () => new THREE.BoxGeometry(CAR_W * 1.04, 0.14, 1.1)),
      paint(look.accent && look.accent !== "#111018" ? look.accent : look.color),
    );
    wing.position.set(0, CAR_LEN * 0.255, CAR_LEN * 0.44);
    group.add(wing);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(
        geo("car:post", () => new THREE.BoxGeometry(0.15, 0.55, 0.3)),
        DARK(),
      );
      post.position.set(side * 2.2, CAR_LEN * 0.232, CAR_LEN * 0.44);
      group.add(post);
    }
  }

  if (look.stripes && look.accent) {
    const stripeMat = paint(look.accent);
    for (const side of [-1, 1]) {
      const hood = new THREE.Mesh(
        geo("car:stripe-hood", () => new THREE.BoxGeometry(0.55, 0.05, CAR_LEN * 0.27)),
        stripeMat,
      );
      hood.position.set(side * 0.55, CAR_LEN * 0.197, -CAR_LEN * 0.33);
      hood.rotation.x = -0.12;
      group.add(hood);
      const trunk = new THREE.Mesh(
        geo("car:stripe-trunk", () => new THREE.BoxGeometry(0.55, 0.05, CAR_LEN * 0.22)),
        stripeMat,
      );
      trunk.position.set(side * 0.55, CAR_LEN * 0.214, CAR_LEN * 0.37);
      group.add(trunk);
    }
  }

  if (look.plate) {
    const plate = new THREE.Mesh(
      geo("car:plate", () => new THREE.PlaneGeometry(1.7, 0.64)),
      new THREE.MeshBasicMaterial({ map: plateTexture(look.plate) }),
    );
    plate.position.set(0, CAR_LEN * 0.1, REAR + 0.02);
    group.add(plate);
  }

  if (look.underglow) {
    const ug = new THREE.Mesh(
      geo("car:underglow", () => new THREE.PlaneGeometry(CAR_W * 1.9, CAR_LEN * 1.35).rotateX(-Math.PI / 2)),
      additive(look.underglow, 0.55),
    );
    ug.position.y = 0.05;
    group.add(ug);
  }

  return { group, wheels, brake, paintMeshes: [body, roof] };
}

export function buildTruck(color: string): THREE.Group {
  const group = new THREE.Group();
  const box = new THREE.Mesh(
    geo("truck:box", () => new THREE.BoxGeometry(CAR_W, 6.2, 11)),
    flat(color),
  );
  box.position.set(0, 4.3, 2.2);
  group.add(box);
  const cab = new THREE.Mesh(
    geo("truck:cab", () => new THREE.BoxGeometry(CAR_W * 0.95, 4.2, 4)),
    paint(color),
  );
  cab.position.set(0, 3.2, -5.6);
  group.add(cab);
  const glass = new THREE.Mesh(
    geo("truck:glass", () => new THREE.BoxGeometry(CAR_W * 0.9, 1.6, 0.2)),
    GLASS(),
  );
  glass.position.set(0, 4.3, -7.6);
  group.add(glass);
  const tire = geo("car:tire", () => new THREE.CylinderGeometry(0.95, 0.95, 0.95, 10).rotateZ(Math.PI / 2));
  for (const z of [5.5, 0.5, -5.5]) {
    for (const side of [-1, 1]) {
      const w = new THREE.Mesh(tire, TIRE());
      w.position.set(side * (CAR_W / 2 - 0.3), 0.95, z);
      group.add(w);
    }
  }
  for (const side of [-1, 1]) {
    const tail = new THREE.Mesh(
      geo("truck:tail", () => new THREE.BoxGeometry(1.2, 0.5, 0.12)),
      glow("#ff1f4b", 1.8),
    );
    tail.position.set(side * 2.3, 1.6, 7.75);
    group.add(tail);
  }
  return group;
}

// Coração estufado, girando devagar na pista.
export function heartGeometry() {
  return geo("heart", () => {
    const s = new THREE.Shape();
    const k = 4.2;
    s.moveTo(0, -0.35 * k);
    s.bezierCurveTo(-0.1 * k, -0.25 * k, -0.5 * k, -0.05 * k, -0.5 * k, 0.18 * k);
    s.bezierCurveTo(-0.5 * k, 0.42 * k, -0.15 * k, 0.5 * k, 0, 0.28 * k);
    s.bezierCurveTo(0.15 * k, 0.5 * k, 0.5 * k, 0.42 * k, 0.5 * k, 0.18 * k);
    s.bezierCurveTo(0.5 * k, -0.05 * k, 0.1 * k, -0.25 * k, 0, -0.35 * k);
    const g = new THREE.ExtrudeGeometry(s, {
      depth: 0.5,
      bevelEnabled: true,
      bevelThickness: 0.35,
      bevelSize: 0.3,
      bevelSegments: 3,
      curveSegments: 10,
    });
    g.center();
    return g;
  });
}

export function buildLamp(side: number): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    geo("lamp:pole", () => new THREE.CylinderGeometry(0.28, 0.35, 23, 6)),
    DARK(),
  );
  pole.position.y = 11.5;
  g.add(pole);
  const arm = new THREE.Mesh(
    geo("lamp:arm", () => new THREE.BoxGeometry(5.2, 0.35, 0.35)),
    DARK(),
  );
  arm.position.set(-side * 2.6, 23, 0);
  g.add(arm);
  const bulb = new THREE.Mesh(
    geo("lamp:bulb", () => new THREE.BoxGeometry(1.6, 0.35, 0.9)),
    glow("#ffd9a8", 3),
  );
  bulb.position.set(-side * 5, 22.75, 0);
  g.add(bulb);
  const halo = new THREE.Sprite(
    mat(
      "lamp:halo",
      () =>
        new THREE.SpriteMaterial({
          map: radialTexture(),
          color: "#ffb0d0",
          transparent: true,
          opacity: 0.55,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
    ),
  );
  halo.scale.set(9, 9, 1);
  halo.position.set(-side * 5, 22.4, 0);
  g.add(halo);
  // Poça de luz no asfalto molhado, esticada na direção da câmera.
  const pool = new THREE.Mesh(
    geo("lamp:pool", () => new THREE.PlaneGeometry(12, 26).rotateX(-Math.PI / 2)),
    additive("#ffb7c8", 0.08),
  );
  pool.position.set(-side * 5, 0.06, 3);
  g.add(pool);
  return g;
}

export function buildTree(): THREE.Group {
  const g = new THREE.Group();
  const wood = geo("tree", () => {
    const parts = [new THREE.CylinderGeometry(0.35, 0.6, 18, 5).translate(0, 9, 0)];
    for (const [y, rz, ry] of [
      [10, 0.7, 0],
      [12.5, -0.6, 1.2],
      [8, -0.8, 2.4],
      [14, 0.5, 3.6],
    ] as const) {
      const b = new THREE.CylinderGeometry(0.15, 0.3, 7, 4).translate(0, 3, 0);
      b.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, ry, rz)));
      parts.push(b.translate(0, y, 0));
    }
    return mergeGeometries(parts.map((p) => p.toNonIndexed()));
  });
  g.add(new THREE.Mesh(wood, flat("#1c1229")));
  const eyes = new THREE.Group();
  eyes.name = "eyes";
  for (const x of [-0.55, 0.55]) {
    const e = new THREE.Mesh(
      geo("tree:eye", () => new THREE.BoxGeometry(0.6, 0.3, 0.1)),
      glow("#ff1f3d", 3),
    );
    e.position.set(x, 6, 1);
    eyes.add(e);
  }
  eyes.visible = false;
  g.add(eyes);
  return g;
}

export function buildPole(): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    geo("pole:pole", () => new THREE.CylinderGeometry(0.3, 0.38, 26, 5)),
    DARK(),
  );
  pole.position.y = 13;
  g.add(pole);
  const bar = new THREE.Mesh(
    geo("pole:bar", () => new THREE.BoxGeometry(8, 0.4, 0.4)),
    DARK(),
  );
  bar.position.y = 24;
  g.add(bar);
  const light = new THREE.Mesh(
    geo("pole:light", () => new THREE.BoxGeometry(0.6, 0.6, 0.6)),
    glow("#ff2d55", 3),
  );
  light.name = "blink";
  light.position.y = 26.5;
  g.add(light);
  return g;
}

const textTexCache = new Map<string, THREE.Texture>();

// Painel de neon com texto, desenhado num canvas e usado como textura.
export function neonTexture(text: string, hue: string, font: string) {
  const key = `${text}|${hue}|${font}`;
  let t = textTexCache.get(key);
  if (t) return t;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 300;
  const g = c.getContext("2d");
  if (g) {
    g.fillStyle = "#0e0818";
    g.fillRect(0, 0, 512, 300);
    g.shadowColor = hue;
    g.shadowBlur = 24;
    g.strokeStyle = hue;
    g.lineWidth = 12;
    g.strokeRect(24, 24, 464, 252);
    g.fillStyle = hue;
    const size = Math.min(150, (512 * 1.5) / Math.max(3, text.length));
    g.font = `${Math.round(size)}px ${font}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, 256, 156, 440);
  }
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  textTexCache.set(key, t);
  return t;
}

export function buildBillboard(): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-5, 5]) {
    const post = new THREE.Mesh(
      geo("bb:post", () => new THREE.BoxGeometry(0.6, 9, 0.6)),
      DARK(),
    );
    post.position.set(x, 4.5, 0);
    g.add(post);
  }
  const back = new THREE.Mesh(
    geo("bb:back", () => new THREE.BoxGeometry(17, 10, 0.6)),
    DARK(),
  );
  back.position.set(0, 14, -0.35);
  g.add(back);
  const face = new THREE.Mesh(
    geo("bb:face", () => new THREE.PlaneGeometry(17, 10)),
    new THREE.MeshBasicMaterial({ toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6) }),
  );
  face.name = "face";
  face.position.set(0, 14, 0);
  g.add(face);
  return g;
}

export function buildGate(roadHalf: number): THREE.Group {
  const g = new THREE.Group();
  for (const side of [-1, 1]) {
    const p = new THREE.Mesh(
      geo("gate:pillar", () => new THREE.BoxGeometry(1.5, 30, 1.5)),
      flat("#2b1d3d"),
    );
    p.position.set(side * roadHalf * 1.2, 15, 0);
    g.add(p);
  }
  const banner = new THREE.Mesh(
    geo(`gate:banner:${roadHalf}`, () => new THREE.BoxGeometry(roadHalf * 2.4, 6, 0.8)),
    new THREE.MeshBasicMaterial({ toneMapped: false, color: new THREE.Color(1.5, 1.5, 1.5) }),
  );
  banner.name = "banner";
  banner.position.set(0, 27, 0);
  g.add(banner);
  return g;
}

let windowsTex: THREE.Texture | null = null;
// Fachada escura com janelas acesas (algumas quentes, outras frias).
export function windowsTexture() {
  if (windowsTex) return windowsTex;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  if (g) {
    g.fillStyle = "#07040d";
    g.fillRect(0, 0, 256, 256);
    let seed = 7;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let y = 8; y < 248; y += 16) {
      for (let x = 8; x < 248; x += 16) {
        const r = rand();
        if (r < 0.2) g.fillStyle = r < 0.05 ? "#9fd8ff" : r < 0.09 ? "#ff9ad5" : "#ffcf8a";
        else g.fillStyle = "#120c1c";
        g.fillRect(x, y, 9, 11);
      }
    }
  }
  windowsTex = new THREE.CanvasTexture(c);
  windowsTex.colorSpace = THREE.SRGBColorSpace;
  windowsTex.wrapS = windowsTex.wrapT = THREE.RepeatWrapping;
  return windowsTex;
}

export const BUILDING_TYPES: [number, number, number][] = [
  [18, 18, 60],
  [24, 20, 95],
  [14, 14, 40],
  [30, 24, 130],
  [20, 16, 72],
  [26, 26, 50],
];

// Caixa com UVs em escala de mundo, pra janelas terem sempre o mesmo tamanho.
export function buildingGeometry(type: number) {
  return geo(`building:${type}`, () => {
    const [w, d, h] = BUILDING_TYPES[type];
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(0, h / 2, 0);
    const uv = g.getAttribute("uv") as THREE.BufferAttribute;
    const cell = 16; // unidades por repetição da textura
    const faces: [number, number][] = [
      [d, h],
      [d, h],
      [0, 0],
      [0, 0],
      [w, h],
      [w, h],
    ];
    for (let f = 0; f < 6; f++) {
      const [fu, fv] = faces[f];
      for (let i = 0; i < 4; i++) {
        const idx = f * 4 + i;
        uv.setXY(idx, (uv.getX(idx) * fu) / cell, (uv.getY(idx) * fv) / cell);
      }
    }
    return g;
  });
}

export function buildingMaterial() {
  return mat("building", () => {
    const tex = windowsTexture();
    return new THREE.MeshStandardMaterial({
      color: "#2a2236",
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color(1, 1, 1),
      emissiveIntensity: 0.6,
      roughness: 0.8,
    });
  });
}

export function buildOverpass(roadHalf: number): THREE.Group {
  const g = new THREE.Group();
  const deckY = 25;
  for (const p of [-1.35, 1.35, -3.4, 3.4]) {
    const pillar = new THREE.Mesh(
      geo("op:pillar", () => new THREE.BoxGeometry(1.8, deckY, 1.8)),
      flat("#1d1528"),
    );
    pillar.position.set(p * roadHalf, deckY / 2, 0);
    g.add(pillar);
  }
  const deck = new THREE.Mesh(
    geo(`op:deck:${roadHalf}`, () => new THREE.BoxGeometry(roadHalf * 8.4, 4.2, 5)),
    flat("#14101c"),
  );
  deck.position.y = deckY + 2.1;
  g.add(deck);
  const train = new THREE.Group();
  train.name = "train";
  const carG = geo("op:car", () => new THREE.BoxGeometry(15, 6.2, 4));
  const winMat = mat("op:windows", () => {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 32;
    const x = c.getContext("2d");
    if (x) {
      x.fillStyle = "#3a3346";
      x.fillRect(0, 0, 128, 32);
      x.fillStyle = "#ffe2aa";
      for (let i = 0; i < 6; i++) x.fillRect(6 + i * 20, 9, 12, 12);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({
      map: t,
      emissiveMap: t,
      emissive: new THREE.Color(1.2, 1.1, 0.9),
      roughness: 0.7,
    });
  });
  for (let i = 0; i < 4; i++) {
    const car = new THREE.Mesh(carG, winMat);
    car.position.set(i * 15.6, deckY + 4.2 + 3.1, 0);
    train.add(car);
  }
  g.add(train);
  return g;
}
