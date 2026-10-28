// Progresso salvo no navegador: recorde, carteira de corações, garagem e som.

import { CARS, UPGRADES, UpgradeId } from "./cars";

export interface RunRecord {
  score: number;
  stage: number;
  stageName: string;
  car: string;
  date: number;
}

export interface Progress {
  best: number;
  hearts: number;
  owned: string[];
  car: string;
  upgrades: Record<UpgradeId, number>;
  muted: boolean;
  runs: RunRecord[]; // as 10 melhores corridas
  musicVol: number;
  sfxVol: number;
  crt: boolean;
}

export const MAX_RUNS = 10;

const KEY = "corrida-999-progress-v1";
// Chaves da primeira versão do jogo, migradas na primeira leitura.
const LEGACY_BEST_KEY = "corrida-999-best";
const LEGACY_MUTED_KEY = "corrida-999-muted";

function fresh(): Progress {
  return {
    best: 0,
    hearts: 0,
    owned: [CARS[0].id],
    car: CARS[0].id,
    upgrades: { motor: 0, pneus: 0, turbo: 0 },
    muted: false,
    runs: [],
    musicVol: 0.8,
    sfxVol: 0.9,
    crt: true,
  };
}

export function loadProgress(): Progress {
  const p = fresh();
  if (typeof window === "undefined") return p;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Progress>;
      Object.assign(p, saved, { upgrades: { ...p.upgrades, ...saved.upgrades } });
    } else {
      p.best = Number(window.localStorage.getItem(LEGACY_BEST_KEY)) || 0;
      p.muted = window.localStorage.getItem(LEGACY_MUTED_KEY) === "1";
    }
  } catch {
    // localStorage indisponível ou corrompido — começa do zero
  }
  if (!p.owned.includes(CARS[0].id)) p.owned.push(CARS[0].id);
  if (!p.owned.includes(p.car)) p.car = CARS[0].id;
  for (const u of UPGRADES) p.upgrades[u.id] = Math.max(0, Math.min(u.prices.length, p.upgrades[u.id] | 0));
  if (!Array.isArray(p.runs)) p.runs = [];
  p.musicVol = Math.max(0, Math.min(1, Number(p.musicVol)));
  p.sfxVol = Math.max(0, Math.min(1, Number(p.sfxVol)));
  return p;
}

export function saveProgress(p: Progress) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // localStorage indisponível (modo privado, cota cheia) — ignora silenciosamente
  }
}

export function updateProgress(change: (p: Progress) => void): Progress {
  const p = loadProgress();
  change(p);
  saveProgress(p);
  return p;
}

export function buyCar(id: string): Progress | null {
  const car = CARS.find((c) => c.id === id);
  const p = loadProgress();
  if (!car || p.owned.includes(id) || p.hearts < car.price) return null;
  p.hearts -= car.price;
  p.owned.push(id);
  p.car = id;
  saveProgress(p);
  return p;
}

export function buyUpgrade(id: UpgradeId): Progress | null {
  const up = UPGRADES.find((u) => u.id === id);
  const p = loadProgress();
  if (!up) return null;
  const price = up.prices[p.upgrades[id]];
  if (price === undefined || p.hearts < price) return null;
  p.hearts -= price;
  p.upgrades[id]++;
  saveProgress(p);
  return p;
}

export function recordRun(p: Progress, run: RunRecord) {
  p.runs = [...p.runs, run].sort((a, b) => b.score - a.score).slice(0, MAX_RUNS);
}
