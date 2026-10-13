import { Resident, ResidentId, Tag } from "../types";

export const TAG_LABELS: Record<Tag, { label: string; icon: string }> = {
  silencio: { label: "Silêncio", icon: "🤫" },
  festa: { label: "Festa", icon: "🎉" },
  economia: { label: "Economia", icon: "💰" },
  seguranca: { label: "Segurança", icon: "🔒" },
  pets: { label: "Pets", icon: "🐶" },
  tradicao: { label: "Tradição", icon: "🏛️" },
  regras: { label: "Regras", icon: "📜" },
  estetica: { label: "Estética", icon: "✨" },
};

// Ordem = de cima pra baixo no prédio (4º andar primeiro).
export const RESIDENTS: Resident[] = [
  {
    id: "osvaldo",
    name: "Seu Osvaldo",
    apt: "401",
    avatar: "👴🏾",
    bio: "Aposentado, gente boa, conhece todo mundo. Não paga o condomínio há 8 meses.",
    special: "Não paga o condomínio até você resolver a dívida dele.",
    likes: { economia: 1, tradicao: 0.5, festa: 0.3, regras: -0.5 },
    startApproval: 60,
    reactions: {
      good: ["É isso aí, meu síndico! 👍", "Esse aí é dos bons.", "Gostei, gostei."],
      bad: ["Aí complica, né...", "No meu tempo não era assim.", "Hmm. Vou pensar no seu caso."],
    },
  },
  {
    id: "patricia",
    name: "Patrícia",
    apt: "402",
    avatar: "👩🏽",
    bio: "Mãe solo de 3 filhos e do Thor, um vira-lata de 30kg. Vive no limite do orçamento.",
    likes: { pets: 1, economia: 0.7, seguranca: 0.6, silencio: -0.3 },
    startApproval: 47,
    reactions: {
      good: ["Obrigada, de verdade 🙏", "Até que enfim alguém pensa nas famílias!", "O Thor agradece 🐶"],
      bad: ["Sério isso? 🙄", "Fácil pra quem não tem 3 filhos.", "Vou lembrar disso na assembleia."],
    },
  },
  {
    id: "marcao",
    name: "Marcão",
    apt: "301",
    avatar: "🧔🏻‍♂️",
    bio: "Baterista da banda 'Os Inadimplentes'. Ensaia em casa. Não entende o problema.",
    special: "Ensaia toda semana. Sem regra do silêncio ou estúdio, a Dona Cida e o Rafael perdem a paciência aos poucos.",
    likes: { festa: 1, regras: -0.8, silencio: -0.7, economia: 0.4 },
    startApproval: 52,
    reactions: {
      good: ["AÍ SIM 🤘🤘", "Síndico rock'n'roll!", "Tá liberado o som? Tô dentro."],
      bad: ["Careta.", "Isso aqui virou um convento?", "Vou compor uma música sobre você. Não vai ser elogio."],
    },
  },
  {
    id: "neide",
    name: "Dona Neide",
    apt: "302",
    avatar: "👵🏼",
    bio: "Administradora do grupo do prédio. Sabe de tudo antes de acontecer. O humor dela contamina o grupo.",
    special: "Admin do grupo: toda semana, o humor dela puxa o de todo mundo pra cima ou pra baixo.",
    likes: { seguranca: 0.6, tradicao: 0.6, regras: 0.5, festa: -0.3 },
    startApproval: 50,
    reactions: {
      good: ["Gente, o síndico resolveu, viu? 👏👏👏", "Aprovado pela Neide ✅", "Assim que se faz!"],
      bad: ["Hmmmm 🤔 vou comentar com o pessoal...", "Não é o que eu ouvi falar por aí...", "Gente, vocês viram isso? 😳"],
    },
  },
  {
    id: "valdemar",
    name: "Dr. Valdemar",
    apt: "201",
    avatar: "👨🏻‍⚖️",
    bio: "Advogado aposentado. Perdeu a eleição pra você por 1 voto. Sabe o regimento de cor.",
    special: "Se ficar furioso (abaixo de 25%), processa o condomínio.",
    likes: { regras: 1, economia: 0.6, estetica: 0.3, festa: -0.5, pets: -0.3 },
    startApproval: 38,
    reactions: {
      good: ["Decisão juridicamente adequada.", "Ao menos dessa vez, de acordo.", "Conforme o regimento. Bem."],
      bad: ["Isso fere o Art. 12 do Regimento.", "Registrado. Será usado na assembleia.", "Lamentável. Lamentável."],
    },
  },
  {
    id: "kelly",
    name: "Kelly",
    apt: "202",
    avatar: "💁🏻‍♀️",
    bio: "Influencer (38 mil seguidores). Grava tudo. O prédio aparece nos stories dela todo dia.",
    special: "Stories: se ela te adora (70%+), posta elogios e o prédio todo melhora. Se te odeia (30%-), detona você.",
    likes: { estetica: 1, festa: 0.8, pets: 0.3, regras: -0.5 },
    startApproval: 55,
    reactions: {
      good: ["AMEI 😍✨", "Vou postar isso, síndico top!", "Isso sim é condomínio de respeito 💅"],
      bad: ["Gente, que ranço 🙄", "Vou fazer um vídeo sobre isso...", "Que coisa mais cafona."],
    },
  },
  {
    id: "cida",
    name: "Dona Cida",
    apt: "101",
    avatar: "👵🏻",
    bio: "78 anos, mora no prédio há 40. Faz bolo pra todo mundo. Odeia barulho e mudança.",
    special: "Se te adora (75%+), distribui bolo pro prédio todo uma vez por mês.",
    likes: { silencio: 1, tradicao: 1, festa: -0.6, economia: 0.4, pets: -0.2 },
    startApproval: 55,
    reactions: {
      good: ["Que síndico bom 🥰", "Deus te abençoe, síndico.", "Assim que é bom, no sossego."],
      bad: ["Ai, meu Jesus...", "Na época do Seu Arlindo não era assim.", "Vou rezar por esse prédio."],
    },
  },
  {
    id: "rafael",
    name: "Rafael e Bia",
    apt: "102",
    avatar: "👨🏻‍🍼",
    bio: "Casal com um bebê de 4 meses. Dormem 3 horas por noite. Paciência zero.",
    likes: { silencio: 1, seguranca: 0.8, economia: 0.5, festa: -0.5 },
    startApproval: 46,
    reactions: {
      good: ["Valeu demais, síndico 🙏", "Finalmente uma boa notícia.", "O bebê dormiu. Obrigado."],
      bad: ["O bebê acordou de novo. Obrigado, síndico. 🙃", "Inacreditável.", "A gente vai se mudar desse prédio."],
    },
  },
];

export const RESIDENT_IDS: ResidentId[] = RESIDENTS.map((r) => r.id);

export const RESIDENTS_BY_ID = Object.fromEntries(RESIDENTS.map((r) => [r.id, r])) as Record<ResidentId, Resident>;

export const SENDER_NAMES: Record<"ze" | "sistema" | "voce", { name: string; avatar: string }> = {
  ze: { name: "Zé (porteiro)", avatar: "👨🏽‍✈️" },
  sistema: { name: "Prédio", avatar: "🏢" },
  voce: { name: "Você", avatar: "🫡" },
};
