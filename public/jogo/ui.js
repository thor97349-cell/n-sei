// FAÍSCA — interface: HUD, menus, cartas de nível, baús e telas de fim de jogo.
"use strict";
window.F = window.F || {};

(function (F) {
  const $ = (id) => document.getElementById(id);
  const screen = $("screen"), hud = $("hud");
  let view = "title";      // tela atual da interface
  let current = null;       // dados da tela atual (cartas, resultado...)
  let armedAt = 0;          // evita escolher carta sem querer logo que ela aparece
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const live = () => F.G && ["play", "levelup", "chest", "pause", "victory"].includes(F.G.mode);

  function show(html, dim) {
    screen.className = dim === false ? "" : "dim";
    screen.style.background = "";
    screen.innerHTML = html;
    screen.scrollTop = 0;
  }
  function clear() { screen.innerHTML = ""; screen.className = ""; }

  // ---------- HUD
  let lastSlots = "", lastCombo = 0;
  const UI = (F.ui = {});
  UI.hud = (G) => {
    const P = G.player;
    $("xpfill").style.width = Math.min(100, (G.xp / G.xpNext) * 100) + "%";
    $("lvl").textContent = "NÍVEL " + G.level;
    $("hpfill").style.width = Math.max(0, (P.hp / P.maxHp) * 100) + "%";
    $("hptxt").textContent = Math.ceil(Math.max(0, P.hp)) + " / " + P.maxHp;
    const nb = F.BOSSES.find((b) => b.at > G.t);
    $("timer").innerHTML = F.fmtTime(G.t) + (G.boss ? "" : nb && nb.at - G.t < 30 ? `<small style="color:#ff3d7f">CHEFÃO EM ${Math.ceil(nb.at - G.t)}s</small>` : G.endless ? "<small>MODO INFINITO</small>" : "");
    $("kills").textContent = "☠ " + F.fmtNum(G.kills);
    $("goldc").textContent = "◆ " + F.fmtNum(G.gold);
    const c = $("combo");
    if (G.combo >= 5) {
      c.style.opacity = 1;
      if (G.combo !== lastCombo) { $("combonum").textContent = G.combo; c.classList.remove("bump"); void c.offsetWidth; c.classList.add("bump"); }
      $("combomul").textContent = "XP x" + (1 + Math.min(G.combo, 500) / 1000).toFixed(2);
    } else c.style.opacity = 0;
    lastCombo = G.combo;
    const sig = G.weapons.map((w) => w.id + w.lvl + w.evo).join() + "|" + Object.entries(G.passives).join();
    if (sig !== lastSlots) {
      lastSlots = sig;
      const ready = new Set(G.weapons.filter((w) => !w.evo && w.lvl >= 5 && G.passives[F.WEAPONS[w.id].evo.needs]).map((w) => w.id));
      $("wslots").innerHTML = G.weapons.map((w) => {
        const d = F.WEAPONS[w.id];
        return `<div class="slot ${w.evo ? "evo" : ""} ${ready.has(w.id) ? "ready" : ""}" style="color:${d.color}" title="${esc(w.evo ? d.evo.name : d.name)}">${d.icon}<div class="pips">${pips(w.evo ? 5 : w.lvl, 5)}</div></div>`;
      }).join("");
      $("pslots").innerHTML = Object.entries(G.passives).map(([id, lv]) => {
        const d = F.PASSIVES[id];
        return `<div class="slot small" style="color:${d.color}" title="${esc(d.name)}">${d.icon}<div class="pips">${pips(lv, d.max)}</div></div>`;
      }).join("");
    }
  };
  const pips = (n, max) => Array.from({ length: max }, (_, i) => `<i class="${i < n ? "on" : ""}"></i>`).join("");

  UI.bossBar = (name, frac) => {
    if (!live() || !name) { $("bossbar").hidden = true; return; }
    $("bossbar").hidden = false;
    $("bossname").textContent = name;
    $("bossfill").style.width = Math.max(0, frac * 100) + "%";
  };
  UI.toast = (msg, kind) => {
    if (!live()) return;
    const el = document.createElement("div");
    el.className = "toast " + (kind || "");
    el.textContent = msg;
    $("toasts").appendChild(el);
    while ($("toasts").children.length > 4) $("toasts").firstChild.remove();
    setTimeout(() => el.remove(), 3000);
  };
  UI.banner = (title, sub) => {
    if (!live()) return;
    const b = $("banner");
    b.querySelector("h2").textContent = title;
    b.querySelector("p").textContent = sub || "";
    b.classList.remove("show"); void b.offsetWidth; b.classList.add("show");
  };
  UI.comboMilestone = () => {};

  // ---------- título
  function titleScreen() {
    view = "title";
    hud.hidden = true;
    F.game.attract();
    F.audio.startMusic(); F.audio.musicIntensity(0.2);
    const S = F.save, st = S.stats;
    const ch = F.CHARACTERS.find((c) => c.id === S.char && F.meta.isUnlocked(c)) || F.CHARACTERS[0];
    const achDone = F.ACHIEVEMENTS.filter((a) => S.ach[a.id]).length;
    const afford = F.meta.affordableCount();
    const daily = F.meta.dailyBonusActive();
    const locked = F.CHARACTERS.length - F.meta.charsUnlocked();
    show(`
      <div class="title">
        <h1 class="logo">FAÍSCA</h1>
        <p class="tagline">Sobreviva ao enxame</p>
        <button class="btn primary play" data-act="play">JOGAR<small>com ${esc(ch.name)} · Enter</small></button>
        <div class="menu-grid">
          <button class="menu-btn" data-act="chars">Núcleos<small>${F.meta.charsUnlocked()}/${F.CHARACTERS.length} desbloqueados</small>${locked && st.runs ? "" : ""}</button>
          <button class="menu-btn" data-act="shop">Oficina<small class="goldtag">◆ ${F.fmtNum(S.gold)}</small>${afford ? `<span class="badge">${afford}</span>` : ""}</button>
          <button class="menu-btn" data-act="ach">Conquistas<small>${achDone}/${F.ACHIEVEMENTS.length}</small></button>
          <button class="menu-btn" data-act="opts">Opções<small>som, efeitos</small></button>
        </div>
        ${daily ? `<div class="daily">☀ Bônus do dia: ouro em dobro na próxima partida${S.streak ? ` · sequência de ${S.streak} dia${S.streak > 1 ? "s" : ""}` : ""}</div>` : ""}
        ${st.runs ? `<div class="stats-line"><span>Recorde <b>${F.fmtTime(st.bestTime)}</b></span><span>Maior combo <b>${st.bestCombo}</b></span><span>Abates <b>${F.fmtNum(st.kills)}</b></span></div>` : ""}
        <p class="tip">${st.runs ? esc(F.TIPS[(Math.random() * F.TIPS.length) | 0]) : "Mova-se com WASD, setas ou arrastando o dedo. As armas atiram sozinhas."}</p>
      </div>`, true);
    screen.className = "";
    screen.style.background = "radial-gradient(ellipse at center, rgba(5,6,14,.35), rgba(5,6,14,.85))";
  }

  function charsScreen() {
    view = "chars";
    const s = F.meta.liveStats(null);
    show(`<div class="panel">
      <div class="row spread"><div><h2>Núcleos</h2><p class="sub">Cada núcleo começa com uma arma diferente.</p></div><button class="btn" data-act="back">Voltar</button></div>
      <div class="chars">${F.CHARACTERS.map((c) => {
        const un = F.meta.isUnlocked(c);
        const ach = c.unlock && F.ACHIEVEMENTS.find((a) => a.id === c.unlock);
        let req = "";
        if (!un && ach) {
          req = `<small>🔒 ${esc(ach.txt)}</small>`;
          if (ach.prog) { const [cur, goal] = ach.prog(s); req += `<div class="prog"><i style="width:${Math.min(100, (cur / goal) * 100)}%"></i></div>`; }
        }
        const w = F.WEAPONS[c.weapon];
        return `<button class="char ${un ? "" : "locked"} ${F.save.char === c.id ? "sel" : ""}" data-act="${un ? "pickchar" : ""}" data-id="${c.id}">
          <div class="orb" style="color:${c.color}"></div>
          <b>${esc(c.name)}</b>
          <small style="color:${w.color}">${w.icon} ${esc(w.name)}</small>
          ${un ? `<small>${esc(c.perk)}</small>` : req}
        </button>`;
      }).join("")}</div></div>`);
  }

  function shopScreen() {
    view = "shop";
    const S = F.save;
    show(`<div class="panel">
      <div class="row spread"><div><h2>Oficina</h2><p class="sub">Melhorias permanentes. Você tem <span class="goldtag">◆ ${F.fmtNum(S.gold)}</span></p></div><button class="btn" data-act="back">Voltar</button></div>
      <div class="list">${F.SHOP.map((it) => {
        const lvl = S.shop[it.id] || 0, maxed = lvl >= it.max, cost = F.shopCost(it, lvl);
        return `<div class="item">
          <div class="i" style="color:var(--cyan)">${it.icon}</div>
          <div class="t"><b>${esc(it.name)}</b><small>${esc(it.txt)}</small><div class="pipsrow">${Array.from({ length: it.max }, (_, i) => `<i class="${i < lvl ? "on" : ""}"></i>`).join("")}</div></div>
          ${maxed ? `<span class="goldtag" style="color:var(--green)">MÁX</span>` : `<button class="btn ${S.gold >= cost ? "gold" : ""}" data-act="buy" data-id="${it.id}" ${S.gold >= cost ? "" : "disabled"}>◆ ${F.fmtNum(cost)}</button>`}
        </div>`;
      }).join("")}</div></div>`);
  }

  function achScreen() {
    view = "ach";
    const s = F.meta.liveStats(null);
    show(`<div class="panel">
      <div class="row spread"><div><h2>Conquistas</h2><p class="sub">Cada uma rende ouro. Algumas liberam núcleos.</p></div><button class="btn" data-act="back">Voltar</button></div>
      <div class="list">${F.ACHIEVEMENTS.map((a) => {
        const done = !!F.save.ach[a.id];
        const ch = F.meta.charFor(a.id);
        let prog = "";
        if (!done && a.prog) { const [cur, goal] = a.prog(s); prog = `<div class="prog"><i style="width:${Math.min(100, (cur / goal) * 100)}%"></i></div>`; }
        return `<div class="item ${done ? "done" : "locked"}">
          <div class="i">${done ? "🏆" : "🔒"}</div>
          <div class="t"><b>${esc(a.name)}</b><small>${esc(a.txt)}${ch ? ` · libera <b style="color:${ch.color}">${esc(ch.name)}</b>` : ""}</small>${prog}</div>
          <span class="goldtag">◆ ${a.gold}</span>
        </div>`;
      }).join("")}</div></div>`);
  }

  function toggles() {
    const s = F.save.settings;
    const t = (k, label) => `<div class="toggle ${s[k] ? "on" : ""}" data-act="toggle" data-id="${k}" role="switch" aria-checked="${s[k]}"><span>${label}</span><span class="sw"></span></div>`;
    return t("sfx", "Efeitos sonoros") + t("music", "Música") + t("dmgNums", "Números de dano") + t("shake", "Tremor de tela");
  }
  function optsScreen() {
    view = "opts";
    show(`<div class="panel" style="max-width:460px">
      <div class="row spread"><h2>Opções</h2><button class="btn" data-act="back">Voltar</button></div>
      <div style="margin-top:14px">${toggles()}</div>
      <p class="help">Controles: WASD ou setas para mover · P ou Esc para pausar · 1-4 para escolher cartas · R para sortear de novo.<br>No celular, arraste o dedo em qualquer lugar da tela.</p>
      <div class="row" style="justify-content:center;margin-top:16px"><button class="btn" data-act="reset" style="color:#ff8a8a">Apagar progresso</button></div>
    </div>`);
  }

  // ---------- partida
  function startRun() {
    F.audio.init(); F.audio.ui();
    const S = F.save;
    const ch = F.CHARACTERS.find((c) => c.id === S.char && F.meta.isUnlocked(c)) || F.CHARACTERS[0];
    view = "game"; clear(); screen.style.background = "";
    hud.hidden = false; lastSlots = ""; $("bossbar").hidden = true; $("toasts").innerHTML = "";
    F.game.start(ch.id);
    if (F.G.dailyBonus) setTimeout(() => UI.toast("☀ Bônus do dia ativo: ouro em dobro nesta partida!", "gold"), 800);
  }

  function cardHtml(c, i) {
    let ic, color, name, lv, ds, cls = "", tag = "", hint = "";
    if (c.kind === "w" || c.kind === "evo") {
      const d = F.WEAPONS[c.id];
      ic = d.icon; color = d.color;
      if (c.kind === "evo") {
        cls = "evo"; tag = "EVOLUÇÃO"; name = d.evo.name; lv = `${esc(d.name)} evolui`; ds = d.evo.txt;
      } else {
        name = d.name;
        const to = c.lvl + c.add;
        lv = c.lvl ? `Nível ${c.lvl} → ${to}` : `<span class="new">NOVA ARMA</span>${c.add > 1 ? " · nível 2" : ""}`;
        ds = c.lvl ? d.lv.slice(c.lvl, to).map((x) => x.txt).join("; ") : d.desc;
        if (to >= 5) {
          const p = F.PASSIVES[d.evo.needs];
          hint = F.G.passives[d.evo.needs] ? `⚡ Pronta para evoluir em ${esc(d.evo.name)}!` : `⚡ No nível 5 evolui com ${esc(p.name)}`;
        }
      }
    } else if (c.kind === "p") {
      const d = F.PASSIVES[c.id];
      ic = d.icon; color = d.color; name = d.name;
      lv = c.lvl ? `Nível ${c.lvl} → ${c.lvl + c.add}` : `<span class="new">NOVA</span>`;
      ds = c.add > 1 ? d.txt + " (x2)" : d.txt;
      const evoOf = F.G.weapons.find((w) => F.WEAPONS[w.id].evo.needs === c.id && !w.evo);
      if (evoOf && !c.lvl) hint = `⚡ Permite evoluir ${esc(F.WEAPONS[evoOf.id].name)}`;
    } else if (c.kind === "heal") {
      ic = "♥"; color = "#7dff7d"; name = "Reparo total"; lv = "Consumível"; ds = "Recupera toda a vida.";
    } else {
      ic = "◆"; color = "#ffd23d"; name = "Bolsa de ouro"; lv = "Consumível"; ds = "+25 de ouro.";
    }
    if (c.add > 1) { cls = "rare"; tag = "SURTO · +2 NÍVEIS"; }
    return `<button class="card ${cls}" data-act="card" data-i="${i}" style="animation-delay:${i * 70}ms">
      <span class="key">${i + 1}</span>
      <div class="ic" style="color:${color};text-shadow:0 0 14px ${color}">${ic}</div>
      <div class="body">${tag ? `<div class="tag">${tag}</div>` : ""}<div class="nm">${esc(name)}</div><div class="lv">${lv}</div><div class="ds">${esc(ds)}</div></div>
      ${hint ? `<div class="hint">${hint}</div>` : ""}
    </button>`;
  }

  UI.levelUp = (choices) => {
    view = "levelup"; current = choices;
    const G = F.G;
    if (choices.some((c) => c.add > 1 || c.kind === "evo")) setTimeout(F.audio.rare, 250);
    show(`<div class="panel lvl-title">
      <h2>NÍVEL ${G.level - G.pendingLevels + 1}</h2>
      <p class="sub">Escolha uma melhoria${G.pendingLevels > 1 ? ` · mais ${G.pendingLevels - 1} na fila` : ""}</p>
      <div class="cards arming" id="cards">${choices.map(cardHtml).join("")}</div>
      <div class="row" style="justify-content:center">
        <button class="btn" data-act="reroll" ${G.rerolls > 0 ? "" : "disabled"}>↻ Sortear de novo (${G.rerolls})</button>
      </div>
    </div>`);
    armedAt = performance.now() + 380;
    setTimeout(() => { const c = $("cards"); if (c) c.classList.remove("arming"); }, 380);
  };
  function chooseCard(i) {
    if (view !== "levelup" || performance.now() < armedAt || !current[i]) return;
    F.audio.pick();
    F.game.choose(current[i]);
    view = "game"; clear();
    F.game.resume();
  }
  function reroll() {
    const ch = F.game.reroll();
    if (ch) { F.audio.ui(); UI.levelUp(ch); }
  }

  UI.chest = (res, kind) => {
    view = "chest"; current = res;
    const icons = [...Object.values(F.WEAPONS).map((w) => w.icon), ...Object.values(F.PASSIVES).map((p) => p.icon)];
    show(`<div class="panel chest">
      <h2>${kind === "boss" ? "BAÚ DO CHEFÃO" : "BAÚ"}</h2>
      <p class="sub" id="chestsub">Abrindo...</p>
      <div class="reel spin" id="reel">?</div>
      <div class="loot" id="loot"></div>
      <button class="btn primary" data-act="chestok" id="chestok" style="visibility:hidden">Continuar</button>
    </div>`);
    let n = 0;
    const spinFor = res.items.length > 1 ? 1500 : 1000;
    const start = performance.now();
    const spin = () => {
      if (view !== "chest") return;
      const el = $("reel");
      if (performance.now() - start < spinFor && !current.skip) {
        el.textContent = icons[(Math.random() * icons.length) | 0];
        F.audio.tick();
        setTimeout(spin, 60 + n++ * 2);
        return;
      }
      el.classList.remove("spin");
      el.textContent = res.items.length >= 5 ? "★" : "✓";
      reveal(0);
    };
    const reveal = (i) => {
      if (view !== "chest") return;
      const loot = $("loot");
      if (i < res.items.length) {
        const it = res.items[i];
        const row = document.createElement("div");
        let ic, txt, color;
        if (it.kind === "evo") { const d = F.WEAPONS[it.id]; ic = d.icon; color = d.color; txt = `EVOLUÇÃO: ${d.evo.name}`; row.className = "evo"; F.audio.rare(); }
        else if (it.kind === "w") { const d = F.WEAPONS[it.id]; ic = d.icon; color = d.color; txt = `${d.name} → nível ${it.lvl + 1}`; F.audio.pick(); }
        else if (it.kind === "p") { const d = F.PASSIVES[it.id]; ic = d.icon; color = d.color; txt = `${d.name} → nível ${it.lvl + 1}`; F.audio.pick(); }
        else { ic = "◆"; color = "#ffd23d"; txt = `+${it.v} de ouro`; F.audio.coin(); }
        row.innerHTML = `<span class="i" style="color:${color}">${ic}</span><span>${esc(txt)}</span>`;
        loot.appendChild(row);
        setTimeout(() => reveal(i + 1), current.skip ? 60 : 280);
      } else {
        const row = document.createElement("div");
        row.innerHTML = `<span class="i" style="color:#ffd23d">◆</span><span class="goldtag">+${res.bonus} de ouro</span>`;
        loot.appendChild(row);
        F.audio.coin();
        $("chestsub").textContent = res.items.length >= 5 ? "JACKPOT! Cinco prêmios!" : res.items.length >= 3 ? "Três prêmios!" : "Prêmio!";
        $("chestok").style.visibility = "visible";
        current.done = true;
        if (res.items.length >= 5) F.audio.chest();
      }
    };
    spin();
  };
  function chestOk() {
    if (view !== "chest") return;
    if (!current.done) { current.skip = true; return; }
    view = "game"; clear(); F.game.resume();
  }

  UI.pause = (G) => {
    view = "pause";
    show(`<div class="panel" style="max-width:520px">
      <h2>Pausado</h2>
      <p class="sub">${F.fmtTime(G.t)} · nível ${G.level} · ${F.fmtNum(G.kills)} abates</p>
      <div class="build">${G.weapons.map((w) => { const d = F.WEAPONS[w.id]; return `<span style="color:${d.color}">${d.icon} ${esc(w.evo ? d.evo.name : d.name + " " + w.lvl)}</span>`; }).join("")}
      ${Object.entries(G.passives).map(([id, lv]) => { const d = F.PASSIVES[id]; return `<span style="color:${d.color}">${d.icon} ${esc(d.name)} ${lv}</span>`; }).join("")}</div>
      <div style="margin:14px 0">${toggles()}</div>
      <div class="row" style="justify-content:space-between">
        <button class="btn" data-act="giveup" style="color:#ff8a8a">Desistir</button>
        <button class="btn primary" data-act="resume">Continuar</button>
      </div>
    </div>`);
  };
  function resume() { if (view !== "pause") return; view = "game"; clear(); F.game.resume(); }

  UI.victory = () => {
    view = "victory";
    F.audio.chest();
    show(`<div class="panel over" style="text-align:center;max-width:520px">
      <h2 class="win">VITÓRIA!</h2>
      <p class="sub">A Singularidade caiu. O enxame foi vencido.</p>
      <div class="bigtime">${F.fmtTime(F.G.t)}</div>
      <p class="sub">Continue no modo infinito para buscar mais ouro e recordes, ou encerre agora.</p>
      <div class="row" style="justify-content:center">
        <button class="btn" data-act="finish">Encerrar e receber</button>
        <button class="btn primary" data-act="endless">Modo infinito</button>
      </div>
    </div>`);
  };

  UI.gameOver = (r) => {
    view = "over"; current = r;
    hud.hidden = true;
    $("banner").classList.remove("show"); $("toasts").innerHTML = "";
    $("bossbar").hidden = true;
    const maxD = Math.max(1, ...Object.values(r.dmgBy));
    const bars = Object.entries(r.dmgBy).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([id, v]) => {
      const d = F.WEAPONS[id];
      const name = d ? d.name : "Bomba", color = d ? d.color : "#ff5252";
      return `<div><span style="color:${color}">${d ? d.icon : "✹"} ${esc(name)}</span><span class="bar"><i style="width:${(v / maxD) * 100}%;background:${color}"></i></span><span style="text-align:right">${F.fmtNum(v)}</span></div>`;
    }).join("");
    const nudges = F.meta.nudges(r);
    const afford = F.meta.affordableCount();
    show(`<div class="panel over" style="text-align:center;max-width:600px">
      <h2 class="${r.won ? "win" : "lose"}">${r.won ? "VITÓRIA!" : "O ENXAME VENCEU"}</h2>
      <div class="bigtime">${F.fmtTime(r.time)}</div>
      ${r.record ? `<span class="record">NOVO RECORDE</span>` : r.prevBest ? `<p class="sub" style="margin:0">Recorde: ${F.fmtTime(Math.max(r.prevBest, r.time))}</p>` : ""}
      <div class="statgrid">
        <div><b>${r.level}</b><small>Nível</small></div>
        <div><b>${F.fmtNum(r.kills)}</b><small>Abates</small></div>
        <div><b>${r.combo}</b><small>Maior combo</small></div>
        <div><b>${r.bosses}</b><small>Chefões</small></div>
      </div>
      <div class="earn"><span id="earn">+0</span> ◆<small>${r.coins} coletado + ${r.bonus} de bônus${r.mult > 1.001 ? ` · x${r.mult.toFixed(2).replace(".", ",")}${r.daily ? " (bônus do dia)" : ""}` : ""}</small></div>
      ${r.newAch.map((a) => `<div class="nudge hot">🏆 Conquista: <b>${esc(a.name)}</b> · +${a.gold} ◆${F.meta.charFor(a.id) ? ` · novo núcleo: <b>${esc(F.meta.charFor(a.id).name)}</b>` : ""}</div>`).join("")}
      ${bars ? `<div class="dmgbars">${bars}</div>` : ""}
      ${nudges.map((n) => `<div class="nudge ${n.hot ? "hot" : ""}">${n.txt}</div>`).join("")}
      <div class="row" style="justify-content:center;margin-top:16px">
        <button class="btn" data-act="menu">Menu</button>
        <button class="btn" data-act="shop">Oficina${afford ? `<span class="badge">${afford}</span>` : ""}</button>
        <button class="btn primary" data-act="again" style="padding:14px 26px">JOGAR DE NOVO</button>
      </div>
      <p class="help">Enter para jogar de novo</p>
    </div>`);
    armedAt = performance.now() + 900;
    // contagem do ouro subindo
    const el = $("earn"), t0 = performance.now();
    const tick = () => {
      if (!el.isConnected) return;
      const k = Math.min(1, (performance.now() - t0) / 1200);
      el.textContent = "+" + F.fmtNum(r.total * (1 - Math.pow(1 - k, 3)));
      if (k < 1) { if (Math.random() < 0.5) F.audio.tick(); requestAnimationFrame(tick); } else F.audio.coin();
    };
    setTimeout(tick, 300);
  };

  // ---------- cliques
  screen.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b || b.disabled) return;
    F.audio.init();
    const act = b.dataset.act, id = b.dataset.id;
    switch (act) {
      case "play": case "again":
        if (act === "again" && performance.now() < armedAt) return;
        startRun(); break;
      case "chars": F.audio.ui(); charsScreen(); break;
      case "shop": F.audio.ui(); if (view === "over") hud.hidden = true; shopScreen(); break;
      case "ach": F.audio.ui(); achScreen(); break;
      case "opts": F.audio.ui(); optsScreen(); break;
      case "back": case "menu": F.audio.ui(); titleScreen(); break;
      case "pickchar": F.save.char = id; F.persist(); F.audio.pick(); charsScreen(); break;
      case "buy":
        if (F.meta.buy(id)) { F.audio.levelUp(); shopScreen(); }
        break;
      case "toggle": {
        const s = F.save.settings; s[id] = !s[id]; F.persist();
        F.audio.setSfx(s.sfx); F.audio.setMusic(s.music);
        b.classList.toggle("on", s[id]); b.setAttribute("aria-checked", s[id]);
        F.audio.ui();
        break;
      }
      case "reset":
        if (b.dataset.confirm) { F.meta.reset(); titleScreen(); }
        else { b.dataset.confirm = "1"; b.textContent = "Tem certeza? Clique de novo"; }
        break;
      case "card": chooseCard(+b.dataset.i); break;
      case "reroll": reroll(); break;
      case "chestok": chestOk(); break;
      case "resume": resume(); break;
      case "giveup":
        if (b.dataset.confirm) { F.game.quit(); }
        else { b.dataset.confirm = "1"; b.textContent = "Confirmar desistência"; }
        break;
      case "endless": view = "game"; clear(); F.game.continueEndless(); break;
      case "finish": F.game.quit(); break;
    }
  });
  $("pauseBtn").addEventListener("click", () => F.game.pause());
  // em celular a tela de título também começa a partida com toque fora dos botões? não: evita toques acidentais

  UI.key = (k) => {
    if (view === "title" && (k === "enter" || k === " ")) startRun();
    else if (view === "game" && (k === "escape" || k === "p")) F.game.pause();
    else if (view === "pause" && (k === "escape" || k === "p" || k === "enter")) resume();
    else if (view === "levelup") {
      if (k >= "1" && k <= "4") chooseCard(+k - 1);
      else if (k === "r") reroll();
    } else if (view === "chest" && (k === "enter" || k === " " || k === "escape")) chestOk();
    else if (view === "over" && (k === "enter" || k === " ") && performance.now() >= armedAt) startRun();
    else if (["chars", "shop", "ach", "opts"].includes(view) && k === "escape") titleScreen();
  };

  // primeiro toque/tecla libera o áudio (exigência dos navegadores)
  const unlock = () => { F.audio.init(); F.audio.startMusic(); };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });

  titleScreen();
})(window.F);
