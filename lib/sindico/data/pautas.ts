import { PautaDef } from "../types";

// Propostas que o síndico pode levar pra assembleia mensal. O voto de cada
// morador sai do quanto a proposta bate com os interesses dele, somado à
// confiança que ele tem no síndico (aprovação).
export const PAUTAS: PautaDef[] = [
  {
    id: "aumento_taxa",
    title: "Aumentar a taxa em R$ 60",
    text: "Reajuste da taxa condominial de cada apartamento, pra equilibrar o caixa.",
    repeatable: true,
    leaning: { economia: -10, seguranca: 2, estetica: 2 },
    yes: {
      effects: { fee: 60, tags: { economia: -6 } },
      result: "Taxa aumentada. O caixa agradece. O bolso dos moradores, não.",
    },
    no: { effects: {}, result: "Reajuste rejeitado. O caixa continua apertado." },
  },
  {
    id: "rateio_extra",
    title: "Chamada extra de R$ 400 por apartamento",
    text: "Cobrança única pra cobrir as despesas atrasadas.",
    repeatable: true,
    leaning: { economia: -12, regras: 3 },
    yes: {
      effects: { money: 3200, tags: { economia: -8 } },
      result: "Rateio aprovado: +R$ 3.200 no caixa. Teve gente xingando baixinho.",
    },
    no: { effects: {}, result: "Rateio rejeitado. 'Que o síndico se vire', disse alguém." },
  },
  {
    id: "cameras",
    title: "Instalar câmeras de segurança",
    text: "R$ 2.000 de instalação e R$ 100/mês de manutenção.",
    leaning: { seguranca: 10, economia: -4, regras: 3, festa: -2 },
    yes: {
      effects: { money: -2000, fixedCosts: 100, tags: { seguranca: 8 }, clearFlags: ["portao_aberto"] },
      result: "Câmeras instaladas. A Neide pediu acesso às imagens 'por segurança'.",
    },
    no: { effects: {}, result: "Câmeras rejeitadas. O Marcão comemorou." },
  },
  {
    id: "lei_silencio",
    title: "Regra do silêncio depois das 22h",
    text: "Nada de som alto, festa ou obra depois das 22h. Multa pra quem descumprir.",
    leaning: { silencio: 10, regras: 4, festa: -10 },
    yes: {
      effects: { tags: { silencio: 6, festa: -6 }, setFlags: ["lei_silencio"], clearFlags: ["marcao_liberado"] },
      result: "Regra aprovada. O Marcão agora ensaia com baquetas de espuma.",
    },
    no: { effects: {}, result: "Rejeitada. O prédio continua sendo um festival." },
  },
  {
    id: "pets_liberados",
    title: "Liberar pets nas áreas comuns",
    text: "Cachorros e gatos podem circular no hall, no jardim e no elevador (com coleira).",
    leaning: { pets: 10, regras: -4, silencio: -3 },
    yes: {
      effects: { tags: { pets: 8, regras: -3 } },
      result: "Aprovado. O Thor agora tem passe livre e uma fã: a Kelly.",
    },
    no: { effects: {}, result: "Rejeitado. O Thor continua sendo contrabandeado no elevador." },
  },
  {
    id: "aumento_ze",
    title: "Aumento de salário pro Zé",
    text: "+R$ 300/mês no salário do porteiro, sem reajuste há 3 anos.",
    requires: { flags: ["pauta_aumento_ze"] },
    leaning: { tradicao: 8, seguranca: 3, economia: -5 },
    yes: {
      effects: { fixedCosts: 300, tags: { tradicao: 4 }, setFlags: ["ze_feliz"], clearFlags: ["pauta_aumento_ze"] },
      result: "Aumento aprovado! O Zé trouxe pão de queijo pra todo mundo.",
    },
    no: {
      effects: { setFlags: ["ze_chateado"], clearFlags: ["pauta_aumento_ze"] },
      result: "Rejeitado. O Zé ouviu tudo da guarita.",
    },
  },
  {
    id: "portaria_remota",
    title: "Trocar o porteiro por portaria remota",
    text: "Economia de R$ 1.200/mês. O Zé seria demitido.",
    requires: { minWeek: 8, notFlags: ["sem_ze"] },
    leaning: { economia: 10, tradicao: -10, seguranca: -4 },
    yes: {
      effects: { fixedCosts: -1200, tags: { tradicao: -8 }, residents: { cida: -8 }, setFlags: ["sem_ze"], clearFlags: ["ze_chateado", "ze_feliz"] },
      result: "Aprovado. O Zé se despediu de todo mundo. A Dona Cida chorou.",
    },
    no: { effects: { tags: { tradicao: 2 } }, result: "Rejeitado. O Zé fica! Ele não sabe que estava em votação." },
  },
  {
    id: "pintura_fachada",
    title: "Pintar a fachada",
    text: "Pintura completa da fachada, com o arquiteto que a Kelly indicou. R$ 4.000.",
    requires: { flags: ["pauta_fachada"] },
    leaning: { estetica: 10, economia: -6, tradicao: 2 },
    yes: {
      effects: { money: -4000, condition: 18, tags: { estetica: 8 }, clearFlags: ["pauta_fachada"] },
      result: "Fachada pintada de verde-água. O prédio virou cenário dos stories da Kelly.",
    },
    no: { effects: { clearFlags: ["pauta_fachada"] }, result: "Rejeitado. A fachada continua cor de 'cinza-poluição'." },
  },
  {
    id: "baixar_taxa",
    title: "Baixar a taxa em R$ 50",
    text: "O caixa está folgado. Devolver parte pros moradores com uma taxa menor.",
    repeatable: true,
    requires: { minMoney: 6000 },
    leaning: { economia: 10, seguranca: -2 },
    yes: {
      effects: { fee: -50, tags: { economia: 6 } },
      result: "Taxa reduzida! Até o Seu Osvaldo comemorou (ele nem paga).",
    },
    no: { effects: {}, result: "Rejeitado?! O prédio preferiu deixar o dinheiro no caixa. Inédito." },
  },
  {
    id: "academia",
    title: "Transformar o depósito em academia",
    text: "Equipar o depósito velho com aparelhos usados. R$ 2.500.",
    requires: { minWeek: 4 },
    leaning: { estetica: 5, festa: 3, economia: -6, tradicao: -3 },
    yes: {
      effects: { money: -2500, condition: 3, tags: { estetica: 5 }, residents: { kelly: 6, marcao: 3 } },
      result: "Academia inaugurada. O Seu Osvaldo usa a esteira como cabide.",
    },
    no: { effects: {}, result: "Rejeitado. O depósito continua guardando coisas de moradores que já morreram." },
  },
];

export const PAUTAS_BY_ID = Object.fromEntries(PAUTAS.map((p) => [p.id, p])) as Record<string, PautaDef>;
