// Interactive doors and destructible wooden barricades.
import * as THREE from 'three';
import { WORLD } from '../config.js';

const doorMat = new THREE.MeshLambertMaterial({ color: 0x55606a });
const doorStripe = new THREE.MeshLambertMaterial({ color: 0xd59a2a });
const woodMats = [0x8c6a42, 0x7d5d39, 0x9a7650].map((c) => new THREE.MeshLambertMaterial({ color: c }));
const woodDamaged = new THREE.MeshLambertMaterial({ color: 0x5e452c });

export class Door {
  constructor(def, scene, world, emit) {
    this.def = def;
    this.id = def.id;
    this.name = def.name;
    this.emit = emit;
    this.closedMin = { ...def.min };
    this.closedMax = { ...def.max };
    this.initialOpen = def.open;
    this.t = def.open ? 1 : 0; // 0 closed .. 1 open
    this.target = this.t;
    this.collider = world.add({ min: { ...def.min }, max: { ...def.max }, kind: 'door', surface: 'metal', ref: this });
    this.world = world;
    const w = def.max.x - def.min.x, h = def.max.y - def.min.y, d = def.max.z - def.min.z;
    this.mesh = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), doorMat);
    this.mesh.add(slab);
    for (const y of [-h / 2 + 0.25, 0.1]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(w + 0.01, 0.12, d + 0.01), doorStripe);
      stripe.position.y = y;
      this.mesh.add(stripe);
    }
    this.center = { x: (def.min.x + def.max.x) / 2, y: h / 2, z: (def.min.z + def.max.z) / 2 };
    scene.add(this.mesh);
    this.blockedBy = null; // function(box) -> true if an actor is in the way
    this.apply();
  }

  get isOpen() { return this.t > 0.95; }
  get isClosed() { return this.t < 0.02; }
  get moving() { return this.t !== this.target; }

  setOpen(open, source = 'player') {
    const tgt = open ? 1 : 0;
    if (this.target === tgt) return false;
    this.target = tgt;
    this.emit('door', this.center, { source, surface: 'metal' });
    return true;
  }

  toggle(source) { return this.setOpen(this.target < 0.5, source); }

  reset() { this.t = this.target = this.initialOpen ? 1 : 0; this.apply(); }

  boxAt(t) {
    const off = this.def.dist * t;
    const min = { ...this.closedMin }, max = { ...this.closedMax };
    min[this.def.axis] += off; max[this.def.axis] += off;
    return { min, max };
  }

  update(dt) {
    if (this.t === this.target) return;
    const step = WORLD.doorSpeed * dt;
    let next = this.t < this.target ? Math.min(this.target, this.t + step) : Math.max(this.target, this.t - step);
    // Closing into an actor: stop and re-open (never trap or push players into walls).
    if (next < this.t && this.blockedBy && this.blockedBy(this.boxAt(next))) {
      this.target = 1;
      next = this.t;
    }
    this.t = next;
    this.apply();
  }

  apply() {
    const b = this.boxAt(this.t);
    this.collider.min = b.min; this.collider.max = b.max;
    this.world.update(this.collider);
    this.mesh.position.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
  }
}

export class Barricade {
  constructor(def, scene, world, emit) {
    this.def = def;
    this.id = def.id;
    this.name = def.name;
    this.emit = emit;
    this.maxHealth = WORLD.barricadeHealth;
    this.health = this.maxHealth;
    this.collider = world.add({ min: { ...def.min }, max: { ...def.max }, kind: 'barricade', surface: 'wood', ref: this });
    this.group = new THREE.Group();
    this.center = { x: (def.min.x + def.max.x) / 2, y: 1.2, z: (def.min.z + def.max.z) / 2 };
    // Planks across the opening (along z), stacked vertically.
    const len = def.max.z - def.min.z + 0.2;
    const height = def.max.y - def.min.y;
    this.planks = [];
    const n = 7;
    for (let i = 0; i < n; i++) {
      const g = new THREE.BoxGeometry(0.12, height / n - 0.06, len * (0.92 + ((i * 37) % 10) / 100));
      const m = new THREE.Mesh(g, woodMats[i % 3]);
      m.position.set(this.center.x + (i % 2 ? 0.08 : -0.08), (i + 0.5) * (height / n), this.center.z + (((i * 13) % 5) - 2) * 0.03);
      m.rotation.x = (((i * 7) % 5) - 2) * 0.03;
      this.group.add(m);
      this.planks.push(m);
    }
    // Two diagonal braces.
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, Math.hypot(len, height) * 0.95), woodMats[1]);
      m.position.set(this.center.x + 0.16 * s, height / 2, this.center.z);
      m.rotation.x = Math.atan2(height, len) * s;
      this.group.add(m);
      this.planks.push(m);
    }
    // Broken remains (shown after destruction; no collision).
    this.debris = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.6 + i * 0.25), woodDamaged);
      m.position.set(this.center.x + (i - 1.5) * 0.45, 0.05, this.center.z + ((i * 31) % 7 - 3) * 0.3);
      m.rotation.y = (i - 1.5) * 0.7;
      this.debris.add(m);
    }
    for (const s of [-1, 1]) { // splintered stubs at the frame edges
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.18), woodDamaged);
      m.position.set(this.center.x, 0.45, s > 0 ? def.max.z - 0.05 : def.min.z + 0.05);
      this.debris.add(m);
    }
    this.debris.visible = false;
    scene.add(this.group, this.debris);
    this.flash = 0;
  }

  get destroyed() { return this.health <= 0; }

  damage(amount, point) {
    if (this.destroyed) return false;
    this.health = Math.max(0, this.health - amount);
    this.flash = 0.08;
    this.emit('barricade_hit', point || this.center, { source: 'world', surface: 'wood' });
    const frac = this.health / this.maxHealth;
    // Progressive visual damage: knock planks out as health drops.
    const remove = Math.floor((1 - frac) * (this.planks.length - 2));
    this.planks.forEach((p, i) => {
      const order = (i * 5) % this.planks.length;
      p.visible = order >= remove;
      if (frac < 0.5) p.material = i % 2 ? woodDamaged : p.material;
    });
    if (this.health <= 0) {
      this.collider.active = false;
      this.group.visible = false;
      this.debris.visible = true;
      this.emit('barricade_break', this.center, { source: 'world', surface: 'wood' });
      return true;
    }
    return false;
  }

  update(dt) {
    if (this.flash > 0) {
      this.flash -= dt;
      const jitter = this.flash > 0 ? 0.02 : 0;
      this.group.position.x = (Math.random() - 0.5) * jitter;
    }
  }

  reset() {
    this.health = this.maxHealth;
    this.collider.active = true;
    this.group.visible = true;
    this.debris.visible = false;
    this.planks.forEach((p, i) => { p.visible = true; p.material = i >= 7 ? woodMats[1] : woodMats[i % 3]; });
  }
}
