// First-person player: movement, collision, crouch/jump, footsteps, health.
import { PLAYER, ARMOR } from './config.js';
import { humanHitboxes } from './core/collision.js';

export class Player {
  constructor(world, layout, emit) {
    this.world = world;
    this.layout = layout;
    this.emit = emit;
    this.pos = { x: 0, y: 0, z: 0 };
    this.vel = { x: 0, z: 0 };
    this.state = { vy: 0, grounded: true };
    this.yaw = 0;
    this.pitch = 0;
    this.height = PLAYER.standHeight;
    this.eyeY = PLAYER.standEye;
    this.smoothY = 0; // smoothed feet height for camera (step-up smoothing)
    this.crouched = false;
    this.walking = false;
    this.ads = false;
    this.health = PLAYER.maxHealth;
    this.armor = 0;
    this.alive = true;
    this.stepDist = 0;
    this.landingTimer = 0;
    this.airTime = 0;
    this.speedMul = 1;
    this.moving = false;
    this.bob = 0;
  }

  reset(spawn) {
    this.pos = { x: spawn.x, y: 0, z: spawn.z };
    this.vel = { x: 0, z: 0 };
    this.state = { vy: 0, grounded: true };
    this.yaw = spawn.yaw; this.pitch = 0;
    this.height = PLAYER.standHeight; this.eyeY = PLAYER.standEye; this.smoothY = 0;
    this.crouched = false;
    this.health = PLAYER.maxHealth;
    this.alive = true;
    this.stepDist = 0; this.landingTimer = 0;
  }

  get speed() { return Math.hypot(this.vel.x, this.vel.z); }
  get hitboxes() { return humanHitboxes(this.height); }
  get eye() { return { x: this.pos.x, y: this.smoothY + this.eyeY, z: this.pos.z }; }

