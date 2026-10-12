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
  notFlags?: string[];
  minWeek?: number;
  maxCondition?: number;
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

export interface Outcome {
  title: string;
  result: string;
  money: number;
  condition: number;
  deltas: Partial<Record<ResidentId, number>>;
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

export interface Ending {
  kind: EndingKind;
  title: string;
  text: string;
  votes?: Votes;
}

export interface GameState {
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
}
