import { MAX_LOG_ENTRIES } from "../constants";
import type { GameState, LogEntry, TipoLog } from "../types";

export function clamp(valor: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valor));
}

let contadorId = 0;
export function gerarId(): string {
  contadorId += 1;
  return `${Date.now().toString(36)}-${contadorId}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export function criarLogEntry(
  mensagem: string,
  tipo: TipoLog,
  timestamp: number,
): LogEntry {
  return { id: gerarId(), mensagem, tipo, timestamp };
}

export function adicionarLog(
  state: GameState,
  mensagem: string,
  tipo: TipoLog,
  timestamp: number,
): GameState {
  const registro = [criarLogEntry(mensagem, tipo, timestamp), ...state.registro].slice(
    0,
    MAX_LOG_ENTRIES,
  );
  return { ...state, registro };
}
