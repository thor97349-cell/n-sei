// PROJECT ECHO — central tuning data.
// Every gameplay number that designers are expected to tweak lives here:
// movement, weapons, damage, armor, recoil, economy, round timing, audio, AI.
// Values are provisional prototype numbers, not final balance.

export const GAME = {
  title: 'PROJECT ECHO',
  map: 'NODE-7',
  mode: 'DATA EXTRACTION',
};

export const PLAYER = {
  radius: 0.3,
  standHeight: 1.75,
  crouchHeight: 1.15,
  standEye: 1.62,
  crouchEye: 1.05,
  crouchTransitionSpeed: 9, // height units per second (smoothing)
  maxHealth: 100,
  // Movement (meters / second). Tactical feel: fast acceleration and stopping.
  runSpeed: 5.4,
  walkMultiplier: 0.52, // Shift
  crouchMultiplier: 0.36, // Ctrl
  adsMultiplier: 0.62, // right mouse
  groundAccel: 62, // m/s^2 toward wish velocity
  groundFriction: 48, // m/s^2 deceleration with no input
  airAccel: 7,
  jumpVelocity: 5.2,
  gravity: 15,
  stepHeight: 0.45,
  landingPenaltyTime: 0.22, // seconds of extra inaccuracy after landing
  mouseSensitivity: 0.0022, // radians per pixel (scaled by settings)
  baseFov: 78,
};

// Hit zones shared by player and bots. Multipliers apply to weapon base damage.
export const HIT_ZONES = {
  head: { mult: 4.0, armored: false },
  torso: { mult: 1.0, armored: true },
  arm: { mult: 0.75, armored: true },
  leg: { mult: 0.6, armored: false },
};

export const ARMOR = {
  max: 100,
  // Fraction of absorbed (blocked) damage that is subtracted from armor points.
  armorDamageRatio: 0.5,
  // Vest only in this prototype: the head is not covered (see HIT_ZONES.head.armored).
};

// Weapon definitions are pure data. To add a weapon, add an entry here and
// (optionally) a viewmodel builder in src/weapons/viewmodels.js.
export const WEAPONS = {
  vertice: {
    id: 'vertice',
    name: 'VÉRTICE',
    category: 'rifle',
    slot: 1,
    price: 2700,
    killReward: 300,
    damage: 27, // 4 torso hits unarmored, 5 armored
    armorPenetration: 0.775, // fraction of damage that reaches health through armor
    rangeModifier: 0.98, // damage *= rangeModifier ^ (distance / 10m)
    maxRange: 220,
    fireInterval: 0.1, // 600 RPM
    automatic: true,
    magSize: 30,
    reserveAmmo: 90,
    reloadTime: 2.4,
    drawTime: 0.6,
    moveSpeedMultiplier: 0.92,
    adsFov: 54,
    adsTime: 0.16,
    sound: 'rifle',
    // Inaccuracy in radians (cone half-angle).
    spread: {
      stand: 0.0035,
      crouch: 0.0025,
      walk: 0.022, // used at shift-walk speed
      run: 0.065, // at full run speed
      air: 0.17,
      landing: 0.06,
      adsMultiplier: 0.55, // applied to the movement-free part only
      perShot: 0.0045, // extra spread added per shot during a spray
      perShotMax: 0.028,
      recoveryRate: 0.08, // rad/s recovered from firing spread
    },
    recoil: {
      // Base pattern: per-shot aim offset increments in degrees [pitchUp, yawRight].
      // Generated deterministically below so it is learnable.
      pattern: null,
      variation: 0.12, // ±12% multiplicative variation per shot (controlled)
      jitter: 0.04, // degrees of small additive jitter
      viewKickRatio: 0.45, // fraction of aim offset shown as camera kick (visual only)
      recoveryDelay: 0.12, // seconds after last shot before recovery starts
      recoveryRate: 7.5, // 1/s exponential decay of aim offset
      indexRecovery: 18, // pattern index rewound per second when not firing
      adsMultiplier: 0.85, // ADS keeps meaningful recoil
    },
  },
  linha: {
    id: 'linha',
    name: 'LINHA',
    category: 'pistol',
    slot: 2,
    price: 0,
    killReward: 300,
    damage: 25,
    headMultiplier: 4.6, // overrides HIT_ZONES.head.mult: close-range one-tap vs no helmet
    armorPenetration: 0.5,
    rangeModifier: 0.86,
    maxRange: 160,
    fireInterval: 0.15,
    automatic: false,
    magSize: 12,
    reserveAmmo: 36,
    reloadTime: 2.1,
    drawTime: 0.4,
    moveSpeedMultiplier: 1.0,
    adsFov: 64,
    adsTime: 0.12,
    sound: 'pistol',
    spread: {
      stand: 0.005,
      crouch: 0.004,
      walk: 0.014,
      run: 0.034,
      air: 0.12,
      landing: 0.04,
      adsMultiplier: 0.6,
      perShot: 0.012,
      perShotMax: 0.04,
      recoveryRate: 0.12,
    },
    recoil: {
      pattern: null,
      variation: 0.15,
      jitter: 0.12,
      viewKickRatio: 0.55,
      recoveryDelay: 0.06,
      recoveryRate: 9,
      indexRecovery: 10,
      adsMultiplier: 0.9,
    },
  },
};

