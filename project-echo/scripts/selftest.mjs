// Headless self-test for PROJECT ECHO core systems (run: npm test).
// Validates map/navigation integrity, collision, damage/TTK tuning, recoil
// behaviour, accuracy states and economy rules without a browser.
import { buildLayout } from '../src/world/layout.js';
import { CollisionWorld, humanHitboxes, rayActor } from '../src/core/collision.js';
import { NavGraph } from '../src/core/nav.js';
import { applyDamage, hitsToKill, computeInaccuracy, RecoilState } from '../src/core/combat.js';
import { Economy, findItem } from '../src/core/economy.js';
import { WEAPONS, PLAYER, ECONOMY } from '../src/config.js';

let failed = 0, passed = 0;
const ok = (cond, msg) => {
  if (cond) passed++;
  else { failed++; console.error('  FAIL:', msg); }
};
const section = (s) => console.log(`\n# ${s}`);

const L = buildLayout();
const world = new CollisionWorld();
for (const b of L.boxes) if (b.collide) world.add({ ...b });
const doorCols = {}, barCols = {};
for (const d of L.doors) doorCols[d.id] = world.add({ min: { ...d.min }, max: { ...d.max }, kind: 'door', surface: 'metal' });
for (const b of L.barricades) barCols[b.id] = world.add({ min: { ...b.min }, max: { ...b.max }, kind: 'barricade', surface: 'wood' });

section('Map & navigation');
const R = 0.32, H = 1.7;
for (const n of Object.values(L.nodes)) {
  ok(!world.overlaps({ x: n.x, y: 0, z: n.z }, R, H, (c) => c.kind === 'static' || c.kind === 'glass'), `node ${n.id} is inside geometry`);
}
for (const e of L.edges) {
  const a = L.nodes[e.a], b = L.nodes[e.b];
  const d = Math.hypot(b.x - a.x, b.z - a.z);
  const steps = Math.ceil(d / 0.2);
  let clear = true;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = { x: a.x + (b.x - a.x) * t, y: 0, z: a.z + (b.z - a.z) * t };
    if (world.overlaps(p, R, H, (c) => c.kind === 'static' || c.kind === 'glass')) { clear = false; break; }
  }
  ok(clear, `edge ${e.a}-${e.b} crosses static geometry`);
  if (e.door) ok(!world.lineClear({ x: a.x, y: 1, z: a.z }, { x: b.x, y: 1, z: b.z }), `door edge ${e.a}-${e.b} not blocked by closed door ${e.door}`);
  if (e.barricade) ok(!world.lineClear({ x: a.x, y: 1, z: a.z }, { x: b.x, y: 1, z: b.z }), `barricade edge ${e.a}-${e.b} not blocked`);
}
const nav = new NavGraph(L);
for (const id of Object.keys(L.nodes)) ok(nav.path('S0', id), `node ${id} unreachable from spawn`);
nav.blocked = (e) => !!e.barricade;
ok(nav.path('S0', 'DR_S'), 'data room unreachable with barricades intact');
ok(nav.path('DR_S', 'DKX') && nav.path('DR_S', 'GX'), 'extraction zones unreachable from data room');
const viaB2 = (() => { nav.blocked = () => false; return nav.path('L1', 'DR_W'); })();
ok(viaB2 && viaB2.includes('SV0'), 'barricade B2 does not create a shortcut into the server hall');
// Distinct approach routes into the data room.
const entries = ['DR_S', 'DR_W', 'DR_E', 'DR_N'].filter((id) => nav.adj[id].some((l) => !l.to.startsWith('DR_')));
ok(entries.length >= 3, `data room needs >=3 approaches, has ${entries.length}`);
console.log(`  ${Object.keys(L.nodes).length} nodes, ${L.edges.length} edges, ${world.colliders.length} colliders, data-room approaches: ${entries.length}`);

