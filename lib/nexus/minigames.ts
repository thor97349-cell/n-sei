import { GameState, MiniGamePrompt, PitchMiniGamePrompt } from "./types";

const PITCH_THEMES: Omit<PitchMiniGamePrompt, "type" | "targetCenter" | "targetWidth">[] = [
  { title: "Pitch para investidor", description: "Acerte o tom certo da apresentação — pare o marcador na zona verde." },
  { title: "Negociação com fornecedor", description: "Feche um acordo justo — pare o marcador na zona verde." },
  { title: "Reunião com cliente estratégico", description: "Convença o cliente no momento certo — pare o marcador na zona verde." },
];

export function rollMiniGame(state: GameState): MiniGamePrompt | null {
  if (state.month < 2) return null;
  if (Math.random() > 0.18) return null;

  const theme = PITCH_THEMES[Math.floor(Math.random() * PITCH_THEMES.length)];
  const targetWidth = 16;
  const targetCenter = 20 + Math.random() * 60;
  return { type: "pitch", ...theme, targetCenter, targetWidth };
}
