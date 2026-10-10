// DOM HUD. Writes to the DOM only when values change to keep frames cheap.
import { AUDIO } from '../config.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.cache = {};
    this.el = {};
    for (const id of ['hud', 'timer', 'phase', 'scoreAtk', 'scoreDef', 'roundNum', 'objText', 'modStatus', 'botsAlive', 'areaName', 'killfeed', 'fps', 'soundRing', 'damageRing', 'crosshair', 'hitmarker', 'progress', 'progressLabel', 'progressFill', 'prompt', 'toast', 'lockHint', 'creditsVal', 'hp', 'ap', 'hpBar', 'apBar', 'weaponName', 'mag', 'reserve', 'ammo', 'slot1', 'slot2', 'reloadHint', 'buyHint', 'deadOverlay', 'markers', 'buy', 'buyItems', 'buyCredits', 'roundEnd', 'reTitle', 'reReason', 'reRows', 'reNext', 'btnNewMatch']) this.el[id] = $(id);
    this.chLines = [...this.el.crosshair.querySelectorAll('.ch')];
    this.hitTimer = 0;
    this.indicators = [];
    this.damageInds = [];
    this.markerEls = new Map();
  }

  set(id, value, prop = 'textContent') {
    const key = id + prop;
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    this.el[id][prop] = value;
  }

  cls(id, name, on) {
    const key = id + '.' + name;
    if (this.cache[key] === on) return;
    this.cache[key] = on;
    this.el[id].classList.toggle(name, on);
  }

  show(on) { this.el.hud.classList.toggle('hidden', !on); }

  // ------------------------------------------------------------ per-frame
  update(s, dt) {
    const t = Math.max(0, Math.ceil(s.timeLeft));
    this.set('timer', `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`);
    this.cls('timer', 'urgent', s.phase === 'live' && s.timeLeft < 20);
    this.set('phase', s.phaseLabel);
    this.cls('phase', 'buy', s.phase === 'buy');
    this.cls('phase', 'extract', s.phaseLabel === 'EXTRACTION');
    this.set('scoreAtk', String(s.wins));
    this.set('scoreDef', String(s.losses));
    this.set('roundNum', String(s.round));
    this.set('objText', s.objText);
    this.set('modStatus', s.modStatus);
    this.cls('modStatus', 'carried', s.modStatus === 'CARRIED');
    this.cls('modStatus', 'dropped', s.modStatus === 'DROPPED');
    this.set('botsAlive', `${s.botsAlive} / ${s.botsTotal}`);
    this.set('areaName', s.area);
    this.set('creditsVal', String(s.credits));
    this.set('hp', String(Math.ceil(s.health)));
    this.set('ap', String(Math.ceil(s.armor)));
    this.el.hpBar.style.width = `${s.health}%`;
    this.el.apBar.style.width = `${s.armor}%`;
    this.el.hp.parentElement.classList.toggle('low', s.health <= 25);
    this.set('weaponName', s.weaponName);
    this.set('mag', String(s.mag));
    this.set('reserve', String(s.reserve));
    this.cls('ammo', 'empty', s.mag === 0);
    this.set('slot1', s.primaryName ? `1 · ${s.primaryName}` : '1 · —');
    this.set('slot2', `2 · ${s.secondaryName}`);
    this.cls('slot1', 'on', s.slot === 'primary');
    this.cls('slot2', 'on', s.slot === 'secondary');
    this.cls('reloadHint', 'hidden', !s.reloading);
    this.cls('buyHint', 'hidden', !(s.phase === 'buy' && !s.buyOpen));
    this.cls('deadOverlay', 'hidden', s.alive);
    this.cls('crosshair', 'hidden', !s.alive);
    this.cls('crosshair', 'ads', s.ads);

    // Dynamic crosshair: gap ≈ projected inaccuracy (approximate, not exact).
    const gap = Math.min(80, 3 + s.spreadPx);
    if (this.cache.gap !== Math.round(gap)) {
      this.cache.gap = Math.round(gap);
      const [tp, bt, lf, rt] = this.chLines;
      tp.style.top = `${-gap - 7}px`; bt.style.top = `${gap}px`;
      lf.style.left = `${-gap - 7}px`; rt.style.left = `${gap}px`;
    }

    // Hitmarker fade.
    if (this.hitTimer > 0) {
      this.hitTimer -= dt;
      this.el.hitmarker.style.opacity = Math.max(0, this.hitTimer / 0.25).toFixed(2);
    }

    // Sound indicators: rotate with the view, fade out.
    for (let i = this.indicators.length - 1; i >= 0; i--) {
      const ind = this.indicators[i];
      ind.life -= dt;
      if (ind.life <= 0) { ind.el.remove(); this.indicators.splice(i, 1); continue; }
      const rel = ind.worldAngle - s.yaw;
      const deg = (-rel * 180) / Math.PI;
      ind.el.style.transform = `rotate(${deg}deg) scale(${ind.scale})`;
      ind.el.style.opacity = (Math.min(1, ind.life / (AUDIO.indicatorLifetime * 0.6)) * ind.alpha).toFixed(2);
    }
    for (let i = this.damageInds.length - 1; i >= 0; i--) {
      const ind = this.damageInds[i];
      ind.life -= dt;
      if (ind.life <= 0) { ind.el.remove(); this.damageInds.splice(i, 1); continue; }
      const deg = (-(ind.worldAngle - s.yaw) * 180) / Math.PI;
      ind.el.style.transform = `rotate(${deg}deg)`;
      ind.el.style.opacity = Math.min(1, ind.life).toFixed(2);
    }
  }

  // ------------------------------------------------------------ feedback
  hitmarker(kind) {
    this.hitTimer = 0.25;
    this.el.hitmarker.className = kind === 'head' ? 'head' : kind === 'kill' ? 'kill' : '';
    this.el.hitmarker.style.opacity = '1';
  }

  // worldAngle: yaw-convention angle from listener to the source.
  soundIndicator(worldAngle, intensity, label, isShot) {
    const step = (AUDIO.indicatorAngleStep * Math.PI) / 180;
    const snapped = Math.round(worldAngle / step) * step; // approximate direction only
    // Merge with an existing indicator in the same direction.
    const existing = this.indicators.find((i) => Math.abs(i.worldAngle - snapped) < 1e-3 && i.label === label);
    if (existing) { existing.life = AUDIO.indicatorLifetime; existing.alpha = Math.max(existing.alpha, intensity); return; }
    if (this.indicators.length >= AUDIO.indicatorMax) {
      const weakest = this.indicators.reduce((a, b) => (a.alpha < b.alpha ? a : b));
      if (weakest.alpha > intensity) return;
      weakest.el.remove();
      this.indicators.splice(this.indicators.indexOf(weakest), 1);
    }
    const el = document.createElement('div');
    el.className = 'sndInd' + (isShot ? ' shot' : '');
    el.innerHTML = `<div class="arc"></div><div class="lbl">${label}</div>`;
    this.el.soundRing.appendChild(el);
    this.indicators.push({ el, worldAngle: snapped, life: AUDIO.indicatorLifetime, alpha: Math.max(0.25, Math.min(1, intensity)), scale: 0.8 + Math.min(1, intensity) * 0.4, label });
  }

  damageIndicator(worldAngle) {
    const el = document.createElement('div');
    el.className = 'dmgInd';
    el.innerHTML = '<div class="arc"></div>';
    this.el.damageRing.appendChild(el);
    this.damageInds.push({ el, worldAngle, life: 1.2 });
    if (this.damageInds.length > 4) { const old = this.damageInds.shift(); old.el.remove(); }
  }

  killfeed(text, headshot) {
    const d = document.createElement('div');
    d.textContent = text;
    if (headshot) d.className = 'hs';
    this.el.killfeed.prepend(d);
    setTimeout(() => d.remove(), 5000);
    while (this.el.killfeed.children.length > 5) this.el.killfeed.lastChild.remove();
  }

  toast(text, kind = '') {
    const d = document.createElement('div');
    d.textContent = text;
    d.className = kind;
    this.el.toast.appendChild(d);
    setTimeout(() => { d.style.opacity = '0'; }, 2600);
    setTimeout(() => d.remove(), 3100);
    while (this.el.toast.children.length > 3) this.el.toast.firstChild.remove();
  }

  progress(label, frac, kind) {
    if (label === null) { this.cls('progress', 'hidden', true); return; }
    this.cls('progress', 'hidden', false);
    this.cls('progress', 'hack', kind === 'hack');
    this.set('progressLabel', label);
    this.el.progressFill.style.width = `${Math.min(100, frac * 100).toFixed(1)}%`;
  }

  prompt(text) {
    this.cls('prompt', 'hidden', !text);
    if (text) this.set('prompt', text);
  }

  lockHint(on) { this.cls('lockHint', 'hidden', !on); }
  showFps(on) { this.cls('fps', 'hidden', !on); }
  fps(v) { this.set('fps', `${v} fps`); }

  // markers: [{id, x, y, cls, label}] in screen pixels (null = hidden)
  markers(list) {
    const seen = new Set();
    for (const m of list) {
      seen.add(m.id);
      let el = this.markerEls.get(m.id);
      if (!el) {
        el = document.createElement('div');
        el.innerHTML = '<div class="gem"></div><span></span>';
        this.el.markers.appendChild(el);
        this.markerEls.set(m.id, el);
      }
      el.className = 'marker ' + m.cls;
      el.style.left = `${m.x}px`;
      el.style.top = `${m.y}px`;
      el.lastChild.textContent = m.label;
    }
    for (const [id, el] of this.markerEls) if (!seen.has(id)) { el.remove(); this.markerEls.delete(id); }
  }

  clearTransient() {
    for (const i of this.indicators) i.el.remove();
    for (const i of this.damageInds) i.el.remove();
    this.indicators = []; this.damageInds = [];
    this.el.toast.innerHTML = '';
    this.progress(null);
    this.prompt(null);
  }

  // ------------------------------------------------------------ buy menu
  renderBuy(items, credits, onBuy) {
    this.set('buyCredits', String(credits));
    const root = this.el.buyItems;
    root.innerHTML = '';
    for (const it of items) {
      const b = document.createElement('button');
      b.className = 'buyItem';
      b.disabled = !it.ok;
      b.innerHTML = `<span class="k">${it.key}</span><span>${it.label}<span class="note">${it.note}</span></span><span class="price">${it.price ? '$' + it.price : 'FREE'}</span>`;
      b.addEventListener('click', () => onBuy(it.id));
      root.appendChild(b);
    }
  }

  showBuy(on) { this.el.buy.classList.toggle('hidden', !on); }

  // ------------------------------------------------------------ round end
  showRoundEnd(data) {
    if (!data) { this.el.roundEnd.classList.add('hidden'); return; }
    this.el.roundEnd.classList.remove('hidden');
    this.el.reTitle.textContent = data.title;
    this.el.reTitle.className = data.won ? 'win' : 'lose';
    this.el.reReason.textContent = data.reason;
    this.el.reRows.innerHTML = data.rows.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');
    this.el.reNext.textContent = data.next;
    this.el.btnNewMatch.classList.toggle('hidden', !data.matchOver);
  }

  setNext(text) { this.el.reNext.textContent = text; }
}
