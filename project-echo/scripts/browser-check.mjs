// Optional in-browser acceptance check (run: npm run check:browser).
// Starts a Vite dev server, opens the game in headless Chromium via Playwright,
// and drives the real game loop at a fixed 60 Hz to verify gameplay behaviour.
// Playwright is NOT a project dependency: if it is missing, the check is skipped.
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let chromium;
try {
  const mod = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  chromium = mod.chromium || mod.default?.chromium;
  if (!chromium) throw new Error('no chromium export');
} catch {
  console.log('Playwright not installed — browser check skipped. (npm i -D playwright to enable)');
  process.exit(0);
}

const results = [];
const check = (name, ok, info = '') => results.push({ ok, line: `${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}` });

const server = await createServer({ root, logLevel: 'error', server: { port: 5199, strictPort: false } });
await server.listen();
const url = server.resolvedUrls.local[0];
const exe = process.env.CHROMIUM_PATH;
const browser = await chromium.launch({ executablePath: exe || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

try {
  await page.goto(url);
  await page.waitForFunction(() => window.__echo);
  await page.click('#btnStart');
  const ev = (fn, arg) => page.evaluate(fn, arg);
  check('start button enters the game', await ev(() => window.__echo.state === 'playing'));
  // Fixed-step driver (software GL in CI is too slow for real-time checks).
  await ev(() => {
    const g = window.__echo;
    g.state = 'test';
    g.frame = () => g.render();
    g.input.locked = true;
    window.__step = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) { g.update(1 / 60); g.input.endFrame(); } };
  });
  const step = (s) => ev((x) => window.__step(x), s);
  const key = async (code, sec) => { await page.keyboard.down(code); await step(sec); await page.keyboard.up(code); };

  // 1-2. Movement, collision.
  const z0 = await ev(() => window.__echo.player.pos.z);
  await key('KeyW', 0.6);
  const z1 = await ev(() => window.__echo.player.pos.z);
  check('W moves forward', z1 < z0 - 2, `${(z1 - z0).toFixed(2)} m`);
  check('spawn barrier holds during buy phase', (await (async () => { await key('KeyW', 3); return ev(() => window.__echo.player.pos.z); })()) > 45.9);
  await ev(() => { const g = window.__echo; g.player.pos = { x: 0, y: 0, z: 56 }; g.player.yaw = Math.PI; });
  await key('KeyW', 0.8);
  check('walls block the player', (await ev(() => window.__echo.player.pos.z)) < 57.8);

  // 6. Accuracy states.
  await ev(() => { const g = window.__echo; g.player.pos = { x: 0, y: 0, z: 52 }; g.player.yaw = Math.PI / 2; });
  await page.keyboard.down('KeyW'); await step(0.5);
  const moving = await ev(() => window.__echo.weapons.inaccuracy);
  await page.keyboard.up('KeyW'); await page.keyboard.down('KeyS'); await step(0.08); await page.keyboard.up('KeyS'); await step(0.03);
  const stopped = await ev(() => ({ i: window.__echo.weapons.inaccuracy, s: window.__echo.player.speed }));
  check('moving hurts accuracy; counter-strafe restores it fast', moving > stopped.i * 3 && stopped.s < 1, `run ${moving.toFixed(4)} -> ${stopped.i.toFixed(4)} rad`);
  await page.keyboard.press('Space'); await step(0.15);
  check('jumping hurts accuracy', await ev(() => window.__echo.weapons.inaccuracy > 0.1));
  await step(1);

  // 15. Buying.
  const buy = await ev(() => { const g = window.__echo; g.setBuyOpen(true); const ok = g.buy('vertice') && g.buy('armor'); const again = g.buy('vertice'); g.setBuyOpen(false); return { ok, again, c: g.economy.credits, a: g.player.armor, w: g.weapons.weapon.id }; });
  check('buy menu purchases rifle + armor and deducts credits', buy.ok && !buy.again && buy.c === 150 && buy.a === 100 && buy.w === 'vertice', JSON.stringify(buy));
  await step(0.8);

  // 4,7. Firing, recoil, reload.
  await ev(() => { const g = window.__echo; g.player.pitch = 0; g.input.mouse.left = true; });
  await step(1.0);
  const spray = await ev(() => { const g = window.__echo; g.input.mouse.left = false; const w = g.weapons.weapon; return { mag: w.mag, pitch: w.recoil.pitch }; });
  check('automatic fire at ~600 rpm', spray.mag >= 19 && spray.mag <= 21, `mag ${spray.mag}`);
  check('recoil climbs during a spray', spray.pitch > 0.08, `${(spray.pitch * 57.3).toFixed(1)}°`);
  await step(1.2);
  check('recoil recovers when firing stops', await ev(() => window.__echo.weapons.weapon.recoil.pitch < 0.005));
  await page.keyboard.press('KeyR'); await step(2.6);
  check('reload refills the magazine', await ev(() => { const w = window.__echo.weapons.weapon; return w.mag === 30 && w.reserve < 90; }));
  // 5. ADS.
  await ev(() => { window.__echo.input.mouse.right = true; }); await step(0.4);
  const ads = await ev(() => ({ f: window.__echo.camera.fov, i: window.__echo.weapons.inaccuracy }));
  await ev(() => { window.__echo.input.mouse.right = false; }); await step(0.4);
  const hip = await ev(() => ({ f: window.__echo.camera.fov, i: window.__echo.weapons.inaccuracy }));
  check('ADS narrows FOV and spread', ads.f < hip.f - 10 && ads.i < hip.i);

  // 9. Doors.
  await ev(() => { const g = window.__echo; g.player.pos = { x: 0, y: 0, z: -15.8 }; g.player.yaw = 0; });
  await page.keyboard.press('KeyE'); await step(0.7);
  check('E opens a door', await ev(() => window.__echo.doors.D1.isOpen));
  await page.keyboard.press('KeyE'); await step(0.7);
  await key('KeyW', 1);
  check('closed door blocks movement', await ev(() => window.__echo.player.pos.z > -18));

  // 8. Barricade.
  const bar = await ev(() => {
    const g = window.__echo; const p = g.player; p.pos = { x: -27, y: 0, z: 23.5 };
    let n = 0; while (!g.barricades.B1.destroyed && n < 50) { g.fireShot(p.eye, { x: 1, y: 0, z: 0 }, g.weapons.weapon.def, 'player'); n++; }
    return { n, open: !g.barricades.B1.collider.active, navOpen: !!g.nav.path('A2', 'SH1')?.includes('SH0') };
  });
  await key('KeyD', 0); // no-op keep input clean
  await ev(() => { const g = window.__echo; g.player.pos = { x: -27, y: 0, z: 23.5 }; g.player.yaw = -Math.PI / 2; });
  await key('KeyW', 1.2);
  const through = await ev(() => window.__echo.player.pos.x);
  check('barricade breaks and opens a walkable route', bar.open && bar.navOpen && through > -22, `${bar.n} rifle hits, player x=${through.toFixed(1)}`);

  // Live phase.
  await ev(() => { const g = window.__echo; g.startRound(true); g.goLive(); });
  // 11. No wallhack: a silent player hidden in the tunnel is never engaged.
  await ev(() => { const g = window.__echo; g.player.pos = { x: 18.7, y: 0, z: 25 }; });
  await step(20);
  const hidden = await ev(() => window.__echo.bots.map((b) => b.state));
  check('bots do not track a silent, hidden player', hidden.every((s) => s !== 'engage' && s !== 'search'), hidden.join(','));
  // 11. Sound: a gunshot draws an investigation to an approximate origin.
  await ev(() => { const g = window.__echo; g.player.pos = { x: 0, y: 0, z: 6 }; g.emit('shot_rifle', { x: 0, y: 0, z: 6 }, { source: 'player' }); });
  await step(0.1);
  const inv = await ev(() => window.__echo.bots.filter((b) => b.state === 'investigate').map((b) => [+b.investigatePos.x.toFixed(1), +b.investigatePos.z.toFixed(1)]));
  check('gunshot makes bots investigate its approximate origin', inv.length > 0, JSON.stringify(inv));
  // 3. Bots engage a visible player and the player can kill them with the normal shot system.
  const kill = await ev(() => {
    const g = window.__echo; const b = g.bots[0]; const p = g.player;
    b.pos = { x: 0, y: 0, z: 20 }; b.state = 'guard'; // open street, clear line of fire
    p.pos = { x: 0, y: 0, z: 24 };
    const e = p.eye; const t = { x: b.pos.x, y: b.pos.y + 1.2, z: b.pos.z };
    const d = Math.hypot(t.x - e.x, t.y - e.y, t.z - e.z);
    const before = g.economy.credits;
    let n = 0; while (b.alive && n < 20) { g.fireShot(e, { x: (t.x - e.x) / d, y: (t.y - e.y) / d, z: (t.z - e.z) / d }, g.weapons.weapon.def, 'player'); n++; }
    return { n, dead: !b.alive, reward: g.economy.credits - before };
  });
  check('player shots kill an armored bot in ~5 torso hits (+kill reward)', kill.dead && kill.n >= 4 && kill.n <= 6 && kill.reward === 300, JSON.stringify(kill));
  // Bot soak: let the AI run with a visible, invulnerable player for 60 s.
  const soak = await ev(() => {
    const g = window.__echo;
    for (const b of g.bots) b.reset();
    g.player.pos = { x: 0, y: 0, z: -4 };
    const states = new Set(); let damage = 0; let bad = 0;
    for (let i = 0; i < 3600; i++) {
      g.player.health = 100000; g.player.armor = 0; g.phaseTime = 100;
      g.update(1 / 60); g.input.endFrame();
      damage += 100000 - g.player.health;
      for (const b of g.bots) {
        states.add(b.state);
        if (!Number.isFinite(b.pos.x) || g.world.overlaps(b.pos, 0.25, 1.6, (c) => c.kind === 'static')) bad++;
      }
    }
    g.player.health = 100;
    return { states: [...states], damage, bad, phase: g.phase };
  });
  check('bots engage and damage a visible player (same damage rules)', soak.damage > 0 && soak.states.includes('engage'), JSON.stringify(soak));
  check('bots never end up inside walls', soak.bad === 0);
  await ev(() => window.__echo.startMatch());

  // 12-13. Steal + extract.
  await ev(() => { const g = window.__echo; g.startRound(true); g.goLive(); for (const b of g.bots) b.alive = false; g.player.pos = { x: 0, y: 0, z: -24.4 }; });
  await page.keyboard.down('KeyE'); await step(5.2); await page.keyboard.up('KeyE');
  check('holding E at the terminal steals the module', await ev(() => window.__echo.objective.state === 'carried'));
  await ev(() => { window.__echo.player.pos = { x: -39, y: 0, z: -47 }; });
  await step(2);
  await ev(() => { window.__echo.player.pos = { x: -30, y: 0, z: -36 }; });
  await step(0.3);
  check('leaving the zone interrupts extraction', await ev(() => window.__echo.objective.extractProgress < 1.5));
  await ev(() => { window.__echo.player.pos = { x: -39, y: 0, z: -47 }; });
  await step(5.3);
  const won = await ev(() => ({ phase: window.__echo.phase, wins: window.__echo.wins, credits: window.__echo.economy.credits }));
  check('extraction wins the round (+$3000)', won.phase === 'end' && won.wins === 1, JSON.stringify(won));
  // 14, 16. Loss by timer, economy carries over.
  await step(7.2);
  const c0 = await ev(() => { const g = window.__echo; g.goLive(); g.phaseTime = 0.01; return g.economy.credits; });
  await step(0.1);
  const c1 = await ev(() => ({ c: window.__echo.economy.credits, phase: window.__echo.phase, losses: window.__echo.losses }));
  check('timer expiry loses the round and pays the loss bonus', c1.phase === 'end' && c1.losses === 1 && c1.c - c0 === 1400, JSON.stringify(c1));
  // 17. HUD reflects state.
  const hud = await ev(() => ({ credits: document.getElementById('creditsVal').textContent, title: document.getElementById('reTitle').textContent }));
  check('HUD shows credits and round result', hud.credits === String(c1.c) && hud.title === 'ROUND LOST', JSON.stringify(hud));
  // Draw calls for the world pass.
  const calls = await ev(() => { const g = window.__echo; g.renderer.info.autoReset = false; g.renderer.info.reset(); g.player.pos = { x: 0, y: 0, z: 20 }; g.updateCamera(0); g.renderer.render(g.scene, g.camera); const c = g.renderer.info.render.calls; g.renderer.info.autoReset = true; return c; });
  results.push({ ok: true, line: `INFO  world draw calls per frame (avenue view): ${calls}` });
} finally {
  await browser.close();
  await server.close();
}
for (const r of results) console.log(r.line);
if (errors.length) console.log('Browser errors:\n' + errors.join('\n'));
const failed = results.filter((r) => !r.ok).length + errors.length;
console.log(`\n${results.filter((r) => r.ok).length} ok, ${failed} failed`);
process.exit(failed ? 1 : 0);
