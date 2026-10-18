// Tipos do protótipo "Síndico". O motor (engine.ts) e os dados (data/*.ts)
// não dependem de React: a ideia é que essa mesma estrutura seja portada
// para C#/Unity (ScriptableObjects ou JSON) quando o jogo sair do protótipo.

// Interesses que os moradores têm. Cada decisão "puxa" alguns interesses
// para cima ou para baixo, e cada morador reage conforme o quanto liga pra eles.
export type Tag =
  | "silencio"
  | "festa"
  | "economia"
  | "seguranca"
  | "pets"
  | "tradicao"
  | "regras"
  | "estetica";

export type ResidentId =
  | "cida"
  | "rafael"
  | "valdemar"
  | "kelly"
  | "marcao"
  | "neide"
  | "osvaldo"
  | "patricia";

// Quem manda mensagem/pendência: um morador, o porteiro ou o próprio prédio.
export type Sender = ResidentId | "ze" | "sistema" | "voce";

export type TagWeights = Partial<Record<Tag, number>>;

export interface Resident {
  id: ResidentId;
  name: string;
  apt: string;
  avatar: string;
  bio: string;
  special?: string; // mecânica própria do morador, mostrada no perfil
  // -1 (odeia) a 1 (ama). Interesses ausentes = indiferente.
  likes: TagWeights;
  startApproval: number;
  reactions: { good: string[]; bad: string[] };
}

export interface ChatLine {
  from: Sender;
  text: string;
}

export interface Effects {
  money?: number;
  condition?: number;
  fee?: number; // muda a taxa condominial mensal (R$ por apartamento)
  fixedCosts?: number; // muda os custos fixos mensais
  tags?: TagWeights;
  residents?: Partial<Record<ResidentId, number>>;
  all?: number;
  setFlags?: string[];
  clearFlags?: string[];
  chat?: ChatLine[];
}

export interface Requirements {
  flags?: string[];
  anyFlags?: string[]; // pelo menos uma destas
  notFlags?: string[];
  minWeek?: number;
  maxCondition?: number;
  minMoney?: number;
  approvalBelow?: Partial<Record<ResidentId, number>>;
}

export interface Choice {
  label: string;
  hours: number;
  effects: Effects;
  result: string;
}

export interface EventDef {
  id: string;
  from: Sender;
  title: string;
  text: string;
  deadline: number; // semanas para responder antes de "explodir"
  requires?: Requirements;
  repeatable?: boolean;
  weight?: number;
  choices: Choice[];
  expire: { effects: Effects; result: string };
}

export interface PautaDef {
  id: string;
  title: string;
  text: string;
  requires?: Requirements;
  repeatable?: boolean;
  // Como cada interesse "vê" a proposta; define o voto de cada morador.
  leaning: TagWeights;
  yes: { effects: Effects; result: string };
  no: { effects: Effects; result: string };
}

export interface PendingEvent {
  uid: number;
  eventId: string;
  weeksLeft: number;
}

export interface ChatMessage {
  id: number;
  week: number;
  from: Sender;
  text: string;
}

export type Deltas = Partial<Record<ResidentId, number>>;

export interface Outcome {
  title: string;
  result: string;
  money: number;
  condition: number;
  deltas: Deltas;
  // Motivo principal de cada mudança (ex: "🤫 Silêncio"), pra ensinar o jogador a ler os moradores.
  reasons: Partial<Record<ResidentId, string>>;
}

// Ação que o próprio síndico decide fazer (não é pendência).
export interface ActionDef {
  id: string;
  icon: string;
  label: string;
  text: string;
  hours: number;
  limit: "week" | "month";
  requires?: Requirements;
  effects: Effects;
  result: string;
}

// Melhoria permanente do prédio, comprada uma vez.
export interface UpgradeDef {
  id: string;
  icon: string;
  name: string;
  text: string;
  cost: number;
  monthly?: number; // + custo / − economia por mês (só pra mostrar; o efeito real vem de effects.fixedCosts)
  effects: Effects;
  result: string;
}

