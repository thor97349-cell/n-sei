import type { EventoDef } from "../types";

// Eventos com escopo "distrito" recebem um distrito desbloqueado aleatório
// no momento do disparo (ver engine/eventos.ts).
export const EVENTOS: EventoDef[] = [
  {
    id: "batida-policial",
    titulo: "Batida Policial",
    descricao:
      "Viaturas cercam o quarteirão. Alguém avisou a polícia sobre suas operações.",
    icone: "🚨",
    escopo: "distrito",
    duracaoMs: 35_000,
    peso: 3,
    opcoes: [
      {
        id: "subornar",
        texto: "Subornar os oficiais (–180 dinheiro)",
        custo: { dinheiro: 180 },
        efeitoSucesso: {
          distrito: { risco: -60 },
          mensagem: "Os oficiais aceitaram o dinheiro e olharam para o outro lado.",
        },
      },
      {
        id: "recuar",
        texto: "Recuar e esperar a poeira baixar",
        efeitoSucesso: {
          distrito: { nivelControle: -15, risco: -30 },
          mensagem: "Vocês recuaram. O distrito ficou mais calmo, mas perdeu terreno.",
        },
      },
      {
        id: "resistir",
        texto: "Resistir e proteger o território",
        padrao: true,
        probabilidadeSucesso: 0.45,
        efeitoSucesso: {
          distrito: { risco: -45 },
          recursos: { reputacao: 10 },
          mensagem: "A resistência funcionou. O distrito respeita ainda mais o império.",
        },
        efeitoFalha: {
          distrito: { nivelControle: -20, risco: -10 },
          recursos: { reputacao: -8 },
          mensagem: "A batida saiu cara. Vocês perderam controle e reputação.",
        },
      },
    ],
  },
  {
    id: "informante-segredos",
    titulo: "Informante com Segredos",
    descricao:
      "Um contato oferece informações valiosas sobre concorrentes — por um preço.",
    icone: "🗂️",
    escopo: "global",
    duracaoMs: 40_000,
    peso: 3,
    opcoes: [
      {
        id: "pagar",
        texto: "Pagar pelo dossiê (–15 influência)",
        custo: { influencia: 15 },
        efeitoSucesso: {
          recursos: { dinheiro: 260, reputacao: 6 },
          mensagem: "O dossiê valeu cada centavo: novos contatos e uma bolada extra.",
        },
      },
      {
        id: "ignorar",
        texto: "Ignorar o informante",
        padrao: true,
        efeitoSucesso: {
          mensagem: "Vocês dispensaram o informante. Talvez outra hora.",
        },
      },
    ],
  },
  {
    id: "disputa-faccoes",
    titulo: "Disputa entre Facções",
    descricao:
      "Uma gangue rival tenta tomar parte do território para si.",
    icone: "⚔️",
    escopo: "distrito",
    duracaoMs: 30_000,
    peso: 2,
    opcoes: [
      {
        id: "intervir",
        texto: "Enviar reforços (–20 segurança)",
        custo: { seguranca: 20 },
        efeitoSucesso: {
          distrito: { nivelControle: 8, risco: 10 },
          mensagem: "Os reforços expulsaram os rivais e ainda fortaleceram o controle.",
        },
      },
      {
        id: "ignorar-disputa",
        texto: "Deixar que se resolva sozinho",
        padrao: true,
        efeitoSucesso: {
          distrito: { nivelControle: -10 },
          mensagem: "Sem intervenção, o distrito perdeu parte do controle para os rivais.",
        },
      },
    ],
  },
  {
    id: "jornalista-investigativo",
    titulo: "Jornalista Investigativo",
    descricao:
      "Uma reportagem prestes a expor conexões do império ameaça sua reputação.",
    icone: "📰",
    escopo: "global",
    duracaoMs: 35_000,
    peso: 2,
    opcoes: [
      {
        id: "subornar-jornalista",
        texto: "Comprar o silêncio (–300 dinheiro)",
        custo: { dinheiro: 300 },
        efeitoSucesso: {
          mensagem: "A matéria nunca saiu. Dinheiro bem gasto.",
        },
      },
      {
        id: "ameacar",
        texto: "Enviar um aviso (–15 segurança)",
        custo: { seguranca: 15 },
        probabilidadeSucesso: 0.6,
        efeitoSucesso: {
          mensagem: "O jornalista engavetou a matéria por conta própria.",
        },
        efeitoFalha: {
          recursos: { reputacao: -20 },
          mensagem: "A ameaça vazou. A reportagem saiu ainda mais dura.",
        },
      },
      {
        id: "ignorar-jornalista",
        texto: "Ignorar a reportagem",
        padrao: true,
        efeitoSucesso: {
          recursos: { reputacao: -15 },
          mensagem: "A reportagem saiu. A reputação do império sofreu.",
        },
      },
    ],
  },
  {
    id: "oportunidade-expansao",
    titulo: "Oportunidade de Expansão",
    descricao:
      "Um sócio local oferece um investimento arriscado com retorno tentador.",
    icone: "📈",
    escopo: "distrito",
    duracaoMs: 40_000,
    peso: 2,
    opcoes: [
      {
        id: "investir-alto",
        texto: "Investir pesado (–400 dinheiro)",
        custo: { dinheiro: 400 },
        probabilidadeSucesso: 0.55,
        efeitoSucesso: {
          recursos: { dinheiro: 900 },
          distrito: { nivelControle: 10 },
          mensagem: "O investimento pagou muito mais do que o esperado.",
        },
        efeitoFalha: {
          distrito: { risco: 15 },
          mensagem: "O negócio desandou. O dinheiro se perdeu no processo.",
        },
      },
      {
        id: "recusar-oportunidade",
        texto: "Recusar a oferta",
        padrao: true,
        efeitoSucesso: {
          mensagem: "Vocês recusaram. Sem riscos, sem ganhos.",
        },
      },
    ],
  },
  {
    id: "traicao-interna",
    titulo: "Traição Interna",
    descricao:
      "Rumores de um traidor entre os seus circulam pelo quartel-general.",
    icone: "🔪",
    escopo: "global",
    duracaoMs: 35_000,
    peso: 1,
    opcoes: [
      {
        id: "investigar",
        texto: "Investigar o traidor (–20 influência)",
        custo: { influencia: 20 },
        efeitoSucesso: {
          recursos: { reputacao: 8 },
          mensagem: "O traidor foi identificado e neutralizado a tempo.",
        },
      },
      {
        id: "ignorar-traicao",
        texto: "Ignorar os rumores",
        padrao: true,
        efeitoSucesso: {
          recursos: { dinheiro: -250, seguranca: -15 },
          mensagem: "O traidor agiu. Vocês perderam dinheiro e segurança.",
        },
      },
    ],
  },
  {
    id: "autoridade-corrupta",
    titulo: "Autoridade Corrupta Quer Parte",
    descricao: "Um oficial graduado exige uma fatia dos lucros do mês.",
    icone: "🎩",
    escopo: "global",
    duracaoMs: 35_000,
    peso: 2,
    opcoes: [
      {
        id: "pagar-autoridade",
        texto: "Pagar 15% do dinheiro guardado",
        efeitoSucesso: {
          mensagem: "O oficial ficou satisfeito e voltou a olhar para o outro lado.",
        },
      },
      {
        id: "recusar-autoridade",
        texto: "Recusar o pedido",
        padrao: true,
        efeitoSucesso: {
          recursos: { reputacao: -10 },
          mensagem: "Vocês recusaram. Todos os distritos ficaram mais visados.",
        },
      },
    ],
  },
  {
    id: "doacao-anonima",
    titulo: "Doação Anônima",
    descricao: "Um antigo aliado deposita recursos sem pedir nada em troca.",
    icone: "🎁",
    escopo: "global",
    duracaoMs: 30_000,
    peso: 1,
    opcoes: [
      {
        id: "aceitar-doacao",
        texto: "Aceitar",
        padrao: true,
        efeitoSucesso: {
          recursos: { dinheiro: 350, influencia: 8 },
          mensagem: "Recursos bem-vindos, sem perguntas feitas.",
        },
      },
    ],
  },
];

export const EVENTOS_POR_ID: Record<string, EventoDef> = Object.fromEntries(
  EVENTOS.map((e) => [e.id, e]),
);

// Trata o caso especial de "autoridade-corrupta", cujo custo é percentual
// (15% do dinheiro atual) em vez de um valor fixo — resolvido no reducer.
export const EVENTO_PAGAR_AUTORIDADE_PCT = 0.15;
