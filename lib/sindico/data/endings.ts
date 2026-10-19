import { EndingKind, EpilogueDef, SpecialEndingDef } from "../types";

// Finais básicos (sempre um destes) e seus ícones.
export const BASE_ENDINGS: Record<EndingKind, { icon: string; title: string }> = {
  reeleito: { icon: "🏆", title: "Reeleito!" },
  derrotado: { icon: "📦", title: "Fim de mandato" },
  destituido: { icon: "🚪", title: "Destituído!" },
  falido: { icon: "💸", title: "Condomínio falido" },
};

// Finais especiais: o primeiro da lista que bater substitui o final básico.
// A ordem importa: os mais raros e mais específicos vêm primeiro.
export const SPECIAL_ENDINGS: SpecialEndingDef[] = [
  {
    id: "investigado",
    icon: "🚔",
    title: "Investigado!",
    text: "O PIX do Gilberto virou caso de polícia. Você e o antigo síndico agora dividem o mesmo advogado. O grupo do prédio mudou de nome pra 'Primavera (sem síndicos, por favor)'.",
    when: { flags: ["propina_mentiu"] },
  },
  {
    id: "unanimidade",
    icon: "👑",
    title: "Unanimidade!",
    text: "8 votos de 8. Até o Dr. Valdemar votou em você, e pediu pra ninguém contar. A Dona Neide mandou um áudio de 6 minutos chorando.",
    when: { kinds: ["reeleito"], minVotes: 8 },
  },
  {
    id: "heroi",
    icon: "🦸",
    title: "O Herói do Primavera",
    text: "Você desmascarou o Gilberto, trouxe o dinheiro de volta e ainda foi reeleito. A Dona Neide quer colocar seu nome numa plaquinha no hall.",
    when: { kinds: ["reeleito"], flags: ["gilberto_condenado"] },
  },
  {
    id: "padrinho",
    icon: "💍",
    title: "Padrinho e Síndico",
    text: "Reeleito e padrinho do casal mais barulhento do prédio. Seu discurso no casamento foi melhor que qualquer prestação de contas.",
    when: { kinds: ["reeleito"], flags: ["cupido"] },
  },
  {
    id: "uniao",
    icon: "🤝",
    title: "Chapa da União",
    text: "Você e o Dr. Valdemar governam juntos. Ele cuida das regras, você cuida das pessoas. Ninguém no prédio acreditava que ia dar certo.",
    when: { kinds: ["reeleito"], flags: ["valdemar_subsindico"] },
  },
  {
    id: "influencer",
    icon: "📱",
    title: "Síndico Influencer",
    text: "Os stories da Kelly te deixaram famoso no bairro. Três prédios vizinhos já perguntaram se você aceita ser síndico deles também.",
    when: { kinds: ["reeleito"], minApproval: { kelly: 85 } },
  },
  {
    id: "modelo",
    icon: "✨",
    title: "Prédio Modelo",
    text: "Reeleito com o prédio brilhando. O Primavera ganhou a plaquinha de 'Condomínio do Ano' da administradora. A Dona Cida lustra todo dia.",
    when: { kinds: ["reeleito"], minCondition: 75 },
  },
  {
    id: "kelly_sindica",
    icon: "💅",
    title: "A Nova Síndica",
    text: "A Kelly se candidatou de última hora, fez uma live de 4 horas e ganhou. Primeiro ato: pintar o hall de rosa. Segundo ato: te bloquear no Instagram.",
    when: { kinds: ["derrotado"], minApproval: { kelly: 60 } },
  },
  {
    id: "ordem",
    icon: "📜",
    title: "Ordem e Regimento",
    text: "A chapa do Dr. Valdemar venceu. O regimento novo tem 84 artigos. Você foi multado no primeiro dia, por assobiar no elevador.",
    when: { kinds: ["derrotado"], flags: ["oposicao_ativa"] },
  },
  {
    id: "grupo_paralelo",
    icon: "📵",
    title: "Derrubado pelo Grupo Paralelo",
    text: "Tudo começou quando você removeu a Dona Neide do grupo. O grupo paralelo dela organizou sua queda em três semanas, com enquete e figurinha.",
    when: { kinds: ["derrotado", "destituido"], flags: ["neide_removida"] },
  },
  {
    id: "despedida_rock",
    icon: "🎸",
    title: "Saída com Trilha Sonora",
    text: "Você foi destituído, mas o Marcão tocou uma música de despedida no hall. Até quem votou contra você chorou um pouquinho.",
    when: { kinds: ["destituido"], minApproval: { marcao: 75 } },
  },
  {
    id: "falido_lindo",
    icon: "🌳",
    title: "Falido, mas Lindo",
    text: "O Primavera quebrou, mas quebrou bonito: obra nova, tudo brilhando e nenhum centavo no caixa. É o prédio falido mais charmoso do bairro. O banco quer comprar.",
    when: { kinds: ["falido"], minUpgrades: 2 },
  },
];

