// PROJECT ECHO — entry point: settings, menus, pointer lock, main loop.
import { Game } from './game/game.js';
import { GRAPHICS } from './config.js';

const $ = (id) => document.getElementById(id);

function loadSettings() {
  const def = { graphics: GRAPHICS.defaultPreset, sensitivity: 1, volume: 0.8, fullscreen: false };
  try {
    return { ...def, ...JSON.parse(localStorage.getItem('echo.settings') || '{}') };
  } catch (e) {
    return def;
  }
}
function saveSettings(s) {
  try { localStorage.setItem('echo.settings', JSON.stringify(s)); } catch (e) { /* storage unavailable */ }
}

const settings = loadSettings();
const canvas = $('game');
let game;
try {
  game = new Game(canvas, settings);
} catch (err) {
  $('startNote').textContent = 'WebGL could not start in this browser: ' + err.message;
  throw err;
}
window.__echo = game; // handy for debugging / automated smoke tests

// ---------------------------------------------------------------- settings UI
function bindSettings(prefix) {
  const g = $(prefix + 'Graphics'), s = $(prefix + 'Sens'), v = $(prefix + 'Vol');
  g.value = settings.graphics; s.value = settings.sensitivity; v.value = settings.volume;
  g.addEventListener('change', () => { settings.graphics = g.value; game.applyGraphics(g.value); syncAll(); saveSettings(settings); });
  s.addEventListener('input', () => { settings.sensitivity = parseFloat(s.value); syncAll(); saveSettings(settings); });
  v.addEventListener('input', () => { settings.volume = parseFloat(v.value); game.audio.setVolume(settings.volume); syncAll(); saveSettings(settings); });
}
function syncAll() {
  for (const p of ['set', 'pause']) {
    $(p + 'Graphics').value = settings.graphics;
    $(p + 'Sens').value = settings.sensitivity;
    $(p + 'Vol').value = settings.volume;
  }
  $('sensOut').textContent = settings.sensitivity.toFixed(2);
}
bindSettings('set');
bindSettings('pause');
syncAll();
$('setFull').checked = settings.fullscreen;
$('setFull').addEventListener('change', () => { settings.fullscreen = $('setFull').checked; saveSettings(settings); });
game.audio.volume = settings.volume;

// ---------------------------------------------------------------- flow
function enterFullscreen() {
  if (!settings.fullscreen || document.fullscreenElement) return;
  document.documentElement.requestFullscreen?.().then(() => {
    // Keyboard lock (fullscreen only) stops Ctrl+W from closing the tab.
    navigator.keyboard?.lock?.(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ControlLeft', 'Escape']).catch(() => {});
  }).catch(() => {});
}

function startGame() {
  game.audio.init();
  game.audio.setVolume(settings.volume);
  enterFullscreen();
  $('start').classList.add('hidden');
  $('pause').classList.add('hidden');
  game.hud.show(true);
  game.state = 'playing';
  game.input.requestLock();
}

function pauseGame() {
  if (game.state !== 'playing') return;
  game.state = 'paused';
  game.audio.suspend();
  $('pause').classList.remove('hidden');
}

function resumeGame() {
  game.audio.resume();
  $('pause').classList.add('hidden');
  game.state = 'playing';
  game.input.requestLock();
}

function toMenu() {
  game.state = 'menu';
  game.setBuyOpen(false);
  game.input.exitLock();
  game.audio.suspend();
  game.hud.show(false);
  game.hud.showRoundEnd(null);
  $('pause').classList.add('hidden');
  $('start').classList.remove('hidden');
  game.startMatch();
}

$('btnStart').addEventListener('click', startGame);
$('btnResume').addEventListener('click', resumeGame);
$('btnRestart').addEventListener('click', () => { game.startMatch(); resumeGame(); });
$('btnMenu').addEventListener('click', toMenu);
$('btnNewMatch').addEventListener('click', () => { game.newMatch(); game.input.requestLock(); });

game.input.onLockChange = (locked) => {
  // Losing the lock (Esc) pauses — unless the buy menu or match summary released it on purpose.
  if (!locked && game.state === 'playing' && !game.buyOpen && game.phase !== 'matchEnd') pauseGame();
  game.hud.lockHint(!locked && game.state === 'playing' && !game.buyOpen && game.phase !== 'matchEnd');
};
game.input.onLockError = () => {
  // Pointer lock unavailable (e.g. iframe preview or re-lock too soon after Esc).
  if (game.state === 'playing') game.hud.lockHint(true);
};
canvas.addEventListener('click', () => {
  if (game.state === 'playing' && !game.input.locked && !game.buyOpen) game.input.requestLock();
});
document.addEventListener('keydown', (e) => {
  // Esc inside the buy menu closes the menu instead of pausing.
  if (e.code === 'Escape' && game.buyOpen) { game.setBuyOpen(false); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

// ---------------------------------------------------------------- loop
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.frame(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
