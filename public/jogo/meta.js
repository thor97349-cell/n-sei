// FAÍSCA — progresso permanente: salvamento, bônus diário, conquistas e recompensas de fim de partida.
"use strict";
window.F = window.F || {};

(function (F) {
  const KEY = "faisca.save.v1";
  const DEFAULT = () => ({
    gold: 0, shop: {}, ach: {}, char: "faisca", lastPlayDay: "", streak: 0,
    stats: { runs: 0, kills: 0, bestTime: 0, bossKills: 0, bestCombo: 0, evolutions: 0, bestLevel: 0, maxWeapons: 0, bestNoHit: 0, bestBossRun: 0, wins: 0, goldTotal: 0 },
    settings: { sfx: true, music: true, dmgNums: true, shake: true },
  });

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!raw) return DEFAULT();
      const d = DEFAULT();
      return Object.assign(d, raw, { stats: Object.assign(d.stats, raw.stats), settings: Object.assign(d.settings, raw.settings), shop: raw.shop || {}, ach: raw.ach || {} });
    } catch { return DEFAULT(); }
  }
  F.save = load();
  F.persist = () => { try { localStorage.setItem(KEY, JSON.stringify(F.save)); } catch { /* modo privado: segue sem salvar */ } };
  F.audio.setSfx(F.save.settings.sfx);
  F.audio.setMusic(F.save.settings.music);

  const dayStr = (d) => { const x = d || new Date(); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
  const today = () => dayStr();
  const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayStr(d); };

  const M = (F.meta = {});
  M.dailyBonusActive = () => F.save.lastPlayDay !== today();
  M.isUnlocked = (ch) => !ch.unlock || !!F.save.ach[ch.unlock];
  M.charsUnlocked = () => F.CHARACTERS.filter(M.isUnlocked).length;
  M.charFor = (achId) => F.CHARACTERS.find((c) => c.unlock === achId);
  M.reset = () => { try { localStorage.removeItem(KEY); } catch { /* sem armazenamento */ } F.save = load(); F.audio.setSfx(true); F.audio.setMusic(true); };

  // estatísticas acumuladas somadas com as da partida em andamento
  function liveStats(G) {
    const s = F.save.stats;
    const out = Object.assign({}, s);
    if (G) {
      out.kills = s.kills + G.kills;
      out.bestTime = Math.max(s.bestTime, G.t);
      out.bossKills = s.bossKills + G.bossesKilled;
      out.bestCombo = Math.max(s.bestCombo, G.bestCombo);
      out.evolutions = s.evolutions + G.evolutions;
      out.bestLevel = Math.max(s.bestLevel, G.level);
      out.maxWeapons = Math.max(s.maxWeapons, G.weapons.length);
      out.bestNoHit = Math.max(s.bestNoHit, G.bestNoHit);
      out.bestBossRun = Math.max(s.bestBossRun, G.bossesKilled);
      out.wins = s.wins + (G.won ? 1 : 0);
      out.goldTotal = s.goldTotal + G.gold;
    }
    out.charsUnlocked = M.charsUnlocked();
    return out;
  }
  M.liveStats = liveStats;

  function checkAchievements(G) {
    const got = [];
    // repete porque desbloquear um núcleo pode completar "Constelação"
    for (let pass = 0; pass < 2; pass++) {
      const s = liveStats(G);
      for (const a of F.ACHIEVEMENTS) {
        if (F.save.ach[a.id] || !a.check(s)) continue;
        F.save.ach[a.id] = true;
        F.save.gold += a.gold;
        F.save.stats.goldTotal += a.gold;
        got.push(a);
      }
    }
    if (got.length) F.persist();
    return got;
  }

  // conquistas que acontecem no meio da partida aparecem na hora
  M.liveCheck = (G) => {
    if (G.mode !== "play") return;
    for (const a of checkAchievements(G)) {
      F.audio.achievement();
      F.ui.toast(`🏆 ${a.name} · +${a.gold} ◆`, "ach");
      const ch = M.charFor(a.id);
      if (ch) setTimeout(() => F.ui.toast(`Novo núcleo desbloqueado: ${ch.name}!`, "gold"), 600);
    }
  };

  M.endRun = (G, won) => {
    const S = F.save, st = S.stats;
    const prevBest = st.bestTime;
    const daily = G.dailyBonus;
    const coins = G.gold;
    const bonus = Math.floor(G.t / 5) + G.level * 2 + G.bossesKilled * 40 + Math.floor(G.kills / 25);
    const mult = G.st.gold * (daily ? 2 : 1);
    const total = Math.round((coins + bonus) * mult);

    st.runs++;
    st.kills += G.kills;
    st.bestTime = Math.max(st.bestTime, G.t);
    st.bossKills += G.bossesKilled;
    st.bestCombo = Math.max(st.bestCombo, G.bestCombo);
    st.evolutions += G.evolutions;
    st.bestLevel = Math.max(st.bestLevel, G.level);
    st.maxWeapons = Math.max(st.maxWeapons, G.weapons.length);
    st.bestNoHit = Math.max(st.bestNoHit, G.bestNoHit);
    st.bestBossRun = Math.max(st.bestBossRun, G.bossesKilled);
    if (won) st.wins++;
    st.goldTotal += total;
    S.gold += total;
    if (daily) {
      S.streak = S.lastPlayDay === yesterday() ? (S.streak || 0) + 1 : 1;
      S.lastPlayDay = today();
    }
    const newAch = checkAchievements(null);
    F.persist();

    F.ui.gameOver({
      won, time: G.t, level: G.level, kills: G.kills, combo: G.bestCombo, bosses: G.bossesKilled,
      coins, bonus, mult, daily, total, record: G.t > prevBest && st.runs > 1, prevBest,
      dmgBy: G.dmgBy, newAch, nextBoss: nextBossIn(G), char: G.char.id,
    });
    F.audio.stopMusic();
  };

  function nextBossIn(G) {
    if (G.boss) return { fighting: true, name: G.boss.def.name, frac: G.boss.hp / G.boss.maxHp };
    const b = F.BOSSES.find((x) => x.at > G.t);
    return b ? { name: b.name, secs: b.at - G.t } : null;
  }

  // sugestões para "só mais uma partida"
  M.nudges = (res) => {
    const out = [];
    const nb = res.nextBoss;
    if (!res.won && nb) {
      if (nb.fighting && nb.frac < 0.35) out.push({ hot: true, txt: `O ${nb.name} estava com só ${Math.ceil(nb.frac * 100)}% de vida. Quase!` });
      else if (nb.secs && nb.secs < 75) out.push({ hot: true, txt: `Faltavam só ${Math.ceil(nb.secs)} segundos para enfrentar o ${nb.name}.` });
    }
    const s = liveStats(null);
    let best = null;
    for (const a of F.ACHIEVEMENTS) {
      if (F.save.ach[a.id] || !a.prog) continue;
      const [cur, goal] = a.prog(s);
      const frac = cur / goal;
      if (frac > 0 && (!best || frac > best.frac)) best = { a, cur, goal, frac };
    }
    if (best) {
      const ch = M.charFor(best.a.id);
      const unit = best.a.prog(s)[2] === "s" ? " s" : "";
      out.push({ txt: `Próxima conquista: <b>${best.a.name}</b> (${fmtNum(Math.floor(best.cur))}${unit} de ${fmtNum(best.goal)}${unit})${ch ? ` · libera o núcleo <b>${ch.name}</b>` : ""}` });
    }
    const afford = cheapestUpgrade();
    if (afford && afford.cost <= F.save.gold) out.push({ hot: true, txt: `Você já pode comprar <b>${afford.item.name} ${roman(afford.lvl + 1)}</b> na Oficina por ${afford.cost} ◆.` });
    else if (afford) out.push({ txt: `Faltam ${afford.cost - F.save.gold} ◆ para <b>${afford.item.name} ${roman(afford.lvl + 1)}</b>.` });
    return out.slice(0, 3);
  };
  function cheapestUpgrade() {
    let best = null;
    for (const it of F.SHOP) {
      const lvl = F.save.shop[it.id] || 0;
      if (lvl >= it.max) continue;
      const cost = F.shopCost(it, lvl);
      if (!best || cost < best.cost) best = { item: it, lvl, cost };
    }
    return best;
  }
  M.affordableCount = () => F.SHOP.filter((it) => (F.save.shop[it.id] || 0) < it.max && F.shopCost(it, F.save.shop[it.id] || 0) <= F.save.gold).length;
  M.buy = (id) => {
    const it = F.SHOP.find((x) => x.id === id);
    const lvl = F.save.shop[id] || 0;
    if (!it || lvl >= it.max) return false;
    const cost = F.shopCost(it, lvl);
    if (F.save.gold < cost) return false;
    F.save.gold -= cost;
    F.save.shop[id] = lvl + 1;
    F.persist();
    return true;
  };

  const roman = (n) => ["", "I", "II", "III", "IV", "V"][n] || String(n);
  const fmtNum = (n) => Math.round(n).toLocaleString("pt-BR");
  F.fmtNum = fmtNum;
  F.roman = roman;
  F.fmtTime = (t) => { t = Math.floor(t); return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };
})(window.F);
