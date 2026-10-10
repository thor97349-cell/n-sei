// Defender bots: waypoint navigation, line-of-sight vision, sound investigation,
// and combat using exactly the same weapon/damage rules as the player.
import * as THREE from 'three';
import { AI, AUDIO, WEAPONS, PLAYER } from '../config.js';
import { humanHitboxes } from '../core/collision.js';
import { RecoilState, computeInaccuracy, spreadOffset, dirFromAngles } from '../core/combat.js';

const DEG = Math.PI / 180;
const BOT_R = 0.32, BOT_H = 1.75, EYE = 1.6;

const mats = {
  uniform: new THREE.MeshLambertMaterial({ color: 0x2d3640 }),
  vest: new THREE.MeshLambertMaterial({ color: 0x1d2226 }),
  pants: new THREE.MeshLambertMaterial({ color: 0x3a3f45 }),
  helmet: new THREE.MeshLambertMaterial({ color: 0x23282c }),
  visor: new THREE.MeshBasicMaterial({ color: 0xff7a1a }),
  skin: new THREE.MeshLambertMaterial({ color: 0x9c7a62 }),
  gun: new THREE.MeshLambertMaterial({ color: 0x1b1d1f }),
  flash: new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9 }),
  hit: new THREE.MeshBasicMaterial({ color: 0xff3b2f }),
};

function part(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function buildBotMesh() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const legL = new THREE.Group(); legL.position.set(-0.11, 0.85, 0); body.add(legL);
  const legR = new THREE.Group(); legR.position.set(0.11, 0.85, 0); body.add(legR);
  part(0.17, 0.85, 0.2, mats.pants, 0, -0.425, 0, legL);
  part(0.17, 0.85, 0.2, mats.pants, 0, -0.425, 0, legR);
  part(0.42, 0.6, 0.26, mats.uniform, 0, 1.15, 0, body);
  part(0.44, 0.42, 0.3, mats.vest, 0, 1.2, 0, body);
  part(0.2, 0.22, 0.22, mats.skin, 0, 1.58, 0, body);
  part(0.25, 0.14, 0.27, mats.helmet, 0, 1.69, 0, body);
  part(0.2, 0.05, 0.02, mats.visor, 0, 1.6, -0.115, body);
  // Arms holding a rifle forward.
  const armL = part(0.11, 0.11, 0.46, mats.uniform, -0.19, 1.3, -0.2, body); armL.rotation.y = 0.35;
  const armR = part(0.11, 0.11, 0.4, mats.uniform, 0.2, 1.28, -0.12, body); armR.rotation.y = -0.1;
  const gun = new THREE.Group(); gun.position.set(0.05, 1.33, -0.35); body.add(gun);
  part(0.06, 0.09, 0.62, mats.gun, 0, 0, 0, gun);
  part(0.04, 0.14, 0.06, mats.gun, 0, -0.1, 0.08, gun);
  const flash = part(0.12, 0.12, 0.2, mats.flash, 0, 0, -0.42, gun);
  flash.visible = false;
  return { root, body, legL, legR, flash, gun };
}

export class Bot {
  constructor(def, game, index) {
    this.def = def;
    this.name = def.name;
    this.game = game;
    this.index = index;
    this.weapon = WEAPONS[AI.weapon];
    this.recoil = new RecoilState(this.weapon);
    this.mesh = buildBotMesh();
    game.scene.add(this.mesh.root);
    this.hitboxes = humanHitboxes(BOT_H);
    this.pos = { x: 0, y: 0, z: 0 };
    this.moveState = { vy: 0, grounded: true };
    this.reset();
  }

