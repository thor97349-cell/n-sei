# PROJECT ECHO — NODE-7 (first playable prototype)

A browser-based, first-person tactical shooter prototype built with **Three.js + Vite + Web Audio**.
One attacker (you) against three defending bots in **NODE-7**, a data center wedged into a compact urban block.
Mode: **DATA EXTRACTION** — steal a physical data module from the terminal and get it out.

Design pillars being tested:

1. **Destructible routes** — wooden barricades can be shot down to open new paths.
2. **Tactical sound** — every action makes positional, occluded sound; bots hear you, and you hear them
   (with subtle directional HUD cues that show *approximate* direction, never positions).

No backend, no external assets, no API keys. All geometry, textures and sounds are procedural.

---

## Run it

Requirements: Node.js 20.19+ (or 22+) and a modern desktop browser (Chrome / Edge / Firefox / ChromeOS).

```bash
cd project-echo
npm install
npm run dev          # dev server on http://localhost:5173 (also exposed on the LAN / IDE preview)
```

Other commands:

```bash
npm test             # headless logic tests: map/nav integrity, collision, TTK, recoil, accuracy, economy
npm run build        # production build into dist/
npm run preview      # serve the production build on http://localhost:4173
npm run check        # npm test + build
npm run check:browser  # optional: plays the game in headless Chromium (needs `npm i -D playwright`)
```

From the repository root you can also run `npm run echo:dev` / `npm run echo:build`.

**Browser IDEs (Replit, Codespaces, cloud preview):** the Vite server listens on all interfaces
(`host: true`, `allowedHosts: true`), so use the IDE's web preview / forwarded port **5173**.
Open the preview in its **own browser tab** if the embedded preview iframe blocks pointer lock
(mouse capture). On Replit set the run command to `cd project-echo && npm install && npm run dev`.

## Controls

| Input | Action |
| --- | --- |
| Click **DEPLOY** | Start and capture the mouse |
| `W A S D` | Move (fast acceleration, quick stops) |
| Mouse | Look / aim |
| Left mouse | Fire (Vértice is automatic, Linha is semi-auto) |
| Right mouse (hold) | Aim down sights |
| `R` | Reload |
| `Shift` | Walk quietly (slower, much quieter footsteps) |
| `Ctrl` or `C` | Crouch (slower, quietest, smaller and more accurate) |
| `Space` | Jump (very inaccurate while airborne) |
| `E` | Open/close doors · **hold** at the terminal to hack |
| `1` / `2` / `Q` | Rifle / pistol / swap |
| `B` | Buy menu (buy phase only) — click items or press `1`–`3` |
| `Esc` | Release the mouse and pause (resume, settings, restart, main menu) |
| `F3` | FPS counter |
| `Enter` | New match after the match summary |

Some browsers close the tab on `Ctrl`+`W`; use `C` to crouch, or tick **Fullscreen** on the start
screen (fullscreen enables keyboard lock in Chromium browsers).

## How a round works

1. **BUY** (15 s) — spawn exits are sealed (orange fields). Press `B` to buy. Bots are idle.
2. **INFILTRATION** (2:30 round timer) — pick a route: Main Avenue, Service Alley, Technical Tunnel,
   or breach a barricade.
3. **DATA THEFT** — hold `E` at the terminal in the Data Room for 5 s. Taking damage, releasing `E` or
   walking away cancels it. Starting and finishing the hack are loud (bots hear them).
4. **EXTRACTION** — the module is now carried (visible in your left hand). Reach the **West Loading Dock**
   or the **East Garage** and stay inside the green zone for 5 s. Leaving the zone drains progress.

You lose the round if you are eliminated (the module drops where you fell) or the timer runs out.
Killing every defender does **not** win the round — only extraction does. First to 4 round wins takes
the match; a new match resets the economy.

## Economy (all values in `src/config.js → ECONOMY`)

