import { SECTORS } from "./sectors";
import { GameState } from "./types";
import { formatCurrency, formatNumber, formatPercent } from "./format";
import { generateAdvice } from "./advisor";
import {
  EXPANSION_LEVEL,
  INVESTMENT_LEVEL,
  EXPANSION_COOLDOWN_MONTHS,
  canExpandMarket,
  canRaiseInvestment,
  expansionCost,
  investmentAmount,
} from "./engine";

export interface ConsultantTopic {
  id: string;
  question: string;
  keywords: string[];
  answer: (state: GameState) => string;
}

export const CONSULTANT_TOPICS: ConsultantTopic[] = [
  {
    id: "financial_health",
    question: "Como está minha saúde financeira?",
    keywords: ["saude", "financeira", "caixa", "runway", "dinheiro", "financas"],
    answer: (state) => {
      const last = state.history.at(-1)!;
      const margin = last.revenue > 0 ? last.profit / last.revenue : 0;
      let text = `Seu caixa atual é ${formatCurrency(state.cash)}. `;
      if (last.profit < 0) {
        const runway = Math.max(0, Math.floor(state.cash / -last.profit));
        text += `Você fechou o mês no vermelho (${formatCurrency(last.profit)}), com runway de cerca de ${runway} meses no ritmo atual. `;
        text += runway < 4 ? "Isso é urgente: corte custos ou ajuste preço/marketing antes que o caixa aperte." : "Ainda há fôlego, mas vale acompanhar a tendência de perto.";
      } else {
        text += `Você está lucrativo neste mês (${formatCurrency(last.profit)}, margem de ${formatPercent(margin)}). `;
        text += margin > 0.2 ? "Margem saudável — bom momento para reinvestir em crescimento." : "A margem está OK, mas ainda dá para melhorar cortando custo ou revisando o preço.";
      }
      return text;
    },
  },
  {
    id: "what_now",
    question: "O que eu devo fazer agora?",
    keywords: ["fazer", "agora", "prioridade", "proximo", "passo"],
    answer: (state) => {
      const advice = generateAdvice(state).slice(0, 2);
      return advice.map((a) => a.text).join(" ");
    },
  },
  {
    id: "price",
    question: "Devo mudar meu preço?",
    keywords: ["preco", "precificacao", "cobrar", "valor"],
    answer: (state) => {
      const sector = SECTORS[state.sectorId];
      const ratio = state.decisions.price / sector.referencePrice;
      if (ratio > 1.15) {
        return `Seu preço (${formatCurrency(state.decisions.price)}) está ${Math.round((ratio - 1) * 100)}% acima da referência do setor (${formatCurrency(sector.referencePrice)}). Isso tende a reduzir demanda e aumentar o churn — considere baixar um pouco, a menos que sua reputação alta justifique o prêmio.`;
      }
      if (ratio < 0.85) {
        return `Seu preço está ${Math.round((1 - ratio) * 100)}% abaixo da referência (${formatCurrency(sector.referencePrice)}). Isso atrai clientes, mas deixa margem na mesa — se a demanda já está forte, dá para subir um pouco.`;
      }
      return `Seu preço (${formatCurrency(state.decisions.price)}) está alinhado com a referência do setor (${formatCurrency(sector.referencePrice)}). Não é urgente mexer, a menos que sua estratégia mude.`;
    },
  },
  {
    id: "reputation",
    question: "Como está minha reputação?",
    keywords: ["reputacao", "qualidade", "avaliacao"],
    answer: (state) => {
      const rep = Math.round(state.reputation);
      let text = `Sua reputação está em ${rep}/100. `;
      if (rep < 40) text += "Está baixa — invista em suporte e P&D para recuperar, e revise se o preço está justificado pela qualidade entregue.";
      else if (rep < 70) text += "Está mediana. Suporte, P&D e um preço alinhado ao valor entregue ajudam a subir mais.";
      else text += "Está ótima — isso reduz seu churn e barateia a aquisição de novos clientes.";
      return text;
    },
  },
  {
    id: "competition",
    question: "Como estou indo contra a concorrência?",
    keywords: ["concorrencia", "concorrente", "rival", "mercado"],
    answer: (state) => {
      const last = state.history.at(-1)!;
      const ahead = last.customers >= last.rivalCustomers;
      let text = `${state.rival.name} tem ${formatNumber(last.rivalCustomers)} clientes (${formatPercent(last.rivalMarketShare)} de market share); você tem ${formatNumber(last.customers)} (${formatPercent(last.marketShare)}). `;
      text += ahead
        ? "Você está à frente — mantenha o investimento em marketing e reputação para não perder a posição."
        : "Você está atrás. Investir mais em marketing e reputação tende a ajudar a virar o jogo — só copiar o preço da concorrente não costuma bastar.";
      return text;
    },
  },
  {
    id: "staffing",
    question: "Devo contratar mais gente?",
    keywords: ["contratar", "equipe", "staff", "funcionario", "suporte", "time"],
    answer: (state) => {
      const idealSupport = Math.ceil(state.customers / 300);
      const support = state.decisions.staff.support;
      let text = `Você tem ${formatNumber(state.customers)} clientes e ${support} pessoa(s) de suporte. `;
      if (support < idealSupport) {
        text += `O ideal para essa base seria algo perto de ${idealSupport}. Suporte insuficiente tende a derrubar a reputação com o tempo.`;
      } else {
        text += "Isso está numa proporção razoável para o tamanho atual da base de clientes.";
      }
      const last = state.history.at(-1)!;
      if (last.revenue > 0 && last.staffCosts / last.revenue > 0.6) {
        text += ` De olho: a folha de pagamento já consome ${formatPercent(last.staffCosts / last.revenue)} da receita — a equipe pode estar grande demais para o momento atual.`;
      }
      return text;
    },
  },
  {
    id: "marketing",
    question: "Vale a pena investir mais em marketing?",
    keywords: ["marketing", "aquisicao", "propaganda", "anuncio", "cac"],
    answer: (state) => {
      const headroom = state.marketCeiling - state.marketSize;
      const shareOfCeiling = state.marketSize / state.marketCeiling;
      let text = `O mercado ocupa ${formatPercent(shareOfCeiling)} do seu teto de maturidade, com ${formatNumber(Math.max(0, Math.round(headroom)))} de espaço ainda por crescer. `;
      if (state.reputation < 40) {
        text += "Sua reputação está baixa, então marketing agora tende a ficar mais caro por cliente — considere melhorar a reputação primeiro.";
      } else if (shareOfCeiling > 0.9) {
        text += "O mercado está quase saturado — crescer agora depende mais de tomar espaço da concorrente do que de marketing puro.";
      } else {
        text += "Reputação ok e ainda há espaço de mercado — investir mais em marketing tende a valer a pena.";
      }
      return text;
    },
  },
  {
    id: "special_actions",
    question: "Estou pronto para uma ação especial?",
    keywords: ["expandir", "investimento", "captar", "nivel", "acao especial"],
    answer: (state) => {
      const parts: string[] = [];
      if (state.level < EXPANSION_LEVEL) {
        parts.push(`"Expandir mercado" desbloqueia no nível ${EXPANSION_LEVEL} (você está no nível ${state.level}).`);
      } else if (canExpandMarket(state)) {
        parts.push(`"Expandir mercado" está disponível agora por ${formatCurrency(expansionCost(state))}.`);
      } else if (state.expansionsUsed >= 5) {
        parts.push(`Você já usou todas as expansões de mercado disponíveis nesta empresa.`);
      } else {
        const readyAt = (state.lastExpansionMonth ?? 0) + EXPANSION_COOLDOWN_MONTHS;
        parts.push(`"Expandir mercado" está em cooldown até o mês ${readyAt}, ou seu caixa está curto para o custo atual.`);
      }
      if (state.level < INVESTMENT_LEVEL) {
        parts.push(`"Captar investimento" desbloqueia no nível ${INVESTMENT_LEVEL}.`);
      } else if (state.investmentRaised) {
        parts.push(`Você já captou sua rodada de investimento nesta empresa.`);
      } else if (canRaiseInvestment(state)) {
        parts.push(`"Captar investimento" está disponível: um aporte de ${formatCurrency(investmentAmount())} em troca de custo fixo permanente.`);
      }
      return parts.join(" ");
    },
  },
  {
    id: "summary",
    question: "Resuma minha empresa",
    keywords: ["resumo", "resumir", "resuma", "situacao geral", "status"],
    answer: (state) => {
      const last = state.history.at(-1)!;
      const sector = SECTORS[state.sectorId];
      return `${state.companyName} (${sector.name}), mês ${state.month}: ${formatNumber(last.customers)} clientes (${formatPercent(last.marketShare)} de market share), receita de ${formatCurrency(last.revenue)}, lucro de ${formatCurrency(last.profit)}, caixa de ${formatCurrency(state.cash)}, reputação ${Math.round(state.reputation)}/100, nível ${state.level}.`;
    },
  },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function askConsultant(state: GameState, rawQuestion: string): string {
  const normalized = normalize(rawQuestion);
  let best: ConsultantTopic | null = null;
  let bestScore = 0;
  for (const topic of CONSULTANT_TOPICS) {
    const score = topic.keywords.reduce((acc, kw) => (normalized.includes(kw) ? acc + 1 : acc), 0);
    if (score > bestScore) {
      bestScore = score;
      best = topic;
    }
  }
  if (best) return best.answer(state);
  const fallback = generateAdvice(state)[0];
  return `Não tenho uma resposta pronta para isso, mas aqui vai o ponto mais relevante agora: ${fallback.text}`;
}