  reset() {
    const posts = this.def.posts;
    const [node, look] = posts[Math.floor(Math.random() * posts.length)];
    const n = this.game.layout.nodes[node];
    this.postNode = node;
    this.postYaw = look;
    this.pos = { x: n.x, y: 0, z: n.z };
    this.moveState = { vy: 0, grounded: true };
    this.yaw = look;
    this.aimPitch = 0;
    this.health = AI.health;
    this.armor = AI.armor;
    this.alive = true;
    this.state = 'guard';
    this.stateTime = 0;
    this.path = null;
    this.pathIdx = 0;
    this.target = null; // final world point for movement
    this.canSee = false;
    this.visionTimer = Math.random() * AI.visionInterval;
    this.lastSeen = null;
    this.lastSeenTime = -99;
    this.reaction = 0;
    this.trackTime = 0;
    this.burstLeft = 0;
    this.burstPause = 0;
    this.fireCooldown = 0;
    this.mag = this.weapon.magSize;
    this.reloadTimer = 0;
    this.strafeDir = 1;
    this.strafeTimer = 0;
    this.patrolIdx = 0;
    this.pauseTimer = 1 + Math.random() * 2;
    this.speed = 0;
    this.walkPhase = 0;
    this.stepDist = 0;
    this.stuckTimer = 0;
    this.lastProgressPos = { ...this.pos };
    this.deathTime = 0;
    this.flashTimer = 0;
    this.hitFlash = 0;
    this.investigatePos = null;
    this.arrived = false;
    this.stuckCount = 0;
    this.lookAroundBase = look;
    this.waitDoor = null;
    this.mesh.root.visible = true;
    this.mesh.root.rotation.set(0, look, 0);
    this.mesh.body.rotation.set(0, 0, 0);
    this.mesh.body.position.set(0, 0, 0);
    this.recoil.reset();
    this.syncMesh();
  }

  get eye() { return { x: this.pos.x, y: this.pos.y + EYE, z: this.pos.z }; }

  // ------------------------------------------------------------ perception
  checkVision() {
    const p = this.game.player;
    if (!p.alive) return false;
    const e = this.eye;
    const head = p.eye;
    const dx = head.x - e.x, dz = head.z - e.z;
    const dist = Math.hypot(dx, dz);
    if (dist > AI.viewDistance) return false;
    // Field of view (wider while recently engaged — they are tracking you).
    const recently = this.game.time - this.lastSeenTime < 2;
    const ang = Math.atan2(-dx, -dz);
    let rel = ang - this.yaw;
    rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    if (!recently && dist > 2.5 && Math.abs(rel) > (AI.fov * DEG) / 2) return false;
    const w = this.game.world;
    const filter = (c) => c.kind !== 'barrier';
    const chest = { x: p.pos.x, y: p.smoothY + p.height * 0.6, z: p.pos.z };
    return w.lineClear(e, head, filter) || w.lineClear(e, chest, filter);
  }

  // Sound event heard? Bots react to player-made and world (barricade) sounds,
  // investigating an approximate origin — never the player's exact position.
  hear(type, pos, source) {
    if (!this.alive || source === 'bot') return;
    const def = AUDIO.events[type];
    if (!def) return;
    const d = Math.hypot(pos.x - this.pos.x, pos.z - this.pos.z);
    if (d > def.radius) return;
    const occ = this.game.world.countOccluders(this.eye, { x: pos.x, y: pos.y + 1, z: pos.z }, 3);
    const effective = def.radius * Math.pow(AUDIO.occlusionHearingPerWall, occ);
    if (d > effective) return;
    if (this.state === 'engage' && this.canSee) return;
    const err = Math.min(AI.soundPositionErrorMax, d * AI.soundPositionError);
    const a = Math.random() * Math.PI * 2;
    const approx = { x: pos.x + Math.cos(a) * err * Math.random(), z: pos.z + Math.sin(a) * err * Math.random() };
    const urgent = type.startsWith('shot') || type === 'barricade_break' || type === 'terminal_done' || type === 'terminal_start';
    // Keep investigating the most recent/most important cue.
    if (this.state === 'investigate' && !urgent && this.stateTime < 1.5) return;
    this.investigate(approx, urgent);
  }

