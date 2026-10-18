import { migrateState } from "./engine";
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
  endings: string[]; // finais já descobertos
}

export const EMPTY_RECORDS: Records = { bestScore: 0, games: 0, wins: 0, achievements: [], endings: [] };

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
  const raw = read<GameState>(SAVE_KEY);
  // Saves de versões antigas são atualizados; os incompatíveis são descartados.
  const s = raw ? migrateState(raw) : null;
  if (!s || s.phase === "ended") return null;
  return s;
}

export function saveGame(s: GameState | null) {
  write(SAVE_KEY, s && s.phase !== "ended" ? s : null);
}

export function loadRecords(): Records {
  return { ...EMPTY_RECORDS, ...(read<Records>(RECORDS_KEY) ?? {}) };
}

// Registra o fim de uma partida. Devolve as conquistas desbloqueadas pela
// primeira vez e se o final alcançado é inédito.
export function recordEnding(s: GameState): { records: Records; newAchievements: string[]; newEnding: boolean } {
  const records = loadRecords();
  const ending = s.ending;
  if (!ending) return { records, newAchievements: [], newEnding: false };
  const newAchievements = ending.achievements.filter((a) => !records.achievements.includes(a));
  const newEnding = !records.endings.includes(ending.endingId);
  const next: Records = {
    bestScore: Math.max(records.bestScore, ending.score),
    games: records.games + 1,
    wins: records.wins + (ending.kind === "reeleito" ? 1 : 0),
    achievements: [...records.achievements, ...newAchievements],
    endings: newEnding ? [...records.endings, ending.endingId] : records.endings,
  };
  write(RECORDS_KEY, next);
  return { records: next, newAchievements, newEnding };
}

export function loadMuted(): boolean {
  return read<boolean>(MUTE_KEY) ?? false;
}

export function saveMuted(muted: boolean) {
  write(MUTE_KEY, muted);
}
