import { STATE_VERSION } from "./engine";
import { GameState } from "./types";

// Tudo fica só no navegador de quem joga. Qualquer erro (modo privado, cota
// cheia, armazenamento bloqueado) é ignorado: o jogo funciona sem salvar.
const SAVE_KEY = "sindico-save";
const RECORDS_KEY = "sindico-records";
const MUTE_KEY = "sindico-mute";

export interface Records {
  bestScore: number;
  games: number;
  wins: number;
  achievements: string[];
}

const EMPTY_RECORDS: Records = { bestScore: 0, games: 0, wins: 0, achievements: [] };

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sem armazenamento: segue sem salvar
  }
}

export function loadGame(): GameState | null {
  const s = read<GameState>(SAVE_KEY);
  // Save de uma versão antiga do jogo não é compatível: descarta.
  if (!s || s.version !== STATE_VERSION || s.phase === "ended") return null;
  return s;
}

export function saveGame(s: GameState | null) {
  write(SAVE_KEY, s && s.phase !== "ended" ? s : null);
}

export function loadRecords(): Records {
  return { ...EMPTY_RECORDS, ...(read<Records>(RECORDS_KEY) ?? {}) };
}

// Registra o fim de uma partida. Devolve as conquistas desbloqueadas pela primeira vez.
export function recordEnding(s: GameState): { records: Records; newAchievements: string[] } {
  const records = loadRecords();
  const ending = s.ending;
  if (!ending) return { records, newAchievements: [] };
  const newAchievements = ending.achievements.filter((a) => !records.achievements.includes(a));
  const next: Records = {
    bestScore: Math.max(records.bestScore, ending.score),
    games: records.games + 1,
    wins: records.wins + (ending.kind === "reeleito" ? 1 : 0),
    achievements: [...records.achievements, ...newAchievements],
  };
  write(RECORDS_KEY, next);
  return { records: next, newAchievements };
}

export function loadMuted(): boolean {
  return read<boolean>(MUTE_KEY) ?? false;
}

export function saveMuted(muted: boolean) {
  write(MUTE_KEY, muted);
}