  investigate(point, urgent) {
    this.state = 'investigate';
    this.stateTime = 0;
    this.investigatePos = point;
    this.arrived = false;
    this.runFast = urgent;
    this.setDestination(point);
    // Glance toward the sound immediately.
    this.lookAroundBase = Math.atan2(-(point.x - this.pos.x), -(point.z - this.pos.z));
  }

  onDamaged(fromPos) {
    if (!this.alive) return;
    if (!this.canSee) {
      // Turn toward the shooter's approximate direction and investigate.
      const err = 3;
      this.investigate({ x: fromPos.x + (Math.random() - 0.5) * err, z: fromPos.z + (Math.random() - 0.5) * err }, true);
      this.yaw = Math.atan2(-(fromPos.x - this.pos.x), -(fromPos.z - this.pos.z));
    }
    this.hitFlash = 0.1;
  }

  // ------------------------------------------------------------ navigation
  setDestination(point) {
    const nav = this.game.nav;
    const w = this.game.world;
    const clear = (x0, z0, x1, z1) => w.lineClear({ x: x0, y: 1.0, z: z0 }, { x: x1, y: 1.0, z: z1 }, (c) => c.kind !== 'barrier');
    const start = nav.nearest(this.pos.x, this.pos.z, clear);
    const end = nav.nearest(point.x, point.z, clear);
    const path = nav.path(start, end);
    this.path = path || [start];
    this.pathIdx = 0;
    // Skip the first node when the second is directly reachable (avoids backtracking).
    if (this.path.length >= 2) {
      const n1 = this.game.layout.nodes[this.path[1]];
      if (w.lineClear({ x: this.pos.x, y: 1.0, z: this.pos.z }, { x: n1.x, y: 1.0, z: n1.z })) this.pathIdx = 1;
    }
    this.target = point;
    this.stuckTimer = 0;
  }

  currentWaypoint() {
    if (!this.path) return null;
    if (this.pathIdx < this.path.length) {
      const n = this.game.layout.nodes[this.path[this.pathIdx]];
      return { x: n.x, z: n.z, node: n.id };
    }
    return this.target ? { x: this.target.x, z: this.target.z, node: null } : null;
  }

