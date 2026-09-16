export type SectorId = "saas" | "ecommerce" | "food" | "servicos";

export interface SectorConfig {
  id: SectorId;
  name: string;
  emoji: string;
  tagline: string;
  referencePrice: number; // preço "de mercado" esperado, mensal por cliente
  unitCost: number; // custo variável por cliente/mês
  fixedCosts: number; // custos fixos mensais (aluguel, infra, etc)
  marketSize: number; // clientes potenciais totais no mercado no início
  marketGrowth: number; // crescimento mensal do mercado (fração, ex 0.01 = 1%)
  churnBase: number; // churn mensal base (fração)
  cacBase: number; // custo de aquisição base por cliente
  salaries: {
    sales: number;
    support: number;
    product: number;
  };
}

export interface StaffCounts {
  sales: number;
  support: number;
  product: number;
}

export interface Decisions {
  price: number;
  marketingSpend: number;
  rndSpend: number;
  staff: StaffCounts;
}

export type InterestTag =
  | "entrepreneurship"
  | "finance"
  | "marketing"
  | "investing"
  | "technology"
  | "operations";

export type GoalId = "build" | "learn" | "compete" | "invest";

export type FounderTraitId = "executive" | "bootstrapper" | "growth_hacker" | "engineer" | "salesperson";

export interface HistoryEntry {
  month: number;
  revenue: number;
  profit: number;
  customers: number;
  marketShare: number;
  cash: number;
  reputation: number;
  variableCosts: number;
  staffCosts: number;
  fixedCosts: number;
  marketingSpend: number;
  rndSpend: number;
  staff: StaffCounts;
  rivalCustomers: number;
  rivalMarketShare: number;
}

export interface Rival {
  name: string;
  customers: number;
}

export interface LogEntry {
  month: number;
  text: string;
  tone: "neutral" | "good" | "bad";
}

export interface CrossroadOption {
  id: string;
  label: string;
  description: string;
  value?: number;
}

export interface CrossroadPrompt {
  id: string;
  title: string;
  description: string;
  options: CrossroadOption[];
}

export type GameOverReason = "bankruptcy" | "acquired" | null;

export interface PitchMiniGamePrompt {
  type: "pitch";
  title: string;
  description: string;
  targetCenter: number; // 0-100
  targetWidth: number; // 0-100
}

export interface QuizMiniGamePrompt {
  type: "quiz";
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export type MiniGamePrompt = PitchMiniGamePrompt | QuizMiniGamePrompt;

export interface GameState {
  id: string;
  companyName: string;
  founderName: string;
  founderTrait: FounderTraitId;
  interests: InterestTag[];
  goal: GoalId;
  sectorId: SectorId;
  month: number;
  cash: number;
  customers: number;
  marketSize: number;
  marketCeiling: number; // teto de mercado: crescimento orgânico desacelera perto dele (satura, não é infinito)
  reputation: number; // 0-100
  xp: number;
  level: number;
  decisions: Decisions;
  rival: Rival;
  history: HistoryEntry[];
  log: LogEntry[];
  milestonesUnlocked: string[];
  gameOver: boolean;
  gameOverReason: GameOverReason;
  pendingCrossroad: CrossroadPrompt | null;
  resolvedCrossroads: string[];
  pendingMiniGame: MiniGamePrompt | null;
  permanentOverhead: number; // custo fixo mensal extra, acumulado por decisões (aportes, aumentos, etc.)
  unitCostAdjustment: number; // ajuste permanente no custo variável por cliente (ex: negociação com fornecedor)
  investmentRaised: boolean;
  lastExpansionMonth: number | null;
  expansionsUsed: number;
  createdAt: number;
  updatedAt: number;
}