* Start: **$3,500** (testing-friendly). Linha pistol is free and always carried.
* Vértice rifle **$2,700**, armor vest **$650**, pistol ammo refill free.
* Round win **+$3,000**; loss **+$1,400**, +$500 per consecutive loss up to **$3,400**; kill **+$300**.
* Survivors keep their rifle and remaining armor; if you die you lose them. Magazines refill every round.

## Implemented mechanics

* **Movement:** ground acceleration/friction tuned for snappy starts and stops; counter-strafing kills
  momentum in ~0.1 s; walk, crouch (with headroom check), jump, step-up on small ledges and the garage ramp.
  AABB collision against walls, props, doors and barricades.
* **Gunplay:** data-driven weapons (`WEAPONS` in config). Hitscan raycasts stop at solid geometry.
  Head / torso / arm / leg hitboxes on bots *and* the player. Damage falloff by distance, armor
  penetration, kill rewards. Both bots and player use `applyDamage()` and `computeInaccuracy()`.
* **Recoil:** hybrid — a fixed, learnable spray pattern (Vértice climbs for ~10 shots, then drifts
  right, left, right) with ±12 % controlled variation and small jitter. Recoil deflects the bullets;
  the camera only shows ~45 % of it (separate visual kick), so pulling down compensates. It recovers when
  you stop firing, so short bursts restart the pattern.
* **Accuracy states:** stationary, crouched, walking, running, airborne, landing and ADS, driven by your
  actual speed (so counter-strafing restores accuracy). Dynamic crosshair approximates the spread.
* **ADS:** narrower FOV, sight alignment, lower spread, slower movement — recoil still applies (85 %).
* **Time-to-kill (rifle, 10 m):** 4 torso hits unarmored, 5 armored, 1 headshot (vest does not cover the head).
* **Destruction:** two wooden barricades (Alley→Shop passage, Loading area→Server Hall) with health,
  progressive plank damage, a breach sound, removed collision, and nav-graph routes that open when broken.
  Concrete walls are indestructible.
* **Doors:** four sliding doors (`E`). They block movement, bullets and sight when closed, never close on
  an actor, make a positional sound, and bots open them along their paths.
* **Tactical audio:** synthesized gunshots (distinct rifle/pistol), footsteps per surface (concrete,
  metal grating, outdoor, wood, tile), landing, reloads, dry fire, doors, barricade hits/breaks,
  terminal beeps/alarm, extraction uplink, hit/kill/headshot UI cues. Distance falloff, wall occlusion
  (gain + low-pass per wall crossed), stereo direction, behind-you dulling, and a cheap reverb bus per
  acoustic zone (outdoor / indoor / tunnel / garage). Voice cap keeps it cheap.
* **Directional sound cues:** enemy sounds above a loudness threshold show a fading arc around the
  crosshair, snapped to 22.5° steps, sized by intensity — direction only.
* **Bot AI:** 3 defenders (Warden guards the data room, Sentry patrols lobby/office, Hound patrols the
  server hall/west side). Waypoint graph with Dijkstra, door opening, stuck recovery. Vision = FOV cone +
  line of sight. Hearing = per-event radius reduced by walls; they investigate an **approximate** origin.
  When sight is lost they search the last *seen* position, not your current one. They react with a delay,
  aim error that settles over time, fire in bursts and stand still to shoot (same accuracy rules).
* **HUD:** timer, phase, score, objective text + module status, defenders alive, area callout, credits,
  health/armor, weapon/ammo/slots, reload state, dynamic crosshair, hit/headshot/kill markers, damage
  direction, sound cues, hack/extraction progress bars, objective markers with distance, kill feed,
  round/match summary.
* **Menus:** start screen with briefing + controls + settings (graphics, sensitivity, volume, fullscreen),
  pause menu (resume, settings, restart match, return to start screen).

## Performance (Chromebook mode)

* **Low** graphics is the default: 0.75× render scale, no shadows, no muzzle light, short draw distance.
  **High** adds shadows from a single directional light, full resolution and muzzle light (antialiasing
  applies after a reload).
* Static map geometry is merged per material (one mesh per material); a full frame measured ~115 draw
  calls including doors, barricade planks, bots and signs. Lambert materials,
  128 px procedural textures, two lights total, no post-processing.
