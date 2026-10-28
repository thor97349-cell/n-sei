// As etapas seguem músicas do Death Race for Love: cada checkpoint é a próxima
// faixa, com clima, cenário e trilha próprios. Depois da nona, a estrada fica
// dourada pra sempre: Legends Never Die.

import { GOLD, Palette } from "./draw";

export interface Stage {
  name: string;
  palette: Palette;
  rain: number; // 0..1
  fog: number; // densidade da neblina
  lake?: boolean;
  train?: boolean;
  eyes?: boolean;
  lightning?: boolean;
  sirens?: boolean;
  butterflies?: boolean;
  heartValue: number;
  billboards: string[];
  music: number;
}

const p = (
  skyTop: string,
  skyMid: string,
  horizon: string,
  fog: string,
  ground: [string, string],
  road: [string, string],
  rumble: [string, string],
  lane: string,
  water: string,
): Palette => ({ skyTop, skyMid, horizon, fog, ground, road, rumble, lane, water });

export const STAGES: Stage[] = [
  {
    name: "EMPTY",
    palette: p(
      "#03020a",
      "#140a2a",
      "#4a1046",
      "#24103a",
      ["#0a0613", "#0d0818"],
      ["#17121f", "#1b1525"],
      ["#ff2d55", "#efe6ff"],
      "#bba6ff",
      "#0c0a24",
    ),
    rain: 0,
    fog: 5,
    heartValue: 1,
    billboards: ["999", "EMPTY", "♥ 24H", "MOTEL", "OPEN", "WRLD", "NO VACANCY"],
    music: 0,
  },
  {
    name: "MAZE",
    palette: p(
      "#02030c",
      "#0c1030",
      "#2a2a6a",
      "#1a1c40",
      ["#070914", "#090b18"],
      ["#12141f", "#151826"],
      ["#3df2ff", "#e6f0ff"],
      "#9fb4ff",
      "#0a1030",
    ),
    rain: 1,
    fog: 6,
    heartValue: 1,
    billboards: ["MAZE", "999", "EXIT?", "♥", "WRLD", "LOST"],
    music: 1,
  },
  {
    name: "HEMOTIONS",
    palette: p(
      "#07020c",
      "#2a0a30",
      "#8a1a6a",
      "#3a1040",
      ["#10061a", "#13081e"],
      ["#1a1020", "#1f1326"],
      ["#ff2d95", "#ffe0f2"],
      "#ff9ad5",
      "#200a28",
    ),
    rain: 0,
    fog: 5,
    train: true,
    heartValue: 1,
    billboards: ["HEMOTIONS", "♥", "999", "CTA", "WRLD", "FEELINGS"],
    music: 0,
  },
  {
    name: "DEMONZ",
    palette: p(
      "#000000",
      "#12020a",
      "#3a0612",
      "#1a0408",
      ["#070204", "#090305"],
      ["#120a0c", "#150c0f"],
      ["#8a0a1e", "#3a2a2e"],
      "#6a2a34",
      "#100206",
    ),
    rain: 0,
    fog: 10,
    eyes: true,
    heartValue: 1,
    billboards: ["DEMONZ", "RUN", "999", "DON'T LOOK BACK", "♥"],
    music: 2,
  },
  {
    name: "FAST",
    palette: p(
      "#01040c",
      "#06163a",
      "#1a4a7a",
      "#0e2a4a",
      ["#050a14", "#060c18"],
      ["#10141c", "#131822"],
      ["#20d6ff", "#f0faff"],
      "#a6e4ff",
      "#061a3a",
    ),
    rain: 0,
    fog: 4,
    lake: true,
    heartValue: 1,
    billboards: ["FAST", "LAKE SHORE DR", "999", "CHI", "WRLD"],
    music: 1,
  },
  {
    name: "HEAR ME CALLING",
    palette: p(
      "#020208",
      "#0e0a24",
      "#3a2a5a",
      "#1c1832",
      ["#06060e", "#080812"],
      ["#111018", "#14131c"],
      ["#b26bff", "#ece0ff"],
      "#c9b8ff",
      "#0a0a1e",
    ),
    rain: 1,
    fog: 6,
    lightning: true,
    heartValue: 1,
    billboards: ["HEAR ME CALLING", "999", "♥", "WRLD", "CALL ME"],
    music: 2,
  },
  {
    name: "ROBBERY",
    palette: p(
      "#050003",
      "#1e040c",
      "#6a0a1a",
      "#2a0610",
      ["#0c0306", "#0f0408"],
      ["#170b0f", "#1b0d12"],
      ["#ff2d55", "#ffe6ea"],
      "#ffb3c0",
      "#1a0408",
    ),
    rain: 0,
    fog: 5,
    sirens: true,
    train: true,
    heartValue: 1,
    billboards: ["ROBBERY", "$$$", "999", "♥ STOLEN", "WRLD"],
    music: 2,
  },
  {
    name: "WHO SHOT CUPID?",
    palette: p(
      "#12030f",
      "#3a0a32",
      "#c2366e",
      "#4a1238",
      ["#16071a", "#1a081e"],
      ["#21111f", "#261424"],
      ["#ff6ab0", "#fff0f8"],
      "#ffc2e0",
      "#2a0a28",
    ),
    rain: 0,
    fog: 5,
    heartValue: 2,
    billboards: ["WHO SHOT CUPID?", "♥", "♥♥♥", "999", "LOVE"],
    music: 3,
  },
  {
    name: "ON GOD",
    palette: p(
      "#0a0a2a",
      "#4a2a6a",
      "#ff8a5a",
      "#6a3a5a",
      ["#120a18", "#150c1c"],
      ["#1c1420", "#201724"],
      ["#ffd166", "#fff4e0"],
      "#ffe0b0",
      "#2a1a3a",
    ),
    rain: 0,
    fog: 4,
    lake: true,
    heartValue: 1,
    billboards: ["ON GOD", "999", "SUNRISE", "WRLD", "♥"],
    music: 3,
  },
];

export const LEGENDS: Stage = {
  name: "LEGENDS NEVER DIE",
  palette: GOLD,
  rain: 0,
  fog: 4,
  butterflies: true,
  heartValue: 2,
  billboards: ["LEGENDS NEVER DIE", "999", "♥", "WRLD", "JUICE WRLD"],
  music: 3,
};

export function stageAt(n: number): Stage {
  return n >= 1 && n <= STAGES.length ? STAGES[n - 1] : LEGENDS;
}
