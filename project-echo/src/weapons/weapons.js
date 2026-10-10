// Player weapon handling: loadout, firing, reload, ADS, recoil and viewmodel animation.
// Weapon behaviour is entirely driven by the data in config.WEAPONS.
import * as THREE from 'three';
import { WEAPONS, PLAYER } from '../config.js';
import { RecoilState, computeInaccuracy, spreadOffset, dirFromAngles } from '../core/combat.js';
import { buildRifle, buildPistol, buildDataModule, buildMuzzleFlash } from './viewmodels.js';

const BUILDERS = { vertice: buildRifle, linha: buildPistol };

export class WeaponInstance {
  constructor(id) {
    this.def = WEAPONS[id];
    this.id = id;
    this.mag = this.def.magSize;
    this.reserve = this.def.reserveAmmo;
    this.recoil = new RecoilState(this.def);
  }
  refill() { this.mag = this.def.magSize; this.reserve = this.def.reserveAmmo; this.recoil.reset(); }
}

export class WeaponSystem {
  constructor(vmScene, game) {
    this.game = game;
    this.vmScene = vmScene;
    this.slots = { primary: null, secondary: new WeaponInstance('linha') };
    this.current = 'secondary';
    this.cooldown = 0;
    this.reloadTimer = 0;
    this.drawTimer = 0;
    this.adsAmount = 0;
    this.triggerReady = true;
    this.kick = 0; // visual weapon kick
    this.flashTimer = 0;
    this.models = {};
    this.root = new THREE.Group();
    vmScene.add(this.root);
    for (const id of Object.keys(BUILDERS)) {
      const m = BUILDERS[id]();
      m.group.visible = false;
      this.root.add(m.group);
      this.models[id] = m;
    }
    this.flash = buildMuzzleFlash();
    vmScene.add(this.flash);
    this.dataModel = buildDataModule();
    this.dataModel.position.set(-0.24, -0.26, -0.42);
    this.dataModel.rotation.set(0.3, 0.4, 0.1);
    this.dataModel.visible = false;
    vmScene.add(this.dataModel);
    this.muzzleLight = new THREE.PointLight(0xffb060, 0, 6, 2);
    this.sway = { x: 0, y: 0 };
    this.inaccuracy = 0;
    this.lastShotTime = 0;
    this.showModel();
  }

  get weapon() { return this.slots[this.current]; }
  get reloading() { return this.reloadTimer > 0; }

  // Round reset. keepPrimary: survivors keep their bought rifle.
  resetForRound(keepPrimary) {
    if (!keepPrimary) this.slots.primary = null;
    for (const s of Object.values(this.slots)) s?.refill();
    this.current = this.slots.primary ? 'primary' : 'secondary';
    this.reloadTimer = 0; this.cooldown = 0; this.adsAmount = 0;
    this.showModel(true);
  }

  giveWeapon(id) {
    const def = WEAPONS[id];
    const slot = def.slot === 1 ? 'primary' : 'secondary';
    this.slots[slot] = new WeaponInstance(id);
    this.switchTo(slot, true);
  }

  switchTo(slot, force = false) {
    if (!this.slots[slot] || (slot === this.current && !force)) return;
    this.current = slot;
    this.reloadTimer = 0;
    this.showModel(true);
    this.game.audio.play('draw', null, { gain: 0.5 });
  }

  showModel(draw = false) {
    for (const [id, m] of Object.entries(this.models)) m.group.visible = id === this.weapon.id;
    if (draw) this.drawTimer = this.weapon.def.drawTime;
  }

  startReload() {
    const w = this.weapon;
    if (this.reloading || w.mag >= w.def.magSize || w.reserve <= 0) return;
    this.reloadTimer = w.def.reloadTime;
    this.game.emit('reload', this.game.player.pos, { source: 'player', weapon: w.def });
  }

