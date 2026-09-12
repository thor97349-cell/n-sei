import { EVENTO_PAGAR_AUTORIDADE_PCT, EVENTOS_POR_ID } from "../data/eventos";
import { DISTRITOS } from "../data/distritos";
import { UPGRADES, UPGRADES_POR_ID } from "../data/upgrades";
import {
  CUSTO_REFORCO_SEGURANCA,
  INVESTIMENTO_INCREMENTO_CONTROLE,
  RECURSOS_INICIAIS,
  REDUCAO_RISCO_REFORCO,
  VERSAO_ESTADO,
} from "../constants";
import type {
  DistritoState,
  EfeitoResultado,
  EventoDef,
  GameState,
  Recursos,
  RecursoId,
  UpgradeState,
} from "../types";
import {
  custoDesbloqueio,
  custoInvestimento,
  custoUpgrade,
  getDistritoDef,
  getReducaoEventoNegativoFracao,
  podeAfordarCusto,
} from "./selectors";
import { proximoIntervaloEvento, sortearEvento } from "./eventos";
import { simularTick } from "./tick";
import { adicionarLog, clamp } from "./utils";

export type GameAction =
  | { type: "TICK"; agora: number }
  | { type: "INVESTIR_DISTRITO"; distritoId: string }
  | { type: "REFORCAR_SEGURANCA"; distritoId: string }
  | { type: "DESBLOQUEAR_DISTRITO"; distritoId: string }
  | { type: "COMPRAR_UPGRADE"; upgradeId: string }
  | { type: "RESOLVER_EVENTO"; opcaoId: string }
  | { type: "DISPENSAR_RELATORIO_OFFLINE" }
  | { type: "CARREGAR_ESTADO"; estado: GameState }
  | { type: "REINICIAR_JOGO" };

export function criarEstadoInicial(): GameState {
  const agora = Date.now();
  const distritos: Record<string, DistritoState> = {};
  for (const d of DISTRITOS) {
    distritos[d.id] = {
      id: d.id,
      nivelControle: d.controleInicial,
      risco: 5,
      desbloqueado: d.desbloqueadoInicialmente,
    };
  }
  const upgrades: Record<string, UpgradeState> = {};
  for (const u of UPGRADES) {
    upgrades[u.id] = { id: u.id, nivel: 0 };
  }

  let estado: GameState = {
    versao: VERSAO_ESTADO,
    criadoEm: agora,
    ultimaAtualizacao: agora,
    recursos: { ...RECURSOS_INICIAIS },
    distritos,
    upgrades,
    eventoAtivo: null,
    proximoEventoEm: agora + proximoIntervaloEvento(),
    registro: [],
    estatisticas: {
      totalDinheiroGanho: 0,
      tempoJogadoMs: 0,
      eventosResolvidos: 0,
      investimentosFeitos: 0,
    },
    relatorioOffline: null,
  };

  estado = adicionarLog(
    estado,
    "O império nasce nas sombras. Que comece a expansão.",
    "info",
    agora,
  );
  return estado;
}

function deduzirRecursos(recursos: Recursos, custo: Partial<Recursos>): Recursos {
  const novo = { ...recursos };
  for (const [chave, valor] of Object.entries(custo)) {
    novo[chave as RecursoId] = Math.max(0, novo[chave as RecursoId] - (valor ?? 0));
  }
  return novo;
}

function aplicarReducaoNegativa(
  efeito: EfeitoResultado,
  fracao: number,
): EfeitoResultado {
  if (fracao <= 0) return efeito;
  const recursos = efeito.recursos
    ? Object.fromEntries(
        Object.entries(efeito.recursos).map(([k, v]) => [
          k,
          v && v < 0 ? v * (1 - fracao) : v,
        ]),
      )
    : undefined;
  const distrito = efeito.distrito
    ? {
        nivelControle:
          efeito.distrito.nivelControle && efeito.distrito.nivelControle < 0
            ? efeito.distrito.nivelControle * (1 - fracao)
            : efeito.distrito.nivelControle,
        risco:
          efeito.distrito.risco && efeito.distrito.risco > 0
            ? efeito.distrito.risco * (1 - fracao)
            : efeito.distrito.risco,
      }
    : undefined;
  return { ...efeito, recursos, distrito };
}

