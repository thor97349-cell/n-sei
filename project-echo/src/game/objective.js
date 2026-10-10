// DATA EXTRACTION objective: terminal hack -> carry physical module -> extract.
import * as THREE from 'three';
import { ROUND } from '../config.js';
import { buildDataModule } from '../weapons/viewmodels.js';

export class Objective {
  constructor(game) {
    this.game = game;
    const t = game.layout.terminal;
    this.terminalPos = { x: t.x, y: 0, z: t.z };
    this.mesh = buildDataModule();
    this.mesh.scale.setScalar(2.2);
    game.scene.add(this.mesh);
    this.glow = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.02, 12), new THREE.MeshBasicMaterial({ color: 0x29c4ff, transparent: true, opacity: 0.5 }));
    game.scene.add(this.glow);
    this.reset();
  }

  reset() {
    this.state = 'terminal'; // terminal | carried | dropped | extracted
    this.hackProgress = 0;
    this.hacking = false;
    this.extractProgress = 0;
    this.extractZone = null;
    this.dropPos = null;
    this.placeMesh();
  }

  get carried() { return this.state === 'carried'; }

  get modulePos() {
    if (this.state === 'terminal') return { x: this.terminalPos.x, y: 1.2, z: this.terminalPos.z };
    if (this.state === 'dropped') return { x: this.dropPos.x, y: 0.2, z: this.dropPos.z };
    const p = this.game.player.pos;
    return { x: p.x, y: 1.2, z: p.z };
  }

  placeMesh() {
    const vis = this.state === 'terminal' || this.state === 'dropped';
    this.mesh.visible = this.glow.visible = vis;
    if (!vis) return;
    const p = this.modulePos;
    this.mesh.position.set(p.x, p.y + 0.1, p.z);
    this.glow.position.set(p.x, p.y - 0.06, p.z);
  }

  // Interrupt the hack (called when the player takes damage).
  interrupt() {
    if (this.hacking) {
      this.hacking = false;
      this.hackProgress = 0;
      this.game.hud.toast('HACK INTERRUPTED', 'warn');
    }
  }

  drop(pos) {
    if (this.state !== 'carried') return;
    this.state = 'dropped';
    this.dropPos = { x: pos.x, z: pos.z };
    this.extractProgress = 0;
    this.placeMesh();
  }

  zoneAt(x, z) {
    for (const zn of this.game.layout.zones.extraction) if (x >= zn.min.x && x <= zn.max.x && z >= zn.min.z && z <= zn.max.z) return zn;
    return null;
  }

  // Returns 'extracted' when the round is won.
  update(dt, input, live) {
    const g = this.game, p = g.player;
    this.mesh.rotation.y += dt * 1.5;
    this.hacking = false;
    if (!live || !p.alive) { this.extractZone = null; return null; }

    if (this.state === 'terminal') {
      const d = Math.hypot(p.pos.x - this.terminalPos.x, p.pos.z - this.terminalPos.z);
      const inRange = d < ROUND.interactRange + 0.4;
      if (inRange && input.down('KeyE')) {
        if (this.hackProgress === 0) g.emit('terminal_start', { x: this.terminalPos.x, y: 1, z: this.terminalPos.z }, { source: 'player' });
        this.hacking = true;
        const before = Math.floor(this.hackProgress);
        this.hackProgress += dt;
        if (Math.floor(this.hackProgress) !== before) g.audio.play('ui_tick', null, { gain: 0.6 });
        if (this.hackProgress >= ROUND.hackTime) {
          this.state = 'carried';
          this.hackProgress = ROUND.hackTime;
          this.placeMesh();
          g.emit('terminal_done', { x: this.terminalPos.x, y: 1, z: this.terminalPos.z }, { source: 'player' });
          g.audio.play('ui_pickup', null, { gain: 0.8 });
          g.hud.toast('DATA MODULE SECURED — EXTRACT AT WEST DOCK OR EAST GARAGE', 'good');
        }
      } else if (this.hackProgress > 0) {
        // Releasing E or walking away cancels the hack.
        this.hackProgress = 0;
      }
    } else if (this.state === 'dropped') {
      if (Math.hypot(p.pos.x - this.dropPos.x, p.pos.z - this.dropPos.z) < 1.2) {
        this.state = 'carried';
        this.placeMesh();
        g.audio.play('ui_pickup', null, { gain: 0.8 });
      }
    } else if (this.state === 'carried') {
      const zone = this.zoneAt(p.pos.x, p.pos.z);
      if (zone) {
        if (!this.extractZone) g.emit('extract_start', p.pos, { source: 'player' });
        this.extractZone = zone;
        this.extractProgress += dt;
        if (this.extractProgress >= ROUND.extractTime) {
          this.state = 'extracted';
          return 'extracted';
        }
      } else {
        if (this.extractZone && this.extractProgress > 0.3) g.hud.toast('LEFT EXTRACTION ZONE', 'warn');
        this.extractZone = null;
        this.extractProgress = Math.max(0, this.extractProgress - dt * 3);
      }
    }
    return null;
  }

  // Phase label for the HUD.
  phaseLabel() {
    if (this.state === 'terminal') return this.hacking || this.hackProgress > 0 ? 'DATA THEFT' : 'INFILTRATION';
    if (this.state === 'carried') return 'EXTRACTION';
    if (this.state === 'dropped') return 'MODULE DROPPED';
    return 'EXTRACTED';
  }

  statusLabel() {
    return { terminal: 'IN TERMINAL', carried: 'CARRIED', dropped: 'DROPPED', extracted: 'EXTRACTED' }[this.state];
  }
}