  // Move along the path; returns true when the destination is reached.
  followPath(dt, speed) {
    const wp = this.currentWaypoint();
    if (!wp) return true;
    // Opening doors on the way.
    if (wp.node && this.pathIdx > 0) {
      const edge = this.game.nav.edgeBetween(this.path[this.pathIdx - 1], wp.node);
      if (edge?.door) {
        const door = this.game.doors[edge.door];
        if (!door.isOpen) {
          if (door.target < 0.5) door.setOpen(true, 'bot');
          this.speed = 0;
          this.faceTowards(wp.x, wp.z, dt);
          return false;
        }
      }
    }
    const dx = wp.x - this.pos.x, dz = wp.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.45) {
      this.pathIdx++;
      if (this.pathIdx > this.path.length || (this.pathIdx === this.path.length && !this.target)) return true;
      // Skip the final straight leg if the target is basically the node.
      if (this.pathIdx === this.path.length && this.target && Math.hypot(this.target.x - this.pos.x, this.target.z - this.pos.z) < 0.5) return true;
      return false;
    }
    // If the target point is directly reachable, skip remaining nodes.
    if (this.target && this.pathIdx < this.path.length && this.pathIdx >= this.path.length - 1) {
      if (this.game.world.lineClear({ x: this.pos.x, y: 1, z: this.pos.z }, { x: this.target.x, y: 1, z: this.target.z })) this.pathIdx = this.path.length;
    }
    this.moveDir(dx / d, dz / d, speed, dt);
    this.faceTowards(wp.x, wp.z, dt);
    // Stuck detection: re-plan if no progress.
    this.stuckTimer += dt;
    if (this.stuckTimer > 1.2) {
      const prog = Math.hypot(this.pos.x - this.lastProgressPos.x, this.pos.z - this.lastProgressPos.z);
      this.lastProgressPos = { ...this.pos };
      this.stuckTimer = 0;
      if (prog < 0.3) {
        if (this.target) this.setDestination(this.target); else this.pathIdx++;
        if (this.stuckCount++ > 3) { this.stuckCount = 0; return true; }
      } else this.stuckCount = 0;
    }
    return false;
  }

  moveDir(nx, nz, speed, dt) {
    const before = { x: this.pos.x, z: this.pos.z };
    this.moveState.vy -= PLAYER.gravity * dt;
    this.game.world.move(this.pos, { x: nx * speed * dt, y: this.moveState.vy * dt, z: nz * speed * dt }, BOT_R, BOT_H, PLAYER.stepHeight, this.moveState);
    const moved = Math.hypot(this.pos.x - before.x, this.pos.z - before.z);
    this.speed = moved / Math.max(dt, 1e-4);
    this.walkPhase += moved * 3.2;
    this.stepDist += moved;
    const stride = speed > 3 ? 2.0 : 1.6;
    if (this.stepDist > stride) {
      this.stepDist = 0;
      this.game.emit(speed > 3 ? 'step_run' : 'step_walk', this.pos, { source: 'bot' });
    }
  }

  faceTowards(x, z, dt, rate = AI.turnSpeed) {
    const want = Math.atan2(-(x - this.pos.x), -(z - this.pos.z));
    this.turnTo(want, dt, rate);
  }

  turnTo(want, dt, rate = AI.turnSpeed) {
    let d = want - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const step = rate * dt;
    this.yaw += Math.abs(d) <= step ? d : Math.sign(d) * step;
  }

  // ------------------------------------------------------------ main update
  update(dt, active) {
    if (!this.alive) { this.updateDeath(dt); return; }
    this.recoil.update(dt);
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.flashTimer > 0) { this.flashTimer -= dt; this.mesh.flash.visible = this.flashTimer > 0; }
    this.speed = 0;
    if (!active) { this.syncMesh(); return; }
    this.stateTime += dt;

    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) this.mag = this.weapon.magSize;
    }

    this.visionTimer -= dt;
    if (this.visionTimer <= 0) {
      this.visionTimer = AI.visionInterval;
      const saw = this.canSee;
      this.canSee = this.checkVision();
      if (this.canSee) {
        const p = this.game.player;
        this.lastSeen = { x: p.pos.x, z: p.pos.z };
        this.lastSeenTime = this.game.time;
        if (this.state !== 'engage') {
          this.state = 'engage';
          this.stateTime = 0;
          const dist = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
          this.reaction = AI.reactionTime + dist * AI.reactionPerMeter + Math.random() * 0.15;
          this.trackTime = 0;
          this.burstLeft = 0;
          this.burstPause = 0;
        }
      } else if (saw) {
        this.trackTime = 0;
      }
    }

    switch (this.state) {
      case 'guard': this.doGuard(dt); break;
      case 'patrol': this.doPatrol(dt); break;
      case 'investigate': this.doInvestigate(dt); break;
      case 'search': this.doSearch(dt); break;
      case 'return': this.doReturn(dt); break;
      case 'engage': this.doEngage(dt); break;
    }
    this.syncMesh();
  }

  doGuard(dt) {
    // Hold the post, sweeping the view slowly.
    const n = this.game.layout.nodes[this.postNode];
    if (Math.hypot(n.x - this.pos.x, n.z - this.pos.z) > 0.6) { this.state = 'return'; this.setDestination({ x: n.x, z: n.z }); return; }
    this.turnTo(this.postYaw + Math.sin(this.stateTime * 0.5 + this.index) * 0.7, dt, 1.5);
    if (this.def.role === 'patrol' && this.stateTime > 4 + this.index * 2) {
      this.state = 'patrol';
      this.stateTime = 0;
      this.patrolIdx = 0;
      this.pauseTimer = 0;
      this.path = null;
    } else if (this.def.role === 'guard' && this.stateTime > 12) {
      // Guards occasionally reposition within their room.
      const route = this.def.patrol;
      const next = route[Math.floor(Math.random() * route.length)];
      const nn = this.game.layout.nodes[next];
      this.postNode = next;
      this.postYaw = Math.atan2(-(this.game.layout.terminal.x - nn.x), -(this.game.layout.terminal.z - nn.z)) + Math.PI;
      this.state = 'return';
      this.setDestination({ x: nn.x, z: nn.z });
    }
  }

  doPatrol(dt) {
    const route = this.def.patrol;
    if (this.pauseTimer > 0) {
      this.pauseTimer -= dt;
      this.turnTo(this.lookAroundBase + Math.sin(this.stateTime * 1.3) * 0.9, dt, 2);
      return;
    }
    if (!this.path) {
      const n = this.game.layout.nodes[route[this.patrolIdx % route.length]];
      this.setDestination({ x: n.x, z: n.z });
    }
    if (this.followPath(dt, AI.patrolSpeed)) {
      this.patrolIdx++;
      this.path = null;
      this.lookAroundBase = this.yaw;
      if (Math.random() < 0.4) this.pauseTimer = 1 + Math.random() * 2;
    }
  }

  doInvestigate(dt) {
    if (!this.arrived) {
      if (this.followPath(dt, this.runFast ? AI.investigateSpeed : AI.patrolSpeed)) { this.arrived = true; this.stateTime = 0; this.lookAroundBase = this.yaw; }
      return;
    }
    this.turnTo(this.lookAroundBase + Math.sin(this.stateTime * 1.6) * 1.4, dt, 2.5);
    if (this.stateTime > AI.investigateLookTime) { this.arrived = false; this.goHome(); }
  }

  doSearch(dt) {
    // Go to where the player was last SEEN (not where they are now).
    if (!this.arrived) {
      if (this.followPath(dt, AI.investigateSpeed)) { this.arrived = true; this.stateTime = 0; this.lookAroundBase = this.yaw; }
      return;
    }
    this.turnTo(this.lookAroundBase + Math.sin(this.stateTime * 1.8) * 1.6, dt, 2.5);
    if (this.stateTime > AI.searchTime) { this.arrived = false; this.goHome(); }
  }

  goHome() {
    const n = this.game.layout.nodes[this.postNode];
    this.state = 'return';
    this.stateTime = 0;
    this.setDestination({ x: n.x, z: n.z });
  }

  doReturn(dt) {
    if (this.followPath(dt, AI.patrolSpeed)) {
      this.state = 'guard';
      this.stateTime = 0;
    }
  }

  doEngage(dt) {
    const p = this.game.player;
    if (!p.alive) { this.goHome(); return; }
    if (!this.canSee) {
      // Lost line of sight: keep aiming at the last known spot briefly, then search it.
      if (this.lastSeen) this.faceTowards(this.lastSeen.x, this.lastSeen.z, dt);
      if (this.game.time - this.lastSeenTime > AI.memoryTime) {
        this.state = 'search';
        this.stateTime = 0;
        this.arrived = false;
        this.setDestination(this.lastSeen);
      }
      return;
    }
    this.trackTime += dt;
    this.reaction -= dt;
    // Aim point: chest, drifting to head once settled.
    const settle = Math.min(1, this.trackTime / AI.aimSettleTime);
    const aimY = p.smoothY + p.height * (0.62 + 0.25 * settle * (this.index % 2 ? 0.6 : 1));
    const e = this.eye;
    const dx = p.pos.x - e.x, dz = p.pos.z - e.z, dy = aimY - e.y;
    const dist = Math.hypot(dx, dz);
    const wantYaw = Math.atan2(-dx, -dz);
    const wantPitch = Math.atan2(dy, dist);
    this.turnTo(wantYaw, dt, AI.turnSpeed * 1.5);
    this.aimPitch += (wantPitch - this.aimPitch) * Math.min(1, dt * 10);
    let yawErr = wantYaw - this.yaw; yawErr = Math.atan2(Math.sin(yawErr), Math.cos(yawErr));

    // Strafe between bursts, stand still while firing (counter-strafe, same accuracy rules).
    this.strafeTimer -= dt;
    if (this.strafeTimer <= 0) { this.strafeDir = Math.random() < 0.5 ? -1 : 1; this.strafeTimer = 0.6 + Math.random() * 0.8; }
    if (this.burstLeft <= 0 && this.burstPause > 0) {
      const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
      this.moveDir(c * this.strafeDir, -s * this.strafeDir, AI.combatStrafeSpeed, dt);
    }
    if (this.reloadTimer > 0) return;
    if (this.mag <= 0) { this.reloadTimer = this.weapon.reloadTime; this.game.emit('reload', this.pos, { source: 'bot' }); return; }
    if (this.reaction > 0 || Math.abs(yawErr) > 8 * DEG) return;
    if (this.burstLeft <= 0) {
      this.burstPause -= dt;
      if (this.burstPause > 0) return;
      this.burstLeft = AI.burstMin + Math.floor(Math.random() * (AI.burstMax - AI.burstMin + 1));
      if (dist > 25) this.burstLeft = Math.min(this.burstLeft, 3);
    }
    if (this.fireCooldown > 0) return;
    this.fireAt(wantYaw, wantPitch, settle, dist);
    this.burstLeft--;
    if (this.burstLeft <= 0) this.burstPause = AI.burstPause + Math.random() * 0.3 + dist * 0.01;
  }

  fireAt(yaw, pitch, settle, dist) {
    const p = this.game.player;
    this.fireCooldown = this.weapon.fireInterval;
    this.mag--;
    // Aim error: large when first spotting, shrinks while tracking; moving targets are harder.
    let errDeg = AI.aimErrorStart + (AI.aimErrorMin - AI.aimErrorStart) * settle;
    errDeg += Math.min(1, p.speed / PLAYER.runSpeed) * AI.targetMovingError;
    if (p.crouched) errDeg *= 0.9;
    const err = spreadOffset(errDeg * DEG);
    // Same inaccuracy model as the player (bots usually stand still to fire).
    const inacc = computeInaccuracy(this.weapon, { speed: this.speed, grounded: true, crouched: false, ads: false, landingTimer: 0, fireSpread: this.recoil.fireSpread });
    const spr = spreadOffset(inacc);
    const comp = AI.recoilCompensation;
    const shotYaw = yaw + err.yaw + spr.yaw - this.recoil.yaw * (1 - comp);
    const shotPitch = pitch + err.pitch + spr.pitch + this.recoil.pitch * (1 - comp);
    const dir = dirFromAngles(shotYaw, shotPitch);
    this.game.fireShot(this.eye, dir, this.weapon, this);
    this.recoil.kick(false);
    this.flashTimer = 0.05;
    this.mesh.flash.visible = true;
    this.game.emit(`shot_${this.weapon.sound}`, this.pos, { source: 'bot', weapon: this.weapon });
  }

  die() {
    this.alive = false;
    this.deathTime = 0;
    this.mesh.flash.visible = false;
  }

  updateDeath(dt) {
    this.deathTime += dt;
    const t = Math.min(1, this.deathTime / 0.45);
    this.mesh.body.rotation.x = (t * t) * (Math.PI / 2) * 0.98;
    this.mesh.body.position.y = -t * 0.05;
  }

  syncMesh() {
    const r = this.mesh.root;
    r.position.set(this.pos.x, this.pos.y, this.pos.z);
    r.rotation.y = this.yaw;
    const swing = this.speed > 0.3 ? Math.sin(this.walkPhase) * 0.5 : 0;
    this.mesh.legL.rotation.x = swing;
    this.mesh.legR.rotation.x = -swing;
    this.mesh.gun.rotation.x = this.state === 'engage' ? this.aimPitch : -0.25;
  }
}
