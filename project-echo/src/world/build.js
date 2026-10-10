// Builds NODE-7 render meshes + collision world from the pure layout data.
// Static geometry is merged per material to keep draw calls low (Chromebook).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildLayout } from './layout.js';
import { CollisionWorld } from '../core/collision.js';
import { getTexture, makeLabelTexture } from './textures.js';

// Material palette: color, detail texture, texture scale (meters per repeat),
// worldUV (planar mapping in world space so long walls tile correctly).
const PALETTE = {
  facade: { color: 0x8f8a80, tex: 'windows', scale: 4, world: true },
  facadeFacility: { color: 0x6f7b85, tex: 'panel', scale: 3, world: true },
  brick: { color: 0x8a5a48, tex: 'brick', scale: 2.5, world: true },
  concrete: { color: 0x8c8b86, tex: 'concrete', scale: 3, world: true },
  concreteDark: { color: 0x5d5e5c, tex: 'concrete', scale: 3, world: true },
  plaster: { color: 0xb3b0a6, tex: 'noise', scale: 3, world: true },
  metalWall: { color: 0x5b6266, tex: 'rib', scale: 2, world: true },
  metalDark: { color: 0x3c4246, tex: 'rib', scale: 2, world: true },
  ceiling: { color: 0x8a8984, tex: 'tile', scale: 2.4, world: true },
  asphalt: { color: 0x47494b, tex: 'asphalt', scale: 6, world: true },
  asphaltDark: { color: 0x3b3c3d, tex: 'asphalt', scale: 5, world: true },
  concreteFloor: { color: 0x77766f, tex: 'concrete', scale: 4, world: true },
  tile: { color: 0x9c9a92, tex: 'tile', scale: 3, world: true },
  raisedFloor: { color: 0x7f8a90, tex: 'tile', scale: 2.4, world: true },
  carpet: { color: 0x4e5560, tex: 'carpet', scale: 3, world: true },
  grate: { color: 0x6c7175, tex: 'grate', scale: 1.2, world: true },
  woodFloor: { color: 0x7a5c40, tex: 'plank', scale: 2, world: true },
  ramp: { color: 0x6f6e68, tex: 'stripe', scale: 3, world: true },
  pillar: { color: 0x9a978e, tex: 'stripe', scale: 1.4, world: true },
  barrierConcrete: { color: 0xa7a59c, tex: 'stripe', scale: 1.6, world: true },
  rack: { color: 0xbdbdbd, tex: 'rack', scale: 2.2, world: true },
  crate: { color: 0x9b7448, tex: 'plank' },
  pallet: { color: 0x8a6a45, tex: 'plank' },
  palletStack: { color: 0x7e6a50, tex: 'plank' },
  shelf: { color: 0x6b5a48, tex: 'plank' },
  counter: { color: 0x5a524a, tex: 'noise' },
  desk: { color: 0x6c6a66, tex: 'noise' },
  cabinet: { color: 0x737a80, tex: 'panel' },
  bench: { color: 0x4d5257, tex: 'noise' },
  vending: { color: 0xa0382f, tex: 'panel' },
  car: { color: 0x2f4a63, tex: 'noise' },
  car2: { color: 0x7a7468, tex: 'noise' },
  van: { color: 0xc9c5ba, tex: 'panel' },
  truck: { color: 0x58636b, tex: 'rib' },
  trailer: { color: 0x7b8a8f, tex: 'rib' },
  dumpster: { color: 0x2f5a43, tex: 'rib' },
  kiosk: { color: 0x3f4a52, tex: 'panel' },
  pole: { color: 0x2e3236, tex: 'noise' },
  planter: { color: 0x6d6a62, tex: 'concrete' },
  terminal: { color: 0x2b3138, tex: 'panel' },
  console: { color: 0x3a4148, tex: 'panel' },
  electrical: { color: 0x707a80, tex: 'panel' },
  shutter: { color: 0x6d7275, tex: 'rib', scale: 2, world: true },
  glass: { color: 0x9fb8c4, transparent: true, opacity: 0.78 }, // frosted security glass: blocks sight and bullets
};

export class MaterialLibrary {
  constructor() { this.cache = {}; }
  get(name) {
    if (this.cache[name]) return this.cache[name];
    const p = PALETTE[name] || { color: 0x888888 };
    const m = new THREE.MeshLambertMaterial({
      color: p.color,
      map: p.tex ? getTexture(p.tex, name.length) : null,
      transparent: !!p.transparent,
      opacity: p.opacity ?? 1,
      depthWrite: !p.transparent,
    });
    m.userData.palette = p;
    this.cache[name] = m;
    return m;
  }
}

