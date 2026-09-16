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

export type Dificuldade = "facil" | "normal" | "dificil";

export interface ConfigDificuldade {
  id: Dificuldade;
  nome: string;
  descricao: string;
  multiplicadorRisco: number;
  multiplicadorEventoNegativo: number;
  multiplicadorJuros: number;
  recursosIniciais: Recursos;
}

export interface OfertaEmprestimo {
  id: string;
  nome: string;
  descricao: string;
  icone: string;
  valorRecebido: number;
  valorDivida: number;
}

export type TipoEfeitoConexao =
  | "reduzir_risco_maior_distrito"
  | "reduzir_divida_percentual"
  | "resolver_evento_ativo"
  | "restaurar_reputacao";

export interface ConexaoDef {
  id: string;
  nome: string;
  descricao: string;
  icone: string;
  custoRecrutamento: Partial<Recursos>;
  custoAcionar: Partial<Recursos>;
  cooldownMs: number;
  efeito: { tipo: TipoEfeitoConexao; valor: number };
}

export interface ConexaoState {
  id: string;
  recrutada: boolean;
  prontoEm: number;
}

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
  // Variação percentual multiplicativa da dívida (ex.: -0.4 quita 40% dela;
  // 0.2 aumenta 20% como penalidade dos cobradores).
  dividaPercentual?: number;
  mensagem: string;
}

export interface EventOpcaoDef {
  id: string;
  texto: string;
  padrao?: boolean;
  custo?: Partial<Recursos>;
  custoPercentualDinheiro?: number;
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
  // Evento só pode ser sorteado se a condição (quando definida) for verdadeira.
  condicao?: (state: GameState) => boolean;
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
  dificuldade: Dificuldade;
  introVista: boolean;
  velocidade: number;
  recursos: Recursos;
  divida: number;
  distritos: Record<string, DistritoState>;
  upgrades: Record<string, UpgradeState>;
  conexoes: Record<string, ConexaoState>;
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
