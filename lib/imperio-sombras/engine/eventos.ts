import {
  EVENTO_MAX_INTERVALO_MS,
  EVENTO_MIN_INTERVALO_MS,
} from "../constants";
import { EVENTOS } from "../data/eventos";
import type { EventoAtivo, EventoDef, GameState } from "../types";
import { distritosDesbloqueadosIds } from "./selectors";

export function proximoIntervaloEvento(): number {
  return (
    EVENTO_MIN_INTERVALO_MS +
    Math.random() * (EVENTO_MAX_INTERVALO_MS - EVENTO_MIN_INTERVALO_MS)
  );
}

function sortearPonderado<T extends { peso: number }>(itens: T[]): T {
  const pesoTotal = itens.reduce((acc, i) => acc + i.peso, 0);
  let alvo = Math.random() * pesoTotal;
  for (const item of itens) {
    alvo -= item.peso;
    if (alvo <= 0) return item;
  }
  return itens[itens.length - 1];
}

export function sortearEvento(
  state: GameState,
  agora: number,
): { def: EventoDef; ativo: EventoAtivo } | null {
  const distritosDesbloqueados = distritosDesbloqueadosIds(state);
  if (distritosDesbloqueados.length === 0) return null;

  const candidatos = EVENTOS.filter((e) => {
    if (e.escopo === "distrito") return distritosDesbloqueados.length > 0;
    return true;
  });
  if (candidatos.length === 0) return null;

  const def = sortearPonderado(candidatos);
  const distritoId =
    def.escopo === "distrito"
      ? distritosDesbloqueados[
          Math.floor(Math.random() * distritosDesbloqueados.length)
        ]
      : undefined;

  return {
    def,
    ativo: {
      eventoId: def.id,
      distritoId,
      criadoEm: agora,
      expiraEm: agora + def.duracaoMs,
    },
  };
}
