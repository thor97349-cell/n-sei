// Game orchestration: systems, rounds, shots, sound events, HUD wiring.
import * as THREE from 'three';
import { AI, AUDIO, ECONOMY, GRAPHICS, PLAYER, ROUND, WEAPONS } from '../config.js';
import { buildWorld, setupLighting, MaterialLibrary } from '../world/build.js';
import { areaAt } from '../world/layout.js';
import { Door, Barricade } from '../world/interactables.js';
import { NavGraph } from '../core/nav.js';
import { rayActor } from '../core/collision.js';
import { applyDamage } from '../core/combat.js';
import { Economy } from '../core/economy.js';
import { AudioSystem } from '../audio/audio.js';
import { Input } from '../input.js';
import { Player } from '../player.js';
import { WeaponSystem } from '../weapons/weapons.js';
import { Bot } from '../ai/bots.js';
import { Objective } from './objective.js';
import { Effects } from './effects.js';
import { Hud } from '../ui/hud.js';

export class Game {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    const preset = GRAPHICS[settings.graphics] || GRAPHICS.low;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: preset.antialias, powerPreference: 'high-performance' });
    this.renderer.autoClear = false;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(PLAYER.baseFov, 1, 0.05, preset.far);
    this.camera.rotation.order = 'YXZ';
    this.vmScene = new THREE.Scene();
    this.vmCamera = new THREE.PerspectiveCamera(62, 1, 0.01, 10);
    this.vmScene.add(new THREE.HemisphereLight(0xdde6ee, 0x3a3530, 2.2));
    const vmSun = new THREE.DirectionalLight(0xfff1dc, 1.4);
    vmSun.position.set(0.5, 1, 0.3);
    this.vmScene.add(vmSun);

    this.mats = new MaterialLibrary();
    const built = buildWorld(this.scene, this.mats);
    this.layout = built.layout;
    this.world = built.world;
    this.zoneMeshes = built.zoneMeshes;
    this.terminalScreen = built.terminalScreen;
    this.lights = setupLighting(this.scene, preset);

    this.time = 0;
    this.audio = new AudioSystem();
    this.hud = new Hud();
    this.input = new Input(canvas);
    this.effects = new Effects(this.scene);
    this.economy = new Economy();
    const emit = (type, pos, opts) => this.emit(type, pos, opts);
    this.emitFn = emit;

    this.doors = {};
    for (const d of this.layout.doors) this.doors[d.id] = new Door(d, this.scene, this.world, emit);
    this.barricades = {};
    for (const b of this.layout.barricades) this.barricades[b.id] = new Barricade(b, this.scene, this.world, emit);
    this.barriers = this.layout.barriers.map((b) => this.world.add({ min: b.min, max: b.max, kind: 'barrier', surface: 'concrete', active: false }));
    // Faint orange fields show the spawn exits are sealed during the buy phase.
    const barrierMat = new THREE.MeshBasicMaterial({ color: 0xe8a33a, transparent: true, opacity: 0.18, depthWrite: false });
    this.barrierMeshes = this.layout.barriers.map((b) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(b.max.x - b.min.x, 3, b.max.z - b.min.z), barrierMat);
      m.position.set((b.min.x + b.max.x) / 2, 1.5, (b.min.z + b.max.z) / 2);
      this.scene.add(m);
      return m;
    });
    this.nav = new NavGraph(this.layout);
    this.nav.blocked = (e) => !!(e.barricade && !this.barricades[e.barricade].destroyed);

    this.player = new Player(this.world, this.layout, emit);
    this.weapons = new WeaponSystem(this.vmScene, this);
    this.bots = this.layout.bots.slice(0, AI.botCount).map((def, i) => new Bot(def, this, i));
    this.objective = new Objective(this);
    for (const door of Object.values(this.doors)) door.blockedBy = (box) => this.actorInBox(box);

    this.state = 'menu'; // menu | playing | paused
    this.phase = 'buy';
    this.buyOpen = false;
    this._v = new THREE.Vector3();
    this.fpsFrames = 0; this.fpsTime = 0; this.showFps = false;
    this.applyGraphics(settings.graphics);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.startMatch();
  }

  // ---------------------------------------------------------------- setup
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = this.vmCamera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.vmCamera.updateProjectionMatrix();
  }

  applyGraphics(name) {
    const p = GRAPHICS[name] || GRAPHICS.low;
    this.graphics = name;
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(name === 'low' ? Math.min(dpr, 1) * p.pixelRatio : Math.min(dpr, 1.5));
    this.renderer.shadowMap.enabled = p.shadows;
    this.lights.sun.castShadow = p.shadows;
    this.scene.fog.far = p.far;
    this.camera.far = p.far;
    this.camera.updateProjectionMatrix();
    this.weapons.setMuzzleLight(this.vmScene, p.muzzleLight);
    this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    for (const b of this.bots || []) b.mesh.root.traverse((o) => { o.castShadow = p.shadows; });
    this.resize();
  }

  actorInBox(box) {
    const inside = (p, r, h) => p.x + r > box.min.x && p.x - r < box.max.x && p.z + r > box.min.z && p.z - r < box.max.z && p.y < box.max.y && p.y + h > box.min.y;
    if (this.player.alive && inside(this.player.pos, PLAYER.radius, this.player.height)) return true;
    return this.bots.some((b) => b.alive && inside(b.pos, 0.32, 1.75));
  }

  // ---------------------------------------------------------------- rounds
  startMatch() {
    this.economy.resetMatch();
    this.wins = 0; this.losses = 0; this.round = 0;
    this.weapons.slots.primary = null;
    this.player.armor = 0;
    this.startRound(false);
  }

  startRound(survived) {
    this.round++;
    for (const d of Object.values(this.doors)) d.reset();
    for (const b of Object.values(this.barricades)) b.reset();
    for (const b of this.bots) b.reset();
    this.objective.reset();
    if (!survived) this.player.armor = 0;
    this.player.reset(this.layout.spawn);
    this.weapons.resetForRound(survived);
    this.effects.clear();
    this.hud.clearTransient();
    this.hud.showRoundEnd(null);
    this.phase = 'buy';
    this.phaseTime = ROUND.buyTime;
    for (const b of this.barriers) b.active = true;
    for (const m of this.barrierMeshes) m.visible = true;
    this.hud.toast(`ROUND ${this.round} — BUY PHASE`, 'warn');
  }

  goLive() {
    this.phase = 'live';
    this.phaseTime = ROUND.roundTime;
    for (const b of this.barriers) b.active = false;
    for (const m of this.barrierMeshes) m.visible = false;
    this.setBuyOpen(false);
    this.hud.toast('GO — INFILTRATE NODE-7', 'good');
  }

  endRound(won, reason) {
    if (this.phase !== 'live') return;
    const summary = this.economy.endRound(won);
    if (won) this.wins++; else this.losses++;
    this.survived = this.player.alive;
    const matchOver = this.wins >= ROUND.winsToTakeMatch || this.losses >= ROUND.winsToTakeMatch;
    this.phase = matchOver ? 'matchEnd' : 'end';
    this.phaseTime = ROUND.endTime;
    this.audio.play(won ? 'ui_win' : 'ui_lose', null, { gain: 0.8 });
    const rows = [
      [won ? 'Round win' : `Round loss (streak ${this.economy.lossStreak})`, `+$${summary.reward}`],
      [`Eliminations × ${summary.kills}`, `+$${summary.killCredits}`],
      ['Credits', `$${summary.credits}`],
      ['Next loss bonus', `$${summary.nextLossBonus}`],
      [this.survived ? 'Survived — loadout kept' : 'Eliminated — loadout lost', ''],
    ];
    const title = matchOver ? (this.wins > this.losses ? 'MATCH WON' : 'MATCH LOST') : won ? 'ROUND WON' : 'ROUND LOST';
    this.hud.showRoundEnd({
      title, won, reason, rows, matchOver,
      next: matchOver ? `FINAL ${this.wins} – ${this.losses} · press ENTER or click NEW MATCH` : `Next round in ${ROUND.endTime}s`,
    });
    if (matchOver) this.input.exitLock();
  }

  // ---------------------------------------------------------------- buying
  loadout() { return { primary: this.weapons.slots.primary?.id || null, armor: this.player.armor }; }

  buyItems() {
    const lo = this.loadout();
    return ECONOMY.items.map((it) => {
      const c = this.economy.canBuy(it, lo);
      let note = c.ok ? '' : c.reason;
      if (it.type === 'weapon' && c.ok) { const w = WEAPONS[it.weapon]; note = `${w.damage} dmg · ${Math.round(60 / w.fireInterval)} rpm · ${w.magSize} rounds`; }
      if (it.type === 'armor' && c.ok) note = 'Torso & arms. Reduces damage taken.';
      if (it.type === 'ammo') {
        const p = this.weapons.slots.secondary;
        const full = p.mag === p.def.magSize && p.reserve === p.def.reserveAmmo;
        if (full) return { ...it, ok: false, note: 'Already full' };
        note = 'Refill pistol ammunition';
      }
      return { ...it, ok: c.ok && this.phase === 'buy', note };
    });
  }

  buy(id) {
    const it = ECONOMY.items.find((i) => i.id === id);
    if (!it || this.phase !== 'buy') return false;
    const offer = this.buyItems().find((i) => i.id === id);
    if (!offer.ok) { this.audio.play('ui_deny', null, { gain: 0.6 }); return false; }
    const r = this.economy.buy(it, this.loadout());
    if (!r.ok) { this.audio.play('ui_deny', null, { gain: 0.6 }); return false; }
    if (it.type === 'weapon') this.weapons.giveWeapon(it.weapon);
    if (it.type === 'armor') this.player.addArmor();
    if (it.type === 'ammo') this.weapons.slots.secondary.refill();
    this.audio.play('ui_buy', null, { gain: 0.7 });
    this.hud.toast(`PURCHASED ${it.label.toUpperCase()}`, 'good');
    this.renderBuy();
    return true;
  }

  renderBuy() { this.hud.renderBuy(this.buyItems(), this.economy.credits, (id) => this.buy(id)); }

  setBuyOpen(open) {
    if (open && this.phase !== 'buy') return;
    if (this.buyOpen === open) return;
    this.buyOpen = open;
    this.hud.showBuy(open);
    if (open) {
      this.renderBuy();
      this.input.exitLock(); // free cursor for clicking
    } else if (this.state === 'playing') {
      this.input.requestLock();
    }
  }

  // ---------------------------------------------------------------- sound events
  emit(type, pos, opts = {}) {
    const def = AUDIO.events[type];
    if (!def) return;
    const source = opts.source || 'world';
    const area = areaAt(this.layout, pos.x, pos.z);
    const surface = opts.surface || area?.surface || 'concrete';
    const zone = area?.zone || 'outdoor';
    if (source === 'player') {
      // Own sounds are non-positional (in your head) and slightly quieter for steps.
      const own = type.startsWith('step') || type === 'land' ? 0.55 : 0.9;
      this.audio.play(type, null, { gain: def.volume * own, surface, zone, weapon: opts.weapon });
    } else {
      const eye = this.player.eye;
      const src = { x: pos.x, y: (pos.y || 0) + 1.2, z: pos.z };
      const d = Math.hypot(src.x - eye.x, src.z - eye.z);
      if (d < def.radius) {
        const occ = this.world.countOccluders(eye, src, AUDIO.maxOcclusionWalls);
        const p = this.audio.perceive(def, src, occ);
        this.audio.play(type, src, { gain: p.gain, occlusion: occ, zone, surface, distance: d, weapon: opts.weapon });
        // Directional HUD cue: enemy activity only, approximate direction, fades.
        if (source === 'bot' && p.gain > AUDIO.indicatorThreshold * def.volume && this.player.alive) {
          const ang = Math.atan2(-(src.x - eye.x), -(src.z - eye.z));
          this.hud.soundIndicator(ang, p.gain / def.volume, def.label, type.startsWith('shot'));
        }
      }
    }
    // Bots hear player and world sounds (not each other).
    if (source !== 'bot' && this.phase === 'live') for (const b of this.bots) b.hear(type, pos, source);
  }

  // ---------------------------------------------------------------- shooting
  // Hitscan shared by player and bots. shooter = 'player' | Bot
  fireShot(origin, dir, weapon, shooter) {
    const range = weapon.maxRange;
    const hit = this.world.raycast(origin, dir, range, (c) => c.kind !== 'barrier');
    let best = hit ? hit.t : range;
    let actor = null, zone = null;
    if (shooter === 'player') {
      for (const b of this.bots) {
        if (!b.alive) continue;
        // Cheap reject: distance from ray to bot center.
        const ox = b.pos.x - origin.x, oz = b.pos.z - origin.z;
        const along = ox * dir.x + oz * dir.z;
        if (along < 0 || along > best + 1) continue;
        const px = origin.x + dir.x * along - b.pos.x, pz = origin.z + dir.z * along - b.pos.z;
        if (px * px + pz * pz > 2.5) continue;
        const r = rayActor(origin, dir, b.pos, b.yaw, b.hitboxes, best);
        if (r && r.t < best) { best = r.t; actor = b; zone = r.zone; }
      }
    } else if (this.player.alive) {
      const p = this.player;
      const r = rayActor(origin, dir, { x: p.pos.x, y: p.smoothY, z: p.pos.z }, p.yaw, p.hitboxes, best);
      if (r && r.t < best) { best = r.t; actor = p; zone = r.zone; }
    }
    const end = { x: origin.x + dir.x * best, y: origin.y + dir.y * best, z: origin.z + dir.z * best };
    if (shooter !== 'player') this.effects.tracer({ x: origin.x + dir.x * 0.8, y: origin.y - 0.15 + dir.y * 0.8, z: origin.z + dir.z * 0.8 }, end);

    if (actor) {
      const res = applyDamage(weapon, zone, best, actor);
      if (actor === this.player) this.onPlayerHit(res, shooter);
      else this.onBotHit(actor, res, origin, weapon);
      this.effects.spark(end, { x: -dir.x, y: -dir.y, z: -dir.z }, 'flesh');
      return;
    }
    if (hit) {
      const c = hit.collider;
      this.effects.impact(hit.point, hit.normal, c.surface);
      if (c.kind === 'barricade' && c.ref) {
        const broke = c.ref.damage(weapon.damage, hit.point);
        if (broke) this.hud.toast(`${c.ref.name} DESTROYED — NEW ROUTE OPEN`, 'warn');
      } else if (shooter === 'player') {
        this.emit('impact', hit.point, { source: 'world', surface: c.surface });
      }
    }
  }

  onBotHit(bot, res, origin, weapon) {
    bot.onDamaged(origin);
    if (res.killed) {
      bot.die();
      const reward = this.economy.addKill(weapon.id);
      this.hud.hitmarker('kill');
      this.audio.play('ui_kill', null, { gain: 0.8 });
      this.hud.killfeed(`YOU ▸ ${bot.name}${res.zone === 'head' ? ' (HEADSHOT)' : ''}  +$${reward}`, res.zone === 'head');
      if (this.bots.every((b) => !b.alive)) this.hud.toast('ALL DEFENDERS DOWN — SECURE AND EXTRACT THE DATA', 'good');
    } else {
      this.hud.hitmarker(res.zone === 'head' ? 'head' : 'hit');
      this.audio.play(res.zone === 'head' ? 'ui_headshot' : 'ui_hit', null, { gain: 0.7 });
    }
  }

  onPlayerHit(res, shooter) {
    const p = this.player;
    this.audio.play('ui_hurt', null, { gain: 0.6 });
    this.objective.interrupt();
    const ang = Math.atan2(-(shooter.pos.x - p.pos.x), -(shooter.pos.z - p.pos.z));
    this.hud.damageIndicator(ang);
    this.punch = 0.04;
    if (res.killed) {
      p.alive = false;
      if (this.objective.carried) { this.objective.drop(p.pos); this.hud.toast('DATA MODULE DROPPED', 'bad'); }
      this.hud.killfeed(`${shooter.name} ▸ YOU${res.zone === 'head' ? ' (HEADSHOT)' : ''}`, res.zone === 'head');
      this.endRound(false, 'ATTACKER ELIMINATED');
    }
  }

  // ---------------------------------------------------------------- interaction
  interactables() {
    const p = this.player;
    const eye = p.eye;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    let door = null, best = ROUND.interactRange + 0.6;
    for (const d of Object.values(this.doors)) {
      const dx = d.center.x - eye.x, dz = d.center.z - eye.z;
      const dist = Math.hypot(dx, dz);
      if (dist > best) continue;
      if (dist > 0.8 && (dx * fx + dz * fz) / dist < 0.2) continue;
      best = dist; door = d;
    }
    const t = this.objective.terminalPos;
    const nearTerminal = this.objective.state === 'terminal' && Math.hypot(t.x - p.pos.x, t.z - p.pos.z) < ROUND.interactRange + 0.4;
    return { door, nearTerminal };
  }

  // ---------------------------------------------------------------- frame
  update(dt) {
    const input = this.input;
    this.time += dt;
    if (input.hit('F3')) { this.showFps = !this.showFps; this.hud.showFps(this.showFps); }

    // Phase timers.
    if (this.phase === 'buy') {
      this.phaseTime -= dt;
      if (input.hit('KeyB')) this.setBuyOpen(!this.buyOpen);
      if (this.buyOpen) for (const it of ECONOMY.items) if (input.hit('Digit' + it.key) || input.hit('Numpad' + it.key)) this.buy(it.id);
      if (this.phaseTime <= 0) this.goLive();
    } else if (this.phase === 'live') {
      this.phaseTime -= dt;
      if (input.hit('KeyB')) this.hud.toast('BUY PHASE IS OVER', 'warn');
      if (this.phaseTime <= 0) { this.phaseTime = 0; this.endRound(false, 'TIME EXPIRED — DATA NOT EXTRACTED'); }
    } else if (this.phase === 'end') {
      this.phaseTime -= dt;
      this.hud.setNext(`Next round in ${Math.max(0, Math.ceil(this.phaseTime))}s`);
      if (this.phaseTime <= 0) this.startRound(this.survived);
    } else if (this.phase === 'matchEnd') {
      if (input.hit('Enter') || input.hit('NumpadEnter')) this.newMatch();
    }

    // Look.
    const sens = PLAYER.mouseSensitivity * this.settings.sensitivity * (this.weapons.adsAmount > 0.5 ? 0.8 : 1);
    if (this.player.alive && !this.buyOpen) this.player.look(input.mouse.dx, input.mouse.dy, sens);

    // Player + weapons (buy menu blocks firing so clicks don't shoot).
    const canAct = this.phase === 'buy' || this.phase === 'live';
    this.player.update(dt, input, this.weapons.weapon.def.moveSpeedMultiplier, canAct);
    this.weapons.update(dt, this.buyOpen ? { ...input, mouse: { ...input.mouse, left: false, right: false }, hit: () => false } : input, this.player, canAct && !this.buyOpen);

    // Interaction.
    let prompt = null;
    if (this.player.alive && canAct) {
      const { door, nearTerminal } = this.interactables();
      if (nearTerminal && this.phase === 'live') prompt = 'HOLD [E] — HACK TERMINAL';
      else if (nearTerminal) prompt = 'Terminal locked until the buy phase ends';
      else if (door) {
        prompt = `[E] ${door.target > 0.5 ? 'CLOSE' : 'OPEN'} ${door.name}`;
        if (input.hit('KeyE')) door.toggle('player');
      }
      if (!prompt && this.phase === 'live') {
        // Barricade info when aiming at one.
        const eye = this.player.eye;
        const dir = { x: -Math.sin(this.player.yaw) * Math.cos(this.player.pitch), y: Math.sin(this.player.pitch), z: -Math.cos(this.player.yaw) * Math.cos(this.player.pitch) };
        const h = this.world.raycast(eye, dir, 25, (c) => c.kind !== 'barrier');
        if (h?.collider.kind === 'barricade') prompt = `WOODEN BARRICADE ${Math.ceil((h.collider.ref.health / h.collider.ref.maxHealth) * 100)}% — shoot to breach`;
      }
    }
    this.hud.prompt(prompt);

    // World objects.
    for (const d of Object.values(this.doors)) d.update(dt);
    for (const b of Object.values(this.barricades)) b.update(dt);
    const botsActive = this.phase === 'live';
    for (const b of this.bots) b.update(dt, botsActive);

    // Objective.
    const res = this.objective.update(dt, input, this.phase === 'live');
    if (res === 'extracted') this.endRound(true, `DATA EXTRACTED VIA ${this.objective.extractZone?.name || 'EXTRACTION'}`);
    if (this.objective.hacking || (this.objective.state === 'terminal' && this.objective.hackProgress > 0)) this.hud.progress('HACKING TERMINAL — HOLD E', this.objective.hackProgress / ROUND.hackTime, 'hack');
    else if (this.objective.carried && this.objective.extractZone) this.hud.progress(`EXTRACTING — ${this.objective.extractZone.name}`, this.objective.extractProgress / ROUND.extractTime, 'extract');
    else this.hud.progress(null);

    this.effects.update(dt);
    this.updateVisuals(dt);
    this.updateCamera(dt);
    this.updateHud(dt);
  }

  updateVisuals(dt) {
    // Zone beams brighten when carrying the module.
    const carrying = this.objective.carried;
    for (const z of this.zoneMeshes) {
      z.beam.material.opacity = carrying ? 0.22 + Math.sin(this.time * 4) * 0.06 : 0.07;
      z.floor.material.opacity = carrying ? 0.28 : 0.12;
    }
    const st = this.objective.state;
    this.terminalScreen.material.color.setHex(st === 'terminal' ? (this.objective.hacking ? (Math.sin(this.time * 20) > 0 ? 0xffffff : 0x29c4ff) : 0x29c4ff) : 0xff3b2f);
  }

  updateCamera(dt) {
    const p = this.player;
    const kick = this.weapons.viewKick();
    this.punch = Math.max(0, (this.punch || 0) - dt * 0.3);
    const eye = p.eye;
    const bobAmt = p.state.grounded ? Math.min(1, p.speed / PLAYER.runSpeed) * (1 - this.weapons.adsAmount) : 0;
    this.camera.position.set(eye.x, eye.y + Math.abs(Math.sin(p.bob)) * 0.025 * bobAmt, eye.z);
    this.camera.rotation.set(p.pitch + kick.pitch + this.punch, p.yaw + kick.yaw, p.alive ? 0 : 0.35);
    const fov = this.weapons.fov(PLAYER.baseFov);
    if (Math.abs(this.camera.fov - fov) > 0.01) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
    this.audio.setListener(eye.x, eye.y, eye.z, p.yaw);
  }

  project(x, y, z) {
    const v = this._v.set(x, y, z).project(this.camera);
    if (v.z > 1 || v.z < -1) return null;
    const w = window.innerWidth, h = window.innerHeight;
    const sx = (v.x * 0.5 + 0.5) * w, sy = (-v.y * 0.5 + 0.5) * h;
    if (sx < 20 || sx > w - 20 || sy < 20 || sy > h - 20) return null;
    return { x: sx, y: sy };
  }

  updateHud(dt) {
    const p = this.player, w = this.weapons.weapon, o = this.objective;
    const area = areaAt(this.layout, p.pos.x, p.pos.z);
    let phaseLabel = this.phase === 'buy' ? 'BUY PHASE' : this.phase === 'live' ? o.phaseLabel() : 'ROUND OVER';
    let objText;
    if (this.phase === 'buy') objText = 'Prepare: press B to buy. The spawn exits open when the timer ends.';
    else if (o.state === 'terminal') objText = 'Reach the DATA ROOM terminal and hold E to steal the module.';
    else if (o.state === 'carried') objText = 'Carry the module to the WEST LOADING DOCK or EAST GARAGE and hold the zone.';
    else if (o.state === 'dropped') objText = 'The module was dropped. Recover it.';
    else objText = 'Data extracted.';
    // Crosshair gap from inaccuracy (pixels at screen center).
    const halfH = window.innerHeight / 2;
    const spreadPx = (Math.tan(this.weapons.inaccuracy) / Math.tan((this.camera.fov * Math.PI) / 360)) * halfH;
    this.hud.update({
      timeLeft: this.phase === 'buy' || this.phase === 'live' ? this.phaseTime : 0,
      phase: this.phase, phaseLabel, wins: this.wins, losses: this.losses, round: this.round,
      objText, modStatus: o.statusLabel(),
      botsAlive: this.bots.filter((b) => b.alive).length, botsTotal: this.bots.length,
      area: area ? area.name : '', credits: this.economy.credits,
      health: Math.max(0, p.health), armor: p.armor,
      weaponName: w.def.name, mag: w.mag, reserve: w.reserve,
      primaryName: this.weapons.slots.primary?.def.name || null, secondaryName: this.weapons.slots.secondary.def.name,
      slot: this.weapons.current, reloading: this.weapons.reloading, buyOpen: this.buyOpen,
      alive: p.alive, ads: this.weapons.adsAmount > 0.7, spreadPx, yaw: p.yaw,
    }, dt);

    // Objective markers.
    const marks = [];
    const dist = (x, z) => Math.round(Math.hypot(x - p.pos.x, z - p.pos.z));
    if (o.state === 'terminal') {
      const s = this.project(o.terminalPos.x, 1.9, o.terminalPos.z);
      if (s) marks.push({ id: 'term', ...s, cls: 'terminal', label: `DATA · ${dist(o.terminalPos.x, o.terminalPos.z)}m` });
    } else if (o.state === 'dropped') {
      const s = this.project(o.dropPos.x, 0.8, o.dropPos.z);
      if (s) marks.push({ id: 'drop', ...s, cls: 'dropped', label: `MODULE · ${dist(o.dropPos.x, o.dropPos.z)}m` });
    } else if (o.state === 'carried') {
      for (const z of this.layout.zones.extraction) {
        const cx = (z.min.x + z.max.x) / 2, cz = (z.min.z + z.max.z) / 2;
        const s = this.project(cx, 2.5, cz);
        if (s) marks.push({ id: 'zone' + z.id, ...s, cls: 'zone', label: `EXTRACT ${z.id.toUpperCase()} · ${dist(cx, cz)}m` });
      }
    }
    this.hud.markers(marks);
  }

  render() {
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.clearDepth();
    this.renderer.render(this.vmScene, this.vmCamera);
  }

  frame(dt) {
    if (this.state === 'playing') this.update(dt);
    this.input.endFrame();
    this.render();
    this.fpsFrames++; this.fpsTime += dt;
    if (this.fpsTime >= 0.5) { this.hud.fps(Math.round(this.fpsFrames / this.fpsTime)); this.fpsFrames = 0; this.fpsTime = 0; }
  }

  newMatch() {
    this.startMatch();
    if (this.state === 'playing') this.input.requestLock();
  }
}