function resolverEvento(
  state: GameState,
  opcaoIdEscolhida: string,
  agora: number,
  auto: boolean,
): GameState {
  if (!state.eventoAtivo) return state;
  const def: EventoDef | undefined = EVENTOS_POR_ID[state.eventoAtivo.eventoId];
  if (!def) {
    return { ...state, eventoAtivo: null };
  }

  const opcaoPadrao = def.opcoes.find((o) => o.padrao) ?? def.opcoes[0];
  const opcao =
    def.opcoes.find((o) => o.id === opcaoIdEscolhida) ?? opcaoPadrao;

  let custo = opcao.custo ? { ...opcao.custo } : undefined;
  if (def.id === "autoridade-corrupta" && opcao.id === "pagar-autoridade") {
    custo = {
      dinheiro: Math.round(state.recursos.dinheiro * EVENTO_PAGAR_AUTORIDADE_PCT),
    };
  }

  // Se o jogador não pode pagar a opção escolhida, cai para a opção padrão.
  if (custo && !podeAfordarCusto(state.recursos, custo) && opcao.id !== opcaoPadrao.id) {
    return resolverEvento(state, opcaoPadrao.id, agora, auto);
  }

  let recursos = custo ? deduzirRecursos(state.recursos, custo) : { ...state.recursos };

  const sucesso =
    opcao.probabilidadeSucesso === undefined
      ? true
      : Math.random() < opcao.probabilidadeSucesso;

  const efeitoBase = sucesso
    ? opcao.efeitoSucesso
    : opcao.efeitoFalha ?? opcao.efeitoSucesso;
  const efeito = aplicarReducaoNegativa(
    efeitoBase,
    getReducaoEventoNegativoFracao(state),
  );

  if (efeito.recursos) {
    for (const [chave, valor] of Object.entries(efeito.recursos)) {
      const atual = recursos[chave as RecursoId];
      recursos = { ...recursos, [chave]: Math.max(0, atual + (valor ?? 0)) };
    }
  }

  let distritos = state.distritos;
  const distritoId = state.eventoAtivo.distritoId;
  if (efeito.distrito && distritoId && distritos[distritoId]) {
    const dState = distritos[distritoId];
    distritos = {
      ...distritos,
      [distritoId]: {
        ...dState,
        nivelControle: clamp(
          dState.nivelControle + (efeito.distrito.nivelControle ?? 0),
          0,
          100,
        ),
        risco: clamp(dState.risco + (efeito.distrito.risco ?? 0), 0, 100),
      },
    };
  }

  const tipoLog = !sucesso ? "negativo" : "evento";
  const prefixo = auto ? "(sem resposta a tempo) " : "";
  let novoEstado: GameState = {
    ...state,
    recursos,
    distritos,
    eventoAtivo: null,
    proximoEventoEm: agora + proximoIntervaloEvento(),
    estatisticas: {
      ...state.estatisticas,
      eventosResolvidos: state.estatisticas.eventosResolvidos + 1,
    },
  };
  novoEstado = adicionarLog(
    novoEstado,
    `${def.icone} ${def.titulo}: ${prefixo}${efeito.mensagem}`,
    tipoLog,
    agora,
  );
  return novoEstado;
}