// Learnable rifle spray: climbs for ~10 shots, then drifts right, left, right.
WEAPONS.vertice.recoil.pattern = (() => {
  const p = [];
  for (let i = 0; i < 30; i++) {
    let up;
    if (i === 0) up = 0.0;
    else if (i < 10) up = 0.55 + i * 0.06;
    else up = Math.max(0.12, 0.6 - (i - 10) * 0.035);
    let side;
    if (i < 6) side = 0.04 * Math.sin(i);
    else if (i < 14) side = 0.38; // drift right
    else if (i < 22) side = -0.5; // swing left
    else side = 0.42; // back right
    p.push([up, side]);
  }
  return p;
})();

// Pistol: a strong single kick per shot, slight rightward bias.
WEAPONS.linha.recoil.pattern = Array.from({ length: 12 }, (_, i) => [1.25 + i * 0.05, i % 2 ? -0.12 : 0.18]);

export const LOADOUT = {
  startingSecondary: 'linha',
};

export const ECONOMY = {
  startingCredits: 3500, // testing-friendly; lower for a real match
  maxCredits: 16000,
  winReward: 3000,
  lossReward: 1400,
  lossBonusStep: 500, // added per consecutive loss
  lossRewardMax: 3400,
  // Buy menu items. Only implemented, functional items are listed.
  items: [
    { id: 'vertice', type: 'weapon', weapon: 'vertice', label: 'VÉRTICE rifle', price: 2700, key: '1' },
    { id: 'armor', type: 'armor', label: 'Armor vest (100)', price: 650, key: '2' },
    { id: 'linha_ammo', type: 'ammo', weapon: 'linha', label: 'LINHA spare magazines', price: 0, key: '3' },
  ],
};

export const ROUND = {
  buyTime: 15,
  roundTime: 150,
  endTime: 7,
  winsToTakeMatch: 4,
  hackTime: 5, // seconds holding E at the terminal
  extractTime: 5, // seconds inside an extraction zone
  interactRange: 2.2,
};

