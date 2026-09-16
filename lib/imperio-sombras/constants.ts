import type { ConfigDificuldade, Dificuldade, OfertaEmprestimo } from "./types";

export const SAVE_KEY = "imperio-sombras:save:v2";
export const VERSAO_ESTADO = 2;

export const TICK_MS = 1000;
export const EVENTO_MIN_INTERVALO_MS = 25_000;
export const EVENTO_MAX_INTERVALO_MS = 55_000;
export const EVENTO_DURACAO_PADRAO_MS = 40_000;

export const MAX_LOG_ENTRIES = 60;

// Tempo máximo de progresso offline considerado (evita ganhos infinitos
// se o jogador ficar dias sem abrir o jogo).
export const OFFLINE_MAX_MS = 8 * 60 * 60 * 1000;

export const RECURSOS_INICIAIS = {
  dinheiro: 500,
  influencia: 10,
  seguranca: 20,
  reputacao: 0,
} as const;

export const CUSTO_REFORCO_SEGURANCA = 10; // custo em recurso "seguranca"
export const REDUCAO_RISCO_REFORCO = 25;

export const INVESTIMENTO_INCREMENTO_CONTROLE = 5;

export const CRISE_LIMITE_RISCO = 100;
export const CRISE_PERDA_CONTROLE = 20;
export const CRISE_PERDA_DINHEIRO_PCT = 0.15;
export const CRISE_RISCO_POS_CRISE = 55;

export const REPUTACAO_GANHO_POR_TICK_BASE = 0.02; // multiplicado pelo controle médio dos distritos desbloqueados

export const VELOCIDADES = [1, 2, 3] as const;
export const VELOCIDADE_PADRAO = 1;

export const DIFICULDADE_PADRAO: Dificuldade = "normal";

export const DIFICULDADES: Record<Dificuldade, ConfigDificuldade> = {
  facil: {
    id: "facil",
    nome: "Fácil",
    descricao: "Para sentir o poder das sombras sem tanta pressão. Risco, juros e eventos mais brandos.",
    multiplicadorRisco: 0.7,
    multiplicadorEventoNegativo: 0.7,
    multiplicadorJuros: 0.65,
    recursosIniciais: { dinheiro: 700, influencia: 15, seguranca: 30, reputacao: 0 },
  },
  normal: {
    id: "normal",
    nome: "Normal",
    descricao: "A experiência completa do Império das Sombras, equilibrada entre risco e recompensa.",
    multiplicadorRisco: 1,
    multiplicadorEventoNegativo: 1,
    multiplicadorJuros: 1,
    recursosIniciais: { ...RECURSOS_INICIAIS },
  },
  dificil: {
    id: "dificil",
    nome: "Difícil",
    descricao: "Risco alto, agiotas pesados e eventos implacáveis. Só para quem já manda em algo.",
    multiplicadorRisco: 1.4,
    multiplicadorEventoNegativo: 1.3,
    multiplicadorJuros: 1.6,
    recursosIniciais: { dinheiro: 350, influencia: 5, seguranca: 15, reputacao: 0 },
  },
};

// --- Dívida e empréstimos ---
export const TAXA_JUROS_DIVIDA_POR_SEGUNDO = 0.0009; // juros compostos de ~5,5%/min na dificuldade normal
export const LIMITE_DIVIDA_COBRANCA = 2500;
export const MULTIPLICADOR_RISCO_SOBRE_LIMITE = 1.6; // risco cresce mais rápido em todos os distritos com cobradores no seu pé

export const OFERTAS_EMPRESTIMO: OfertaEmprestimo[] = [
  {
    id: "rapido",
    nome: "Empréstimo Rápido",
    descricao: "Dinheiro na mão agora, juros correndo a partir de já.",
    icone: "💵",
    valorRecebido: 400,
    valorDivida: 520,
  },
  {
    id: "agiota",
    nome: "Empréstimo do Agiota",
    descricao: "Mais dinheiro, mais risco. O agiota não perdoa atraso.",
    icone: "🤑",
    valorRecebido: 1200,
    valorDivida: 1680,
  },
  {
    id: "pesado",
    nome: "Empréstimo Pesado",
    descricao: "Injeção de capital para expandir rápido — se você aguentar pagar.",
    icone: "💰",
    valorRecebido: 3000,
    valorDivida: 4500,
  },
];

export const TITULOS_IMPERIO: {
  nome: string;
  pontosMinimos: number;
  bonusMultiplicadorDinheiro: number;
}[] = [
  { nome: "Rato de Beco", pontosMinimos: 0, bonusMultiplicadorDinheiro: 0 },
  { nome: "Bandido de Rua", pontosMinimos: 50, bonusMultiplicadorDinheiro: 0.05 },
  { nome: "Chefe de Distrito", pontosMinimos: 150, bonusMultiplicadorDinheiro: 0.12 },
  { nome: "Barão da Sombra", pontosMinimos: 350, bonusMultiplicadorDinheiro: 0.22 },
  { nome: "Conselheiro Oculto", pontosMinimos: 700, bonusMultiplicadorDinheiro: 0.35 },
  { nome: "Imperador das Sombras", pontosMinimos: 1200, bonusMultiplicadorDinheiro: 0.5 },
];
