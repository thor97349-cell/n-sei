// Keyboard / mouse input with pointer lock handling.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set(); // keys pressed since last frame (edge)
    this.mouse = { dx: 0, dy: 0, left: false, right: false, leftPressed: false };
    this.locked = false;
    this.onLockChange = null;
    this.enabled = true;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'ControlLeft' || e.code === 'ControlRight' || e.code === 'Space' || e.code === 'Tab') e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.left = this.mouse.right = false; });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouse.dx += e.movementX || 0;
      this.mouse.dy += e.movementY || 0;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) { this.mouse.left = true; this.mouse.leftPressed = true; }
      if (e.button === 2) this.mouse.right = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
    // Right-click is ADS: never open the browser context menu over the game.
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) { this.mouse.left = this.mouse.right = false; }
      this.onLockChange?.(this.locked);
    });
    document.addEventListener('pointerlockerror', () => this.onLockError?.());
  }

  requestLock() {
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: false });
      if (p && p.catch) p.catch(() => this.onLockError?.());
    } catch (e) {
      this.onLockError?.();
    }
  }

  exitLock() { if (document.pointerLockElement) document.exitPointerLock(); }

  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }

  endFrame() {
    this.pressed.clear();
    this.mouse.dx = this.mouse.dy = 0;
    this.mouse.leftPressed = false;
  }
}
