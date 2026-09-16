import { OFFLINE_MAX_MS, SAVE_KEY, VERSAO_ESTADO } from "../constants";
import type { GameState, RelatorioOffline } from "../types";
import { criarEstadoInicial } from "./reducer";
import { simularTick } from "./tick";

const PASSO_OFFLINE_MS = 60_000;
const LIMIAR_RELATORIO_OFFLINE_MS = 60_000;

export function salvarEstado(state: GameState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // localStorage indisponível (modo privado, quota excedida, etc.) — ignora.
  }
}

function lerEstadoBruto(): GameState | null {
  if (typeof window === "undefined") return null;
  try {
    const bruto = window.localStorage.getItem(SAVE_KEY);
    if (!bruto) return null;
    const estado = JSON.parse(bruto) as GameState;
    if (estado.versao !== VERSAO_ESTADO) return null;
    return estado;
  } catch {
    return null;
  }
}

function simularProgressoOffline(
  estadoSalvo: GameState,
  agora: number,
): { estado: GameState; relatorio: RelatorioOffline | null } {
  const decorridoTotal = agora - estadoSalvo.ultimaAtualizacao;
  if (decorridoTotal < LIMIAR_RELATORIO_OFFLINE_MS) {
    return { estado: { ...estadoSalvo, ultimaAtualizacao: agora }, relatorio: null };
  }

  const decorridoLimitado = Math.min(decorridoTotal, OFFLINE_MAX_MS);
  const alvo = estadoSalvo.ultimaAtualizacao + decorridoLimitado;

  let estado = estadoSalvo;
  let dinheiroGanho = 0;
  let influenciaGanha = 0;
  let criseOcorreu = false;

  while (estado.ultimaAtualizacao < alvo) {
    const proximo = Math.min(estado.ultimaAtualizacao + PASSO_OFFLINE_MS, alvo);
    const resultado = simularTick(estado, proximo, { silencioso: true });
    estado = resultado.estado;
    dinheiroGanho += resultado.dinheiroGanho;
    influenciaGanha += resultado.influenciaGanha;
    criseOcorreu = criseOcorreu || resultado.criseOcorreu;
  }

  estado = { ...estado, ultimaAtualizacao: agora };

  return {
    estado,
    relatorio: {
      duracaoMs: decorridoLimitado,
      dinheiroGanho,
      influenciaGanha,
      criseOcorreu,
    },
  };
}

export function carregarEstadoInicial(): GameState {
  const salvo = lerEstadoBruto();
  if (!salvo) return criarEstadoInicial();

  const agora = Date.now();
  const { estado, relatorio } = simularProgressoOffline(salvo, agora);
  return { ...estado, relatorioOffline: relatorio };
}
