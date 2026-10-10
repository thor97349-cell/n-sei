// Lightweight collision world built from axis-aligned boxes.
// Pure JavaScript (no three.js) so it can be unit-tested in Node.
//
// A collider: { min:{x,y,z}, max:{x,y,z}, surface, kind, active, ref }
//   kind: 'static' | 'door' | 'barricade' | 'glass'
//   active=false removes it from all queries (destroyed barricade).

const EPS = 1e-4;

export class CollisionWorld {
  constructor() {
    this.colliders = [];
    // Uniform grid broad-phase on XZ for static + dynamic boxes.
    this.cell = 8;
    this.grid = new Map();
  }

  add(c) {
    c.active = c.active !== false;
    c.id = this.colliders.length;
    this.colliders.push(c);
    this._insert(c);
    return c;
  }

  _keys(min, max) {
    const s = this.cell;
    const keys = [];
    const x0 = Math.floor(min.x / s), x1 = Math.floor(max.x / s);
    const z0 = Math.floor(min.z / s), z1 = Math.floor(max.z / s);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) keys.push(x * 73856093 ^ z * 19349663);
    return keys;
  }

  _insert(c) {
    c._keys = this._keys(c.min, c.max);
    for (const k of c._keys) {
      let list = this.grid.get(k);
      if (!list) this.grid.set(k, (list = []));
      list.push(c);
    }
  }

  // Re-index a collider after its box moved (doors).
  update(c) {
    for (const k of c._keys) {
      const list = this.grid.get(k);
      const i = list.indexOf(c);
      if (i >= 0) list.splice(i, 1);
    }
    this._insert(c);
  }

  query(min, max, out = []) {
    out.length = 0;
    const stamp = (this._stamp = (this._stamp || 0) + 1);
    for (const k of this._keys(min, max)) {
      const list = this.grid.get(k);
      if (!list) continue;
      for (const c of list) {
        if (!c.active || c._stamp === stamp) continue;
        c._stamp = stamp;
        if (c.max.x > min.x && c.min.x < max.x && c.max.y > min.y && c.min.y < max.y && c.max.z > min.z && c.min.z < max.z) out.push(c);
      }
    }
    return out;
  }

  // Ray vs boxes. Returns nearest hit {t, point, normal, collider} or null.
  // dir must be normalized. `filter(c)` may reject colliders.
  raycast(origin, dir, maxDist, filter) {
    let best = null;
    let bestT = maxDist;
    const stamp = (this._stamp = (this._stamp || 0) + 1);
    // Walk the grid cells the ray passes through (2D DDA on XZ).
    const s = this.cell;
    let cx = Math.floor(origin.x / s), cz = Math.floor(origin.z / s);
    const stepX = dir.x > 0 ? 1 : -1, stepZ = dir.z > 0 ? 1 : -1;
    const tDeltaX = Math.abs(dir.x) > EPS ? Math.abs(s / dir.x) : Infinity;
    const tDeltaZ = Math.abs(dir.z) > EPS ? Math.abs(s / dir.z) : Infinity;
    let tMaxX = Math.abs(dir.x) > EPS ? ((dir.x > 0 ? (cx + 1) * s - origin.x : origin.x - cx * s) / Math.abs(dir.x)) : Infinity;
    let tMaxZ = Math.abs(dir.z) > EPS ? ((dir.z > 0 ? (cz + 1) * s - origin.z : origin.z - cz * s) / Math.abs(dir.z)) : Infinity;
    let tCell = 0;
    for (let guard = 0; guard < 400; guard++) {
      const list = this.grid.get(cx * 73856093 ^ cz * 19349663);
      if (list) {
        for (const c of list) {
          if (!c.active || c._stamp === stamp) continue;
          c._stamp = stamp;
          if (filter && !filter(c)) continue;
          const hit = rayBox(origin, dir, c.min, c.max, bestT);
          if (hit && hit.t < bestT) {
            bestT = hit.t;
            best = { t: hit.t, normal: hit.normal, collider: c };
          }
        }
      }
      // Stop once the next cell starts beyond the best hit.
      tCell = Math.min(tMaxX, tMaxZ);
      if (tCell > bestT || tCell > maxDist) break;
      if (tMaxX < tMaxZ) { cx += stepX; tMaxX += tDeltaX; } else { cz += stepZ; tMaxZ += tDeltaZ; }
    }
    if (best) best.point = { x: origin.x + dir.x * best.t, y: origin.y + dir.y * best.t, z: origin.z + dir.z * best.t };
    return best;
  }

  // Clear line between two points?
  lineClear(a, b, filter) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const d = Math.hypot(dx, dy, dz);
    if (d < EPS) return true;
    return !this.raycast(a, { x: dx / d, y: dy / d, z: dz / d }, d - 0.05, filter);
  }

  // Count distinct solid boxes between two points (for sound occlusion).
  countOccluders(a, b, maxCount = 3) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const d = Math.hypot(dx, dy, dz);
    if (d < EPS) return 0;
    const dir = { x: dx / d, y: dy / d, z: dz / d };
    const seen = new Set();
    let origin = { x: a.x, y: a.y, z: a.z };
    let travelled = 0;
    let count = 0;
    while (count < maxCount) {
      const hit = this.raycast(origin, dir, d - travelled - 0.05, (c) => !seen.has(c) && c.kind !== 'prop');
      if (!hit) break;
      seen.add(hit.collider);
      count += hit.collider.kind === 'glass' ? 0.5 : 1;
      travelled += hit.t + 0.02;
      origin = { x: hit.point.x + dir.x * 0.02, y: hit.point.y + dir.y * 0.02, z: hit.point.z + dir.z * 0.02 };
    }
    return count;
  }

  // Highest walkable surface under a footprint, at or below `maxY`.
  groundHeight(x, z, r, maxY, out) {
    const min = { x: x - r, y: -50, z: z - r }, max = { x: x + r, y: maxY + 0.01, z: z + r };
    let h = -Infinity;
    for (const c of this.query(min, max, out)) if (c.max.y <= maxY + 0.01 && c.max.y > h) h = c.max.y;
    return h;
  }

  // Move an upright box actor (feet position `pos`, radius r, height h) by delta
  // with axis-separated resolution and automatic step-up. Mutates pos & state.
  // state: { vy, grounded }
  move(pos, delta, r, h, stepHeight, state) {
    const tmp = this._tmp || (this._tmp = []);
    const hit = { x: false, z: false, ceiling: false };
    // Horizontal axes.
    for (const axis of ['x', 'z']) {
      const d = delta[axis];
      if (Math.abs(d) < 1e-7) continue;
      pos[axis] += d;
      const min = { x: pos.x - r, y: pos.y + 0.01, z: pos.z - r };
      const max = { x: pos.x + r, y: pos.y + h, z: pos.z + r };
      const hits = this.query(min, max, tmp);
      if (!hits.length) continue;
      // Try a step-up first (only when grounded).
      let stepTo = -Infinity;
      let blocked = false;
      for (const c of hits) {
        if (state.grounded && c.max.y - pos.y <= stepHeight) stepTo = Math.max(stepTo, c.max.y);
        else blocked = true;
      }
      if (!blocked && stepTo > -Infinity) {
        const smin = { x: min.x, y: stepTo + 0.01, z: min.z };
        const smax = { x: max.x, y: stepTo + h, z: max.z };
        if (!this.query(smin, smax, tmp).length) {
          pos.y = stepTo;
          continue;
        }
      }
      // Push back out along this axis.
      const again = this.query(min, max, tmp);
      for (const c of again) {
        if (c.max.y - pos.y <= 0.011) continue;
        if (d > 0) pos[axis] = Math.min(pos[axis], c.min[axis] - r - EPS);
        else pos[axis] = Math.max(pos[axis], c.max[axis] + r + EPS);
      }
      hit[axis] = true;
    }
    // Vertical.
    pos.y += delta.y;
    const min = { x: pos.x - r + 0.02, y: pos.y, z: pos.z - r + 0.02 };
    const max = { x: pos.x + r - 0.02, y: pos.y + h, z: pos.z + r - 0.02 };
    state.grounded = false;
    for (const c of this.query(min, max, tmp)) {
      if (delta.y <= 0 && c.max.y - pos.y <= Math.max(0.6, -delta.y + 0.05)) {
        pos.y = c.max.y;
        state.vy = 0;
        state.grounded = true;
      } else if (delta.y > 0 && c.min.y >= pos.y + h - delta.y - 0.05) {
        pos.y = c.min.y - h - EPS;
        state.vy = Math.min(state.vy, 0);
        hit.ceiling = true;
      }
    }
    // Ground probe so we stay grounded while walking.
    if (!state.grounded && state.vy <= 0) {
      const g = this.groundHeight(pos.x, pos.z, r - 0.02, pos.y + 0.001, tmp);
      if (g > -Infinity && pos.y - g < 0.06) {
        pos.y = g;
        state.grounded = true;
        state.vy = 0;
      }
    }
    return hit;
  }

  // Would an upright box at pos overlap anything?
  overlaps(pos, r, h, filter) {
    const min = { x: pos.x - r, y: pos.y + 0.02, z: pos.z - r };
    const max = { x: pos.x + r, y: pos.y + h, z: pos.z + r };
    const hits = this.query(min, max, []);
    return filter ? hits.some(filter) : hits.length > 0;
  }
}

