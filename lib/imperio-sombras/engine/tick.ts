import {
  CRISE_LIMITE_RISCO,
  CRISE_PERDA_CONTROLE,
  CRISE_PERDA_DINHEIRO_PCT,
  CRISE_RISCO_POS_CRISE,
  LIMITE_DIVIDA_COBRANCA,
  MULTIPLICADOR_RISCO_SOBRE_LIMITE,
  REPUTACAO_GANHO_POR_TICK_BASE,
} from "../constants";
import { DISTRITOS } from "../data/distritos";
import type { GameState } from "../types";
import {
  getConfigDificuldade,
  getGeracaoSegurancaPorTick,
  getJurosDividaPorSegundo,
  getReducaoRiscoFracao,
  rendaEfetivaDistrito,
} from "./selectors";
import { adicionarLog, clamp } from "./utils";

export interface ResultadoTick {
  estado: GameState;
  dinheiroGanho: number;
  influenciaGanha: number;
  criseOcorreu: boolean;
}

/**
 * Avança a simulação do estado até `agora`, aplicando renda, crescimento de
 * risco e crises. Não mexe em eventos — isso é responsabilidade do reducer
 * (tempo real) ou é deliberadamente ignorado (progresso offline).
 */
export function simularTick(
  state: GameState,
  agora: number,
  opcoes: { silencioso?: boolean } = {},
): ResultadoTick {
  const deltaMs = Math.max(0, agora - state.ultimaAtualizacao);
  // A velocidade do jogo acelera a simulação econômica (renda, risco,
  // reputação, juros), mas não os relógios reais de eventos/cronômetros.
  const deltaSeg = (deltaMs / 1000) * state.velocidade;

  if (deltaSeg <= 0) {
    return {
      estado: { ...state, ultimaAtualizacao: agora },
      dinheiroGanho: 0,
      influenciaGanha: 0,
      criseOcorreu: false,
    };
  }

  const dificuldade = getConfigDificuldade(state);
  const recursos = { ...state.recursos };
  const distritos = { ...state.distritos };
  const reducaoRiscoFracao = getReducaoRiscoFracao(state);
  const geracaoSeguranca = getGeracaoSegurancaPorTick(state);
  const multiplicadorRiscoCobranca =
    state.divida > LIMITE_DIVIDA_COBRANCA ? MULTIPLICADOR_RISCO_SOBRE_LIMITE : 1;

  recursos.seguranca += geracaoSeguranca * deltaSeg;

  let divida = state.divida;
  if (divida > 0) {
    divida += getJurosDividaPorSegundo(state) * deltaSeg;
  }

  let dinheiroGanho = 0;
  let influenciaGanha = 0;
  let criseOcorreu = false;
  let somaControle = 0;
  let countDesbloqueados = 0;

  let novoEstado: GameState = state;

  for (const distritoDef of DISTRITOS) {
    const dState = distritos[distritoDef.id];
    if (!dState || !dState.desbloqueado) continue;

    countDesbloqueados += 1;
    somaControle += dState.nivelControle;

    const renda = rendaEfetivaDistrito(distritoDef, dState, state);
    const ganhoDinheiro = renda.dinheiro * deltaSeg;
    const ganhoInfluencia = renda.influencia * deltaSeg;
    recursos.dinheiro += ganhoDinheiro;
    recursos.influencia += ganhoInfluencia;
    dinheiroGanho += ganhoDinheiro;
    influenciaGanha += ganhoInfluencia;

    const crescimentoRisco =
      distritoDef.riscoCrescimentoBase *
      (dState.nivelControle / 100) *
      (1 - reducaoRiscoFracao) *
      dificuldade.multiplicadorRisco *
      multiplicadorRiscoCobranca;
    let novoRisco = dState.risco + crescimentoRisco * deltaSeg;
    let novoControle = dState.nivelControle;

    if (novoRisco >= CRISE_LIMITE_RISCO) {
      criseOcorreu = true;
      novoControle = clamp(novoControle - CRISE_PERDA_CONTROLE, 0, 100);
      recursos.dinheiro = Math.max(
        0,
        recursos.dinheiro - recursos.dinheiro * CRISE_PERDA_DINHEIRO_PCT,
      );
      novoRisco = CRISE_RISCO_POS_CRISE;

      if (!opcoes.silencioso) {
        novoEstado = adicionarLog(
          novoEstado,
          `${distritoDef.icone} ${distritoDef.nome} entrou em crise: a polícia avançou. Vocês perderam controle e parte do caixa.`,
          "negativo",
          agora,
        );
      }
    }

    distritos[distritoDef.id] = {
      ...dState,
      risco: clamp(novoRisco, 0, 100),
      nivelControle: clamp(novoControle, 0, 100),
    };
  }

  if (countDesbloqueados > 0) {
    const controleMedio = somaControle / countDesbloqueados;
    recursos.reputacao +=
      REPUTACAO_GANHO_POR_TICK_BASE * controleMedio * deltaSeg;
  }

  novoEstado = {
    ...novoEstado,
    ultimaAtualizacao: agora,
    recursos,
    distritos,
    divida,
    estatisticas: {
      ...novoEstado.estatisticas,
      totalDinheiroGanho: novoEstado.estatisticas.totalDinheiroGanho + dinheiroGanho,
      tempoJogadoMs: novoEstado.estatisticas.tempoJogadoMs + deltaMs,
    },
  };

  return { estado: novoEstado, dinheiroGanho, influenciaGanha, criseOcorreu };
}
