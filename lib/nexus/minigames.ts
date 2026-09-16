import { GameState, MiniGamePrompt, PitchMiniGamePrompt, QuizMiniGamePrompt } from "./types";
import { SECTORS } from "./sectors";
import { formatCurrency, formatNumber } from "./format";

type QuizContent = Omit<QuizMiniGamePrompt, "type">;

interface ContextualQuiz {
  id: string;
  applicable: (state: GameState) => boolean;
  build: (state: GameState) => QuizContent;
}

// Perguntas geradas a partir da situação real da empresa no momento — usam os
// números atuais do jogador, não são trivia genérica solta.
const CONTEXTUAL_QUIZZES: ContextualQuiz[] = [
  {
    id: "price_high",
    applicable: (s) => s.decisions.price > SECTORS[s.sectorId].referencePrice * 1.2,
    build: (s) => {
      const ref = SECTORS[s.sectorId].referencePrice;
      const pct = Math.round((s.decisions.price / ref - 1) * 100);
      return {
        question: `Seu preço (${formatCurrency(s.decisions.price)}) está ${pct}% acima da referência do setor (${formatCurrency(ref)}). O que isso tende a causar?`,
        options: ["Reduz demanda e aumenta o churn", "Aumenta a demanda automaticamente", "Não tem nenhum efeito"],
        correctIndex: 0,
        explanation: "Preço muito acima do valor percebido afasta novos clientes e faz os atuais cancelarem mais.",
      };
    },
  },
  {
    id: "price_low",
    applicable: (s) => s.decisions.price < SECTORS[s.sectorId].referencePrice * 0.7,
    build: (s) => {
      const ref = SECTORS[s.sectorId].referencePrice;
      const pct = Math.round((1 - s.decisions.price / ref) * 100);
      return {
        question: `Seu preço está ${pct}% abaixo da referência do setor (${formatCurrency(ref)}). Isso tende a...`,
        options: [
          "Atrair mais clientes, mas deixar margem na mesa",
          "Afugentar todos os clientes",
          "Aumentar o churn imediatamente",
        ],
        correctIndex: 0,
        explanation: "Preço bem abaixo do valor percebido acelera aquisição, mas reduz a margem por cliente.",
      };
    },
  },
  {
    id: "reputation_low",
    applicable: (s) => s.reputation < 40,
    build: (s) => ({
      question: `Sua reputação está em ${Math.round(s.reputation)}/100. Qual ação tende a ajudar mais a recuperar?`,
      options: ["Investir em suporte e P&D", "Cortar todo o investimento em marketing", "Aumentar o preço"],
      correctIndex: 0,
      explanation: "Suporte e P&D elevam a qualidade percebida, que é o principal motor da reputação.",
    }),
  },
  {
    id: "reputation_high",
    applicable: (s) => s.reputation >= 80,
    build: (s) => ({
      question: `Sua reputação está ótima (${Math.round(s.reputation)}/100). Isso costuma reduzir principalmente...`,
      options: ["O churn de clientes", "O tamanho do mercado", "O preço de referência do setor"],
      correctIndex: 0,
      explanation: "Reputação alta retém clientes por mais tempo, reduzindo o churn mensal.",
    }),
  },
  {
    id: "short_runway",
    applicable: (s) => {
      const last = s.history.at(-1)!;
      return last.profit < 0 && s.cash / -last.profit < 4;
    },
    build: (s) => {
      const last = s.history.at(-1)!;
      const runway = Math.max(0, Math.floor(s.cash / -last.profit));
      return {
        question: `No ritmo atual, seu caixa aguenta cerca de ${runway} meses. Qual é a ação mais urgente?`,
        options: [
          "Cortar custos ou ajustar preço/marketing para virar o jogo",
          "Contratar mais gente para crescer mais rápido",
          "Reduzir ainda mais o preço",
        ],
        correctIndex: 0,
        explanation: "Com pouco runway, o mais urgente é reverter o prejuízo antes de expandir mais.",
      };
    },
  },
  {
    id: "healthy_margin",
    applicable: (s) => {
      const last = s.history.at(-1)!;
      return last.revenue > 0 && last.profit / last.revenue > 0.2;
    },
    build: (s) => {
      const last = s.history.at(-1)!;
      const pct = Math.round((last.profit / last.revenue) * 100);
      return {
        question: `Sua margem está saudável (${pct}%). Esse costuma ser um bom momento para...`,
        options: ["Reinvestir em marketing ou P&D", "Demitir toda a equipe", "Ignorar reputação e focar só em preço"],
        correctIndex: 0,
        explanation: "Margem folgada é o momento ideal para reinvestir e acelerar o crescimento.",
      };
    },
  },
  {
    id: "support_understaffed",
    applicable: (s) => s.customers > 150 && s.customers > s.decisions.staff.support * 300,
    build: (s) => ({
      question: `Você tem ${formatNumber(s.customers)} clientes e só ${s.decisions.staff.support} pessoa(s) de suporte. Isso tende a...`,
      options: ["Piorar a reputação com o tempo", "Melhorar a reputação automaticamente", "Não ter nenhum efeito"],
      correctIndex: 0,
      explanation: "Suporte insuficiente para a base de clientes derruba a qualidade percebida ao longo do tempo.",
    }),
  },
  {
    id: "rival_ahead",
    applicable: (s) => s.rival.customers > s.customers * 1.2,
    build: (s) => ({
      question: `${s.rival.name} tem mais clientes que você (${formatNumber(s.rival.customers)} vs ${formatNumber(s.customers)}). O que tende a ajudar a virar o jogo?`,
      options: [
        "Investir mais em marketing e reputação",
        "Copiar o preço da concorrente sem mudar mais nada",
        "Ignorar e não fazer nada",
      ],
      correctIndex: 0,
      explanation: "Ganhar terreno de uma concorrente à frente exige investir em aquisição e qualidade, não só imitar preço.",
    }),
  },
  {
    id: "overstaffed",
    applicable: (s) => {
      const last = s.history.at(-1)!;
      return last.revenue > 0 && last.staffCosts / last.revenue > 0.6;
    },
    build: (s) => {
      const last = s.history.at(-1)!;
      const pct = Math.round((last.staffCosts / last.revenue) * 100);
      return {
        question: `Sua folha de pagamento consome ${pct}% da receita atual. O que isso indica?`,
        options: [
          "A equipe pode estar grande demais para o tamanho atual da empresa",
          "Não há problema nenhum nisso",
          "Você deveria contratar ainda mais",
        ],
        correctIndex: 0,
        explanation: "Quando a folha consome a maior parte da receita, o time cresceu na frente da demanda.",
      };
    },
  },
  {
    id: "market_maturing",
    applicable: (s) => s.marketSize / s.marketCeiling > 0.85,
    build: (s) => {
      const pct = Math.round((s.marketSize / s.marketCeiling) * 100);
      return {
        question: `O mercado já atingiu ${pct}% do seu teto de maturidade. Continuar crescendo agora depende principalmente de...`,
        options: [
          "Ganhar participação da concorrente, não do crescimento orgânico do mercado",
          "Só esperar o mercado crescer sozinho",
          "Aumentar o preço sem mudar mais nada",
        ],
        correctIndex: 0,
        explanation: "Perto do teto, o mercado quase não cresce sozinho — crescer exige tomar espaço da concorrência.",
      };
    },
  },
  {
    id: "expansion_unlocked",
    applicable: (s) => s.level >= 3 && s.expansionsUsed === 0,
    build: () => ({
      question: `Você desbloqueou "Expandir Mercado". O que essa ação faz?`,
      options: [
        "Eleva permanentemente o teto de crescimento do mercado",
        "Reduz o churn imediatamente",
        "Aumenta o preço de referência do setor",
      ],
      correctIndex: 0,
      explanation: "Expandir Mercado investe caixa para elevar o teto de maturidade do mercado, com custo crescente a cada uso.",
    }),
  },
];

