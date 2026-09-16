import { GameState } from "./types";

const SAVES_KEY = "nexus-vertice-saves-v2";
const ACTIVE_KEY = "nexus-vertice-active-v2";

type SaveMap = Record<string, GameState>;

function readSaves(): SaveMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SAVES_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as SaveMap;
  } catch {
    return {};
  }
}

function writeSaves(saves: SaveMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
  } catch {
    // localStorage indisponível (modo privado, cota cheia) — ignora silenciosamente
  }
}

export function listSaves(): GameState[] {
  return Object.values(readSaves()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadSave(id: string): GameState | null {
  return readSaves()[id] ?? null;
}

export function saveGame(state: GameState) {
  const saves = readSaves();
  saves[state.id] = state;
  writeSaves(saves);
}

export function deleteSave(id: string) {
  const saves = readSaves();
  delete saves[id];
  writeSaves(saves);
  if (getActiveId() === id) setActiveId(null);
}

export function getActiveId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function setActiveId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(ACTIVE_KEY, id);
    else window.localStorage.removeItem(ACTIVE_KEY);
  } catch {
    // ignora
  }
}

export function loadActiveGame(): GameState | null {
  const id = getActiveId();
  if (!id) return null;
  return loadSave(id);
}
