// O que o motor do jogo entrega pra quem desenha a corrida em 3D. Fica num
// arquivo à parte pra o motor não depender da biblioteca 3D.

import { CarDef } from "./cars";
import { Palette } from "./draw";
import { Stage } from "./stages";
import { Segment } from "./track";

export interface RaceView {
  segments: Segment[];
  trackLength: number;
  position: number;
  playerX: number;
  playerZ: number;
  speedPercent: number;
  t: number;
  lap: number;
  collected: Set<number>;
  stage: Stage;
  palette: Palette;
  nine: boolean;
  fogDensity: number;
  car: CarDef;
  carColor: string;
  drifting: boolean;
  driftDir: number;
  boostTime: number;
  steer: number;
  braking: boolean;
  hidden: boolean;
  shake: number;
  lightning: number;
  skyOffset: number;
  cityOffset: number;
  spriteVisible: (kind: string, offset: number) => boolean;
}

// Posição do carro do jogador na tela (centro da traseira, no chão, e largura),
// em pixels do canvas de HUD: é de onde saem faíscas, fumaça e chamas.
export interface PlayerScreen {
  x: number;
  y: number;
  w: number;
  top: number; // altura do teto na tela, pra posicionar o medidor de drift
}

export interface RaceRenderer {
  resize(width: number, height: number): void;
  render(view: RaceView): PlayerScreen;
  dispose(): void;
}