// Slab test. Returns {t, normal} or null.
export function rayBox(o, d, min, max, maxT = Infinity) {
  let tmin = 0, tmax = maxT;
  let nAxis = -1, nSign = 0;
  for (let i = 0; i < 3; i++) {
    const a = i === 0 ? 'x' : i === 1 ? 'y' : 'z';
    if (Math.abs(d[a]) < 1e-9) {
      if (o[a] < min[a] || o[a] > max[a]) return null;
      continue;
    }
    const inv = 1 / d[a];
    let t1 = (min[a] - o[a]) * inv, t2 = (max[a] - o[a]) * inv;
    let sign = -1;
    if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; sign = 1; }
    if (t1 > tmin) { tmin = t1; nAxis = i; nSign = sign; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  if (nAxis < 0) return { t: 0, normal: { x: -d.x, y: -d.y, z: -d.z } }; // origin inside
  const normal = { x: 0, y: 0, z: 0 };
  normal[nAxis === 0 ? 'x' : nAxis === 1 ? 'y' : 'z'] = nSign;
  return { t: tmin, normal };
}

// Ray vs a set of hitboxes on an actor rotated by `yaw` about its feet position.
// hitboxes: [{zone, min:{x,y,z}, max:{x,y,z}}] in actor-local space (y up, -z forward).
export function rayActor(origin, dir, actorPos, yaw, hitboxes, maxT) {
  const c = Math.cos(-yaw), s = Math.sin(-yaw);
  const ox = origin.x - actorPos.x, oz = origin.z - actorPos.z;
  const lo = { x: ox * c + oz * s, y: origin.y - actorPos.y, z: -ox * s + oz * c };
  const ld = { x: dir.x * c + dir.z * s, y: dir.y, z: -dir.x * s + dir.z * c };
  let best = null;
  for (const hb of hitboxes) {
    const h = rayBox(lo, ld, hb.min, hb.max, maxT);
    if (h && (!best || h.t < best.t)) best = { t: h.t, zone: hb.zone };
  }
  return best;
}

// Standard humanoid hitboxes (local space). Arms sit at the torso sides.
export function humanHitboxes(height) {
  const k = height / 1.75;
  const crouched = height < 1.5;
  const legTop = crouched ? 0.55 : 0.85 * k;
  const torsoTop = height - 0.3;
  return [
    { zone: 'head', min: { x: -0.14, y: torsoTop + 0.02, z: -0.15 }, max: { x: 0.14, y: height, z: 0.13 } },
    { zone: 'torso', min: { x: -0.22, y: legTop, z: -0.14 }, max: { x: 0.22, y: torsoTop, z: 0.14 } },
    { zone: 'arm', min: { x: -0.34, y: legTop + 0.15, z: -0.4 }, max: { x: -0.22, y: torsoTop, z: 0.12 } },
    { zone: 'arm', min: { x: 0.22, y: legTop + 0.15, z: -0.4 }, max: { x: 0.34, y: torsoTop, z: 0.12 } },
    { zone: 'leg', min: { x: -0.2, y: 0, z: -0.12 }, max: { x: 0.2, y: legTop, z: 0.12 } },
  ];
}
