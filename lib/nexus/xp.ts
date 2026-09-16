import { GameState } from "./types";

export interface Milestone {
  id: string;
  xp: number;
  label: string;
  hint: string;
  check: (s: GameState) => boolean;
}

export const MILESTONES: Milestone[] = [
  {
    id: "first_profit",
    xp: 50,
    label: "Primeiro mês com lucro",
    hint: "Termine um mês com lucro positivo.",
    check: (s) => s.history.at(-1)!.profit > 0,
  },
  {
    id: "100_customers",
    xp: 40,
    label: "100 clientes ativos",
    hint: "Chegue a 100 clientes ativos.",
    check: (s) => s.customers >= 100,
  },
  {
    id: "1k_customers",
    xp: 80,
    label: "1.000 clientes ativos",
    hint: "Chegue a 1.000 clientes ativos.",
    check: (s) => s.customers >= 1000,
  },
  {
    id: "revenue_10k",
    xp: 60,
    label: "R$10 mil em receita mensal",
    hint: "Alcance R$10.000 de receita em um único mês.",
    check: (s) => s.history.at(-1)!.revenue >= 10000,
  },
  {
    id: "revenue_50k",
    xp: 100,
    label: "R$50 mil em receita mensal",
    hint: "Alcance R$50.000 de receita em um único mês.",
    check: (s) => s.history.at(-1)!.revenue >= 50000,
  },
  {
    id: "market_share_10",
    xp: 90,
    label: "10% de market share",
    hint: "Conquiste 10% do mercado.",
    check: (s) => s.history.at(-1)!.marketShare >= 0.1,
  },
  {
    id: "market_share_25",
    xp: 150,
    label: "25% de market share",
    hint: "Conquiste 25% do mercado.",
    check: (s) => s.history.at(-1)!.marketShare >= 0.25,
  },
  {
    id: "survive_year",
    xp: 70,
    label: "Sobreviveu 12 meses",
    hint: "Mantenha a empresa aberta por 12 meses.",
    check: (s) => s.month >= 12,
  },
  {
    id: "survive_2years",
    xp: 130,
    label: "Sobreviveu 24 meses",
    hint: "Mantenha a empresa aberta por 24 meses.",
    check: (s) => s.month >= 24,
  },
  {
    id: "reputation_90",
    xp: 60,
    label: "Reputação acima de 90",
    hint: "Leve a reputação acima de 90/100.",
    check: (s) => s.reputation >= 90,
  },
  {
    id: "first_crossroad",
    xp: 30,
    label: "Primeira decisão de encruzilhada",
    hint: "Resolva seu primeiro evento de decisão.",
    check: (s) => s.resolvedCrossroads.length >= 1,
  },
  {
    id: "market_expansion",
    xp: 70,
    label: "Primeira expansão de mercado",
    hint: "Use a ação de expansão de mercado (nível 3+).",
    check: (s) => s.lastExpansionMonth !== null,
  },
  {
    id: "investment_raised",
    xp: 90,
    label: "Primeira rodada de investimento",
    hint: "Capte uma rodada de investimento (nível 5+).",
    check: (s) => s.investmentRaised,
  },
];

// XP necessário cumulativo para alcançar cada nível (progressão crescente).
export function levelForXp(xp: number): number {
  let level = 1;
  let threshold = 100;
  let remaining = xp;
  while (remaining >= threshold) {
    remaining -= threshold;
    level += 1;
    threshold = Math.round(threshold * 1.25);
  }
  return level;
}

export function xpProgress(xp: number): { level: number; currentXp: number; neededXp: number } {
  let level = 1;
  let threshold = 100;
  let remaining = xp;
  while (remaining >= threshold) {
    remaining -= threshold;
    level += 1;
    threshold = Math.round(threshold * 1.25);
  }
  return { level, currentXp: remaining, neededXp: threshold };
}

export function checkMilestones(state: GameState): { xpGained: number; unlocked: Milestone[] } {
  const unlocked: Milestone[] = [];
  let xpGained = 0;
  for (const m of MILESTONES) {
    if (state.milestonesUnlocked.includes(m.id)) continue;
    if (m.check(state)) {
      unlocked.push(m);
      xpGained += m.xp;
    }
  }
  return { xpGained, unlocked };
}

export function getMilestonesStatus(state: GameState) {
  return MILESTONES.map((m) => ({
    ...m,
    unlocked: state.milestonesUnlocked.includes(m.id),
  }));
}
