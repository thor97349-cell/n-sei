const STREAK_KEY = "nexus-vertice-streak-v1";

export interface StreakData {
  lastPlayedDate: string | null; // YYYY-MM-DD
  streakDays: number;
  longestStreak: number;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysBetween(a: string, b: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / msPerDay);
}

export function getStreak(): StreakData {
  if (typeof window === "undefined") return { lastPlayedDate: null, streakDays: 0, longestStreak: 0 };
  try {
    const raw = window.localStorage.getItem(STREAK_KEY);
    if (!raw) return { lastPlayedDate: null, streakDays: 0, longestStreak: 0 };
    return JSON.parse(raw) as StreakData;
  } catch {
    return { lastPlayedDate: null, streakDays: 0, longestStreak: 0 };
  }
}

function writeStreak(data: StreakData) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STREAK_KEY, JSON.stringify(data));
  } catch {
    // ignora
  }
}

export const DAILY_BONUS_XP = 15;

// Chamado quando o jogador toma uma ação real (avança um mês). Retorna se um novo
// dia de sequência foi registrado agora (para dar o bônus uma única vez por dia).
export function registerPlaySession(): { streak: StreakData; isNewDay: boolean } {
  const today = todayKey();
  const current = getStreak();

  if (current.lastPlayedDate === today) {
    return { streak: current, isNewDay: false };
  }

  const consecutive = current.lastPlayedDate !== null && daysBetween(current.lastPlayedDate, today) === 1;
  const streakDays = consecutive ? current.streakDays + 1 : 1;
  const next: StreakData = {
    lastPlayedDate: today,
    streakDays,
    longestStreak: Math.max(current.longestStreak, streakDays),
  };
  writeStreak(next);
  return { streak: next, isNewDay: true };
}