export const AI = {
  botCount: 3,
  health: 100,
  armor: 100,
  weapon: 'vertice',
  fov: 115, // degrees
  viewDistance: 70,
  visionInterval: 0.1, // seconds between LOS checks per bot
  reactionTime: 0.55, // base delay before first shot after spotting
  reactionPerMeter: 0.006,
  aimErrorStart: 3.2, // degrees when first spotting
  aimErrorMin: 0.55, // degrees after settling
  aimSettleTime: 1.3,
  targetMovingError: 1.2, // extra degrees if target moves fast
  burstMin: 3,
  burstMax: 6,
  burstPause: 0.4,
  turnSpeed: 7, // rad/s
  patrolSpeed: 2.6,
  investigateSpeed: 3.6,
  combatStrafeSpeed: 2.0,
  investigateLookTime: 3.5,
  searchTime: 5,
  soundPositionError: 0.12, // approx error = distance * factor (meters)
  soundPositionErrorMax: 4,
  memoryTime: 1.0, // seconds a bot keeps reacting after LOS lost before it moves to search
  recoilCompensation: 0.7,
};

// Tactical audio. `radius` = maximum distance (m) for AI hearing and for the
// player to hear it at all. `volume` = loudness at the source. Occlusion is
// per wall crossed between source and listener.
export const AUDIO = {
  masterVolume: 0.8,
  maxVoices: 24,
  occlusionGainPerWall: 0.42,
  occlusionHearingPerWall: 0.55,
  occlusionLowpass: [20000, 1400, 650, 400],
  maxOcclusionWalls: 3,
  indicatorThreshold: 0.06, // perceived gain needed to show a HUD indicator
  indicatorLifetime: 1.6,
  indicatorMax: 6,
  indicatorAngleStep: 22.5, // degrees; indicators snap to approximate directions
  events: {
    step_run: { radius: 20, volume: 0.55, label: 'STEPS' },
    step_walk: { radius: 5, volume: 0.16, label: 'STEPS' },
    step_crouch: { radius: 3.5, volume: 0.12, label: 'STEPS' },
    land: { radius: 12, volume: 0.5, label: 'LANDING' },
    shot_rifle: { radius: 75, volume: 1.0, label: 'GUNFIRE' },
    shot_pistol: { radius: 55, volume: 0.85, label: 'GUNFIRE' },
    reload: { radius: 7, volume: 0.35, label: 'RELOAD' },
    door: { radius: 24, volume: 0.6, label: 'DOOR' },
    barricade_hit: { radius: 26, volume: 0.6, label: 'IMPACT' },
    barricade_break: { radius: 48, volume: 1.0, label: 'BREACH' },
    terminal_start: { radius: 28, volume: 0.7, label: 'TERMINAL' },
    terminal_done: { radius: 45, volume: 0.9, label: 'ALARM' },
    extract_start: { radius: 18, volume: 0.6, label: 'UPLINK' },
    impact: { radius: 10, volume: 0.25, label: 'IMPACT' },
  },
  // Acoustic character per surface (footsteps / impacts).
  surfaces: {
    concrete: { freq: 950, q: 1.2, decay: 0.08, ring: 0 },
    metal: { freq: 2300, q: 4, decay: 0.12, ring: 1250 },
    outdoor: { freq: 520, q: 0.7, decay: 0.07, ring: 0 },
    wood: { freq: 420, q: 2.2, decay: 0.1, ring: 0 },
    tile: { freq: 1500, q: 1.8, decay: 0.07, ring: 0 },
  },
  // Simple reverb buses (feedback delays) per acoustic zone.
  zones: {
    outdoor: { delay: 0.11, feedback: 0.18, send: 0.18, tone: 2500 },
    indoor: { delay: 0.045, feedback: 0.32, send: 0.3, tone: 3200 },
    tunnel: { delay: 0.028, feedback: 0.55, send: 0.45, tone: 1800 },
    garage: { delay: 0.07, feedback: 0.45, send: 0.4, tone: 2200 },
  },
};

export const WORLD = {
  barricadeHealth: 220,
  doorSpeed: 2.2, // fraction of travel per second (≈0.45 s)
  maxDecals: 48,
};

export const GRAPHICS = {
  low: { pixelRatio: 0.75, shadows: false, far: 130, muzzleLight: false, antialias: false },
  high: { pixelRatio: 1.0, shadows: true, far: 220, muzzleLight: true, antialias: true },
  defaultPreset: 'low',
};