  update(dt, input, player, canFire) {
    const w = this.weapon;
    const def = w.def;
    for (const s of Object.values(this.slots)) s?.recoil.update(dt);
    this.cooldown -= dt;
    this.drawTimer = Math.max(0, this.drawTimer - dt);

    if (player.alive) {
      if (input.hit('Digit1') || input.hit('Numpad1')) this.switchTo('primary');
      if (input.hit('Digit2') || input.hit('Numpad2')) this.switchTo('secondary');
      if (input.hit('KeyQ')) this.switchTo(this.current === 'primary' ? 'secondary' : 'primary');
      if (input.hit('KeyR')) this.startReload();
    }

    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const need = def.magSize - w.mag;
        const take = Math.min(need, w.reserve);
        w.mag += take; w.reserve -= take;
        this.reloadTimer = 0;
      }
    }

    // ADS (hold right mouse). Not while reloading.
    const wantAds = player.alive && input.mouse.right && !this.reloading && this.drawTimer <= 0;
    player.ads = wantAds;
    this.adsAmount += ((wantAds ? 1 : 0) - this.adsAmount) * Math.min(1, dt / def.adsTime * 2.2);

    // Accuracy from movement state (same function the bots use).
    this.inaccuracy = computeInaccuracy(def, {
      speed: player.speed, grounded: player.state.grounded, crouched: player.crouched,
      ads: this.adsAmount > 0.7, landingTimer: player.landingTimer, fireSpread: w.recoil.fireSpread,
    });

    // Firing. The cooldown accumulates so the fire rate stays correct even at
    // low frame rates (several shots may resolve in one long frame).
    if (!input.mouse.left) this.triggerReady = true;
    const trigger = def.automatic ? input.mouse.left : input.mouse.left && this.triggerReady;
    if (trigger && canFire && player.alive && this.drawTimer <= 0 && !this.reloading) {
      let shots = 0;
      while (this.cooldown <= 0 && shots < 3 && !this.reloading) {
        if (w.mag <= 0) {
          this.triggerReady = false;
          this.game.audio.play('dryfire', null, { gain: 0.6 });
          this.cooldown = 0.25;
          if (w.reserve > 0) this.startReload();
          break;
        }
        this.fire(player);
        this.triggerReady = false;
        shots++;
        if (!def.automatic) break;
      }
    }
    if (this.cooldown < 0) this.cooldown = 0;

    this.animate(dt, input, player);
  }

  fire(player) {
    const w = this.weapon, def = w.def;
    w.mag--;
    this.cooldown += def.fireInterval;
    // Shot direction = aim + recoil offset (pattern) + spread. Right recoil = -yaw.
    const spr = spreadOffset(this.inaccuracy);
    const yaw = player.yaw - w.recoil.yaw + spr.yaw;
    const pitch = player.pitch + w.recoil.pitch + spr.pitch;
    const dir = dirFromAngles(yaw, pitch);
    this.game.fireShot(player.eye, dir, def, 'player');
    w.recoil.kick(this.adsAmount > 0.7);
    this.kick = Math.min(1, this.kick + (def.category === 'pistol' ? 0.9 : 0.55));
    this.flashTimer = 0.04;
    this.flash.rotation.z = Math.random() * Math.PI;
    this.game.emit(`shot_${def.sound}`, player.pos, { source: 'player', weapon: def });
    if (w.mag === 0 && w.reserve > 0) this.autoReloadAt = 0.35;
  }

  animate(dt, input, player) {
    const m = this.models[this.weapon.id];
    const def = this.weapon.def;
    // Auto reload shortly after emptying the magazine.
    if (this.autoReloadAt !== undefined) {
      this.autoReloadAt -= dt;
      if (this.autoReloadAt <= 0) { this.autoReloadAt = undefined; if (!input.mouse.left || !def.automatic) this.startReload(); else this.autoReloadAt = 0.05; }
    }
    this.kick = Math.max(0, this.kick - dt * 9);
    this.sway.x += (-input.mouse.dx * 0.00025 - this.sway.x) * Math.min(1, dt * 10);
    this.sway.y += (input.mouse.dy * 0.00025 - this.sway.y) * Math.min(1, dt * 10);
    const a = this.adsAmount;
    const pos = m.hip.clone().lerp(m.ads, a);
    const moveAmt = Math.min(1, player.speed / PLAYER.runSpeed) * (player.state.grounded ? 1 : 0);
    const bobScale = (1 - a * 0.85) * moveAmt;
    pos.x += Math.sin(player.bob) * 0.012 * bobScale + this.sway.x * (1 - a * 0.7);
    pos.y += Math.abs(Math.cos(player.bob)) * 0.012 * bobScale + this.sway.y * (1 - a * 0.7);
    pos.z += this.kick * (def.category === 'pistol' ? 0.05 : 0.035);
    let rotX = this.kick * (def.category === 'pistol' ? 0.22 : 0.06);
    let rotZ = 0;
    // Reload: dip and roll the weapon.
    if (this.reloading) {
      const p = 1 - this.reloadTimer / def.reloadTime;
      const dip = Math.sin(Math.min(1, p * 1.15) * Math.PI);
      pos.y -= dip * 0.16; rotX -= dip * 0.5; rotZ += dip * 0.6;
    }
    if (this.drawTimer > 0) {
      const p = this.drawTimer / def.drawTime;
      pos.y -= p * 0.3; rotX -= p * 0.8;
    }
    if (!player.alive) pos.y -= 1;
    m.group.position.copy(pos);
    m.group.rotation.set(rotX, 0, rotZ);
    // Muzzle flash follows the barrel tip.
    this.flashTimer -= dt;
    this.flash.visible = this.flashTimer > 0;
    if (this.flash.visible) {
      m.muzzle.getWorldPosition(this.flash.position);
      const s = 0.8 + Math.random() * 0.6;
      this.flash.scale.set(s, s, s);
    }
    if (this.muzzleLight.parent) this.muzzleLight.intensity = this.flash.visible ? 12 : 0;
    this.dataModel.visible = this.game.objective?.carried && player.alive && a < 0.5;
  }

  // Field of view with ADS zoom.
  fov(base) {
    return base + (this.weapon.def.adsFov - base) * this.adsAmount;
  }

  // Visual-only camera kick (separate from actual shot direction).
  viewKick() {
    const r = this.weapon.recoil;
    return { pitch: r.viewPitch, yaw: -r.viewYaw };
  }

  setMuzzleLight(scene, enabled) {
    if (enabled && !this.muzzleLight.parent) scene.add(this.muzzleLight);
    if (!enabled && this.muzzleLight.parent) this.muzzleLight.parent.remove(this.muzzleLight);
  }
}

