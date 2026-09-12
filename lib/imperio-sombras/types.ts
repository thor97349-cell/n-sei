// Tipos centrais do Império das Sombras.
// O estado persistido guarda apenas dados dinâmicos (números, ids, flags);
// a definição estática de distritos/upgrades/eventos vive em `data/*`.

export type RecursoId = "dinheiro" | "influencia" | "seguranca" | "reputacao";

export type Recursos = Record<RecursoId, number>;

export type CategoriaUpgrade =
  | "operacoes"
  | "influencia"
  | "seguranca"
  | "especial";

export type TipoEfeitoUpgrade =
  | "multiplicador_dinheiro"
  | "multiplicador_influencia"
  | "geracao_seguranca"
  | "reducao_risco"
  | "reducao_custo_desbloqueio"
  | "reducao_custo_investimento"
  | "reducao_evento_negativo";

export interface EfeitoUpgrade {
  tipo: TipoEfeitoUpgrade;
  valorPorNivel: number;
}

export interface UpgradeDef {
  id: string;
  nome: string;
  descricao: string;
  icone: string;
  categoria: CategoriaUpgrade;
  nivelMax: number;
  custoBase: Partial<Recursos>;
  escalaCusto: number; // multiplicador aplicado ao custo a cada nível já comprado
  efeito: EfeitoUpgrade;
  requisitoReputacao?: number;
}

export interface UpgradeState {
  id: string;
  nivel: number;
}

export interface DistritoDef {
  id: string;
  nome: string;
  descricao: string;
  icone: string;
  tier: number;
  rendaBase: number; // dinheiro/tick a 100% de controle
  influenciaBase: number; // influência/tick a 100% de controle
  riscoCrescimentoBase: number; // risco ganho por tick a 100% de controle
  custoInvestimentoBase: number;
  custoDesbloqueio: Partial<Recursos>;
  requisitoReputacao: number;
  desbloqueadoInicialmente: boolean;
  controleInicial: number;
}

export interface DistritoState {
  id: string;
  nivelControle: number;
  risco: number;
  desbloqueado: boolean;
}

export interface EfeitoResultado {
  recursos?: Partial<Recursos>;
  distrito?: {
    nivelControle?: number;
    risco?: number;
  };
  mensagem: string;
}

export interface EventOpcaoDef {
  id: string;
  texto: string;
  padrao?: boolean;
  custo?: Partial<Recursos>;
  probabilidadeSucesso?: number;
  efeitoSucesso: EfeitoResultado;
  efeitoFalha?: EfeitoResultado;
}

export type EscopoEvento = "global" | "distrito";

export interface EventoDef {
  id: string;
  titulo: string;
  descricao: string;
  icone: string;
  escopo: EscopoEvento;
  duracaoMs: number;
  peso: number;
  opcoes: EventOpcaoDef[];
}

export interface EventoAtivo {
  eventoId: string;
  distritoId?: string;
  criadoEm: number;
  expiraEm: number;
}

export type TipoLog = "info" | "positivo" | "negativo" | "evento";

export interface LogEntry {
  id: string;
  timestamp: number;
  mensagem: string;
  tipo: TipoLog;
}

export interface Estatisticas {
  totalDinheiroGanho: number;
  tempoJogadoMs: number;
  eventosResolvidos: number;
  investimentosFeitos: number;
}

export interface RelatorioOffline {
  duracaoMs: number;
  dinheiroGanho: number;
  influenciaGanha: number;
  criseOcorreu: boolean;
}

export interface GameState {
  versao: number;
  criadoEm: number;
  ultimaAtualizacao: number;
  recursos: Recursos;
  distritos: Record<string, DistritoState>;
  upgrades: Record<string, UpgradeState>;
  eventoAtivo: EventoAtivo | null;
  proximoEventoEm: number;
  registro: LogEntry[];
  estatisticas: Estatisticas;
  relatorioOffline: RelatorioOffline | null;
}

export interface TituloImperio {
  nome: string;
  pontosMinimos: number;
  bonusMultiplicadorDinheiro: number;
}
