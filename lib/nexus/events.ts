export interface MarketEvent {
  id: string;
  text: (companyName: string) => string;
  tone: "good" | "bad" | "neutral";
  apply: (mods: EventModifiers) => void;
}

export interface EventModifiers {
  demandMultiplier: number;
  churnMultiplier: number;
  reputationDelta: number;
  cashDelta: number;
  marketSizeMultiplier: number;
}

export function emptyModifiers(): EventModifiers {
  return {
    demandMultiplier: 1,
    churnMultiplier: 1,
    reputationDelta: 0,
    cashDelta: 0,
    marketSizeMultiplier: 1,
  };
}

export const EVENTS: MarketEvent[] = [
  {
    id: "viral_post",
    text: () => "Um cliente publicou um post que viralizou nas redes sociais.",
    tone: "good",
    apply: (m) => {
      m.demandMultiplier *= 1.35;
      m.reputationDelta += 3;
    },
  },
  {
    id: "competitor_price_cut",
    text: () => "Um concorrente direto baixou os preços agressivamente.",
    tone: "bad",
    apply: (m) => {
      m.demandMultiplier *= 0.8;
      m.churnMultiplier *= 1.15;
    },
  },
  {
    id: "supplier_issue",
    text: () => "Problema com fornecedor gerou atraso e reclamações.",
    tone: "bad",
    apply: (m) => {
      m.reputationDelta -= 5;
      m.cashDelta -= 900;
    },
  },
  {
    id: "press_feature",
    text: (name) => `${name} foi destaque em uma matéria de mídia especializada.`,
    tone: "good",
    apply: (m) => {
      m.demandMultiplier *= 1.5;
    },
  },
  {
    id: "economic_slowdown",
    text: () => "Desaceleração econômica no setor reduziu o apetite de compra.",
    tone: "bad",
    apply: (m) => {
      m.marketSizeMultiplier *= 0.97;
      m.demandMultiplier *= 0.85;
    },
  },
  {
    id: "key_hire",
    text: () => "Um talento experiente se candidatou espontaneamente à vaga em aberto.",
    tone: "good",
    apply: (m) => {
      m.reputationDelta += 2;
    },
  },
  {
    id: "quiet_month",
    text: () => "Mês tranquilo, sem grandes movimentos no mercado.",
    tone: "neutral",
    apply: () => {},
  },
  {
    id: "regulation",
    text: () => "Nova regulamentação do setor aumentou custos de conformidade.",
    tone: "bad",
    apply: (m) => {
      m.cashDelta -= 600;
    },
  },
];

export function rollEvent(): MarketEvent {
  const roll = Math.random();
  if (roll < 0.4) {
    return EVENTS.find((e) => e.id === "quiet_month")!;
  }
  const active = EVENTS.filter((e) => e.id !== "quiet_month");
  return active[Math.floor(Math.random() * active.length)];
}