function processarEventos(state: GameState, agora: number): GameState {
  let novoEstado = state;

  if (novoEstado.eventoAtivo && agora >= novoEstado.eventoAtivo.expiraEm) {
    const def = EVENTOS_POR_ID[novoEstado.eventoAtivo.eventoId];
    const padrao = def?.opcoes.find((o) => o.padrao) ?? def?.opcoes[0];
    if (padrao) {
      novoEstado = resolverEvento(novoEstado, padrao.id, agora, true);
    } else {
      novoEstado = { ...novoEstado, eventoAtivo: null };
    }
  }

  if (!novoEstado.eventoAtivo && agora >= novoEstado.proximoEventoEm) {
    const sorteio = sortearEvento(novoEstado, agora);
    if (sorteio) {
      const def = sorteio.def;
      novoEstado = adicionarLog(
        {
          ...novoEstado,
          eventoAtivo: sorteio.ativo,
        },
        `${def.icone} Novo evento: ${def.titulo}`,
        "evento",
        agora,
      );
    } else {
      novoEstado = { ...novoEstado, proximoEventoEm: agora + proximoIntervaloEvento() };
    }
  }

  return novoEstado;
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "TICK": {
      const { estado } = simularTick(state, action.agora);
      return processarEventos(estado, action.agora);
    }

    case "INVESTIR_DISTRITO": {
      const def = getDistritoDef(action.distritoId);
      const dState = state.distritos[action.distritoId];
      if (!def || !dState || !dState.desbloqueado || dState.nivelControle >= 100) {
        return state;
      }
      const custo = custoInvestimento(def, dState, state);
      if (state.recursos.dinheiro < custo) return state;

      const agora = Date.now();
      let novoEstado: GameState = {
        ...state,
        recursos: { ...state.recursos, dinheiro: state.recursos.dinheiro - custo },
        distritos: {
          ...state.distritos,
          [action.distritoId]: {
            ...dState,
            nivelControle: clamp(
              dState.nivelControle + INVESTIMENTO_INCREMENTO_CONTROLE,
              0,
              100,
            ),
          },
        },
        estatisticas: {
          ...state.estatisticas,
          investimentosFeitos: state.estatisticas.investimentosFeitos + 1,
        },
      };
      novoEstado = adicionarLog(
        novoEstado,
        `${def.icone} Investimento em ${def.nome}: controle aumentado.`,
        "positivo",
        agora,
      );
      return novoEstado;
    }

    case "REFORCAR_SEGURANCA": {
      const def = getDistritoDef(action.distritoId);
      const dState = state.distritos[action.distritoId];
      if (!def || !dState || !dState.desbloqueado || dState.risco <= 0) return state;
      if (state.recursos.seguranca < CUSTO_REFORCO_SEGURANCA) return state;

      const agora = Date.now();
      let novoEstado: GameState = {
        ...state,
        recursos: {
          ...state.recursos,
          seguranca: state.recursos.seguranca - CUSTO_REFORCO_SEGURANCA,
        },
        distritos: {
          ...state.distritos,
          [action.distritoId]: {
            ...dState,
            risco: clamp(dState.risco - REDUCAO_RISCO_REFORCO, 0, 100),
          },
        },
      };
      novoEstado = adicionarLog(
        novoEstado,
        `${def.icone} Reforço de segurança em ${def.nome}: risco reduzido.`,
        "info",
        agora,
      );
      return novoEstado;
    }

    case "DESBLOQUEAR_DISTRITO": {
      const def = getDistritoDef(action.distritoId);
      const dState = state.distritos[action.distritoId];
      if (!def || !dState || dState.desbloqueado) return state;
      if (state.recursos.reputacao < def.requisitoReputacao) return state;

      const custo = custoDesbloqueio(def, state);
      if (!podeAfordarCusto(state.recursos, custo)) return state;

      const agora = Date.now();
      let novoEstado: GameState = {
        ...state,
        recursos: deduzirRecursos(state.recursos, custo),
        distritos: {
          ...state.distritos,
          [action.distritoId]: {
            ...dState,
            desbloqueado: true,
            nivelControle: Math.max(dState.nivelControle, 8),
          },
        },
      };
      novoEstado = adicionarLog(
        novoEstado,
        `${def.icone} ${def.nome} agora faz parte do império das sombras.`,
        "positivo",
        agora,
      );
      return novoEstado;
    }

    case "COMPRAR_UPGRADE": {
      const def = UPGRADES_POR_ID[action.upgradeId];
      const upState = state.upgrades[action.upgradeId];
      if (!def || !upState || upState.nivel >= def.nivelMax) return state;
      if (def.requisitoReputacao && state.recursos.reputacao < def.requisitoReputacao) {
        return state;
      }
      const custo = custoUpgrade(def, upState.nivel);
      if (!podeAfordarCusto(state.recursos, custo)) return state;

      const agora = Date.now();
      let novoEstado: GameState = {
        ...state,
        recursos: deduzirRecursos(state.recursos, custo),
        upgrades: {
          ...state.upgrades,
          [action.upgradeId]: { ...upState, nivel: upState.nivel + 1 },
        },
      };
      novoEstado = adicionarLog(
        novoEstado,
        `${def.icone} ${def.nome} evoluiu para o nível ${upState.nivel + 1}.`,
        "positivo",
        agora,
      );
      return novoEstado;
    }

    case "RESOLVER_EVENTO": {
      if (!state.eventoAtivo) return state;
      return resolverEvento(state, action.opcaoId, Date.now(), false);
    }

    case "DISPENSAR_RELATORIO_OFFLINE":
      return { ...state, relatorioOffline: null };

    case "CARREGAR_ESTADO":
      return action.estado;

    case "REINICIAR_JOGO":
      return criarEstadoInicial();

    default:
      return state;
  }
}
