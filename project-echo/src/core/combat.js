// Shared combat rules for the player and bots: damage, armor, accuracy, recoil.
// Pure JavaScript so the numbers can be tested in Node.
import { HIT_ZONES, ARMOR, PLAYER } from '../config.js';

const DEG = Math.PI / 180;

// Damage for one hit. target = { health, armor }. Mutates target.
// Returns { health, armor, killed, zone, raw }.
export function applyDamage(weapon, zone, distance, target) {
  const z = HIT_ZONES[zone] || HIT_ZONES.torso;
  const mult = zone === 'head' && weapon.headMultiplier ? weapon.headMultiplier : z.mult;
  let dmg = weapon.damage * mult * Math.pow(weapon.rangeModifier, distance / 10);
  let armorLoss = 0;
  if (z.armored && target.armor > 0) {
    const toHealth = dmg * weapon.armorPenetration;
    armorLoss = (dmg - toHealth) * ARMOR.armorDamageRatio;
    if (armorLoss > target.armor) {
      // Armor breaks: the part it can no longer absorb goes to health.
      const leftover = (armorLoss - target.armor) / ARMOR.armorDamageRatio;
      armorLoss = target.armor;
      dmg = toHealth + leftover;
    } else dmg = toHealth;
  }
  const healthLoss = Math.max(1, Math.round(dmg));
  target.armor = Math.max(0, target.armor - Math.round(armorLoss));
  target.health = Math.max(0, target.health - healthLoss);
  return { health: healthLoss, armor: Math.round(armorLoss), killed: target.health <= 0, zone };
}

// Hits needed to kill (for tests / HUD info).
export function hitsToKill(weapon, zone, distance, armor = 0) {
  const t = { health: 100, armor };
  let n = 0;
  while (t.health > 0 && n < 50) { applyDamage(weapon, zone, distance, t); n++; }
  return n;
}

// Movement state -> inaccuracy (radians). state: { speed, grounded, crouched, ads,
// landingTimer, maxSpeed, fireSpread }
export function computeInaccuracy(weapon, s) {
  const sp = weapon.spread;
  const base = s.crouched ? sp.crouch : sp.stand;
  // Movement penalty scales with actual horizontal speed so counter-strafing
  // (killing velocity) restores accuracy immediately.
  const runRef = PLAYER.runSpeed * weapon.moveSpeedMultiplier;
  const walkRef = runRef * PLAYER.walkMultiplier;
  const quietRef = runRef * 0.3;
  let move = 0;
  if (s.speed > quietRef) {
    if (s.speed <= walkRef) move = sp.walk * smooth((s.speed - quietRef) / (walkRef - quietRef));
    else move = sp.walk + (sp.run - sp.walk) * smooth((s.speed - walkRef) / (runRef - walkRef));
  }
  let inacc = base * (s.ads ? sp.adsMultiplier : 1) + move;
  if (!s.grounded) inacc += sp.air;
  if (s.landingTimer > 0) inacc += sp.landing * (s.landingTimer / PLAYER.landingPenaltyTime);
  inacc += s.fireSpread || 0;
  return inacc;
}

function smooth(t) {
  t = Math.min(1, Math.max(0, t));
  return t * t * (3 - 2 * t);
}

// Random direction offset inside a cone (uniform over the disk).
export function spreadOffset(inacc, rnd = Math.random) {
  const r = inacc * Math.sqrt(rnd());
  const a = rnd() * Math.PI * 2;
  return { pitch: r * Math.sin(a), yaw: r * Math.cos(a) };
}

// Hybrid recoil: learnable pattern + controlled variation. The aim offset is
// what actually deflects bullets; the camera only shows a fraction of it.
export class RecoilState {
  constructor(weapon, rnd = Math.random) {
    this.weapon = weapon;
    this.rnd = rnd;
    this.index = 0; // position in the spray pattern (float, rewinds when idle)
    this.pitch = 0; // radians, accumulated aim offset (up = positive)
    this.yaw = 0; // radians (right = positive)
    this.sinceShot = 99;
    this.fireSpread = 0;
  }

  reset() {
    this.index = 0; this.pitch = 0; this.yaw = 0; this.sinceShot = 99; this.fireSpread = 0;
  }

  // Call once per shot (before computing the shot direction for the *next* bullet).
  kick(ads) {
    const r = this.weapon.recoil;
    const pat = r.pattern;
    const i = Math.min(pat.length - 1, Math.floor(this.index));
    const [up, side] = pat[i];
    const vary = 1 + (this.rnd() * 2 - 1) * r.variation;
    const mul = ads ? r.adsMultiplier : 1;
    this.pitch += (up * vary + (this.rnd() * 2 - 1) * r.jitter) * DEG * mul;
    this.yaw += (side * vary + (this.rnd() * 2 - 1) * r.jitter) * DEG * mul;
    this.index += 1;
    this.sinceShot = 0;
    const sp = this.weapon.spread;
    this.fireSpread = Math.min(sp.perShotMax, this.fireSpread + sp.perShot);
  }

  update(dt) {
    const r = this.weapon.recoil;
    this.sinceShot += dt;
    this.fireSpread = Math.max(0, this.fireSpread - this.weapon.spread.recoveryRate * dt);
    if (this.sinceShot > Math.max(r.recoveryDelay, this.weapon.fireInterval * 1.2)) {
      const k = Math.exp(-r.recoveryRate * dt);
      this.pitch *= k;
      this.yaw *= k;
      this.index = Math.max(0, this.index - r.indexRecovery * dt);
    }
  }

  get viewPitch() { return this.pitch * this.weapon.recoil.viewKickRatio; }
  get viewYaw() { return this.yaw * this.weapon.recoil.viewKickRatio; }
}

// Forward vector for yaw/pitch (yaw 0 = -z, pitch up positive).
export function dirFromAngles(yaw, pitch, out = { x: 0, y: 0, z: 0 }) {
  const cp = Math.cos(pitch);
  out.x = -Math.sin(yaw) * cp;
  out.y = Math.sin(pitch);
  out.z = -Math.cos(yaw) * cp;
  return out;
}