* Collision and raycasts use a uniform grid over axis-aligned boxes; a full game update with three live
  bots measured ≈0.05–0.2 ms of CPU in headless Chromium.
* Decals, sparks and tracers are fixed-size pools; nothing accumulates over a match.

## Code map

```
src/
  config.js               all tuning: movement, weapons, recoil, damage, armor, economy, rounds, AI, audio, graphics
  main.js                 entry: settings, start/pause screens, pointer lock, main loop
  input.js                keyboard/mouse + pointer lock
  player.js               movement, crouch/jump, footsteps
  core/collision.js       AABB world, grid broad-phase, raycasts, occlusion, hitboxes   (pure JS)
  core/combat.js          damage/armor, accuracy states, hybrid recoil                    (pure JS)
  core/economy.js         credits, buy rules, round rewards                               (pure JS)
  core/nav.js             waypoint graph + pathfinding                                    (pure JS)
  world/layout.js         NODE-7 layout data: walls, props, areas, doors, barricades, waypoints (pure JS)
  world/build.js          meshes/materials/lighting from the layout
  world/interactables.js  doors and destructible barricades
  world/textures.js       procedural canvas textures
  weapons/weapons.js      player weapon handling, ADS, reload, viewmodel animation
  weapons/viewmodels.js   procedural first-person models
  ai/bots.js              defender bots: perception, navigation, combat
  audio/audio.js          Web Audio synthesis + spatialisation
  game/game.js            orchestration: rounds, shots, sound events, interaction, HUD wiring
  game/objective.js       terminal hack, data module, extraction zones
  game/effects.js         pooled decals, sparks, tracers
  ui/hud.js               DOM HUD, buy menu, round summary
scripts/selftest.mjs      Node logic tests (npm test)
scripts/browser-check.mjs optional end-to-end browser test (npm run check:browser)
```

To add a weapon: add an entry to `WEAPONS` (and a buy item in `ECONOMY.items`), then a viewmodel builder
in `weapons/viewmodels.js` registered in `BUILDERS` (`weapons/weapons.js`). The shooting code is generic.

## Verification status

Automated (`npm test`, `npm run check:browser`, `npm run build`) — passing:
map/nav integrity (every waypoint edge clear, all areas reachable, ≥3 data-room approaches, barricade
shortcut), wall/door/barricade collision, ramp climbing, hitbox zones, TTK targets, accuracy ordering,
recoil climb/recovery/variation, economy rules; and in a real browser: start flow, keyboard movement,
spawn barrier, counter-strafe accuracy, jump inaccuracy, buying, automatic fire rate, recoil + recovery,
reload, ADS, doors (`E`), barricade breach opening a walkable route, bots not tracking a hidden silent
player, gunshot investigation, killing a bot (+$300), bots engaging and damaging the player, bots never
inside walls during a 60 s soak, hack → extraction win, leaving the zone interrupting extraction, time-out
loss with loss bonus, HUD updates.

Manual checks worth doing on real hardware (cannot be automated headlessly):

1. **Audio feel** — let a bot patrol near a wall and listen: footsteps get quieter and duller through walls;
   tunnel steps ring metallic. Fire in the avenue vs. the tunnel.
2. **Mouse feel** — sensitivity, ADS, spray control (pull down then right/left/right).
3. **Frame rate** — press `F3` on the target Chromebook in Low and High modes.

## Known limitations (prototype)

* Single player vs. bots only; no multiplayer, no allied recovery of a dropped module (the round ends on death).
* Bots do not use teamwork, grenades or crouching, do not collide with each other, and can be outplayed by
  door/LOS tricks. Their hearing ignores other bots' noise.
* Collision is box-based (the ramp is invisible steps); no physics debris.
* Frosted lobby glass blocks bullets and AI vision (treated as solid security glass).
* Pointer lock may be blocked inside some embedded preview iframes — open the preview in its own tab.
* Antialiasing only changes after a page reload; graphics preset is remembered in `localStorage`.
