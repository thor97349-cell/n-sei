import { SECTORS } from "./sectors";
import { GameState, InterestTag } from "./types";
import { formatCurrency, formatPercent } from "./format";

export interface Advice {
  id: string;
  category: InterestTag;
  tone: "good" | "bad" | "neutral";
  title: string;
  text: string;
}

export function generateAdvice(state: GameState): Advice[] {
  const sector = SECTORS[state.sectorId];
  const last = state.history.at(-1)!;
  const prev = state.history.length > 1 ? state.history.at(-2)! : undefined;
  const advice: Advice[] = [];

  const margin = last.revenue > 0 ? last.profit / last.revenue : 0;

  if (last.profit < 0) {
    const burn = -last.profit;
    const runwayMonths = burn > 0 ? state.cash / burn : Infinity;
    if (Number.isFinite(runwayMonths) && runwayMonths < 3) {
      advice.push({
        id: "cash_risk",
        category: "finance",
        tone: "bad",
        title: "Caixa em risco",
        text: `No ritmo atual de queima (${formatCurrency(burn)}/mês), o caixa acaba em cerca de ${Math.max(0, Math.floor(runwayMonths))} meses. Corte custos ou suba preço/marketing antes disso.`,
      });
    } else {
      advice.push({
        id: "negative_month",
        category: "finance",
        tone: "neutral",
        title: "Mês no vermelho",
        text: `Lucro negativo neste mês (${formatCurrency(last.profit)}). No ritmo atual, ainda há ${Number.isFinite(runwayMonths) ? Math.floor(runwayMonths) : "muitos"} meses de caixa.`,
      });
    }
  } else if (margin > 0.15) {
    advice.push({
      id: "healthy_margin",
      category: "finance",
      tone: "good",
      title: "Margem saudável",
      text: `Margem de ${formatPercent(margin)} este mês. Bom momento para reinvestir parte do lucro em marketing ou P&D.`,
    });
  }

  const priceRatio = state.decisions.price / sector.referencePrice;
  if (priceRatio > 1.3) {
    advice.push({
      id: "price_high",
      category: "marketing",
      tone: "bad",
      title: "Preço acima do mercado",
      text: `Seu preço está ${Math.round((priceRatio - 1) * 100)}% acima da referência do setor (${formatCurrency(sector.referencePrice)}), o que reduz demanda e aumenta o churn.`,
    });
  } else if (priceRatio < 0.7) {
    advice.push({
      id: "price_low",
      category: "marketing",
      tone: "neutral",
      title: "Preço bem abaixo do mercado",
      text: `Seu preço está ${Math.round((1 - priceRatio) * 100)}% abaixo da referência — atrai clientes, mas pode estar deixando margem na mesa.`,
    });
  }

  if (state.reputation < 40) {
    advice.push({
      id: "low_reputation",
      category: "operations",
      tone: "bad",
      title: "Reputação baixa",
      text: `Reputação em ${Math.round(state.reputation)}/100 aumenta o churn. Considere contratar suporte ou investir em P&D para recuperá-la.`,
    });
  }

  if (prev && last.customers < prev.customers) {
    advice.push({
      id: "shrinking_base",
      category: "marketing",
      tone: "bad",
      title: "Base de clientes encolhendo",
      text: "Você perdeu clientes no último mês. Revise preço e reputação, ou aumente o investimento em marketing.",
    });
  }

  if (last.marketShare < 0.05 && state.month >= 3) {
    advice.push({
      id: "growth_headroom",
      category: "investing",
      tone: "neutral",
      title: "Muito espaço para crescer",
      text: `Você tem apenas ${formatPercent(last.marketShare)} do mercado. Aumentar o investimento em marketing pode acelerar a aquisição.`,
    });
  }

  const idealSupport = Math.ceil(last.customers / 300);
  if (last.customers > 200 && state.decisions.staff.support < idealSupport) {
    advice.push({
      id: "support_understaffed",
      category: "operations",
      tone: "neutral",
      title: "Suporte pode estar sobrecarregado",
      text: "A base de clientes cresceu mais rápido que a equipe de suporte — isso tende a derrubar a reputação com o tempo.",
    });
  }

  if (advice.length === 0) {
    advice.push({
      id: "stable",
      category: "entrepreneurship",
      tone: "good",
      title: "Operação estável",
      text: "Nenhum alerta no momento. Continue monitorando margem, reputação e market share a cada mês.",
    });
  }

  const priority = (a: Advice) => {
    let score = state.interests.includes(a.category) ? 10 : 0;
    if (a.tone === "bad") score += 3;
    if (a.tone === "neutral") score += 1;
    return score;
  };

  return advice.sort((a, b) => priority(b) - priority(a));
}
