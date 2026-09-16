import { EVENTOS_POR_ID } from "../data/eventos";
import { DISTRITOS } from "../data/distritos";
import { UPGRADES, UPGRADES_POR_ID } from "../data/upgrades";
import { CONEXOES, CONEXOES_POR_ID } from "../data/conexoes";
import {
  CUSTO_REFORCO_SEGURANCA,
  DIFICULDADE_PADRAO,
  DIFICULDADES,
  INVESTIMENTO_INCREMENTO_CONTROLE,
  OFERTAS_EMPRESTIMO,
  REDUCAO_RISCO_REFORCO,
  VELOCIDADES,
  VELOCIDADE_PADRAO,
  VERSAO_ESTADO,
} from "../constants";
import type {
  ConexaoState,
  Dificuldade,
  DistritoState,
  EfeitoResultado,
  EventOpcaoDef,
  EventoDef,
  GameState,
  Recursos,
  RecursoId,
  TipoLog,
  UpgradeState,
} from "../types";
import {
  custoDesbloqueio,
  custoInvestimento,
  custoUpgrade,
  getConfigDificuldade,
  getDistritoDef,
  getMaiorRiscoDistritoId,
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
  | { type: "PEGAR_EMPRESTIMO"; ofertaId: string }
  | { type: "PAGAR_DIVIDA" }
  | { type: "RECRUTAR_CONEXAO"; conexaoId: string }
  | { type: "ACIONAR_CONEXAO"; conexaoId: string }
  | { type: "DEFINIR_VELOCIDADE"; velocidade: number }
  | { type: "INICIAR_JOGO"; dificuldade: Dificuldade }
  | { type: "DISPENSAR_RELATORIO_OFFLINE" }
  | { type: "CARREGAR_ESTADO"; estado: GameState }
  | { type: "REINICIAR_JOGO" };

export function criarEstadoInicial(dificuldade: Dificuldade = DIFICULDADE_PADRAO): GameState {
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
  const conexoes: Record<string, ConexaoState> = {};
  for (const c of CONEXOES) {
    conexoes[c.id] = { id: c.id, recrutada: false, prontoEm: 0 };
  }

  let estado: GameState = {
    versao: VERSAO_ESTADO,
    criadoEm: agora,
    ultimaAtualizacao: agora,
    dificuldade,
    introVista: false,
    velocidade: VELOCIDADE_PADRAO,
    recursos: { ...DIFICULDADES[dificuldade].recursosIniciais },
    divida: 0,
    distritos,
    upgrades,
    conexoes,
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

function calcularCustoOpcao(
  state: GameState,
  opcao: EventOpcaoDef,
): Partial<Recursos> | undefined {
  if (opcao.custoPercentualDinheiro) {
    return { dinheiro: Math.round(state.recursos.dinheiro * opcao.custoPercentualDinheiro) };
  }
  return opcao.custo ? { ...opcao.custo } : undefined;
}

// multiplicador < 1 amortece o impacto de efeitos ruins (upgrades de defesa),
// multiplicador > 1 os amplifica (dificuldade Difícil).
function aplicarModificadorNegativo(
  efeito: EfeitoResultado,
  multiplicador: number,
): EfeitoResultado {
  if (multiplicador === 1) return efeito;
  const recursos = efeito.recursos
    ? Object.fromEntries(
        Object.entries(efeito.recursos).map(([k, v]) => [
          k,
          v && v < 0 ? v * multiplicador : v,
        ]),
      )
    : undefined;
  const distrito = efeito.distrito
    ? {
        nivelControle:
          efeito.distrito.nivelControle && efeito.distrito.nivelControle < 0
            ? efeito.distrito.nivelControle * multiplicador
            : efeito.distrito.nivelControle,
        risco:
          efeito.distrito.risco && efeito.distrito.risco > 0
            ? efeito.distrito.risco * multiplicador
            : efeito.distrito.risco,
      }
    : undefined;
  const dividaPercentual =
    efeito.dividaPercentual && efeito.dividaPercentual > 0
      ? efeito.dividaPercentual * multiplicador
      : efeito.dividaPercentual;
  return { ...efeito, recursos, distrito, dividaPercentual };
}

function getMultiplicadorEfetivoNegativo(state: GameState): number {
  const dificuldade = getConfigDificuldade(state);
  const reducao = getReducaoEventoNegativoFracao(state);
  return dificuldade.multiplicadorEventoNegativo * (1 - reducao);
}

// Aplica o efeito (já resolvido) de um evento ao estado e encerra o evento
// ativo. Usado tanto pela resposta normal do jogador quanto por conexões que
// resolvem o evento em andamento na hora (ver "resolver_evento_ativo").
function aplicarEfeitoEvento(
  state: GameState,
  def: EventoDef,
  efeito: EfeitoResultado,
  agora: number,
  tipoLog: TipoLog,
  prefixoMensagem: string,
): GameState {
  let recursos = { ...state.recursos };
  if (efeito.recursos) {
    for (const [chave, valor] of Object.entries(efeito.recursos)) {
      const atual = recursos[chave as RecursoId];
      recursos = { ...recursos, [chave]: Math.max(0, atual + (valor ?? 0)) };
    }
  }

  let distritos = state.distritos;
  const distritoId = state.eventoAtivo?.distritoId;
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

  const divida = efeito.dividaPercentual
    ? Math.max(0, state.divida + state.divida * efeito.dividaPercentual)
    : state.divida;

  const novoEstado: GameState = {
    ...state,
    recursos,
    distritos,
    divida,
    eventoAtivo: null,
    proximoEventoEm: agora + proximoIntervaloEvento(),
    estatisticas: {
      ...state.estatisticas,
      eventosResolvidos: state.estatisticas.eventosResolvidos + 1,
    },
  };
  return adicionarLog(
    novoEstado,
    `${def.icone} ${def.titulo}: ${prefixoMensagem}${efeito.mensagem}`,
    tipoLog,
    agora,
  );
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
  const opcao = def.opcoes.find((o) => o.id === opcaoIdEscolhida) ?? opcaoPadrao;

  const custo = calcularCustoOpcao(state, opcao);

  // Se o jogador não pode pagar a opção escolhida, cai para a opção padrão.
  if (custo && !podeAfordarCusto(state.recursos, custo) && opcao.id !== opcaoPadrao.id) {
    return resolverEvento(state, opcaoPadrao.id, agora, auto);
  }

  const estadoComCusto: GameState = custo
    ? { ...state, recursos: deduzirRecursos(state.recursos, custo) }
    : state;

  const sucesso =
    opcao.probabilidadeSucesso === undefined
      ? true
      : Math.random() < opcao.probabilidadeSucesso;

  const efeitoBase = sucesso
    ? opcao.efeitoSucesso
    : opcao.efeitoFalha ?? opcao.efeitoSucesso;
  const efeito = aplicarModificadorNegativo(
    efeitoBase,
    getMultiplicadorEfetivoNegativo(state),
  );

  const tipoLog = !sucesso ? "negativo" : "evento";
  const prefixo = auto ? "(sem resposta a tempo) " : "";
  return aplicarEfeitoEvento(estadoComCusto, def, efeito, agora, tipoLog, prefixo);
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

    case "PEGAR_EMPRESTIMO": {
      const oferta = OFERTAS_EMPRESTIMO.find((o) => o.id === action.ofertaId);
      if (!oferta) return state;

      const agora = Date.now();
      let novoEstado: GameState = {
        ...state,
        recursos: {
          ...state.recursos,
          dinheiro: state.recursos.dinheiro + oferta.valorRecebido,
        },
        divida: state.divida + oferta.valorDivida,
      };
      novoEstado = adicionarLog(
        novoEstado,
        `${oferta.icone} ${oferta.nome}: +${oferta.valorRecebido} em caixa. Dívida agora em ${Math.round(novoEstado.divida)}.`,
        "info",
        agora,
      );
      return novoEstado;
    }

    case "PAGAR_DIVIDA": {
      if (state.divida <= 0 || state.recursos.dinheiro <= 0) return state;
      const valorPago = Math.min(state.recursos.dinheiro, state.divida);

      const agora = Date.now();
      let novoEstado: GameState = {
        ...state,
        recursos: { ...state.recursos, dinheiro: state.recursos.dinheiro - valorPago },
        divida: Math.max(0, state.divida - valorPago),
      };
      novoEstado = adicionarLog(
        novoEstado,
        `💳 Pagamento de dívida: –${Math.round(valorPago)} dinheiro.`,
        "info",
        agora,
      );
      return novoEstado;
    }

    case "RECRUTAR_CONEXAO": {
      const def = CONEXOES_POR_ID[action.conexaoId];
      const cState = state.conexoes[action.conexaoId];
      if (!def || !cState || cState.recrutada) return state;
      if (!podeAfordarCusto(state.recursos, def.custoRecrutamento)) return state;

      const agora = Date.now();
      let novoEstado: GameState = {
        ...state,
        recursos: deduzirRecursos(state.recursos, def.custoRecrutamento),
        conexoes: {
          ...state.conexoes,
          [def.id]: { ...cState, recrutada: true, prontoEm: agora },
        },
      };
      novoEstado = adicionarLog(
        novoEstado,
        `${def.icone} ${def.nome} agora está do seu lado.`,
        "positivo",
        agora,
      );
      return novoEstado;
    }

    case "ACIONAR_CONEXAO": {
      const def = CONEXOES_POR_ID[action.conexaoId];
      const cState = state.conexoes[action.conexaoId];
      if (!def || !cState || !cState.recrutada) return state;
      const agora = Date.now();
      if (agora < cState.prontoEm) return state;
      if (!podeAfordarCusto(state.recursos, def.custoAcionar)) return state;

      const estadoComCusto: GameState = {
        ...state,
        recursos: deduzirRecursos(state.recursos, def.custoAcionar),
        conexoes: {
          ...state.conexoes,
          [def.id]: { ...cState, prontoEm: agora + def.cooldownMs },
        },
      };

      switch (def.efeito.tipo) {
        case "reduzir_risco_maior_distrito": {
          const alvoId = getMaiorRiscoDistritoId(estadoComCusto);
          if (!alvoId) return state;
          const alvoDef = getDistritoDef(alvoId);
          const dState = estadoComCusto.distritos[alvoId];
          const novoEstado: GameState = {
            ...estadoComCusto,
            distritos: {
              ...estadoComCusto.distritos,
              [alvoId]: {
                ...dState,
                risco: clamp(dState.risco - def.efeito.valor, 0, 100),
              },
            },
          };
          return adicionarLog(
            novoEstado,
            `${def.icone} ${def.nome} abafou o caso em ${alvoDef?.nome ?? alvoId}. Risco reduzido.`,
            "positivo",
            agora,
          );
        }

        case "reduzir_divida_percentual": {
          if (estadoComCusto.divida <= 0) return state;
          const abatimento = estadoComCusto.divida * def.efeito.valor;
          const novoEstado: GameState = {
            ...estadoComCusto,
            divida: Math.max(0, estadoComCusto.divida - abatimento),
          };
          return adicionarLog(
            novoEstado,
            `${def.icone} ${def.nome} renegociou sua dívida. –${Math.round(abatimento)} de dívida.`,
            "positivo",
            agora,
          );
        }

        case "resolver_evento_ativo": {
          if (!estadoComCusto.eventoAtivo) return state;
          const eventoDef = EVENTOS_POR_ID[estadoComCusto.eventoAtivo.eventoId];
          const melhorOpcao =
            eventoDef?.opcoes.find((o) => !o.padrao) ?? eventoDef?.opcoes[0];
          if (!eventoDef || !melhorOpcao) return state;
          return aplicarEfeitoEvento(
            estadoComCusto,
            eventoDef,
            melhorOpcao.efeitoSucesso,
            agora,
            "positivo",
            `${def.nome} resolveu na hora: `,
          );
        }

        case "restaurar_reputacao": {
          const novoEstado: GameState = {
            ...estadoComCusto,
            recursos: {
              ...estadoComCusto.recursos,
              reputacao: estadoComCusto.recursos.reputacao + def.efeito.valor,
            },
          };
          return adicionarLog(
            novoEstado,
            `${def.icone} ${def.nome} publicou uma matéria favorável. +${def.efeito.valor} reputação.`,
            "positivo",
            agora,
          );
        }

        default:
          return state;
      }
    }

    case "DEFINIR_VELOCIDADE": {
      if (!VELOCIDADES.includes(action.velocidade as (typeof VELOCIDADES)[number])) {
        return state;
      }
      return { ...state, velocidade: action.velocidade };
    }

    case "INICIAR_JOGO":
      return { ...criarEstadoInicial(action.dificuldade), introVista: true };

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