export const ALL_ENDING_IDS = [...SPECIAL_ENDINGS.map((e) => e.id), ...(Object.keys(BASE_ENDINGS) as EndingKind[])];

export const ENDING_INFO: Record<string, { icon: string; title: string }> = {
  ...Object.fromEntries(SPECIAL_ENDINGS.map((e) => [e.id, { icon: e.icon, title: e.title }])),
  ...BASE_ENDINGS,
};

// O que aconteceu com cada um depois do mandato. Pra cada personagem, vale a
// primeira variante cuja condição bate; a última de cada um não tem condição.
export const EPILOGUES: EpilogueDef[] = [
  // ---------- Seu Osvaldo ----------
  { who: "osvaldo", when: { flags: ["osvaldo_pagou"] }, text: "Pagou a dívida toda de uma vez e vendeu o carro. Hoje anda de bicicleta e diz que nunca esteve tão em forma. Ainda não te dá bom dia." },
  { who: "osvaldo", when: { flags: ["airbnb"] }, text: "Virou superhost no Airbnb. Tem nota 4,97 e um alemão que volta todo ano e já fala 'oxe'." },
  { who: "osvaldo", when: { flags: ["osvaldo_acordo"], minApproval: { osvaldo: 60 } }, text: "Terminou de pagar a dívida em 14 parcelas e comemorou com churrasco na garagem. Sem autorização, claro." },
  { who: "osvaldo", when: { maxApproval: { osvaldo: 30 } }, text: "Fala pra todo mundo que 'no tempo do Gilberto era melhor'. Ninguém tem coragem de contar pra ele." },
  { who: "osvaldo", text: "Segue sem pagar o condomínio, jogando dominó na varanda e cumprimentando todo mundo pelo nome." },

  // ---------- Patrícia ----------
  { who: "patricia", when: { flags: ["melhoria_playground"] }, text: "Os três filhos praticamente moram no playground. Ela diz que foi a melhor coisa que já aconteceu no prédio." },
  { who: "patricia", when: { flags: ["patricia_atraso"] }, text: "Ainda procura emprego. O prédio inteiro ajuda com currículo, marmita e passeio com o Thor." },
  { who: "patricia", when: { maxApproval: { patricia: 25 } }, text: "Se mudou com as crianças e o Thor pra uma casa com quintal. Na despedida, o Thor deixou um 'presente' no seu capacho." },
  { who: "patricia", when: { minApproval: { patricia: 75 } }, text: "Te chamou pra ser padrinho do Thor. Teve até bolo de ração." },
  { who: "patricia", text: "Continua equilibrando três filhos, dois empregos e um cachorro de 30 kg. O Thor ainda faz xixi no elevador de vez em quando." },

  // ---------- Marcão ----------
  { who: "marcao", when: { flags: ["cupido"] }, text: "Casou com a Kelly. A banda mudou de nome: agora é 'Os Adimplentes'." },
  { who: "marcao", when: { flags: ["melhoria_estudio"] }, text: "Gravou o primeiro disco no estúdio do prédio. A faixa 3 se chama 'Síndico Gente Fina'." },
  { who: "marcao", when: { flags: ["lado_kelly"] }, text: "Compôs 'Síndico Traíra' e tocou na festa do prédio vizinho. Virou o maior sucesso da banda." },
  { who: "marcao", when: { flags: ["lei_silencio"], maxApproval: { marcao: 40 } }, text: "Vendeu a bateria e comprou um teclado com fone de ouvido. Diz que perdeu a alma. O Rafael dormiu 9 horas seguidas." },
  { who: "marcao", when: { minApproval: { marcao: 80 } }, text: "Tatuou o nome do prédio no braço. Escrito errado: 'Edifisio Primavera'." },
  { who: "marcao", text: "Continua ensaiando às 23h. Agora com abafador. Às vezes." },

  // ---------- Dona Neide ----------
  { who: "neide", when: { flags: ["neide_removida"] }, text: "Nunca voltou pro grupo oficial. O grupo paralelo dela tem 47 membros, incluindo gente que nem mora no prédio." },
  { who: "neide", when: { minApproval: { neide: 75 } }, text: "Mandou fazer uma camiseta com a sua foto escrito 'MEU SÍNDICO'. Usa em toda assembleia." },
  { who: "neide", when: { maxApproval: { neide: 30 } }, text: "Fez uma enquete no grupo: 'Quem aqui sente falta do síndico antigo?'. O 'sim' ganhou." },
  { who: "neide", text: "Continua mandando bom dia com figurinha de flor todo dia às 6h12. Sem falta, nem no Natal." },

  // ---------- Dr. Valdemar ----------
  { who: "valdemar", when: { flags: ["valdemar_subsindico"] }, text: "Levou o cargo de subsíndico tão a sério que reescreveu o regimento. Tem 84 artigos agora. O 61 proíbe assobiar." },
  { who: "valdemar", when: { flags: ["gilberto_condenado"] }, text: "Emoldurou a sentença do Gilberto e pendurou na portaria. Mostra pra toda visita, com comentários." },
  { who: "valdemar", when: { kinds: ["derrotado", "destituido", "falido"] }, text: "Assumiu a sindicância. Primeira medida: multa pra quem deixar bolo nas áreas comuns. A Dona Cida recorreu." },
  { who: "valdemar", when: { minApproval: { valdemar: 70 } }, text: "Te convidou pra jantar. Foram duas horas sobre o Código Civil. Foi... legal, até." },
  { who: "valdemar", text: "Segue anotando tudo num caderninho preto. Ninguém sabe o que tem nele. Todo mundo tem medo." },

  // ---------- Kelly ----------
  { who: "kelly", when: { flags: ["cupido"] }, text: "Casou com o Marcão e transmitiu tudo ao vivo. 200 mil visualizações. O prédio virou ponto turístico de casamento." },
  { who: "kelly", when: { flags: ["hall_rosa"] }, text: "O hall rosa viralizou. Tem fila pra tirar foto no fim de semana. O Dr. Valdemar começou a cobrar entrada." },
  { who: "kelly", when: { flags: ["lado_marcao"] }, text: "Fez uma série de 12 vídeos sobre o término. Você aparece em todos. Mal." },
  { who: "kelly", when: { minApproval: { kelly: 80 } }, text: "Fechou uma publi de tinta e conseguiu a pintura da fachada de graça. O prédio aparece no comercial." },
  { who: "kelly", when: { maxApproval: { kelly: 25 } }, text: "Se mudou pra um prédio 'com mais estética'. Ainda posta indireta sobre o Primavera toda semana." },
  { who: "kelly", text: "Continua gravando stories no terraço. O prédio tem mais seguidores que a prefeitura." },

  // ---------- Dona Cida ----------
  { who: "cida", when: { flags: ["sem_ze"] }, text: "Visita o Zé toda semana na lanchonete nova dele. Leva bolo. Ele vende." },
  { who: "cida", when: { minApproval: { cida: 80 } }, text: "Te passou a receita secreta do bolo de fubá. É segredo absoluto. Ela já contou pra Neide." },
  { who: "cida", when: { maxApproval: { cida: 25 } }, text: "Se mudou pra casa da filha em Campinas. Diz que o prédio 'não é mais o mesmo' desde que você chegou." },
  { who: "cida", text: "Segue no 101, na janela, sabendo de tudo antes de todo mundo. O bolo de domingo continua sagrado." },

  // ---------- Rafael e Núbia ----------
  { who: "rafael", when: { anyFlags: ["lei_silencio", "melhoria_estudio"], minApproval: { rafael: 60 } }, text: "O bebê dorme a noite inteira. Rafael e Núbia voltaram a ter vida e já estão pensando no segundo filho." },
  { who: "rafael", when: { maxApproval: { rafael: 25 } }, text: "Se mudaram pra uma casa no interior, atrás de silêncio. Mandaram foto: tudo calmo, menos o galo, que canta às 4h." },
  { who: "rafael", text: "O bebê deu os primeiros passos no hall. A primeira palavra foi 'Marcão'." },

  // ---------- Zé ----------
  { who: "ze", when: { flags: ["sem_ze"] }, text: "Saiu da portaria e abriu uma lanchonete na esquina. Cumprimenta todo mundo como se ainda estivesse na guarita." },
  { who: "ze", when: { flags: ["ze_feliz"] }, text: "Com o aumento, voltou a estudar junto com a filha. Agora corrige o português dos avisos do Dr. Valdemar." },
  { who: "ze", when: { flags: ["ze_chateado"] }, text: "Continua na portaria, mas atende o interfone com um 'pois não' bem seco." },
  { who: "ze", text: "Continua na guarita, de olho em tudo. Sabe mais do prédio que qualquer síndico." },

  // ---------- O prédio ----------
  { who: "predio", when: { minCondition: 85 }, text: "Ganhou o prêmio de 'Prédio Mais Bem Cuidado do Bairro'. A placa fica no hall, do lado do quadro de avisos." },
  { who: "predio", when: { maxCondition: 30 }, text: "Foi parar numa reportagem sobre prédios abandonados. O mofo da garagem deu entrevista." },
  { who: "predio", when: { minUpgrades: 4 }, text: "Com tanta obra, o apartamento no Primavera valorizou 20%. O Seu Osvaldo já anunciou o dele." },
  { who: "predio", text: "Continua de pé, com goteira, pombo e um grupo de WhatsApp que nunca dorme." },

  // ---------- Você ----------
  { who: "voce", when: { flags: ["propina_mentiu"] }, text: "Divide advogado com o Gilberto. Ele manda bom dia no grupo dos dois. Você não responde." },
  { who: "voce", when: { kinds: ["reeleito"] }, text: "Continua síndico. Seu celular tem 3.482 mensagens não lidas e você aprendeu a dormir com elas." },
  { who: "voce", when: { kinds: ["derrotado"] }, text: "Voltou a ser só um morador. Pela primeira vez em meses, dormiu com o celular desligado." },
  { who: "voce", when: { kinds: ["destituido"] }, text: "Agora evita o elevador pra não encontrar ninguém. Usa a escada. Do 4º andar." },
  { who: "voce", text: "Mudou seu nome no grupo pra 'Ex-Síndico (não me marquem)'." },
];

export const EPILOGUE_ORDER: EpilogueDef["who"][] = ["voce", "cida", "rafael", "valdemar", "kelly", "marcao", "neide", "osvaldo", "patricia", "ze", "predio"];