function boxGeometry(min, max, palette) {
  const w = max.x - min.x, h = max.y - min.y, d = max.z - min.z;
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2);
  if (palette?.world) {
    const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
    const s = palette.scale || 3;
    for (let i = 0; i < pos.count; i++) {
      const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (ny > 0.5) uv.setXY(i, x / s, z / s);
      else if (nx > 0.5) uv.setXY(i, z / s, y / s);
      else uv.setXY(i, x / s, y / s);
    }
  }
  return g;
}

export function buildWorld(scene, mats) {
  const layout = buildLayout();
  const world = new CollisionWorld();
  const groups = new Map();
  const addGeom = (mat, g) => {
    if (!groups.has(mat)) groups.set(mat, []);
    groups.get(mat).push(g);
  };

  for (const b of layout.boxes) {
    if (b.collide) world.add({ min: b.min, max: b.max, surface: b.surface, kind: b.kind, mat: b.mat });
    if (b.visual) addGeom(b.mat, boxGeometry(b.min, b.max, PALETTE[b.mat]));
  }

  // Floors and ceilings from areas.
  for (const a of layout.areas) {
    addGeom(a.floor, boxGeometry({ x: a.min.x, y: -0.1, z: a.min.z }, { x: a.max.x, y: 0, z: a.max.z }, PALETTE[a.floor]));
    if (a.ceiling) {
      const rects = a.id === 'garage'
        ? [[a.min.x, a.min.z, 40.6, a.max.z], [40.6, -42, a.max.x, a.max.z]]
        : [[a.min.x, a.min.z, a.max.x, a.max.z]];
      for (const [x0, z0, x1, z1] of rects) {
        const min = { x: x0, y: a.ceiling, z: z0 }, max = { x: x1, y: a.ceiling + 0.3, z: z1 };
        world.add({ min, max, surface: 'concrete', kind: 'static', mat: a.ceilMat });
        addGeom(a.ceilMat, boxGeometry(min, max, PALETTE[a.ceilMat]));
      }
      // Light panels (unlit emissive look, no real lights).
      const step = a.id.startsWith('tunnel') ? 7 : 6;
      const xs = [], zs = [];
      const w0 = a.max.x - a.min.x, d0 = a.max.z - a.min.z;
      if (w0 < step) xs.push((a.min.x + a.max.x) / 2); else for (let x = a.min.x + step / 2; x < a.max.x; x += step) xs.push(x);
      if (d0 < step) zs.push((a.min.z + a.max.z) / 2); else for (let z = a.min.z + step / 2; z < a.max.z; z += step) zs.push(z);
      for (const x of xs) {
        for (const z of zs) {
          if (a.id === 'garage' && x > 40.6 && z < -42) continue;
          const w = Math.min(1.6, (a.max.x - a.min.x) * 0.4), d = a.id.startsWith('tunnel') ? 1.2 : 0.5;
          addGeom('lightPanel', boxGeometry({ x: x - w / 2, y: a.ceiling - 0.05, z: z - d / 2 }, { x: x + w / 2, y: a.ceiling, z: z + d / 2 }));
        }
      }
    }
  }

  // Ramp visual: one sloped slab over the collision steps.
  {
    const r = layout.ramp;
    const len = Math.abs(r.z1 - r.z0);
    const g = new THREE.BoxGeometry(r.x1 - r.x0, 0.2, Math.hypot(len, r.top));
    g.rotateX(-Math.atan2(r.top, len));
    g.translate((r.x0 + r.x1) / 2, r.top / 2 - 0.05, (r.z0 + r.z1) / 2);
    addGeom('ramp', g);
  }

  // Decorative pipes (visual only).
  for (const p of layout.decor) {
    if (p.type !== 'pipe') continue;
    const len = p.axis === 'z' ? p.z1 - p.z0 : p.x1 - p.x0;
    const g = new THREE.CylinderGeometry(p.r, p.r, len, 6, 1, true);
    g.deleteAttribute('uv');
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (p.axis === 'z') { g.rotateX(Math.PI / 2); g.translate(p.x, p.y, (p.z0 + p.z1) / 2); } else { g.rotateZ(Math.PI / 2); g.translate((p.x0 + p.x1) / 2, p.y, p.z); }
    addGeom(p.mat, g);
  }

  // Skyline: tall building blocks outside the playable boundary (visual only).
  const sky = [
    [-60, 58, 60, 70, 18], [-60, -70, -46, 58, 14], [46, -70, 60, 58, 16], [-60, -70, 60, -54, 12],
    [-24, 2, -8, 46, 11], [8, -2, 17, 46, 13], [20.5, -30, 46, 58, 9], [-46, -30, -32, 58, 10],
  ];
  for (const [x0, z0, x1, z1, h] of sky) addGeom('facade', boxGeometry({ x: x0, y: 0, z: z0 }, { x: x1, y: h, z: z1 }, PALETTE.facade));

  const extraMats = {
    lightPanel: new THREE.MeshBasicMaterial({ color: 0xdfe8e6 }),
    pipe: new THREE.MeshLambertMaterial({ color: 0x6f777b }),
    pipeRed: new THREE.MeshLambertMaterial({ color: 0x8a3a2c }),
  };
  const staticMeshes = [];
  for (const [mat, geoms] of groups) {
    const merged = mergeGeometries(geoms, false);
    for (const g of geoms) g.dispose();
    const mesh = new THREE.Mesh(merged, extraMats[mat] || mats.get(mat));
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    mesh.receiveShadow = true;
    mesh.castShadow = !['asphalt', 'asphaltDark', 'concreteFloor', 'tile', 'carpet', 'grate', 'raisedFloor', 'woodFloor', 'lightPanel', 'glass'].includes(mat);
    if (mat === 'glass') mesh.renderOrder = 2;
    scene.add(mesh);
    staticMeshes.push(mesh);
  }

  // Area signage (callouts) for orientation.
  // [text, x, y, z, rotationY] — plane faces +z when rotationY = 0.
  const signs = [
    ['DATA ROOM', 0, 3.4, -17.75, 0],
    ['SECURITY', 0, 4.0, -1.75, 0],
    ['NODE-7', 0, 5.2, -1.75, 0],
    ['SERVER HALL', -8.75, 3.3, -10.5, Math.PI / 2],
    ['OFFICE WING', 8.75, 3.3, -7.5, -Math.PI / 2],
    ['◂ WEST DOCK  EXTRACT', -15, 2.6, -37.75, 0],
    ['GARAGE  EXTRACT ▸', 17, 2.6, -37.75, 0],
    ['TECH TUNNEL', 13.75, 3.6, 51.5, -Math.PI / 2],
    ['SERVICE ALLEY', -13.75, 3.0, 47.6, Math.PI / 2],
  ];
  for (const [text, x, y, z, ry] of signs) {
    const tex = makeLabelTexture(text);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(text.length > 12 ? 3.6 : 2.6, 0.62), new THREE.MeshBasicMaterial({ map: tex }));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    scene.add(m);
  }

  // Extraction zones: floor markings + light beam.
  const zoneMeshes = [];
  for (const z of layout.zones.extraction) {
    const w = z.max.x - z.min.x, d = z.max.z - z.min.z;
    const grp = new THREE.Group();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color: 0x2bd47d, transparent: true, opacity: 0.16, depthWrite: false }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.03;
    grp.add(floor);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, 0.02, d)), new THREE.LineBasicMaterial({ color: 0x3dff9a }));
    edges.position.y = 0.04;
    grp.add(edges);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 6, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0x3dff9a, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = 3;
    grp.add(beam);
    grp.position.set((z.min.x + z.max.x) / 2, 0, (z.min.z + z.max.z) / 2);
    scene.add(grp);
    zoneMeshes.push({ zone: z, group: grp, floor, beam });
  }

  // Terminal screen.
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.5), new THREE.MeshBasicMaterial({ color: 0x29c4ff }));
  screen.position.set(layout.terminal.x, 1.3, layout.terminal.z + 0.51);
  screen.rotation.x = -0.25;
  scene.add(screen);
  const screenBack = screen.clone();
  screenBack.material = screen.material;
  screenBack.position.z = layout.terminal.z - 0.51;
  screenBack.rotation.set(0.25, Math.PI, 0);
  scene.add(screenBack);

  return { layout, world, staticMeshes, zoneMeshes, terminalScreen: screen };
}

export function setupLighting(scene, preset) {
  scene.background = new THREE.Color(0x9aa6ad);
  scene.fog = new THREE.Fog(0x9aa6ad, 40, preset.far);
  const hemi = new THREE.HemisphereLight(0xdde6ee, 0x4a4540, 1.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.6);
  sun.position.set(30, 60, 25);
  sun.target.position.set(0, 0, 0);
  sun.shadow.mapSize.set(1024, 1024);
  const c = sun.shadow.camera;
  c.left = -60; c.right = 60; c.top = 60; c.bottom = -60; c.near = 10; c.far = 160;
  sun.shadow.bias = -0.0008;
  scene.add(sun, sun.target);
  return { hemi, sun };
}