const GENERIC_QUIZZES: QuizContent[] = [
  {
    question: "Se o CAC (custo de aquisição) sobe mas a reputação da empresa também sobe, o que geralmente acontece?",
    options: ["O CAC efetivo cai, porque reputação alta barateia a aquisição", "Nada muda", "O CAC dobra sempre"],
    correctIndex: 0,
    explanation: "Reputação alta reduz o custo efetivo de conquistar clientes — o boca a boca faz parte do trabalho do marketing.",
  },
  {
    question: "O que é 'runway' no caixa de uma empresa?",
    options: [
      "O crescimento do mercado",
      "Quantos meses o caixa atual aguenta no ritmo de queima atual",
      "A margem de lucro",
    ],
    correctIndex: 1,
    explanation: "Runway é quanto tempo a empresa sobrevive antes de ficar sem caixa, no ritmo de queima atual.",
  },
  {
    question: "Market share é...",
    options: [
      "O lucro dividido pela receita",
      "Sua fatia de clientes dentro do mercado total do setor",
      "O valor de uma ação na bolsa",
    ],
    correctIndex: 1,
    explanation: "Market share = seus clientes ativos dividido pelo tamanho total do mercado.",
  },
  {
    question: "O que é churn?",
    options: [
      "A fração de clientes que cancela por mês",
      "O lucro líquido da empresa",
      "O preço médio cobrado por cliente",
    ],
    correctIndex: 0,
    explanation: "Churn é a taxa de cancelamento mensal — quanto maior, mais rápido a base de clientes esvazia.",
  },
  {
    question: "O que é margem de lucro?",
    options: ["Receita menos custo fixo", "Lucro dividido pela receita", "O preço de referência do setor"],
    correctIndex: 1,
    explanation: "Margem = lucro ÷ receita — mostra qual fração de cada real vendido vira lucro.",
  },
  {
    question: "No Vértice, o que faz o crescimento do mercado desacelerar com o tempo?",
    options: [
      "Ele se aproxima de um teto e satura, como um mercado real que amadurece",
      "Ele cresce para sempre sem limite",
      "Ele nunca cresce, é sempre fixo",
    ],
    correctIndex: 0,
    explanation: "O mercado tem um teto de maturidade — quanto mais perto dele, mais lento o crescimento orgânico.",
  },
  {
    question: "Para que serve investir em P&D?",
    options: [
      "Melhora a reputação/qualidade percebida ao longo do tempo",
      "Reduz o preço de referência do setor",
      "Aumenta o tamanho do mercado imediatamente",
    ],
    correctIndex: 0,
    explanation: "P&D eleva a qualidade do produto, um dos fatores que empurram a reputação para cima.",
  },
  {
    question: "O que é uma 'encruzilhada' no jogo?",
    options: [
      "Um evento que exige uma decisão real, com consequências permanentes",
      "Um aviso informativo sem nenhum efeito",
      "Um tipo de gráfico no painel de Finanças",
    ],
    correctIndex: 0,
    explanation: "Encruzilhadas travam o avanço do mês até você escolher entre opções com efeitos de verdade.",
  },
  {
    question: "O que acontece se você aceita uma oferta de aquisição de um concorrente?",
    options: [
      "Você vende a empresa e a partida termina com um final de sucesso",
      "Nada muda, é só um evento informativo",
      "Sua reputação cai a zero",
    ],
    correctIndex: 0,
    explanation: "Aceitar a aquisição encerra a partida recebendo o valor da venda — um final alternativo, não uma derrota.",
  },
  {
    question: "O que é elasticidade de preço, na prática?",
    options: [
      "O quanto a demanda reage a mudanças de preço",
      "A velocidade com que o mercado cresce",
      "O custo fixo mensal da empresa",
    ],
    correctIndex: 0,
    explanation: "Elasticidade descreve o quanto clientes reagem (compram mais ou menos) quando o preço muda.",
  },
  {
    question: "O que representa a concorrente simulada dentro da sua partida?",
    options: [
      "Uma entidade própria da sua partida disputando o mesmo mercado — não são dados de outros jogadores",
      "Um ranking com dados reais de outras pessoas jogando",
      "Uma média histórica do setor",
    ],
    correctIndex: 0,
    explanation: "A concorrente é gerada e simulada só dentro do seu próprio jogo, para dar tensão competitiva real.",
  },
  {
    question: "Para que serve a ação 'Captar investimento'?",
    options: [
      "Aporte de caixa em troca de um custo fixo permanente adicional",
      "Reduz o churn instantaneamente",
      "Aumenta o preço de referência do setor",
    ],
    correctIndex: 0,
    explanation: "É uma rodada única: mais caixa agora, mas com um custo de governança que fica para sempre.",
  },
  {
    question: "O que os traços de fundador (escolhidos no início) fazem?",
    options: [
      "Dão um bônus mecânico permanente e diferente, dependendo da escolha",
      "São só flavor, sem nenhum efeito no jogo",
      "Mudam apenas a cor do tema visual",
    ],
    correctIndex: 0,
    explanation: "Cada traço muda algo real e permanente: caixa inicial, reputação inicial, CAC, custo variável ou churn.",
  },
  {
    question: "Para que serve a sequência de dias jogando (streak)?",
    options: [
      "Dá um pequeno bônus de XP por engajamento diário real",
      "Aumenta o preço de todos os produtos",
      "Reduz o tamanho do mercado",
    ],
    correctIndex: 0,
    explanation: "Jogar em dias consecutivos rende um bônus de XP simbólico — sem penalidade se a sequência quebrar.",
  },
  {
    question: "Para que servem XP e nível de fundador?",
    options: [
      "Desbloqueiam ações especiais, como expandir mercado e captar investimento",
      "Não têm nenhuma função no jogo",
      "Só mudam a cor da barra de progresso",
    ],
    correctIndex: 0,
    explanation: "Subir de nível desbloqueia ferramentas estratégicas novas, não é só um número cosmético.",
  },
  {
    question: "Uma equipe de suporte pequena demais para a base de clientes tende a...",
    options: ["Não ter nenhum efeito", "Derrubar a reputação com o tempo", "Aumentar o preço automaticamente"],
    correctIndex: 1,
    explanation: "Clientes mal atendidos avaliam pior a empresa — suporte precisa escalar junto com a base.",
  },
  {
    question: "Cobrar um preço muito acima da referência do setor tende a...",
    options: ["Aumentar a demanda", "Reduzir demanda e aumentar o churn", "Não ter nenhum efeito"],
    correctIndex: 1,
    explanation: "Preço muito acima do valor percebido afasta novos clientes e faz os atuais cancelarem mais.",
  },
  {
    question: "Investir em suporte e P&D tende a melhorar principalmente...",
    options: ["O preço de referência do setor", "A reputação da empresa", "O tamanho do mercado"],
    correctIndex: 1,
    explanation: "Suporte e P&D elevam a qualidade percebida, que é um dos principais motores da reputação.",
  },
];