export type ProfileId = "novato" | "aposentado" | "advogado" | "influencer" | "contador";
export type DifficultyId = "tranquilo" | "normal" | "caotico";

export interface GameConfig {
  profile: ProfileId;
  difficulty: DifficultyId;
  hoursPerWeek: number;
  lobbySlots: number;
  monthlyWear: number;
  extraEventChance: number;
}

export interface GameStats {
  resolved: number;
  expired: number;
  lobbied: number;
  upgrades: number;
  passedPautas: number;
}

export interface MonthReport {
  month: number;
  income: number;
  costs: number;
  payers: number;
  defaulters: ResidentId[];
  conditionLoss: number;
}

export type Votes = Partial<Record<ResidentId, boolean>>;

export interface AssemblyState {
  month: number;
  offered: string[];
  report: MonthReport;
  // undefined = ainda escolhendo; null = assembleia sem pauta
  selected?: string | null;
  lobbied: ResidentId[];
  result?: {
    pautaId: string | null;
    votes: Votes;
    passed: boolean;
    minerva: boolean;
    text: string;
  };
  removal?: { votes: Votes; removed: boolean };
}

export type EndingKind = "reeleito" | "derrotado" | "destituido" | "falido";

// Condição pra um final especial ou um epílogo valer (todas as partes informadas precisam bater).
export interface EndCondition {
  kinds?: EndingKind[];
  flags?: string[];
  anyFlags?: string[];
  notFlags?: string[];
  minApproval?: Partial<Record<ResidentId, number>>;
  maxApproval?: Partial<Record<ResidentId, number>>;
  minCondition?: number;
  maxCondition?: number;
  minUpgrades?: number;
  minVotes?: number;
}

// Final especial: troca o título e o texto do final básico quando a condição bate.
export interface SpecialEndingDef {
  id: string;
  icon: string;
  title: string;
  text: string;
  when: EndCondition;
}

export type EpilogueSubject = ResidentId | "ze" | "predio" | "voce";

// "O que aconteceu com cada um": a primeira variante cuja condição bate é a usada.
export interface EpilogueDef {
  who: EpilogueSubject;
  when?: EndCondition;
  text: string;
}

export interface EpilogueLine {
  who: EpilogueSubject;
  text: string;
}

// Decisão marcante, pro resumo do mandato no final.
export interface DecisionRecord {
  week: number;
  title: string;
  choice: string;
  impact: number;
}

export interface Ending {
  kind: EndingKind;
  // Id do final alcançado: o do final especial, ou o próprio kind se nenhum especial bateu.
  endingId: string;
  icon?: string;
  title: string;
  text: string;
  votes?: Votes;
  score: number;
  achievements: string[];
  epilogue: EpilogueLine[];
}

export interface GameState {
  version: number;
  config: GameConfig;
  rng: number;
  week: number; // 1..TOTAL_WEEKS
  hours: number;
  money: number;
  condition: number;
  fee: number;
  fixedCosts: number;
  approval: Record<ResidentId, number>;
  flags: string[];
  seen: string[];
  usedPautas: string[];
  pending: PendingEvent[];
  nextUid: number;
  chat: ChatMessage[];
  phase: "week" | "assembly" | "ended";
  negativeMonths: number;
  lastOutcome: Outcome | null;
  assembly: AssemblyState | null;
  ending: Ending | null;
  // Uso das ações do síndico: id -> semana (limite semanal) ou mês (limite mensal) do último uso.
  actionsUsed: Record<string, number>;
  visitedMonth: Partial<Record<ResidentId, number>>;
  stats: GameStats;
  // Pra animar o prédio: muda a cada decisão, com as variações de aprovação.
  fx: { tick: number; deltas: Deltas };
  decisions: DecisionRecord[];
}
