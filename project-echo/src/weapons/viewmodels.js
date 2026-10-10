// Procedural first-person weapon models (boxes and cylinders only).
// Each builder returns { group, muzzle (Object3D at barrel tip), sightY, adsZ }.
import * as THREE from 'three';

const M = {
  metal: new THREE.MeshLambertMaterial({ color: 0x2c3034 }),
  metalLight: new THREE.MeshLambertMaterial({ color: 0x4a5055 }),
  polymer: new THREE.MeshLambertMaterial({ color: 0x3a3833 }),
  tan: new THREE.MeshLambertMaterial({ color: 0x8b7b5e }),
  glove: new THREE.MeshLambertMaterial({ color: 0x23272b }),
  sleeve: new THREE.MeshLambertMaterial({ color: 0x3b4a3f }),
  sightGlow: new THREE.MeshBasicMaterial({ color: 0xff5a2a }),
  dataCase: new THREE.MeshLambertMaterial({ color: 0x1e2226 }),
  dataGlow: new THREE.MeshBasicMaterial({ color: 0x29c4ff }),
};

function b(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function cyl(r, len, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat);
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function hands(group, gripZ, foreZ, foreY = -0.02) {
  // Right hand on the grip, left hand on the handguard.
  b(0.07, 0.09, 0.1, M.glove, 0.0, -0.07, gripZ, group);
  b(0.09, 0.09, 0.32, M.sleeve, 0.04, -0.11, gripZ + 0.22, group).rotation.x = 0.35;
  if (foreZ !== null) {
    b(0.09, 0.06, 0.11, M.glove, -0.005, foreY - 0.035, foreZ, group);
    const arm = b(0.09, 0.09, 0.36, M.sleeve, -0.09, foreY - 0.12, foreZ + 0.2, group);
    arm.rotation.set(0.3, -0.35, 0);
  }
}

export function buildRifle() {
  const g = new THREE.Group();
  b(0.06, 0.08, 0.42, M.metal, 0, 0, 0, g); // receiver
  b(0.065, 0.07, 0.3, M.tan, 0, -0.005, -0.33, g); // handguard
  cyl(0.012, 0.28, M.metalLight, 0, 0.005, -0.6, g); // barrel
  cyl(0.02, 0.06, M.metal, 0, 0.005, -0.75, g); // muzzle brake
  b(0.04, 0.13, 0.07, M.polymer, 0, -0.1, 0.07, g).rotation.x = -0.25; // grip
  b(0.045, 0.16, 0.07, M.metal, 0, -0.11, -0.1, g).rotation.x = 0.2; // magazine
  b(0.05, 0.08, 0.2, M.tan, 0, -0.02, 0.29, g); // stock
  b(0.055, 0.11, 0.04, M.polymer, 0, -0.03, 0.39, g);
  b(0.02, 0.012, 0.36, M.metalLight, 0, 0.046, -0.08, g); // top rail
  // Reflex sight: frame + glowing dot. The dot defines the ADS line.
  b(0.045, 0.005, 0.05, M.metal, 0, 0.055, -0.02, g);
  b(0.006, 0.045, 0.05, M.metal, -0.022, 0.078, -0.02, g);
  b(0.006, 0.045, 0.05, M.metal, 0.022, 0.078, -0.02, g);
  b(0.045, 0.006, 0.05, M.metal, 0, 0.1, -0.02, g);
  b(0.004, 0.004, 0.002, M.sightGlow, 0, 0.078, -0.02, g);
  hands(g, 0.07, -0.33);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.005, -0.8);
  g.add(muzzle);
  return { group: g, muzzle, sightY: 0.078, hip: new THREE.Vector3(0.17, -0.17, -0.42), ads: new THREE.Vector3(0, -0.078, -0.33) };
}

export function buildPistol() {
  const g = new THREE.Group();
  b(0.04, 0.045, 0.2, M.metal, 0, 0, -0.04, g); // slide
  b(0.036, 0.03, 0.17, M.polymer, 0, -0.035, -0.035, g); // frame
  b(0.034, 0.11, 0.05, M.polymer, 0, -0.095, 0.035, g).rotation.x = -0.2; // grip
  b(0.006, 0.012, 0.01, M.metalLight, 0, 0.028, -0.13, g); // front sight
  b(0.03, 0.012, 0.01, M.metalLight, 0, 0.028, 0.045, g); // rear sight
  b(0.004, 0.004, 0.004, M.sightGlow, 0, 0.034, -0.13, g);
  // Two-handed grip: gloves wrap the grip, forearms angle back toward the camera.
  b(0.05, 0.08, 0.07, M.glove, 0.0, -0.08, 0.04, g);
  b(0.05, 0.07, 0.07, M.glove, -0.035, -0.085, 0.03, g);
  const fr = b(0.07, 0.07, 0.22, M.sleeve, 0.05, -0.13, 0.17, g); fr.rotation.set(0.35, 0.35, 0);
  const fl = b(0.07, 0.07, 0.22, M.sleeve, -0.08, -0.13, 0.16, g); fl.rotation.set(0.35, -0.45, 0);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.0, -0.15);
  g.add(muzzle);
  return { group: g, muzzle, sightY: 0.034, hip: new THREE.Vector3(0.12, -0.12, -0.42), ads: new THREE.Vector3(0, -0.034, -0.36) };
}

export function buildDataModule() {
  const g = new THREE.Group();
  b(0.14, 0.09, 0.2, M.dataCase, 0, 0, 0, g);
  b(0.145, 0.015, 0.16, M.dataGlow, 0, 0.02, 0, g);
  b(0.05, 0.02, 0.02, M.metalLight, 0, 0.055, 0, g);
  return g;
}

export function buildMuzzleFlash() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const grd = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grd.addColorStop(0, 'rgba(255,250,220,1)');
  grd.addColorStop(0.3, 'rgba(255,190,90,0.9)');
  grd.addColorStop(1, 'rgba(255,120,30,0)');
  ctx.fillStyle = grd;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2, r = i % 2 ? 12 : 31;
    ctx.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
  }
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), mat);
  m.visible = false;
  return m;
}
