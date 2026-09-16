export type FounderTraitId = "executive" | "bootstrapper" | "growth_hacker" | "engineer" | "salesperson";

export interface FounderTrait {
  id: FounderTraitId;
  name: string;
  emoji: string;
  description: string;
  cashMultiplier: number;
  startingReputationBonus: number;
  cacMultiplier: number; // menor que 1 = marketing mais eficiente
  unitCostMultiplier: number; // menor que 1 = custo variável menor
  churnMultiplier: number; // menor que 1 = clientes ficam mais tempo
}

export const FOUNDER_TRAITS: FounderTrait[] = [
  {
    id: "executive",
    name: "Ex-executivo(a)",
    emoji: "🎓",
    description: "Anos de carreira corporativa renderam contatos e credibilidade. Começa com reputação mais alta.",
    cashMultiplier: 1,
    startingReputationBonus: 15,
    cacMultiplier: 1,
    unitCostMultiplier: 1,
    churnMultiplier: 1,
  },
  {
    id: "bootstrapper",
    name: "Bootstrapper",
    emoji: "💰",
    description: "Economizou por anos antes de fundar. Começa com 50% mais caixa.",
    cashMultiplier: 1.5,
    startingReputationBonus: 0,
    cacMultiplier: 1,
    unitCostMultiplier: 1,
    churnMultiplier: 1,
  },
  {
    id: "growth_hacker",
    name: "Growth Hacker",
    emoji: "📣",
    description: "Veio do marketing digital. Cada real investido em aquisição rende 20% mais clientes.",
    cashMultiplier: 1,
    startingReputationBonus: 0,
    cacMultiplier: 0.8,
    unitCostMultiplier: 1,
    churnMultiplier: 1,
  },
  {
    id: "engineer",
    name: "Engenheiro(a)",
    emoji: "🔧",
    description: "Construiu o produto com as próprias mãos. Custo variável por cliente 15% menor para sempre.",
    cashMultiplier: 1,
    startingReputationBonus: 0,
    cacMultiplier: 1,
    unitCostMultiplier: 0.85,
    churnMultiplier: 1,
  },
  {
    id: "salesperson",
    name: "Vendedor(a) nato(a)",
    emoji: "🤝",
    description: "Sabe reter cliente como ninguém. Churn 20% menor para sempre.",
    cashMultiplier: 1,
    startingReputationBonus: 0,
    cacMultiplier: 1,
    unitCostMultiplier: 1,
    churnMultiplier: 0.8,
  },
];

export function getTrait(id: FounderTraitId): FounderTrait {
  return FOUNDER_TRAITS.find((t) => t.id === id) ?? FOUNDER_TRAITS[0];
}
