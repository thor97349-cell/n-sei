// FAÍSCA — motor do jogo: simulação, armas, inimigos, chefões e desenho no canvas.
"use strict";
window.F = window.F || {};

(function (F) {
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const DT = 1 / 60;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: false });
  let W = 0, H = 0, DPR = 1, SCALE = 1, VW = 0, VH = 0;

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    SCALE = clamp(Math.min(W, H) / 700, 0.7, 1.3);
    VW = W / SCALE; VH = H / SCALE;
  }
  window.addEventListener("resize", resize);
  resize();

  // ---------- brilhos pré-renderizados (bem mais rápidos que shadowBlur)
  const glowCache = new Map();
  function glow(color) {
    let c = glowCache.get(color);
    if (c) return c;
    c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d");
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, color); gr.addColorStop(0.25, hexA(color, 0.55)); gr.addColorStop(1, hexA(color, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    glowCache.set(color, c);
    return c;
  }
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  // ---------- grade espacial para colisões
  const CELL = 64;
  const cells = new Map();
  const ckey = (cx, cy) => (cx + 32768) * 65536 + (cy + 32768);
  function gridBuild() {
    if (cells.size > 3000) cells.clear();
    for (const a of cells.values()) a.length = 0;
    for (const e of G.enemies) {
      if (e.dead || e.boss) continue;
      const k = ckey(Math.floor(e.x / CELL), Math.floor(e.y / CELL));
      let a = cells.get(k);
      if (!a) { a = []; cells.set(k, a); }
      a.push(e);
    }
  }
  // chama fn(e) para inimigos cujo corpo pode estar a até r de (x,y)
  function forNear(x, y, r, fn) {
    const rr = r + 30;
    const x0 = Math.floor((x - rr) / CELL), x1 = Math.floor((x + rr) / CELL);
    const y0 = Math.floor((y - rr) / CELL), y1 = Math.floor((y + rr) / CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const a = cells.get(ckey(cx, cy));
      if (!a) continue;
      for (let i = 0; i < a.length; i++) { const e = a[i]; if (!e.dead) fn(e); }
    }
    const b = G.boss;
    if (b && !b.dead) {
      const dx = b.x - x, dy = b.y - y, m = r + b.r;
      if (dx * dx + dy * dy < m * m) fn(b);
    }
  }

  // ---------- estado
  let G = null;
  let nextId = 1;
  const keys = new Set();
  const joy = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0, dx: 0, dy: 0 };

  function computeStats() {
    const S = F.save, sh = S.shop, p = G.passives, ch = G.char.mods;
    const lv = (id) => p[id] || 0;
    const st = {
      dmg: 1 + 0.05 * (sh.dano || 0) + 0.1 * lv("potencia") + (ch.dmg || 0),
      cd: (1 - 0.04 * (sh.cadencia || 0)) * Math.pow(0.93, lv("ritmo")),
      area: 1 + 0.1 * lv("alcance") + (ch.area || 0),
      proj: lv("eco"),
      crit: 0.03 + 0.05 * lv("precisao") + (ch.crit || 0),
      speed: 165 * (1 + 0.04 * (sh.veloc || 0) + 0.07 * lv("propulsao") + (ch.speed || 0)),
      magnet: 90 * (1 + 0.15 * (sh.ima || 0) + 0.25 * lv("ima")),
      luck: 1 + 0.08 * (sh.sorte || 0) + 0.1 * lv("sorte") + (ch.luck || 0),
      armor: (sh.armadura || 0) + lv("blindagem"),
      xp: 1 + 0.06 * (sh.xp || 0) + 0.08 * lv("sabedoria"),
      regen: 0.2 * (sh.regen || 0) + 0.3 * lv("regen"),
      maxHp: 100 + 12 * (sh.vida || 0) + 20 * lv("nucleo") + (ch.hp || 0),
      gold: 1 + 0.12 * (sh.ouro || 0),
    };
    const P = G.player;
    if (P.maxHp && st.maxHp > P.maxHp) P.hp += st.maxHp - P.maxHp;
    P.maxHp = st.maxHp; P.hp = Math.min(P.hp, P.maxHp);
    G.st = st;
    for (const w of G.weapons) w.s = wstat(w);
  }
  function wstat(w) {
    const def = F.WEAPONS[w.id], s = {};
    for (let i = 0; i < w.lvl; i++) Object.assign(s, def.lv[i]);
    if (w.evo) Object.assign(s, def.evo);
    return s;
  }
  const xpNeed = (L) => Math.floor(4 + (L - 1) * 5 + Math.pow(L - 1, 2) * 0.75);

  function newRun(charId) {
    const ch = F.CHARACTERS.find((c) => c.id === charId) || F.CHARACTERS[0];
    G = {
      t: 0, mode: "play", char: ch, speedScale: 1, slow: 0,
      player: { x: 0, y: 0, r: 12, hp: 1, maxHp: 0, inv: 0, vx: 0, vy: 0, face: 0, trail: [] },
      weapons: [], passives: {},
      enemies: [], shots: [], bullets: [], gems: [], pickups: [], mines: [], fx: [], parts: [], texts: [],
      level: 1, xp: 0, xpNext: xpNeed(1), kills: 0, gold: 0, combo: 0, comboT: 0, bestCombo: 0, comboMark: 0,
      gemStreak: 0, gemStreakT: 0,
      pendingLevels: 0, pendingChests: [], rerolls: F.save.shop.reroll || 0, revives: F.save.shop.reviver || 0,
      boss: null, bossIdx: 0, bossesKilled: 0, bossWarn: 0, nextElite: 50, hordes: [100, 225, 375, 525], spawnAcc: 0,
      cam: { x: 0, y: 0, shake: 0 }, hurtFlash: 0, dmgBy: {}, evolutions: 0,
      noHitT: 0, bestNoHit: 0, dying: 0, won: false, endless: false, hiddenAch: 0, ended: false,
      dailyBonus: F.meta.dailyBonusActive(),
    };
    G.player.maxHp = 0;
    computeStats();
    G.player.hp = G.st.maxHp;
    addWeapon(ch.weapon);
    F.G = G;
    return G;
  }

  function addWeapon(id) {
    const w = { id, lvl: 1, evo: false, t: 0.3, a: 0, n: 0, orbs: [] };
    w.s = wstat(w);
    G.weapons.push(w);
    G.dmgBy[id] = G.dmgBy[id] || 0;
    return w;
  }

  // ---------- utilidades de jogo
  function addText(x, y, txt, color, size, life) {
    if (G.texts.length > 90) G.texts.shift();
    G.texts.push({ x, y, txt, color, size: size || 14, life: life || 0.7, max: life || 0.7, vy: -40 });
  }
  function burst(x, y, color, n, spd, size, life) {
    for (let i = 0; i < n; i++) {
      if (G.parts.length > 1400) G.parts.shift();
      const a = Math.random() * TAU, v = rand(0.3, 1) * (spd || 160);
      G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.5, 1) * (life || 0.5), max: life || 0.5, size: size || 3, color });
    }
  }
  function shake(v) { if (F.save.settings.shake) G.cam.shake = Math.min(18, G.cam.shake + v); }

  function nearestEnemies(x, y, n, maxD) {
    const best = [];
    const md2 = maxD * maxD;
    for (const e of G.enemies) {
      if (e.dead) continue;
      const dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy;
      if (d > md2) continue;
      if (best.length < n) { best.push([d, e]); best.sort((a, b) => a[0] - b[0]); }
      else if (d < best[best.length - 1][0]) { best[best.length - 1] = [d, e]; best.sort((a, b) => a[0] - b[0]); }
    }
    const out = best.map((b) => b[1]);
    // o chefão sempre entra como alvo prioritário quando está ao alcance
    const B = G.boss;
    if (B && !B.dead && !out.includes(B) && (B.x - x) ** 2 + (B.y - y) ** 2 < md2) { out.unshift(B); if (out.length > n) out.pop(); }
    else if (B && out[0] !== B && out.includes(B)) { out.splice(out.indexOf(B), 1); out.unshift(B); }
    return out;
  }

  function hurtEnemy(e, base, src, kx, ky, critBonus) {
    if (e.dead) return;
    const crit = Math.random() < G.st.crit + (critBonus || 0);
    let dmg = base * G.st.dmg * (crit ? 2 : 1) * rand(0.92, 1.08);
    e.hp -= dmg; e.flash = 0.09;
    G.dmgBy[src] = (G.dmgBy[src] || 0) + dmg;
    if (kx || ky) {
      const k = e.boss ? 0.04 : e.elite ? 0.3 : 1;
      e.kx += kx * k; e.ky += ky * k;
    }
    if (F.save.settings.dmgNums && (crit || G.texts.length < 60)) {
      addText(e.x + rand(-6, 6), e.y - e.r, Math.round(dmg) + (crit ? "!" : ""), crit ? "#ffe14d" : "#ffffff", crit ? 18 : 12, 0.55);
    }
    F.audio.hit();
    if (e.hp <= 0) killEnemy(e);
  }

  function killEnemy(e) {
    e.dead = true;
    G.kills++;
    G.combo++; G.comboT = 1.6;
    if (G.combo > G.bestCombo) G.bestCombo = G.combo;
    F.audio.kill(G.combo);
    burst(e.x, e.y, e.color, e.boss ? 120 : e.elite ? 40 : 9, e.boss ? 420 : 200, e.boss ? 5 : 3, e.boss ? 1.4 : 0.45);
    const luck = G.st.luck;
    if (e.boss) return bossDown(e);
    dropGem(e.x, e.y, e.xp);
    if (e.elite) {
      G.pickups.push({ kind: "chest", x: e.x, y: e.y, r: 14, t: 0, elite: true });
      for (let i = 0; i < 6; i++) G.pickups.push({ kind: "coin", x: e.x + rand(-30, 30), y: e.y + rand(-30, 30), r: 7, v: 3, t: 0 });
      shake(5);
    } else {
      const r = Math.random();
      if (r < 0.022 * luck) G.pickups.push({ kind: "coin", x: e.x, y: e.y, r: 7, v: 1 + ((Math.random() * 2) | 0), t: 0 });
      else if (r < 0.022 * luck + 0.0045) G.pickups.push({ kind: "heart", x: e.x, y: e.y, r: 9, t: 0 });
      else if (r < 0.022 * luck + 0.0045 + 0.0018 * luck) G.pickups.push({ kind: "vortex", x: e.x, y: e.y, r: 10, t: 0 });
      else if (r < 0.022 * luck + 0.0045 + 0.0018 * luck + 0.0012 * luck) G.pickups.push({ kind: "bomb", x: e.x, y: e.y, r: 10, t: 0 });
    }
    if (e.type === "divisor") {
      for (let i = 0; i < 2; i++) spawnEnemy("mini", e.x + rand(-12, 12), e.y + rand(-12, 12));
    }
    // marcos de combo
    const marks = [25, 50, 100, 200, 300, 500, 750, 1000, 1500, 2000];
    if (G.combo >= marks[G.comboMark] ) {
      const m = marks[G.comboMark++];
      F.ui.comboMilestone(m);
      F.audio.combo();
      const bonus = Math.round(m / 25);
      G.gold += bonus;
      addText(G.player.x, G.player.y - 40, `COMBO ${m}! +${bonus} ◆`, "#ffe14d", 20, 1.4);
    }
  }

  function dropGem(x, y, v) {
    if (G.gems.length > 380) {
      // junta os cristais mais antigos num só, para não pesar
      let sum = 0; const old = G.gems.splice(0, 60);
      for (const g of old) sum += g.v;
      G.gems.push({ x: old[0].x, y: old[0].y, v: sum, pull: false, t: 0 });
    }
    G.gems.push({ x: x + rand(-3, 3), y: y + rand(-3, 3), v, pull: false, t: 0 });
  }
  const gemColor = (v) => (v >= 50 ? "#ffd23d" : v >= 10 ? "#ff6bd6" : v >= 3 ? "#5dff9c" : "#4dd2ff");

  // ---------- inimigos
  function hpMul() {
    const m = G.t / 60;
    let k = 1 + m * 0.35 + m * m * 0.115;
    if (m > 10) k *= Math.pow(1.22, m - 10);
    return k;
  }
  function spawnEnemy(type, x, y, elite) {
    const d = F.ENEMIES[type], m = G.t / 60;
    const hm = hpMul();
    const e = {
      id: nextId++, type, x, y, r: d.r, hp: d.hp * hm, spd: d.spd * (1 + Math.min(0.35, m * 0.03)) * rand(0.92, 1.08),
      dmg: d.dmg * (1 + m * 0.13), xp: d.xp, color: d.color, shape: d.shape, kx: 0, ky: 0, flash: 0,
      rot: Math.random() * TAU, st: 0, stT: rand(1, 3), shootT: rand(1.5, 3), orbCd: 0, dead: false, elite: false,
    };
    if (elite) {
      e.elite = true; e.r *= 1.7; e.hp *= 16; e.dmg *= 1.4; e.xp = 25; e.spd *= 0.9;
    }
    e.maxHp = e.hp;
    G.enemies.push(e);
    return e;
  }
  function spawnPoint(extra) {
    const a = Math.random() * TAU;
    const d = Math.hypot(VW, VH) / 2 + 40 + (extra || 0);
    return [G.player.x + Math.cos(a) * d, G.player.y + Math.sin(a) * d];
  }
  function chooseType() {
    const t = G.t, m = t / 60;
    const w = [["ponto", 10]];
    if (t > 40) w.push(["flecha", 4 + m]);
    if (t > 90) w.push(["bloco", 2 + m * 0.5]);
    if (t > 150) w.push(["divisor", 3]);
    if (t > 210) w.push(["olho", 2 + m * 0.3]);
    if (t > 270) w.push(["investida", 2 + m * 0.3]);
    let sum = 0; for (const x of w) sum += x[1];
    let r = Math.random() * sum;
    for (const x of w) { r -= x[1]; if (r <= 0) return x[0]; }
    return "ponto";
  }

  function director(dt) {
    const m = G.t / 60;
    let rate = 1.6 + m * 1.4 + m * m * 0.18;
    if (G.boss) rate *= 0.45;
    if (G.t < 3) rate = 0;
    G.spawnAcc += rate * dt;
    while (G.spawnAcc >= 1) {
      G.spawnAcc--;
      if (G.enemies.length > 480) continue;
      const [x, y] = spawnPoint();
      spawnEnemy(chooseType(), x, y);
    }
    // elite com baú
    if (G.t >= G.nextElite) {
      G.nextElite += 55;
      let ty = chooseType();
      if (ty === "divisor") ty = "bloco";
      const [x, y] = spawnPoint();
      spawnEnemy(ty, x, y, true);
      F.ui.toast("Um inimigo dourado apareceu. Ele carrega um baú!", "gold");
    }
    // hordas que cercam o jogador
    if (G.hordes.length && G.t >= G.hordes[0]) {
      G.hordes.shift();
      const n = Math.round(36 + m * 8), type = m > 4 ? "flecha" : "ponto";
      const d = Math.hypot(VW, VH) / 2 + 30;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        const e = spawnEnemy(type, G.player.x + Math.cos(a) * d, G.player.y + Math.sin(a) * d);
        e.spd *= 0.85;
      }
      F.ui.banner("O ENXAME CERCA VOCÊ", "Abra caminho!");
      F.audio.warn();
    }
    // chefões
    const def = nextBossDef();
    if (def && !G.boss) {
      if (G.t >= def.at - 4 && !G.bossWarn) {
        G.bossWarn = 1;
        F.ui.banner("⚠ " + def.name + " SE APROXIMA", def.final ? "O fim do enxame" : "Chefão");
        F.audio.warn();
      }
      if (G.t >= def.at) spawnBoss(def);
    }
  }
  function nextBossDef() {
    const n = F.BOSSES.length;
    if (G.bossIdx < n) return F.BOSSES[G.bossIdx];
    // modo infinito: chefões repetem a cada 2 minutos, cada vez mais fortes
    const k = G.bossIdx - n, base = F.BOSSES[k % (n - 1)];
    return Object.assign({}, base, { at: 600 + 120 * (k + 1), hp: F.BOSSES[n - 1].hp * Math.pow(1.6, k + 1), final: false, name: base.name + " " + roman(k + 2) });
  }
  const roman = (n) => ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][n] || String(n);

  function spawnBoss(def) {
    const [x, y] = spawnPoint(80);
    const e = {
      id: nextId++, type: "boss", def, boss: true, x, y, r: def.r, hp: def.hp, maxHp: def.hp, spd: def.spd, dmg: def.dmg,
      xp: 100, color: def.color, shape: "poly", sides: def.sides, kx: 0, ky: 0, flash: 0, rot: 0, dead: false,
      pi: 0, pt: 3, st: "move", stT: 0, sub: 0, spin: 0,
    };
    G.enemies.push(e);
    G.boss = e;
    G.bossWarn = 0;
    F.ui.bossBar(def.name, 1);
  }

  function bossDown(e) {
    G.boss = null; G.bossIdx++; G.bossesKilled++;
    F.ui.bossBar(null);
    F.audio.bossDie();
    shake(18); G.slow = 1.2;
    dropGem(e.x, e.y, 100);
    G.pickups.push({ kind: "chest", x: e.x, y: e.y, r: 18, t: 0, boss: true });
    for (let i = 0; i < 20; i++) G.pickups.push({ kind: "coin", x: e.x + rand(-60, 60), y: e.y + rand(-60, 60), r: 7, v: 4, t: 0 });
    G.fx.push({ kind: "ring", x: e.x, y: e.y, r: 400, life: 0.8, max: 0.8, color: e.color });
    if (e.def.final && !G.endless) {
      G.won = true;
      G.victoryAt = G.t + 1.2;
    } else {
      F.ui.banner(e.def.name + " DERROTADO", "Pegue o baú!");
    }
  }

  function enemyShoot(e, ang, spd, r, dmgMul) {
    if (G.bullets.length > 400) return;
    G.bullets.push({ x: e.x, y: e.y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, r: r || 6, dmg: e.dmg * (dmgMul || 0.6), life: 6, color: e.boss ? e.color : "#ffd23d" });
  }

  function updateBoss(e, dt, dx, dy, d) {
    e.rot += dt * 0.6;
    e.pt -= dt;
    const pats = e.def.patterns;
    if (e.st === "move") {
      e.x += (dx / d) * e.spd * dt; e.y += (dy / d) * e.spd * dt;
      if (e.pt <= 0) {
        e.st = pats[e.pi++ % pats.length]; e.stT = 0; e.sub = 0;
      }
      return;
    }
    e.stT += dt;
    const done = () => { e.st = "move"; e.pt = e.def.final ? 1.6 : 2.4; };
    switch (e.st) {
      case "burst": {
        if (e.stT > 0.5 && e.sub < (e.def.final ? 3 : 2)) {
          e.sub++; e.stT = 0;
          const n = e.def.final ? 26 : 18, off = Math.random() * TAU;
          for (let i = 0; i < n; i++) enemyShoot(e, off + (i / n) * TAU, 165, 8);
          F.audio.nova(); shake(3);
        } else if (e.sub >= (e.def.final ? 3 : 2) && e.stT > 0.6) done();
        break;
      }
      case "spiral": {
        e.spin += dt * 3.2;
        e.sub += dt;
        while (e.sub > 0.09) {
          e.sub -= 0.09;
          const arms = e.def.final ? 4 : 3;
          for (let i = 0; i < arms; i++) enemyShoot(e, e.spin + (i / arms) * TAU, 150, 7);
        }
        e.x += (dx / d) * e.spd * 0.3 * dt; e.y += (dy / d) * e.spd * 0.3 * dt;
        if (e.stT > 3.2) done();
        break;
      }
      case "dash": {
        const cycle = e.stT % 1.3;
        if (e.stT > 3.9) { done(); break; }
        if (cycle < 0.6) { e.tx = dx / d; e.ty = dy / d; e.tele = 1; }
        else { e.tele = 0; e.x += e.tx * e.spd * 6.5 * dt; e.y += e.ty * e.spd * 6.5 * dt; if (Math.random() < 0.5) burst(e.x, e.y, e.color, 1, 60, 4, 0.4); }
        break;
      }
      case "blink": {
        if (e.sub === 0 && e.stT > 0.5) {
          e.sub = 1;
          burst(e.x, e.y, e.color, 30, 260, 4, 0.6);
          const a = Math.random() * TAU;
          e.x = G.player.x + Math.cos(a) * 280; e.y = G.player.y + Math.sin(a) * 280;
          burst(e.x, e.y, e.color, 30, 260, 4, 0.6);
          F.audio.zap();
        }
        if (e.sub === 1 && e.stT > 1.1) {
          e.sub = 2;
          for (let i = 0; i < 14; i++) enemyShoot(e, (i / 14) * TAU, 200, 7);
        }
        if (e.stT > 1.6) done();
        break;
      }
      case "summon": {
        const n = e.def.final ? 14 : 8;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU;
          spawnEnemy(G.t > 300 ? "flecha" : "ponto", e.x + Math.cos(a) * (e.r + 20), e.y + Math.sin(a) * (e.r + 20));
        }
        burst(e.x, e.y, e.color, 20, 200, 3, 0.5);
        done();
        break;
      }
      default: done();
    }
  }

  function updateEnemies(dt) {
    const P = G.player;
    const far = Math.max(VW, VH) * 0.75 + 220;
    for (const e of G.enemies) {
      if (e.dead) continue;
      let dx = P.x - e.x, dy = P.y - e.y;
      let d = Math.hypot(dx, dy) || 1;
      if (e.flash > 0) e.flash -= dt;
      if (e.boss) {
        updateBoss(e, dt, dx, dy, d);
      } else {
        if (d > far) {
          // ficou para trás: reaparece à frente do jogador
          const mv = Math.hypot(P.vx, P.vy);
          const base = mv > 10 ? Math.atan2(P.vy, P.vx) : Math.random() * TAU;
          const a = base + rand(-1.2, 1.2), rr = Math.hypot(VW, VH) / 2 + 40;
          e.x = P.x + Math.cos(a) * rr; e.y = P.y + Math.sin(a) * rr;
          continue;
        }
        let sp = e.spd, mx = dx / d, my = dy / d;
        const def = F.ENEMIES[e.type];
        if (def.shooter) {
          if (d < 250) { mx = -mx * 0.6 + my * 0.5; my = -my * 0.6 - (dx / d) * 0.5; }
          e.shootT -= dt;
          if (e.shootT <= 0 && d < 520) { e.shootT = rand(2.4, 3.2); enemyShoot(e, Math.atan2(dy, dx), 185, 6); }
        } else if (def.dasher) {
          e.stT -= dt;
          if (e.st === 0 && e.stT <= 0 && d < 420) { e.st = 1; e.stT = 0.55; e.tx = mx; e.ty = my; }
          else if (e.st === 1) { sp = 0; if (e.stT <= 0) { e.st = 2; e.stT = 0.45; } }
          else if (e.st === 2) { sp = e.spd * 7; mx = e.tx; my = e.ty; if (e.stT <= 0) { e.st = 0; e.stT = rand(2, 3.5); } }
        }
        e.x += mx * sp * dt + e.kx * dt; e.y += my * sp * dt + e.ky * dt;
        e.rot += dt * (e.type === "flecha" ? 0 : 1.5);
        if (e.type === "flecha" || e.type === "investida") e.rot = Math.atan2(my, mx);
      }
      e.kx *= 0.88; e.ky *= 0.88;
      // contato com o jogador
      dx = P.x - e.x; dy = P.y - e.y;
      const rr = e.r + P.r - 3;
      if (dx * dx + dy * dy < rr * rr) hurtPlayer(e.dmg);
    }
    // separação leve entre inimigos vizinhos
    for (const a of cells.values()) {
      for (let i = 0; i < a.length; i++) {
        const e = a[i];
        for (let j = i + 1; j < a.length && j < i + 6; j++) {
          const o = a[j];
          const dx = e.x - o.x, dy = e.y - o.y, m = e.r + o.r;
          const d2 = dx * dx + dy * dy;
          if (d2 < m * m && d2 > 0.01) {
            const d = Math.sqrt(d2), push = (m - d) * 0.25;
            const nx = dx / d, ny = dy / d;
            e.x += nx * push; e.y += ny * push; o.x -= nx * push; o.y -= ny * push;
          }
        }
      }
    }
  }

  function hurtPlayer(raw) {
    const P = G.player;
    if (P.inv > 0 || G.dying) return;
    const dmg = Math.max(1, Math.round(raw - G.st.armor));
    P.hp -= dmg; P.inv = 0.6;
    G.noHitT = 0;
    // levar dano quebra o combo
    if (G.combo >= 20) addText(P.x, P.y - 44, "COMBO PERDIDO", "#ff4d6d", 16, 1.1);
    G.combo = 0; G.comboMark = 0; G.comboT = 0;
    G.hurtFlash = 0.35; shake(7);
    F.audio.hurt();
    addText(P.x, P.y - 20, "-" + dmg, "#ff4d6d", 18, 0.8);
    burst(P.x, P.y, "#ff4d6d", 12, 220, 3, 0.4);
    if (P.hp <= 0) {
      if (G.revives > 0) {
        G.revives--;
        P.hp = Math.round(P.maxHp * 0.5); P.inv = 2.5;
        clearScreen(true);
        F.ui.banner("FÊNIX", "Você renasceu!");
        F.audio.levelUp();
      } else {
        P.hp = 0; G.dying = 1.6; G.slow = 1.6;
        burst(P.x, P.y, G.char.color, 90, 380, 4, 1.4);
        shake(16);
        F.audio.bomb();
      }
    }
  }

  // apaga (ou fere, no caso do chefão) tudo que está na tela
  function clearScreen(fromRevive) {
    const P = G.player;
    for (const e of G.enemies) {
      if (e.dead) continue;
      if (Math.abs(e.x - P.x) > VW / 2 + 40 || Math.abs(e.y - P.y) > VH / 2 + 40) continue;
      if (e.boss) hurtEnemy(e, e.maxHp * 0.06 / G.st.dmg, "bomba");
      else killEnemy(e);
    }
    G.bullets.length = 0;
    G.fx.push({ kind: "ring", x: P.x, y: P.y, r: Math.max(VW, VH), life: 0.6, max: 0.6, color: fromRevive ? "#ff9f43" : "#ffffff" });
    shake(14); F.audio.bomb();
  }

  // ---------- armas
  function fireShot(w, x, y, ang, s, color) {
    const sp = s.speed || 560;
    G.shots.push({ kind: "bullet", x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: 5 * Math.sqrt(G.st.area), dmg: s.dmg, pierce: s.pierce || 1, life: 1.2, src: w.id, color, hits: [] });
  }

  const WEAPON_UPDATE = {
    pulso(w, s, dt) {
      w.t -= dt; if (w.t > 0) return;
      const P = G.player, n = s.count + G.st.proj;
      const tg = nearestEnemies(P.x, P.y, n, 640);
      if (!tg.length) { w.t = 0.1; return; }
      w.t = s.cd * G.st.cd;
      const color = w.evo ? "#ffffff" : F.WEAPONS.pulso.color;
      for (let i = 0; i < n; i++) {
        const e = tg[i % tg.length];
        let a = Math.atan2(e.y - P.y, e.x - P.x);
        if (i >= tg.length) a += (Math.ceil((i - tg.length + 1) / 2)) * 0.16 * (i % 2 ? 1 : -1);
        fireShot(w, P.x, P.y, a, s, color);
      }
      if (s.ring) {
        w.n++;
        if (w.n % 2 === 0) for (let i = 0; i < s.ring; i++) fireShot(w, P.x, P.y, (i / s.ring) * TAU + w.n * 0.2, s, "#7df9ff");
      }
      F.audio.shoot();
    },
    orbita(w, s, dt) {
      const P = G.player, A = G.st.area;
      w.a += s.spin * dt;
      w.orbs.length = 0;
      const rings = [[s.count + G.st.proj, s.radius * A, w.a]];
      if (s.inner) rings.push([s.inner, s.radius * A * 0.55, -w.a * 1.3]);
      const size = s.size * Math.sqrt(A);
      for (const [n, R, base] of rings) {
        for (let i = 0; i < n; i++) {
          const ang = base + (i / n) * TAU;
          const ox = P.x + Math.cos(ang) * R, oy = P.y + Math.sin(ang) * R;
          w.orbs.push(ox, oy, size);
          forNear(ox, oy, size, (e) => {
            if (e.orbCd > G.t) return;
            const dx = e.x - ox, dy = e.y - oy, m = e.r + size;
            if (dx * dx + dy * dy > m * m) return;
            e.orbCd = G.t + 0.35;
            const d = Math.hypot(e.x - P.x, e.y - P.y) || 1;
            hurtEnemy(e, s.dmg, "orbita", ((e.x - P.x) / d) * 160, ((e.y - P.y) / d) * 160);
          });
        }
      }
    },
    raio(w, s, dt) {
      w.t -= dt; if (w.t > 0) return;
      const P = G.player;
      const pool = nearestEnemies(P.x, P.y, 14, 430);
      if (!pool.length) { w.t = 0.15; return; }
      w.t = s.cd * G.st.cd;
      const hit = new Set();
      const strikes = s.strikes + G.st.proj;
      const range = s.range * G.st.area;
      for (let k = 0; k < strikes; k++) {
        let cur = pool.find((e) => !hit.has(e) && !e.dead) || null;
        if (k > 0) { const free = pool.filter((e) => !hit.has(e) && !e.dead); cur = free.length ? pick(free) : null; }
        if (!cur) break;
        const pts = [P.x, P.y - 4];
        for (let c = 0; c <= s.chains && cur; c++) {
          hit.add(cur);
          pts.push(cur.x, cur.y);
          const from = cur;
          hurtEnemy(cur, s.dmg, "raio", 0, 0, s.crit || 0);
          let best = null, bd = range * range;
          forNear(from.x, from.y, range, (e) => {
            if (hit.has(e)) return;
            const dx = e.x - from.x, dy = e.y - from.y, d2 = dx * dx + dy * dy;
            if (d2 < bd) { bd = d2; best = e; }
          });
          cur = best;
        }
        G.fx.push({ kind: "bolt", pts, life: 0.2, max: 0.2, color: w.evo ? "#ffffff" : "#ffe14d" });
      }
      F.audio.zap();
    },
    nova(w, s, dt) {
      w.t -= dt; if (w.t > 0) return;
      w.t = s.cd * G.st.cd;
      const P = G.player, R = s.radius * G.st.area;
      let healed = 0;
      forNear(P.x, P.y, R, (e) => {
        const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy) || 1;
        if (d > R + e.r) return;
        if (s.heal && healed < 8) { healed += s.heal; }
        hurtEnemy(e, s.dmg, "nova", (dx / d) * s.push, (dy / d) * s.push);
      });
      if (healed > 0) { P.hp = Math.min(P.maxHp, P.hp + healed); }
      G.fx.push({ kind: "ring", x: P.x, y: P.y, r: R, life: 0.4, max: 0.4, color: w.evo ? "#ffd27d" : "#ff9f43" });
      F.audio.nova();
    },
    enxame(w, s, dt) {
      w.t -= dt; if (w.t > 0) return;
      const P = G.player;
      const tg = nearestEnemies(P.x, P.y, 10, 620);
      if (!tg.length) { w.t = 0.2; return; }
      w.t = s.cd * G.st.cd;
      const n = s.count + G.st.proj;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.35 + rand(-0.2, 0.2);
        G.shots.push({ kind: "missile", x: P.x, y: P.y, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, r: 5, dmg: s.dmg, blast: s.blast * G.st.area, life: 3, src: "enxame", color: w.evo ? "#b4ffd0" : "#5dff9c", target: tg[i % tg.length], hits: [] });
      }
    },
    feixe(w, s, dt) {
      w.t -= dt; if (w.t > 0) return;
      const P = G.player;
      const len = s.len * (0.6 + 0.4 * G.st.area), width = s.width * G.st.area;
      let base;
      if (s.star) { w.a += 0.55; base = w.a; }
      else {
        const tg = nearestEnemies(P.x, P.y, 1, len);
        if (!tg.length) { w.t = 0.15; return; }
        base = Math.atan2(tg[0].y - P.y, tg[0].x - P.x);
      }
      w.t = s.cd * G.st.cd;
      const n = s.beams + G.st.proj;
      for (let i = 0; i < n; i++) {
        const a = base + (i / n) * TAU;
        const cx = Math.cos(a), cy = Math.sin(a);
        const x2 = P.x + cx * len, y2 = P.y + cy * len;
        for (const e of G.enemies) {
          if (e.dead) continue;
          const ex = e.x - P.x, ey = e.y - P.y;
          const along = ex * cx + ey * cy;
          if (along < -e.r || along > len + e.r) continue;
          const perp = Math.abs(ex * cy - ey * cx);
          if (perp < width / 2 + e.r) hurtEnemy(e, s.dmg, "feixe", cx * 60, cy * 60);
        }
        G.fx.push({ kind: "beam", x1: P.x, y1: P.y, x2, y2, w: width, life: 0.22, max: 0.22, color: w.evo ? "#ffd1f3" : "#ff6bd6" });
      }
      F.audio.laser();
    },
    rastro(w, s, dt) {
      w.t -= dt; if (w.t > 0) return;
      w.t = s.cd * G.st.cd;
      const P = G.player, n = s.count + G.st.proj;
      for (let i = 0; i < n; i++) {
        if (G.mines.length > 70) G.mines.shift();
        G.mines.push({ x: P.x + rand(-22, 22) * (n > 1 ? 1 : 0.3), y: P.y + rand(-22, 22) * (n > 1 ? 1 : 0.3), arm: 0.35, life: s.life, dmg: s.dmg, blast: s.blast * G.st.area, color: w.evo ? "#ffb347" : "#ff5252" });
      }
    },
  };

  function explode(x, y, R, dmg, src, color) {
    forNear(x, y, R, (e) => {
      const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy) || 1;
      if (d < R + e.r) hurtEnemy(e, dmg, src, (dx / d) * 120, (dy / d) * 120);
    });
    G.fx.push({ kind: "ring", x, y, r: R, life: 0.3, max: 0.3, color, fill: true });
    burst(x, y, color, 10, 220, 3, 0.4);
    F.audio.boom();
  }

  function updateShots(dt) {
    for (const s of G.shots) {
      if (s.dead) continue;
      s.life -= dt;
      if (s.kind === "missile") {
        if (!s.target || s.target.dead) {
          const t = nearestEnemies(s.x, s.y, 1, 500);
          s.target = t[0] || null;
        }
        const sp = Math.min(560, Math.hypot(s.vx, s.vy) + 900 * dt);
        let a = Math.atan2(s.vy, s.vx);
        if (s.target) {
          const want = Math.atan2(s.target.y - s.y, s.target.x - s.x);
          let da = want - a; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
          a += clamp(da, -7 * dt, 7 * dt);
        }
        s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp;
        if (Math.random() < 0.6) G.parts.push({ x: s.x, y: s.y, vx: -s.vx * 0.1, vy: -s.vy * 0.1, life: 0.3, max: 0.3, size: 2, color: s.color });
      }
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.life <= 0) {
        if (s.kind === "missile") explode(s.x, s.y, s.blast, s.dmg, s.src, s.color);
        s.dead = true; continue;
      }
      forNear(s.x, s.y, s.r, (e) => {
        if (s.dead || e.dead) return;
        const dx = e.x - s.x, dy = e.y - s.y, m = e.r + s.r;
        if (dx * dx + dy * dy > m * m) return;
        if (s.kind === "missile") { s.dead = true; explode(s.x, s.y, s.blast, s.dmg, s.src, s.color); return; }
        if (s.hits.includes(e.id)) return;
        s.hits.push(e.id);
        const sp = Math.hypot(s.vx, s.vy) || 1;
        hurtEnemy(e, s.dmg, s.src, (s.vx / sp) * 90, (s.vy / sp) * 90);
        if (--s.pierce <= 0) s.dead = true;
      });
    }
    // minas
    for (const m of G.mines) {
      if (m.dead) continue;
      m.arm -= dt; m.life -= dt;
      if (m.life <= 0) { m.dead = true; continue; }
      if (m.arm > 0) continue;
      let boom = false;
      forNear(m.x, m.y, 12, (e) => {
        if (boom) return;
        const dx = e.x - m.x, dy = e.y - m.y, r = e.r + 12;
        if (dx * dx + dy * dy < r * r) boom = true;
      });
      if (boom) { m.dead = true; explode(m.x, m.y, m.blast, m.dmg, "rastro", m.color); }
    }
    // projéteis inimigos
    const P = G.player;
    for (const b of G.bullets) {
      if (b.dead) continue;
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0) { b.dead = true; continue; }
      const dx = b.x - P.x, dy = b.y - P.y, m = b.r + P.r - 4;
      if (dx * dx + dy * dy < m * m) { b.dead = true; hurtPlayer(b.dmg); }
    }
  }

  // ---------- coleta
  function updatePickups(dt) {
    const P = G.player, mag = G.st.magnet;
    G.gemStreakT -= dt; if (G.gemStreakT <= 0) G.gemStreak = 0;
    for (const g of G.gems) {
      if (g.dead) continue;
      g.t += dt;
      const dx = P.x - g.x, dy = P.y - g.y, d = Math.hypot(dx, dy) || 1;
      if (!g.pull && d < mag) g.pull = true;
      if (g.pull) {
        g.sp = Math.min(900, (g.sp || 120) + 1400 * dt);
        g.x += (dx / d) * g.sp * dt; g.y += (dy / d) * g.sp * dt;
      }
      if (d < P.r + 8) {
        g.dead = true;
        const comboMul = 1 + Math.min(G.combo, 500) / 1000;
        gainXp(g.v * G.st.xp * comboMul);
        G.gemStreak++; G.gemStreakT = 0.4;
        F.audio.gem(G.gemStreak);
      }
    }
    for (const p of G.pickups) {
      if (p.dead) continue;
      p.t += dt;
      const dx = P.x - p.x, dy = P.y - p.y, d = Math.hypot(dx, dy) || 1;
      const reach = p.kind === "coin" ? mag : 40;
      if (d < reach || p.pull) {
        p.pull = true;
        p.sp = Math.min(700, (p.sp || 100) + 1200 * dt);
        p.x += (dx / d) * p.sp * dt; p.y += (dy / d) * p.sp * dt;
      }
      if (d < P.r + p.r) { p.dead = true; collect(p); }
    }
  }
  function collect(p) {
    const P = G.player;
    switch (p.kind) {
      case "coin": { const v = p.v || 1; G.gold += v; F.audio.coin(); addText(P.x, P.y - 22, "+" + v + " ◆", "#ffd23d", 12, 0.6); break; }
      case "heart": P.hp = Math.min(P.maxHp, P.hp + 30); F.audio.heal(); addText(P.x, P.y - 22, "+30 ♥", "#7dff7d", 16, 0.9); burst(P.x, P.y, "#7dff7d", 14, 140, 3, 0.5); break;
      case "vortex": for (const g of G.gems) g.pull = true; F.audio.rare(); F.ui.toast("Vórtice! Todos os cristais vêm até você", "cyan"); break;
      case "bomb": clearScreen(false); F.ui.toast("Bomba! Tela limpa", "red"); break;
      case "chest": G.pendingChests.push(p.boss ? "boss" : "elite"); F.audio.chest(); break;
    }
  }
  function gainXp(v) {
    G.xp += v;
    while (G.xp >= G.xpNext) {
      G.xp -= G.xpNext; G.level++; G.xpNext = xpNeed(G.level); G.pendingLevels++;
    }
  }

  // ---------- escolhas de melhoria
  function evoReady() {
    return G.weapons.filter((w) => !w.evo && w.lvl >= 5 && G.passives[F.WEAPONS[w.id].evo.needs]);
  }
  function makeChoices(n) {
    const pool = [];
    const luck = G.st.luck;
    for (const w of G.weapons) if (!w.evo && w.lvl < 5) pool.push({ kind: "w", id: w.id, lvl: w.lvl, wgt: 1.25 });
    if (G.weapons.length < 6) for (const id in F.WEAPONS) if (!G.weapons.some((w) => w.id === id)) pool.push({ kind: "w", id, lvl: 0, wgt: G.weapons.length < 3 ? 1.1 : 0.8 });
    const pcount = Object.keys(G.passives).length;
    for (const id in F.PASSIVES) {
      const lv = G.passives[id] || 0;
      if (lv >= F.PASSIVES[id].max) continue;
      if (!lv && pcount >= 6) continue;
      // passivas que evoluem uma arma que você tem ficam um pouco mais frequentes
      const helps = G.weapons.some((w) => F.WEAPONS[w.id].evo.needs === id && !w.evo);
      pool.push({ kind: "p", id, lvl: lv, wgt: (lv ? 1.1 : 0.85) * (helps && !lv ? 1.6 : 1) });
    }
    const evos = evoReady();
    const out = [];
    if (evos.length && Math.random() < 0.6) out.push({ kind: "evo", id: evos[0].id });
    while (out.length < n && pool.length) {
      let sum = 0; for (const c of pool) sum += c.wgt;
      let r = Math.random() * sum, idx = 0;
      for (; idx < pool.length; idx++) { r -= pool[idx].wgt; if (r <= 0) break; }
      const c = pool.splice(Math.min(idx, pool.length - 1), 1)[0];
      const max = c.kind === "w" ? 5 : F.PASSIVES[c.id].max;
      c.add = 1;
      if (Math.random() < 0.09 * luck && c.lvl + 2 <= max) c.add = 2;
      out.push(c);
    }
    if (out.length < n) out.push({ kind: "heal" });
    if (out.length < n) out.push({ kind: "gold" });
    return out;
  }
  function applyChoice(c) {
    const P = G.player;
    if (c.kind === "w") {
      let w = G.weapons.find((x) => x.id === c.id);
      if (!w) { w = addWeapon(c.id); w.lvl = c.add; }
      else w.lvl = Math.min(5, w.lvl + c.add);
    } else if (c.kind === "p") {
      G.passives[c.id] = Math.min(F.PASSIVES[c.id].max, (G.passives[c.id] || 0) + c.add);
      if (c.id === "nucleo") P.hp += 20 * c.add;
    } else if (c.kind === "evo") {
      const w = G.weapons.find((x) => x.id === c.id);
      if (w) { w.evo = true; G.evolutions++; F.ui.banner("EVOLUÇÃO!", F.WEAPONS[c.id].evo.name); burst(P.x, P.y, "#ffffff", 60, 320, 4, 1); shake(8); }
    } else if (c.kind === "heal") {
      P.hp = P.maxHp;
    } else if (c.kind === "gold") {
      G.gold += 25;
    }
    computeStats();
  }
  // itens do baú: evolução primeiro, depois +1 nível em coisas que você já tem
  function chestItems(kind) {
    const luck = G.st.luck;
    let n = 1;
    if (kind === "boss") n = Math.random() < 0.25 * luck ? 5 : 3;
    else if (Math.random() < 0.02 * luck) n = 5;
    else if (Math.random() < 0.1 * luck) n = 3;
    const items = [];
    const evoUsed = new Set();
    for (let i = 0; i < n; i++) {
      const ev = evoReady().find((w) => !evoUsed.has(w.id));
      if (ev) { evoUsed.add(ev.id); items.push({ kind: "evo", id: ev.id }); applyChoice({ kind: "evo", id: ev.id }); continue; }
      const opts = [];
      for (const w of G.weapons) if (!w.evo && w.lvl < 5) opts.push({ kind: "w", id: w.id, lvl: w.lvl, add: 1 });
      for (const id in G.passives) if (G.passives[id] < F.PASSIVES[id].max) opts.push({ kind: "p", id, lvl: G.passives[id], add: 1 });
      if (!opts.length) { items.push({ kind: "gold", v: 30 }); G.gold += 30; continue; }
      const c = pick(opts);
      items.push(c); applyChoice(c);
    }
    const bonus = Math.round((kind === "boss" ? 40 : 10) * rand(0.8, 1.4) * luck);
    G.gold += bonus;
    return { items, bonus };
  }

  // ---------- passo de simulação
  function step(dt) {
    if (G.slow > 0) { G.slow -= dt; dt *= 0.3; }
    const P = G.player;
    if (G.dying > 0) {
      G.dying -= DT;
      updateParticles(dt);
      if (G.dying <= 0) endRun(false);
      return;
    }
    G.t += dt;
    // "Intocável" só conta depois dos 2 primeiros minutos, quando o enxame já apertou
    if (G.t > 120) { G.noHitT += dt; if (G.noHitT > G.bestNoHit) G.bestNoHit = G.noHitT; }
    // movimento
    let mx = 0, my = 0;
    if (G.bot) { [mx, my] = botInput(); }
    else {
      if (keys.has("arrowleft") || keys.has("a")) mx -= 1;
      if (keys.has("arrowright") || keys.has("d")) mx += 1;
      if (keys.has("arrowup") || keys.has("w")) my -= 1;
      if (keys.has("arrowdown") || keys.has("s")) my += 1;
      if (joy.active) { mx += joy.dx; my += joy.dy; }
    }
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    P.vx = mx * G.st.speed; P.vy = my * G.st.speed;
    P.x += P.vx * dt; P.y += P.vy * dt;
    if (ml > 0.1) P.face = Math.atan2(my, mx);
    if (P.inv > 0) P.inv -= dt;
    if (G.st.regen > 0) P.hp = Math.min(P.maxHp, P.hp + G.st.regen * dt);
    if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) { G.combo = 0; G.comboMark = 0; } }
    if (G.hurtFlash > 0) G.hurtFlash -= dt;

    gridBuild();
    director(dt);
    for (const w of G.weapons) WEAPON_UPDATE[w.id](w, w.s, dt);
    updateShots(dt);
    updateEnemies(dt);
    updatePickups(dt);
    updateParticles(dt);
    for (const f of G.fx) f.life -= dt;

    // limpeza
    if (G.enemies.some((e) => e.dead)) G.enemies = G.enemies.filter((e) => !e.dead);
    G.shots = G.shots.filter((s) => !s.dead);
    G.bullets = G.bullets.filter((b) => !b.dead);
    G.gems = G.gems.filter((g) => !g.dead);
    G.pickups = G.pickups.filter((p) => !p.dead);
    G.mines = G.mines.filter((m) => !m.dead);
    G.fx = G.fx.filter((f) => f.life > 0);

    if (G.boss) F.ui.bossBar(G.boss.def.name, G.boss.hp / G.boss.maxHp);
    P.trail.push(P.x, P.y);
    if (P.trail.length > 20) P.trail.splice(0, 2);
  }
  function updateParticles(dt) {
    for (const p of G.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.93; p.vy *= 0.93; }
    G.parts = G.parts.filter((p) => p.life > 0);
    for (const t of G.texts) { t.life -= dt; t.y += t.vy * dt; t.vy *= 0.92; }
    G.texts = G.texts.filter((t) => t.life > 0);
    if (G.cam.shake > 0) G.cam.shake = Math.max(0, G.cam.shake - dt * 30);
  }

  // Piloto automático (usado nos testes de balanceamento e na tela de título)
  function botInput() {
    const P = G.player;
    let ax = 0, ay = 0;
    for (const e of G.enemies) {
      const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1;
      const R = e.boss ? 300 : 150;
      if (d < R) { const w = Math.pow((e.boss ? 120 : 50) / d, 2); ax += (dx / d) * w; ay += (dy / d) * w; }
    }
    for (const b of G.bullets) {
      const dx = P.x - b.x, dy = P.y - b.y, d = Math.hypot(dx, dy) || 1;
      if (d < 110) { const w = Math.pow(45 / d, 2); ax += (dx / d) * w; ay += (dy / d) * w; }
    }
    let best = null, bd = 700 * 700;
    for (const g of G.pickups) { const d = (g.x - P.x) ** 2 + (g.y - P.y) ** 2; if (d < bd) { bd = d; best = g; } }
    if (!best) for (const g of G.gems) { const d = (g.x - P.x) ** 2 + (g.y - P.y) ** 2; if (d < bd) { bd = d; best = g; } }
    if (best) { const d = Math.sqrt(bd) || 1; ax += ((best.x - P.x) / d) * 0.7; ay += ((best.y - P.y) / d) * 0.7; }
    else { ax += -P.y * 0.001; ay += P.x * 0.001; }
    return [ax * 3, ay * 3];
  }

  // ---------- desenho
  const stars = Array.from({ length: 140 }, () => [Math.random() * 1600, Math.random() * 1600, Math.random() * 1.6 + 0.3, Math.random()]);

  function shapePath(shape, r, sides) {
    ctx.beginPath();
    switch (shape) {
      case "circle": ctx.arc(0, 0, r, 0, TAU); break;
      case "tri": ctx.moveTo(r * 1.2, 0); ctx.lineTo(-r * 0.8, r * 0.85); ctx.lineTo(-r * 0.8, -r * 0.85); ctx.closePath(); break;
      case "square": ctx.rect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7); break;
      case "diamond": ctx.moveTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.lineTo(0, -r); ctx.closePath(); break;
      case "arrow": ctx.moveTo(r * 1.3, 0); ctx.lineTo(-r * 0.7, r); ctx.lineTo(-r * 0.2, 0); ctx.lineTo(-r * 0.7, -r); ctx.closePath(); break;
      default: {
        const n = shape === "hex" ? 6 : sides || 6;
        for (let i = 0; i < n; i++) { const a = (i / n) * TAU; ctx[i ? "lineTo" : "moveTo"](Math.cos(a) * r, Math.sin(a) * r); }
        ctx.closePath();
      }
    }
  }

  function render() {
    const now = performance.now() / 1000;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#05060e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!G) return;
    const P = G.player, cam = G.cam;
    cam.x += (P.x - cam.x) * 0.15; cam.y += (P.y - cam.y) * 0.15;
    const sx = cam.shake ? rand(-cam.shake, cam.shake) : 0, sy = cam.shake ? rand(-cam.shake, cam.shake) : 0;
    const k = DPR * SCALE;
    const ox = VW / 2 - cam.x + sx, oy = VH / 2 - cam.y + sy;
    const left = cam.x - VW / 2 - 60, right = cam.x + VW / 2 + 60, top = cam.y - VH / 2 - 60, bot = cam.y + VH / 2 + 60;
    const vis = (x, y) => x > left && x < right && y > top && y < bot;

    // estrelas com paralaxe
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.fillStyle = "#9fb4ff";
    for (const s of stars) {
      const px = (((s[0] - cam.x * 0.35) % 1600) + 1600) % 1600, py = (((s[1] - cam.y * 0.35) % 1600) + 1600) % 1600;
      for (let tx = px; tx < VW; tx += 1600) for (let ty = py; ty < VH; ty += 1600) {
        ctx.globalAlpha = 0.25 + 0.35 * Math.sin(now * 2 + s[3] * 10) ** 2;
        ctx.fillRect(tx, ty, s[2], s[2]);
      }
    }
    ctx.globalAlpha = 1;

    // grade do mundo
    ctx.setTransform(k, 0, 0, k, ox * k, oy * k);
    const intensity = Math.min(1, G.t / 600);
    ctx.strokeStyle = `rgba(${90 + intensity * 120},${110 - intensity * 60},${230 - intensity * 80},0.09)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const gs = 80;
    for (let x = Math.floor(left / gs) * gs; x < right; x += gs) { ctx.moveTo(x, top); ctx.lineTo(x, bot); }
    for (let y = Math.floor(top / gs) * gs; y < bot; y += gs) { ctx.moveTo(left, y); ctx.lineTo(right, y); }
    ctx.stroke();

    // minas
    for (const m of G.mines) {
      if (!vis(m.x, m.y)) continue;
      const blink = m.arm > 0 ? 0.4 : 0.6 + 0.4 * Math.sin(now * 12 + m.x);
      ctx.globalAlpha = blink;
      ctx.drawImage(glow(m.color), m.x - 14, m.y - 14, 28, 28);
      ctx.fillStyle = m.color; ctx.fillRect(m.x - 3, m.y - 3, 6, 6);
    }
    ctx.globalAlpha = 1;

    // cristais e itens
    ctx.globalCompositeOperation = "lighter";
    for (const g of G.gems) {
      if (!vis(g.x, g.y)) continue;
      const c = gemColor(g.v), s = g.v >= 50 ? 9 : g.v >= 10 ? 7 : g.v >= 3 ? 5.5 : 4.5;
      ctx.drawImage(glow(c), g.x - s * 2.5, g.y - s * 2.5, s * 5, s * 5);
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.moveTo(g.x, g.y - s); ctx.lineTo(g.x + s * 0.7, g.y); ctx.lineTo(g.x, g.y + s); ctx.lineTo(g.x - s * 0.7, g.y); ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    for (const p of G.pickups) {
      if (!vis(p.x, p.y)) continue;
      const bob = Math.sin(now * 4 + p.x) * 3;
      drawPickup(p, p.x, p.y + bob, now);
    }

    // inimigos
    for (const e of G.enemies) {
      if (e.dead || !vis(e.x, e.y)) continue;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = e.boss ? 0.9 : 0.5;
      const gr = e.r * (e.boss ? 3.2 : 2.6);
      ctx.drawImage(glow(e.elite ? "#ffd23d" : e.color), e.x - gr, e.y - gr, gr * 2, gr * 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.save();
      ctx.translate(e.x, e.y); ctx.rotate(e.rot);
      shapePath(e.shape, e.r, e.sides);
      ctx.fillStyle = e.flash > 0 ? "#ffffff" : "#0b0c18";
      ctx.fill();
      ctx.lineWidth = e.boss ? 4 : e.elite ? 3 : 2;
      ctx.strokeStyle = e.flash > 0 ? "#ffffff" : e.elite ? "#ffd23d" : e.color;
      ctx.stroke();
      if (e.boss) {
        ctx.rotate(-e.rot * 2.5);
        shapePath("poly", e.r * 0.55, e.sides);
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(0, 0, e.r * 0.18, 0, TAU); ctx.fill();
      } else {
        ctx.fillStyle = e.elite ? "#ffd23d" : e.color;
        ctx.beginPath(); ctx.arc(e.shape === "tri" || e.shape === "arrow" ? e.r * 0.25 : 0, 0, e.r * 0.25, 0, TAU); ctx.fill();
      }
      ctx.restore();
      // aviso de investida
      if ((e.st === 1 && F.ENEMIES[e.type] && F.ENEMIES[e.type].dasher) || e.tele) {
        ctx.strokeStyle = hexA("#ff2e2e", 0.35 + 0.3 * Math.sin(now * 30));
        ctx.lineWidth = e.boss ? 10 : 3;
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + e.tx * (e.boss ? 520 : 230), e.y + e.ty * (e.boss ? 520 : 230)); ctx.stroke();
      }
      if (e.elite && e.hp < e.maxHp) {
        ctx.fillStyle = "#000a"; ctx.fillRect(e.x - 20, e.y - e.r - 12, 40, 4);
        ctx.fillStyle = "#ffd23d"; ctx.fillRect(e.x - 20, e.y - e.r - 12, 40 * Math.max(0, e.hp / e.maxHp), 4);
      }
    }

    // armas e efeitos (aditivo)
    ctx.globalCompositeOperation = "lighter";
    for (const w of G.weapons) {
      if (w.id !== "orbita") continue;
      const col = w.evo ? "#ffd27d" : F.WEAPONS.orbita.color;
      for (let i = 0; i < w.orbs.length; i += 3) {
        const x = w.orbs[i], y = w.orbs[i + 1], s = w.orbs[i + 2];
        ctx.drawImage(glow(col), x - s * 3, y - s * 3, s * 6, s * 6);
        ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(x, y, s * 0.6, 0, TAU); ctx.fill();
      }
    }
    for (const s of G.shots) {
      if (!vis(s.x, s.y)) continue;
      const r = s.kind === "missile" ? 12 : s.r * 2.6;
      ctx.drawImage(glow(s.color), s.x - r, s.y - r, r * 2, r * 2);
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = s.kind === "missile" ? 3 : 2.5;
      const sp = Math.hypot(s.vx, s.vy) || 1;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - (s.vx / sp) * 10, s.y - (s.vy / sp) * 10); ctx.stroke();
    }
    for (const f of G.fx) {
      const a = Math.max(0, f.life / f.max);
      if (f.kind === "ring") {
        const r = f.r * (1 - a * a * 0.85);
        ctx.strokeStyle = hexA(f.color, a * 0.9); ctx.lineWidth = 2 + a * 6;
        ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); ctx.stroke();
        if (f.fill) { ctx.fillStyle = hexA(f.color, a * 0.25); ctx.fill(); }
      } else if (f.kind === "beam") {
        ctx.strokeStyle = hexA(f.color, a * 0.6); ctx.lineWidth = f.w * (1.6 + (1 - a));
        ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2); ctx.stroke();
        ctx.strokeStyle = hexA("#ffffff", a); ctx.lineWidth = f.w * 0.4;
        ctx.stroke();
      } else if (f.kind === "bolt") {
        ctx.strokeStyle = hexA(f.color, a); ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < f.pts.length - 2; i += 2) {
          const x1 = f.pts[i], y1 = f.pts[i + 1], x2 = f.pts[i + 2], y2 = f.pts[i + 3];
          ctx.moveTo(x1, y1);
          const segs = 4;
          for (let j = 1; j < segs; j++) {
            const t = j / segs; ctx.lineTo(x1 + (x2 - x1) * t + rand(-9, 9), y1 + (y2 - y1) * t + rand(-9, 9));
          }
          ctx.lineTo(x2, y2);
        }
        ctx.stroke();
        ctx.strokeStyle = hexA("#ffffff", a * 0.8); ctx.lineWidth = 1; ctx.stroke();
      }
    }
    for (const b of G.bullets) {
      if (!vis(b.x, b.y)) continue;
      ctx.drawImage(glow(b.color), b.x - b.r * 2.5, b.y - b.r * 2.5, b.r * 5, b.r * 5);
      ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.55, 0, TAU); ctx.fill();
    }

    // jogador
    if (G.dying <= 0) {
      const col = G.char.color;
      for (let i = 0; i < P.trail.length; i += 2) {
        const a = i / P.trail.length;
        ctx.globalAlpha = a * 0.35;
        const s = 6 + a * 10;
        ctx.drawImage(glow(col), P.trail[i] - s, P.trail[i + 1] - s, s * 2, s * 2);
      }
      ctx.globalAlpha = P.inv > 0 && Math.floor(now * 20) % 2 ? 0.35 : 1;
      const pulse = 1 + Math.sin(now * 6) * 0.08;
      ctx.drawImage(glow(col), P.x - 40 * pulse, P.y - 40 * pulse, 80 * pulse, 80 * pulse);
      ctx.globalCompositeOperation = "source-over";
      ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(now * 2);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      for (let i = 0; i < 8; i++) { const r = i % 2 ? 5 : 12; const a = (i / 8) * TAU; ctx[i ? "lineTo" : "moveTo"](Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
      // barra de vida sob o jogador
      if (P.hp < P.maxHp) {
        ctx.fillStyle = "#000c"; ctx.fillRect(P.x - 18, P.y + 20, 36, 4);
        ctx.fillStyle = P.hp / P.maxHp < 0.3 ? "#ff4d6d" : "#7dff7d"; ctx.fillRect(P.x - 18, P.y + 20, 36 * (P.hp / P.maxHp), 4);
      }
    }

    // partículas
    ctx.globalCompositeOperation = "lighter";
    for (const p of G.parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    // números de dano
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const t of G.texts) {
      ctx.globalAlpha = Math.min(1, t.life / t.max * 2);
      ctx.font = `800 ${t.size}px ui-sans-serif, system-ui, sans-serif`;
      ctx.lineWidth = 3; ctx.strokeStyle = "#000"; ctx.strokeText(t.txt, t.x, t.y);
      ctx.fillStyle = t.color; ctx.fillText(t.txt, t.x, t.y);
    }
    ctx.globalAlpha = 1;

    // setas para o chefão e baús fora da tela
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const arrowTo = (x, y, color) => {
      const dx = x - cam.x, dy = y - cam.y;
      if (Math.abs(dx) < VW / 2 - 10 && Math.abs(dy) < VH / 2 - 10) return;
      const a = Math.atan2(dy, dx);
      const m = Math.min((VW / 2 - 28) / Math.abs(Math.cos(a) || 1e-6), (VH / 2 - 28) / Math.abs(Math.sin(a) || 1e-6));
      ctx.save(); ctx.translate(VW / 2 + Math.cos(a) * m, VH / 2 + Math.sin(a) * m); ctx.rotate(a);
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, 9); ctx.lineTo(-8, -9); ctx.closePath(); ctx.fill();
      ctx.restore();
    };
    if (G.boss) arrowTo(G.boss.x, G.boss.y, "#ff3d7f");
    for (const p of G.pickups) if (p.kind === "chest") arrowTo(p.x, p.y, "#ffd23d");

    // vinheta de dano e de vida baixa
    const low = P.hp / P.maxHp < 0.3 && G.dying <= 0;
    if (G.hurtFlash > 0 || low) {
      const a = Math.max(G.hurtFlash > 0 ? G.hurtFlash * 1.4 : 0, low ? 0.25 + 0.2 * Math.sin(now * 6) : 0);
      const gr = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.3, VW / 2, VH / 2, Math.max(VW, VH) * 0.7);
      gr.addColorStop(0, "rgba(255,0,40,0)"); gr.addColorStop(1, `rgba(255,0,40,${Math.min(0.6, a)})`);
      ctx.fillStyle = gr; ctx.fillRect(0, 0, VW, VH);
    }
    // joystick virtual
    if (joy.active) {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 56, 0, TAU); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.beginPath(); ctx.arc(joy.ox + joy.dx * 56, joy.oy + joy.dy * 56, 22, 0, TAU); ctx.fill();
    }
  }

  function drawPickup(p, x, y, now) {
    const colors = { coin: "#ffd23d", heart: "#ff4d8d", vortex: "#4dd2ff", bomb: "#ff5252", chest: "#ffd23d" };
    const c = colors[p.kind];
    ctx.globalCompositeOperation = "lighter";
    const gs = p.kind === "chest" ? 44 : 22;
    ctx.globalAlpha = p.kind === "chest" ? 0.7 + 0.3 * Math.sin(now * 5) : 0.8;
    ctx.drawImage(glow(c), x - gs, y - gs, gs * 2, gs * 2);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = c; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2;
    if (p.kind === "coin") {
      ctx.save(); ctx.translate(x, y); ctx.scale(Math.abs(Math.cos(now * 4 + p.x)) * 0.8 + 0.2, 1);
      ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(6, 0); ctx.lineTo(0, 7); ctx.lineTo(-6, 0); ctx.closePath(); ctx.fill();
      ctx.restore();
    } else if (p.kind === "chest") {
      const s = p.boss ? 1.4 : 1;
      ctx.fillStyle = "#3a2a00"; ctx.fillRect(x - 13 * s, y - 9 * s, 26 * s, 18 * s);
      ctx.strokeStyle = "#ffd23d"; ctx.lineWidth = 3; ctx.strokeRect(x - 13 * s, y - 9 * s, 26 * s, 18 * s);
      ctx.beginPath(); ctx.moveTo(x - 13 * s, y - 2 * s); ctx.lineTo(x + 13 * s, y - 2 * s); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.fillRect(x - 3, y - 4 * s, 6, 6);
    } else {
      ctx.font = "800 16px ui-sans-serif, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.beginPath(); ctx.arc(x, y, 11, 0, TAU); ctx.fillStyle = "#0b0c18"; ctx.fill(); ctx.strokeStyle = c; ctx.stroke();
      ctx.fillStyle = c; ctx.fillText(p.kind === "heart" ? "♥" : p.kind === "vortex" ? "@" : "✹", x, y + 1);
    }
  }

  // ---------- laço principal
  let acc = 0, lastT = 0, hudT = 0;
  function frame(ts) {
    const dtReal = Math.min(0.1, (ts - (lastT || ts)) / 1000);
    lastT = ts;
    if (G && G.mode === "play") {
      acc += dtReal;
      let steps = 0;
      while (acc >= DT && steps < 5) { step(DT); acc -= DT; steps++; if (G.mode !== "play") break; }
      if (steps >= 5) acc = 0;
      if (G.mode === "play" && !G.dying) maybeInterrupt();
      hudT -= dtReal;
      if (hudT <= 0) { hudT = 0.05; F.ui.hud(G); F.meta.liveCheck(G); F.audio.musicIntensity(Math.min(1, G.t / 360 + (G.boss ? 0.4 : 0))); }
    } else if (G && G.mode === "attract") {
      acc += dtReal;
      while (acc >= DT) { step(DT); acc -= DT; }
      // na tela de título, a demonstração automática escolhe cartas sozinha
      while (G.pendingLevels > 0) { G.pendingLevels--; applyChoice(makeChoices(3)[0]); }
      G.pendingChests.length = 0;
      if (G.dying > 0 || G.t > 200) F.game.attract();
    }
    render();
    requestAnimationFrame(frame);
  }
  function maybeInterrupt() {
    if (G.pendingLevels > 0) {
      G.mode = "levelup";
      F.audio.levelUp();
      F.ui.levelUp(makeChoices(G.st.luck >= 1.4 ? 4 : 3));
    } else if (G.pendingChests.length) {
      G.mode = "chest";
      const kind = G.pendingChests.shift();
      F.ui.chest(chestItems(kind), kind);
    } else if (G.won && !G.endless && G.victoryAt && G.t >= G.victoryAt) {
      G.victoryAt = 0;
      G.mode = "victory";
      F.ui.victory();
    }
  }

  function endRun(won) {
    if (G.ended) return;
    G.ended = true;
    G.mode = "over";
    F.meta.endRun(G, won);
  }

  // ---------- entrada
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    keys.add(k);
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
    F.ui.key(k, e);
  });
  window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener("blur", () => { keys.clear(); joy.active = false; if (G && G.mode === "play") F.game.pause(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && G && G.mode === "play") F.game.pause(); });
  canvas.addEventListener("pointerdown", (e) => {
    F.audio.init();
    if (!G || G.mode !== "play") return;
    joy.active = true; joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; joy.dx = joy.dy = 0;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!joy.active || e.pointerId !== joy.id) return;
    let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy;
    const d = Math.hypot(dx, dy);
    if (d > 56) { joy.ox += (dx / d) * (d - 56); joy.oy += (dy / d) * (d - 56); dx = e.clientX - joy.ox; dy = e.clientY - joy.oy; }
    joy.dx = dx / 56; joy.dy = dy / 56;
    if (Math.hypot(joy.dx, joy.dy) < 0.15) joy.dx = joy.dy = 0;
  });
  const endJoy = (e) => { if (e.pointerId === joy.id) { joy.active = false; joy.dx = joy.dy = 0; } };
  canvas.addEventListener("pointerup", endJoy);
  canvas.addEventListener("pointercancel", endJoy);

  // ---------- API usada pela interface
  F.game = {
    start(charId) {
      newRun(charId); keys.clear(); joy.active = false; acc = 0;
      F.audio.init(); F.audio.startMusic();
    },
    attract() {
      newRun(pick(F.CHARACTERS).id);
      G.mode = "attract"; G.bot = true;
      // começa a demonstração já no meio da ação
      for (let i = 0; i < 60 * 40; i++) { step(DT); while (G.pendingLevels > 0) { G.pendingLevels--; applyChoice(makeChoices(3)[0]); } }
    },
    pause() { if (G && G.mode === "play") { G.mode = "pause"; F.ui.pause(G); } },
    resume() { if (G && (G.mode === "pause" || G.mode === "levelup" || G.mode === "chest")) { G.mode = "play"; lastT = 0; acc = 0; } },
    choose(c) { applyChoice(c); G.pendingLevels--; },
    reroll() { if (G.rerolls > 0) { G.rerolls--; return makeChoices(G.st.luck >= 1.4 ? 4 : 3); } return null; },
    quit() { if (G && !G.ended) endRun(G.won); },
    continueEndless() { G.endless = true; G.mode = "play"; F.ui.banner("MODO INFINITO", "Até onde você aguenta?"); },
    get G() { return G; },
    // avança a partida atual com o piloto automático (para testes)
    fastForward(seconds) {
      const bot = G.bot; G.bot = true;
      for (let i = 0; i < seconds * 60 && !(G.dying > 0); i++) {
        step(DT);
        while (G.pendingLevels > 0) { G.pendingLevels--; applyChoice(makeChoices(3)[0]); }
        while (G.pendingChests.length) chestItems(G.pendingChests.shift());
      }
      G.bot = bot;
    },
    // usado em testes automáticos de balanceamento: simula sem desenhar
    simulate(seconds, charId, opts) {
      newRun(charId || "faisca");
      G.bot = true; G.mode = "sim";
      const log = [];
      let lastBoss = 0;
      for (let i = 0; i < seconds * 60 && !G.ended && !(G.dying > 0); i++) {
        step(DT);
        while (G.pendingLevels > 0) { G.pendingLevels--; const ch = makeChoices(3); applyChoice(ch[(opts && opts.random) ? (Math.random() * ch.length) | 0 : 0]); }
        while (G.pendingChests.length) chestItems(G.pendingChests.shift());
        if (G.boss && !G.boss.logged) { G.boss.logged = true; log.push(`chefe ${G.boss.def.name} surgiu em ${G.t.toFixed(0)}s`); }
        if (G.bossesKilled > lastBoss) { lastBoss = G.bossesKilled; log.push(`chefe ${lastBoss} derrotado em ${G.t.toFixed(0)}s (nível ${G.level}, vida ${G.player.hp.toFixed(0)})`); }
        if (i % (60 * 60) === 0) log.push(`t=${G.t.toFixed(0)} lvl=${G.level} hp=${G.player.hp.toFixed(0)}/${G.player.maxHp} inimigos=${G.enemies.length} abates=${G.kills} armas=${G.weapons.map((w) => w.id + w.lvl + (w.evo ? "E" : "")).join(",")}`);
      }
      const r = { t: G.t, level: G.level, kills: G.kills, hp: G.player.hp, bosses: G.bossesKilled, gold: G.gold, dmgBy: G.dmgBy, log, died: G.dying > 0 };
      G = null; F.G = null;
      return r;
    },
  };
  F.game.step = step;

  requestAnimationFrame(frame);
})(window.F);
