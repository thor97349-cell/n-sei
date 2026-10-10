// Small procedural canvas textures (grayscale detail, tinted by material color).
import * as THREE from 'three';

const cache = new Map();

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function noise(ctx, size, amount, r) {
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * amount;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

const painters = {
  noise(ctx, s, r) { ctx.fillStyle = '#d8d8d8'; ctx.fillRect(0, 0, s, s); noise(ctx, s, 40, r); },
  concrete(ctx, s, r) {
    ctx.fillStyle = '#d0d0d0'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(0,0,0,${r() * 0.06})`; ctx.fillRect(r() * s, r() * s, 6 + r() * 30, 4 + r() * 20); }
    noise(ctx, s, 34, r);
    ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, s - 2, s - 2);
  },
  panel(ctx, s, r) {
    ctx.fillStyle = '#d4d4d4'; ctx.fillRect(0, 0, s, s); noise(ctx, s, 18, r);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, s - 2, s / 2 - 2); ctx.strokeRect(1, s / 2 + 1, s - 2, s / 2 - 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (const [x, y] of [[6, 6], [s - 8, 6], [6, s / 2 + 6], [s - 8, s / 2 + 6]]) ctx.fillRect(x, y, 3, 3);
  },
  brick(ctx, s, r) {
    ctx.fillStyle = '#9a9a9a'; ctx.fillRect(0, 0, s, s);
    const bh = s / 8, bw = s / 4;
    for (let y = 0; y < 8; y++) for (let x = -1; x < 5; x++) {
      const off = y % 2 ? bw / 2 : 0; const v = 190 + r() * 50;
      ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(x * bw + off + 1, y * bh + 1, bw - 3, bh - 3);
    }
    noise(ctx, s, 26, r);
  },
  plank(ctx, s, r) {
    ctx.fillStyle = '#c8c8c8'; ctx.fillRect(0, 0, s, s);
    const n = 5;
    for (let i = 0; i < n; i++) {
      const v = 175 + r() * 60; ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(0, (i * s) / n + 1, s, s / n - 3);
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      for (let k = 0; k < 4; k++) { ctx.beginPath(); const y = (i * s) / n + 4 + r() * (s / n - 8); ctx.moveTo(0, y); ctx.lineTo(s, y + (r() - 0.5) * 4); ctx.stroke(); }
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3; ctx.strokeRect(2, 2, s - 4, s - 4);
    noise(ctx, s, 20, r);
  },
  tile(ctx, s, r) {
    ctx.fillStyle = '#e0e0e0'; ctx.fillRect(0, 0, s, s); noise(ctx, s, 14, r);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo((i * s) / 4, 0); ctx.lineTo((i * s) / 4, s); ctx.moveTo(0, (i * s) / 4); ctx.lineTo(s, (i * s) / 4); ctx.stroke(); }
  },
  grate(ctx, s, r) {
    ctx.fillStyle = '#5a5a5a'; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#c0c0c0';
    for (let i = 0; i < 16; i++) { ctx.fillRect(0, i * 8, s, 3); ctx.fillRect(i * 8, 0, 2, s); }
    noise(ctx, s, 24, r);
  },
  rib(ctx, s, r) {
    ctx.fillStyle = '#c8c8c8'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 8; i++) { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(i * 16, 0, 4, s); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(i * 16 + 4, 0, 3, s); }
    noise(ctx, s, 22, r);
  },
  stripe(ctx, s, r) {
    ctx.fillStyle = '#d6d6d6'; ctx.fillRect(0, 0, s, s); noise(ctx, s, 24, r);
    ctx.fillStyle = '#e8b830';
    for (let i = -2; i < 6; i++) { ctx.beginPath(); ctx.moveTo(i * 32, s * 0.7); ctx.lineTo(i * 32 + 16, s * 0.7); ctx.lineTo(i * 32 + 32, s); ctx.lineTo(i * 32 + 16, s); ctx.fill(); }
  },
  rack(ctx, s, r) {
    ctx.fillStyle = '#3a3a3a'; ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < 16; y++) {
      ctx.fillStyle = y % 2 ? '#2a2a2a' : '#474747'; ctx.fillRect(4, y * 8 + 1, s - 8, 6);
      if (r() > 0.4) { ctx.fillStyle = r() > 0.8 ? '#ff9d2e' : '#4dd6ff'; ctx.fillRect(10 + r() * 20, y * 8 + 3, 3, 2); }
      if (r() > 0.6) { ctx.fillStyle = '#5dff8a'; ctx.fillRect(70 + r() * 40, y * 8 + 3, 2, 2); }
    }
  },
  carpet(ctx, s, r) { ctx.fillStyle = '#b8b8b8'; ctx.fillRect(0, 0, s, s); noise(ctx, s, 46, r); },
  asphalt(ctx, s, r) {
    ctx.fillStyle = '#a0a0a0'; ctx.fillRect(0, 0, s, s); noise(ctx, s, 60, r);
    for (let i = 0; i < 6; i++) { ctx.strokeStyle = `rgba(0,0,0,${0.1 + r() * 0.15})`; ctx.beginPath(); let x = r() * s, y = r() * s; ctx.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 30; y += (r() - 0.5) * 30; ctx.lineTo(x, y); } ctx.stroke(); }
  },
  windows(ctx, s, r) {
    ctx.fillStyle = '#c8c8c8'; ctx.fillRect(0, 0, s, s); noise(ctx, s, 22, r);
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      const lit = r() > 0.7; ctx.fillStyle = lit ? '#e6d9a8' : '#3d4a56';
      ctx.fillRect(x * 64 + 14, y * 64 + 12, 36, 40);
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x * 64 + 31, y * 64 + 12, 2, 40);
    }
  },
};

export function getTexture(kind, seed = 1) {
  const key = kind + seed;
  if (cache.has(key)) return cache.get(key);
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  (painters[kind] || painters.noise)(ctx, size, rng(seed * 977 + kind.length * 31));
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 2;
  cache.set(key, t);
  return t;
}

export function makeLabelTexture(text, { bg = '#1b1f24', fg = '#e8e3d6', accent = '#e8a33a', w = 512, h = 128 } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = accent; ctx.fillRect(0, 0, 14, h);
  ctx.fillStyle = fg;
  ctx.font = `700 ${Math.floor(h * 0.42)}px "Segoe UI", Roboto, Arial, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 36, h / 2 + 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
