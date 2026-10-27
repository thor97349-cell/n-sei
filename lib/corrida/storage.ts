const BEST_KEY = "corrida-999-best";
const MUTED_KEY = "corrida-999-muted";

export function loadBest(): number {
  if (typeof window === "undefined") return 0;
  try {
    return Number(window.localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function saveBest(score: number) {
  try {
    window.localStorage.setItem(BEST_KEY, String(Math.floor(score)));
  } catch {
    // localStorage indisponível (modo privado, cota cheia) — ignora silenciosamente
  }
}

export function loadMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveMuted(muted: boolean) {
  try {
    window.localStorage.setItem(MUTED_KEY, muted ? "1" : "0");
  } catch {
    // idem
  }
}
