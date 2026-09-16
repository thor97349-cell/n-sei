import { GameState, MiniGamePrompt, PitchMiniGamePrompt, QuizMiniGamePrompt } from "./types";

const QUIZ_POOL: Omit<QuizMiniGamePrompt, "type">[] = [
  {
    question: "Se o CAC (custo de aquisição) sobe mas a reputação da empresa também sobe, o que geralmente acontece?",
    options: ["O CAC efetivo cai, porque reputação alta barateia a aquisição", "Nada muda", "O CAC dobra sempre"],
    correctIndex: 0,
    explanation: "Reputação alta reduz o custo efetivo de conquistar clientes — o boca a boca faz parte do trabalho do marketing.",
  },
  {
    question: "Cobrar um preço muito acima da referência do setor tende a...",
    options: ["Aumentar a demanda", "Reduzir demanda e aumentar o churn", "Não ter nenhum efeito"],
    correctIndex: 1,
    explanation: "Preço muito acima do valor percebido afasta novos clientes e faz os atuais cancelarem mais.",
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
    question: "Investir em suporte e P&D tende a melhorar principalmente...",
    options: ["O preço de referência do setor", "A reputação da empresa", "O tamanho do mercado"],
    correctIndex: 1,
    explanation: "Suporte e P&D elevam a qualidade percebida, que é um dos principais motores da reputação.",
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
    question: "Uma equipe de suporte pequena demais para a base de clientes tende a...",
    options: ["Não ter nenhum efeito", "Derrubar a reputação com o tempo", "Aumentar o preço automaticamente"],
    correctIndex: 1,
    explanation: "Clientes mal atendidos avaliam pior a empresa — suporte precisa escalar junto com a base.",
  },
];

const PITCH_THEMES: Omit<PitchMiniGamePrompt, "type" | "targetCenter" | "targetWidth">[] = [
  { title: "Pitch para investidor", description: "Acerte o tom certo da apresentação — pare o marcador na zona verde." },
  { title: "Negociação com fornecedor", description: "Feche um acordo justo — pare o marcador na zona verde." },
  { title: "Reunião com cliente estratégico", description: "Convença o cliente no momento certo — pare o marcador na zona verde." },
];

export function rollMiniGame(state: GameState): MiniGamePrompt | null {
  if (state.month < 2) return null;
  if (Math.random() > 0.18) return null;

  if (Math.random() < 0.5) {
    const theme = PITCH_THEMES[Math.floor(Math.random() * PITCH_THEMES.length)];
    const targetWidth = 16;
    const targetCenter = 20 + Math.random() * 60;
    return { type: "pitch", ...theme, targetCenter, targetWidth };
  }

  const quiz = QUIZ_POOL[Math.floor(Math.random() * QUIZ_POOL.length)];
  return { type: "quiz", ...quiz };
}
