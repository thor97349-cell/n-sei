// Carros da garagem e upgrades. Os nomes vêm de músicas do Juice WRLD.

export type UpgradeId = "motor" | "pneus" | "turbo";

export interface CarStats {
  speed: number; // multiplicador da velocidade máxima
  accel: number;
  grip: number; // resiste à força das curvas e segura a derrapagem
  turbo: number; // carga do drift e força do turbo
}

export interface CarDef {
  id: string;
  name: string;
  tagline: string;
  price: number;
  color: string;
  accent: string;
  plate: string;
  spoiler: boolean;
  stripes: boolean;
  stats: CarStats;
}

export const CARS: CarDef[] = [
  {
    id: "lucid",
    name: "LUCID",
    tagline: "O primeiro carro. Equilibrado em tudo.",
    price: 0,
    color: "#7b2cff",
    accent: "#3df2ff",
    plate: "999",
    spoiler: false,
    stripes: false,
    stats: { speed: 1, accel: 1, grip: 1, turbo: 1 },
  },
  {
    id: "bandit",
    name: "BANDIT",
    tagline: "Gruda no chão. Feito pra curva fechada.",
    price: 250,
    color: "#ffcc1a",
    accent: "#111018",
    plate: "B4NDIT",
    spoiler: false,
    stripes: true,
    stats: { speed: 1, accel: 1.1, grip: 1.3, turbo: 0.95 },
  },
  {
    id: "robbery",
    name: "ROBBERY",
    tagline: "Carrega o drift rápido e solta um turbo absurdo.",
    price: 500,
    color: "#e0123a",
    accent: "#ffd166",
    plate: "$$$",
    spoiler: true,
    stripes: false,
    stats: { speed: 1.03, accel: 1.05, grip: 0.95, turbo: 1.4 },
  },
  {
    id: "fast",
    name: "FAST",
    tagline: "O mais rápido em reta. Pede mão leve na curva.",
    price: 750,
    color: "#20d6ff",
    accent: "#ffffff",
    plate: "FAST",
    spoiler: true,
    stripes: true,
    stats: { speed: 1.12, accel: 1.08, grip: 0.9, turbo: 1.1 },
  },
  {
    id: "wrld",
    name: "WRLD",
    tagline: "999 corações. Transforma o negativo em positivo.",
    price: 999,
    color: "#1a1424",
    accent: "#ffd166",
    plate: "WRLD",
    spoiler: true,
    stripes: true,
    stats: { speed: 1.1, accel: 1.12, grip: 1.15, turbo: 1.25 },
  },
];

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  effect: string;
  prices: number[];
}

export const UPGRADES: UpgradeDef[] = [
  { id: "motor", name: "Motor", effect: "+3% de velocidade máxima e aceleração", prices: [40, 90, 160, 250, 360] },
  { id: "pneus", name: "Pneus", effect: "+8% de aderência nas curvas", prices: [40, 90, 160, 250, 360] },
  { id: "turbo", name: "Turbo", effect: "+10% de carga do drift e turbo", prices: [50, 110, 190, 290, 400] },
];

export function carById(id: string): CarDef {
  return CARS.find((c) => c.id === id) ?? CARS[0];
}

export function effectiveStats(car: CarDef, upgrades: Record<UpgradeId, number>): CarStats {
  return {
    speed: car.stats.speed * (1 + 0.03 * upgrades.motor),
    accel: car.stats.accel * (1 + 0.03 * upgrades.motor),
    grip: car.stats.grip * (1 + 0.08 * upgrades.pneus),
    turbo: car.stats.turbo * (1 + 0.1 * upgrades.turbo),
  };
}