section('Collision');
{
  // Walk the player from the avenue straight into the lobby facade glass.
  const pos = { x: -6, y: 0, z: 2 };
  const st = { vy: 0, grounded: true };
  for (let i = 0; i < 200; i++) world.move(pos, { x: 0, y: -0.01, z: -0.05 }, PLAYER.radius, PLAYER.standHeight, PLAYER.stepHeight, st);
  ok(pos.z > -2 + 0.2, `player passed through lobby glass (z=${pos.z.toFixed(2)})`);
  // Walk into closed door D1 from lobby.
  const p2 = { x: 0, y: 0, z: -15 };
  for (let i = 0; i < 100; i++) world.move(p2, { x: 0, y: -0.01, z: -0.05 }, PLAYER.radius, PLAYER.standHeight, PLAYER.stepHeight, st);
  ok(p2.z > -18, `player passed through closed door D1 (z=${p2.z.toFixed(2)})`);
  // Open door: move collider away and retry.
  const d = doorCols.D1; d.min.x += 2.9; d.max.x += 2.9; world.update(d);
  for (let i = 0; i < 100; i++) world.move(p2, { x: 0, y: -0.01, z: -0.05 }, PLAYER.radius, PLAYER.standHeight, PLAYER.stepHeight, st);
  ok(p2.z < -19, `player cannot pass open door D1 (z=${p2.z.toFixed(2)})`);
  d.min.x -= 2.9; d.max.x -= 2.9; world.update(d);
  // Barricade B1 blocks, then passes when destroyed.
  const p3 = { x: -27, y: 0, z: 23.5 };
  for (let i = 0; i < 100; i++) world.move(p3, { x: 0.05, y: -0.01, z: 0 }, PLAYER.radius, PLAYER.standHeight, PLAYER.stepHeight, st);
  ok(p3.x < -24, `barricade B1 not blocking (x=${p3.x.toFixed(2)})`);
  barCols.B1.active = false;
  for (let i = 0; i < 100; i++) world.move(p3, { x: 0.05, y: -0.01, z: 0 }, PLAYER.radius, PLAYER.standHeight, PLAYER.stepHeight, st);
  ok(p3.x > -22, `destroyed barricade B1 still blocks (x=${p3.x.toFixed(2)})`);
  barCols.B1.active = true;
  // Ramp is climbable.
  const p4 = { x: 43.4, y: 0, z: -40 };
  for (let i = 0; i < 420; i++) world.move(p4, { x: 0, y: -0.02, z: -0.04 }, PLAYER.radius, PLAYER.standHeight, PLAYER.stepHeight, st);
  ok(p4.y > 2, `garage ramp not climbable (y=${p4.y.toFixed(2)})`);
  // Shots stop at walls.
  const hit = world.raycast({ x: 0, y: 1.5, z: 10 }, { x: 0, y: 0, z: -1 }, 200);
  ok(hit && hit.collider, 'ray from avenue north should hit something');
  // Head hitbox
  const hb = humanHitboxes(1.75);
  const head = rayActor({ x: 0, y: 1.6, z: 5 }, { x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 0 }, 0, hb, 100);
  const legs = rayActor({ x: 0, y: 0.4, z: 5 }, { x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 0 }, 0, hb, 100);
  const arm = rayActor({ x: 0.3, y: 1.2, z: 5 }, { x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 0 }, 0, hb, 100);
  ok(head?.zone === 'head' && legs?.zone === 'leg' && arm?.zone === 'arm', `hitbox zones wrong: ${head?.zone}/${legs?.zone}/${arm?.zone}`);
  const rotated = rayActor({ x: 5, y: 1.2, z: 0 }, { x: -1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, Math.PI / 2, hb, 100);
  ok(rotated, 'rotated actor hitbox missed');
  // Sound occlusion: avenue -> data room crosses walls.
  const occ = world.countOccluders({ x: 0, y: 1.6, z: 10 }, { x: 0, y: 1.6, z: -26 });
  ok(occ >= 1, `expected occlusion between avenue and data room, got ${occ}`);
  ok(world.countOccluders({ x: 0, y: 1.6, z: 40 }, { x: 0, y: 1.6, z: 20 }) === 0, 'open avenue should not be occluded');
}

section('Damage / time-to-kill');
const V = WEAPONS.vertice, P = WEAPONS.linha;
const tb = [
  ['Vértice torso unarmored 10m', hitsToKill(V, 'torso', 10, 0), [4, 5]],
  ['Vértice torso armored 10m', hitsToKill(V, 'torso', 10, 100), [4, 5]],
  ['Vértice head armored 20m', hitsToKill(V, 'head', 20, 100), [1, 1]],
  ['Vértice leg unarmored 10m', hitsToKill(V, 'leg', 10, 0), [6, 8]],
  ['Linha torso unarmored 5m', hitsToKill(P, 'torso', 5, 0), [4, 6]],
  ['Linha torso armored 10m', hitsToKill(P, 'torso', 10, 100), [7, 11]],
  ['Linha head unarmored 3m', hitsToKill(P, 'head', 3, 0), [1, 1]],
];
for (const [name, n, [lo, hi]] of tb) {
  console.log(`  ${name}: ${n} hits`);
  ok(n >= lo && n <= hi, `${name} expected ${lo}-${hi} hits, got ${n}`);
}
const armT = { health: 100, armor: 0 }, torT = { health: 100, armor: 0 };
applyDamage(V, 'arm', 10, armT); applyDamage(V, 'torso', 10, torT);
ok(armT.health > torT.health, 'arm shots must deal less than torso');
const armored = { health: 100, armor: 100 };
applyDamage(V, 'torso', 10, armored);
ok(armored.armor < 100 && armored.health > 100 - V.damage, 'armor should absorb and lose points');
console.log(`  Vértice TTK (torso, unarmored): ${((hitsToKill(V, 'torso', 10) - 1) * V.fireInterval * 1000).toFixed(0)} ms`);

section('Accuracy states');
const st = (o) => computeInaccuracy(V, { speed: 0, grounded: true, crouched: false, ads: false, landingTimer: 0, ...o });
const stand = st({}), crouch = st({ crouched: true }), ads = st({ ads: true });
const walk = st({ speed: PLAYER.runSpeed * V.moveSpeedMultiplier * PLAYER.walkMultiplier });
const run = st({ speed: PLAYER.runSpeed * V.moveSpeedMultiplier });
const air = st({ grounded: false });
console.log(`  stand ${stand.toFixed(4)} crouch ${crouch.toFixed(4)} ads ${ads.toFixed(4)} walk ${walk.toFixed(4)} run ${run.toFixed(4)} air ${air.toFixed(4)} rad`);
ok(crouch < stand && ads < stand && stand < walk && walk < run && run < air, 'accuracy ordering crouch/ads < stand < walk < run < air');
ok(st({ speed: 1.0 }) === stand, 'counter-strafed (slow) speed should give standing accuracy');

section('Recoil');
{
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const r = new RecoilState(V, rnd);
  for (let i = 0; i < 3; i++) { r.kick(false); r.update(V.fireInterval); }
  const burst3 = r.pitch;
  for (let i = 0; i < 12; i++) { r.kick(false); r.update(V.fireInterval); }
  const spray15 = r.pitch;
  ok(spray15 > burst3 * 2.5, 'sustained fire should climb more than a short burst');
  const yawMid = r.yaw;
  ok(yawMid > 0, 'Vértice pattern should drift right mid-spray');
  for (let i = 0; i < 72; i++) r.update(1 / 60);
  ok(r.pitch < spray15 * 0.05 && r.index < 1, `recoil should recover after 1.2s (pitch ${r.pitch.toFixed(4)}, index ${r.index.toFixed(2)})`);
  // Two sprays should be similar but not identical (controlled variation).
  const spray = (s) => { seed = s; const q = new RecoilState(V, rnd); for (let i = 0; i < 20; i++) { q.kick(false); q.update(V.fireInterval); } return [q.pitch, q.yaw]; };
  const s1 = spray(11), s2 = spray(99);
  ok(s1[0] !== s2[0] && Math.abs(s1[0] - s2[0]) / s1[0] < 0.15, 'sprays should vary slightly (<15%)');
  const adsR = new RecoilState(V, rnd); for (let i = 0; i < 10; i++) adsR.kick(true);
  ok(adsR.pitch > 0.5 * spray15 * (10 / 15) * 0.5, 'ADS must keep meaningful recoil');
}

section('Economy');
{
  const e = new Economy();
  ok(e.credits === ECONOMY.startingCredits, 'starting credits');
  const lo = { primary: null, armor: 0 };
  ok(e.buy(findItem('vertice'), lo).ok && e.credits === 800, 'buy rifle 2700');
  lo.primary = 'vertice';
  ok(!e.buy(findItem('vertice'), lo).ok, 'cannot buy same rifle twice');
  ok(e.buy(findItem('armor'), lo).ok && e.credits === 150, 'buy armor 650');
  lo.armor = 100;
  ok(!e.buy(findItem('armor'), { primary: null, armor: 0 }).ok, 'cannot afford armor with 150');
  const l1 = e.endRound(false); const l2 = e.endRound(false);
  ok(l1.reward === 1400 && l2.reward === 1900, `loss bonus ladder 1400 -> 1900 (got ${l1.reward}, ${l2.reward})`);
  for (let i = 0; i < 8; i++) e.endRound(false);
  ok(e.lossReward() === ECONOMY.lossRewardMax, 'loss bonus capped');
  const w = e.endRound(true);
  ok(w.reward === 3000 && e.lossReward() === 1400, 'win resets loss streak');
  e.addKill('vertice');
  ok(e.endRound(true).killCredits === 300, 'kill reward tracked');
  e.resetMatch();
  ok(e.credits === ECONOMY.startingCredits && e.lossStreak === 0, 'new match resets economy');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
