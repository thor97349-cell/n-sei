// Pooled impact decals, sparks and tracers (bounded: nothing accumulates).
import * as THREE from 'three';
import { WORLD } from '../config.js';

const SURFACE_COLORS = { wood: 0xc9a06a, metal: 0xffe0a0, concrete: 0xd8d4c8, outdoor: 0xb0aaa0, tile: 0xe0e0e0, flesh: 0xb02a20 };

export class Effects {
  constructor(scene) {
    this.scene = scene;
    // Decals: one shared material, ring buffer.
    const decalMat = new THREE.MeshBasicMaterial({ color: 0x141414, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    const decalGeo = new THREE.CircleGeometry(0.05, 6);
    this.decals = [];
    for (let i = 0; i < WORLD.maxDecals; i++) {
      const m = new THREE.Mesh(decalGeo, decalMat);
      m.visible = false;
      m.matrixAutoUpdate = false;
      scene.add(m);
      this.decals.push(m);
    }
    this.decalIdx = 0;
    // Sparks / dust puffs.
    this.sparks = [];
    const sparkGeo = new THREE.PlaneGeometry(0.18, 0.18);
    for (let i = 0; i < 16; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide });
      const m = new THREE.Mesh(sparkGeo, mat);
      m.visible = false;
      scene.add(m);
      this.sparks.push({ mesh: m, life: 0 });
    }
    this.sparkIdx = 0;
    // Tracers (bot shots, so the player can read incoming fire).
    this.tracers = [];
    for (let i = 0; i < 8; i++) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0.8 }));
      l.visible = false;
      l.frustumCulled = false;
      scene.add(l);
      this.tracers.push({ line: l, life: 0 });
    }
    this.tracerIdx = 0;
    this._q = new THREE.Quaternion();
    this._n = new THREE.Vector3();
    this._z = new THREE.Vector3(0, 0, 1);
  }

  impact(point, normal, surface) {
    const d = this.decals[this.decalIdx];
    this.decalIdx = (this.decalIdx + 1) % this.decals.length;
    this._n.set(normal.x, normal.y, normal.z);
    this._q.setFromUnitVectors(this._z, this._n);
    d.position.set(point.x + normal.x * 0.01, point.y + normal.y * 0.01, point.z + normal.z * 0.01);
    d.quaternion.copy(this._q);
    d.updateMatrix();
    d.visible = true;
    this.spark(point, normal, surface);
  }

  spark(point, normal, surface) {
    const s = this.sparks[this.sparkIdx];
    this.sparkIdx = (this.sparkIdx + 1) % this.sparks.length;
    s.mesh.material.color.setHex(SURFACE_COLORS[surface] || 0xffffff);
    s.mesh.position.set(point.x + normal.x * 0.05, point.y + normal.y * 0.05, point.z + normal.z * 0.05);
    s.mesh.lookAt(point.x + normal.x, point.y + normal.y, point.z + normal.z);
    s.mesh.rotation.z = Math.random() * 6;
    s.life = 0.09;
    s.mesh.visible = true;
  }

  tracer(from, to) {
    const t = this.tracers[this.tracerIdx];
    this.tracerIdx = (this.tracerIdx + 1) % this.tracers.length;
    const a = t.line.geometry.attributes.position.array;
    a[0] = from.x; a[1] = from.y; a[2] = from.z; a[3] = to.x; a[4] = to.y; a[5] = to.z;
    t.line.geometry.attributes.position.needsUpdate = true;
    t.line.visible = true;
    t.life = 0.06;
  }

  clear() {
    for (const d of this.decals) d.visible = false;
  }

  update(dt) {
    for (const s of this.sparks) if (s.life > 0) {
      s.life -= dt;
      const k = Math.max(0, s.life / 0.09);
      s.mesh.scale.setScalar(0.6 + (1 - k) * 0.8);
      s.mesh.material.opacity = k;
      if (s.life <= 0) s.mesh.visible = false;
    }
    for (const t of this.tracers) if (t.life > 0) { t.life -= dt; if (t.life <= 0) t.line.visible = false; }
  }
}
