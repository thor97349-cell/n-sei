import { GameState } from "./types";

const STORAGE_KEY = "nexus-vertice-save-v1";

export function loadGame(): GameState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GameState;
  } catch {
    return null;
  }
}

export function saveGame(state: GameState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage indisponível (modo privado, cota cheia) — ignora silenciosamente
  }
}

export function clearGame() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignora
  }
}
