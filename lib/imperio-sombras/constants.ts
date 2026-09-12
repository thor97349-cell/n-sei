export const SAVE_KEY = "imperio-sombras:save:v1";
export const VERSAO_ESTADO = 1;

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
