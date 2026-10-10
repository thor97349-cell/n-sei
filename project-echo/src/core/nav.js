// Waypoint navigation graph with Dijkstra pathfinding.
// Edges can be gated by doors (bots open them) or barricades (blocked until destroyed).

export class NavGraph {
  constructor(layout) {
    this.nodes = layout.nodes;
    this.adj = {};
    for (const id in this.nodes) this.adj[id] = [];
    for (const e of layout.edges) {
      const a = this.nodes[e.a], b = this.nodes[e.b];
      if (!a || !b) throw new Error(`Bad nav edge ${e.a}-${e.b}`);
      const len = Math.hypot(a.x - b.x, a.z - b.z);
      this.adj[e.a].push({ to: e.b, len, edge: e });
      this.adj[e.b].push({ to: e.a, len, edge: e });
    }
    this.blocked = (edge) => false; // replaced by game (barricade state)
  }

  path(from, to) {
    if (from === to) return [from];
    const dist = { [from]: 0 };
    const prev = {};
    const open = new Set([from]);
    const done = new Set();
    while (open.size) {
      let cur = null, best = Infinity;
      for (const n of open) if (dist[n] < best) { best = dist[n]; cur = n; }
      open.delete(cur);
      if (cur === to) break;
      done.add(cur);
      for (const { to: nb, len, edge } of this.adj[cur]) {
        if (done.has(nb) || this.blocked(edge)) continue;
        const d = best + len + (edge.door ? 1.5 : 0);
        if (d < (dist[nb] ?? Infinity)) { dist[nb] = d; prev[nb] = { node: cur, edge }; open.add(nb); }
      }
    }
    if (dist[to] === undefined) return null;
    const out = [to];
    let n = to;
    while (n !== from) { n = prev[n].node; out.push(n); }
    return out.reverse();
  }

  edgeBetween(a, b) {
    const link = this.adj[a]?.find((l) => l.to === b);
    return link ? link.edge : null;
  }

  // Nearest node with a clear straight line (via `clear(x0,z0,x1,z1)`).
  nearest(x, z, clear) {
    const sorted = Object.values(this.nodes)
      .map((n) => ({ n, d: (n.x - x) ** 2 + (n.z - z) ** 2 }))
      .sort((p, q) => p.d - q.d);
    for (let i = 0; i < Math.min(8, sorted.length); i++) {
      if (!clear || clear(x, z, sorted[i].n.x, sorted[i].n.z)) return sorted[i].n.id;
    }
    return sorted[0].n.id;
  }
}