const PITCH_THEMES: Omit<PitchMiniGamePrompt, "type" | "targetCenter" | "targetWidth">[] = [
  { title: "Pitch para investidor", description: "Acerte o tom certo da apresentação — pare o marcador na zona verde." },
  { title: "Negociação com fornecedor", description: "Feche um acordo justo — pare o marcador na zona verde." },
  { title: "Reunião com cliente estratégico", description: "Convença o cliente no momento certo — pare o marcador na zona verde." },
];

function pickQuiz(state: GameState): QuizContent {
  const applicable = CONTEXTUAL_QUIZZES.filter((q) => {
    try {
      return q.applicable(state);
    } catch {
      return false;
    }
  });
  if (applicable.length > 0 && Math.random() < 0.75) {
    const chosen = applicable[Math.floor(Math.random() * applicable.length)];
    return chosen.build(state);
  }
  return GENERIC_QUIZZES[Math.floor(Math.random() * GENERIC_QUIZZES.length)];
}

export function rollMiniGame(state: GameState): MiniGamePrompt | null {
  if (state.month < 2) return null;
  if (Math.random() > 0.18) return null;

  if (Math.random() < 0.5) {
    const theme = PITCH_THEMES[Math.floor(Math.random() * PITCH_THEMES.length)];
    const targetWidth = 16;
    const targetCenter = 20 + Math.random() * 60;
    return { type: "pitch", ...theme, targetCenter, targetWidth };
  }

  return { type: "quiz", ...pickQuiz(state) };
}
