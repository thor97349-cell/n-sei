import { GoalId, InterestTag } from "./types";

export const INTEREST_OPTIONS: { id: InterestTag; label: string }[] = [
  { id: "entrepreneurship", label: "Empreendedorismo" },
  { id: "finance", label: "Finanças" },
  { id: "marketing", label: "Marketing" },
  { id: "investing", label: "Investimentos" },
  { id: "technology", label: "Tecnologia" },
  { id: "operations", label: "Operações" },
];

export const GOAL_OPTIONS: { id: GoalId; label: string; description: string }[] = [
  { id: "build", label: "Construir uma empresa", description: "Quero simular o processo real de tirar um negócio do papel." },
  { id: "learn", label: "Aprender sobre negócios", description: "Quero entender como preço, custo e marketing se conectam." },
  { id: "compete", label: "Competir", description: "Quero maximizar métricas e bater meus próprios recordes." },
  { id: "invest", label: "Entender investimentos", description: "Quero ver como decisões afetam caixa, margem e crescimento." },
];

export function interestLabel(id: InterestTag): string {
  return INTEREST_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

export function goalLabel(id: GoalId): string {
  return GOAL_OPTIONS.find((o) => o.id === id)?.label ?? id;
}