  look(dx, dy, sens) {
    this.yaw -= dx * sens;
    this.pitch -= dy * sens;
    const lim = Math.PI / 2 - 0.01;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  update(dt, input, weaponMoveMul, canMove = true) {
    if (!this.alive) {
      // Death camera: sink toward the floor.
      this.eyeY = Math.max(0.35, this.eyeY - dt * 2.5);
      return;
    }
    // A key tapped and released between two frames still counts for that frame
    // (important for quick counter-strafe taps on slow machines).
    const k = { has: (c) => input.keys.has(c) || input.pressed.has(c) };
    const fwd = canMove ? (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0) : 0;
    const str = canMove ? (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0) : 0;
    this.walking = k.has('ShiftLeft') || k.has('ShiftRight');
    const wantCrouch = k.has('ControlLeft') || k.has('ControlRight') || k.has('KeyC');

    // Crouch / stand with headroom check.
    if (wantCrouch) this.crouched = true;
    else if (this.crouched) {
      if (!this.world.overlaps({ x: this.pos.x, y: this.pos.y + 0.05, z: this.pos.z }, PLAYER.radius - 0.02, PLAYER.standHeight - 0.05)) this.crouched = false;
    }
    const targetH = this.crouched ? PLAYER.crouchHeight : PLAYER.standHeight;
    const targetEye = this.crouched ? PLAYER.crouchEye : PLAYER.standEye;
    this.height += Math.sign(targetH - this.height) * Math.min(Math.abs(targetH - this.height), PLAYER.crouchTransitionSpeed * dt * 0.6);
    this.eyeY += (targetEye - this.eyeY) * Math.min(1, dt * 14);

    // Wish velocity.
    let mul = weaponMoveMul;
    let m = 1;
    if (this.walking) m = Math.min(m, PLAYER.walkMultiplier);
    if (this.crouched) m = Math.min(m, PLAYER.crouchMultiplier);
    if (this.ads) m = Math.min(m, PLAYER.adsMultiplier);
    mul *= m;
    const maxSpeed = PLAYER.runSpeed * mul;
    this.maxSpeed = PLAYER.runSpeed * weaponMoveMul;
    let wx = 0, wz = 0;
    if (fwd || str) {
      const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
      // forward = (-sin, -cos); right = (cos, -sin)
      wx = -s * fwd + c * str;
      wz = -c * fwd - s * str;
      const len = Math.hypot(wx, wz);
      wx = (wx / len) * maxSpeed; wz = (wz / len) * maxSpeed;
    }
    const g = this.state.grounded;
    if (g) {
      if (fwd || str) {
        // Accelerate toward wish velocity (handles counter-strafing: the
        // opposite key drives velocity through zero almost instantly).
        const dx = wx - this.vel.x, dz = wz - this.vel.z;
        const dl = Math.hypot(dx, dz);
        const a = PLAYER.groundAccel * dt;
        if (dl <= a) { this.vel.x = wx; this.vel.z = wz; } else { this.vel.x += (dx / dl) * a; this.vel.z += (dz / dl) * a; }
      } else {
        const sp = this.speed;
        const drop = PLAYER.groundFriction * dt;
        if (sp <= drop) { this.vel.x = 0; this.vel.z = 0; } else { this.vel.x *= (sp - drop) / sp; this.vel.z *= (sp - drop) / sp; }
      }
    } else if (fwd || str) {
      // Limited air control.
      this.vel.x += (wx - this.vel.x) * Math.min(1, PLAYER.airAccel * dt * 0.2);
      this.vel.z += (wz - this.vel.z) * Math.min(1, PLAYER.airAccel * dt * 0.2);
    }

    // Jump.
    if (canMove && input.hit('Space') && g && !this.crouched) {
      this.state.vy = PLAYER.jumpVelocity;
      this.state.grounded = false;
    }
    this.state.vy -= PLAYER.gravity * dt;
    const wasGrounded = this.state.grounded;
    const fallSpeed = -this.state.vy;
    const prevX = this.pos.x, prevZ = this.pos.z;
    const hit = this.world.move(this.pos, { x: this.vel.x * dt, y: this.state.vy * dt, z: this.vel.z * dt }, PLAYER.radius, this.height, PLAYER.stepHeight, this.state);
    if (hit.x) this.vel.x = 0;
    if (hit.z) this.vel.z = 0;
    // Safety: never fall out of the world.
    if (this.pos.y < -5) { this.pos.y = 0.1; this.state.vy = 0; }

    if (!wasGrounded && this.state.grounded) {
      if (this.airTime > 0.25) {
        this.landingTimer = PLAYER.landingPenaltyTime;
        if (fallSpeed > 3) this.emit('land', this.pos, { source: 'player' });
      }
      this.airTime = 0;
    }
    if (!this.state.grounded) this.airTime += dt;
    this.landingTimer = Math.max(0, this.landingTimer - dt);

    // Camera step smoothing.
    if (this.pos.y > this.smoothY) this.smoothY = Math.min(this.pos.y, this.smoothY + Math.max(dt * 6, (this.pos.y - this.smoothY) * dt * 18));
    else this.smoothY = this.pos.y;

    // Footsteps based on distance travelled on the ground.
    const moved = Math.hypot(this.pos.x - prevX, this.pos.z - prevZ);
    this.moving = moved > 0.001;
    if (this.state.grounded && moved > 0) {
      this.stepDist += moved;
      const sp = this.speed;
      const stride = this.crouched ? 1.1 : sp > maxSpeed * 0.75 && !this.walking ? 2.1 : 1.5;
      if (this.stepDist >= stride) {
        this.stepDist = 0;
        let type = 'step_run';
        if (this.crouched) type = 'step_crouch';
        else if (this.walking || sp < PLAYER.runSpeed * 0.6) type = 'step_walk';
        this.emit(type, this.pos, { source: 'player' });
      }
      this.bob += moved * 2.4;
    }
  }

  takeDamage(result) {
    if (result.killed) this.alive = false;
  }

  addArmor() { this.armor = ARMOR.max; }
}
