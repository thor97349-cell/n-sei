import { CrossroadPrompt, GameState, LogEntry } from "./types";
import { formatCurrency } from "./format";

export interface CrossroadEffect {
  cashDelta?: number;
  reputationDelta?: number;
  customersDelta?: number;
  permanentOverheadDelta?: number;
  unitCostAdjustmentDelta?: number;
  endGame?: "acquired";
  logText: string;
  logTone: LogEntry["tone"];
}

export interface CrossroadOptionDef {
  id: string;
  label: string;
  description: string;
  value?: number;
  apply: (state: GameState, value?: number) => CrossroadEffect;
}

export interface CrossroadDefinition {
  id: string;
  title: string;
  description: string;
  eligible?: (state: GameState) => boolean;
  options: CrossroadOptionDef[];
}

// Reconstrói as definições (com as funções de efeito) a partir do estado atual.
// Números aleatórios gerados aqui (ex: valor de aquisição) só valem para a rolagem
// que os exibe — na resolução, usamos o valor já congelado em pendingCrossroad.
export function buildCrossroads(state: GameState): CrossroadDefinition[] {
  const last = state.history.at(-1)!;
  const acquisitionOffer = Math.round(last.revenue * (8 + Math.random() * 6));

  return [
    {
      id: "big_client_discount",
      title: "Cliente grande pede desconto",
      description: `Um cliente importante, responsável por boa parte da receita da ${state.companyName}, pede 25% de desconto em troca de um contrato anual.`,
      options: [
        {
          id: "accept",
          label: "Aceitar o desconto",
          description: "Mantém o cliente, abre mão de parte da receita deste mês.",
          apply: () => ({
            cashDelta: -Math.round(last.revenue * 0.08),
            reputationDelta: 4,
            logText: "Você aceitou o desconto e manteve o cliente satisfeito.",
            logTone: "neutral",
          }),
        },
        {
          id: "refuse",
          label: "Manter o preço cheio",
          description: "Arrisca perder o cliente, mas preserva sua política de preços.",
          apply: () => ({
            customersDelta: -Math.max(3, Math.round(state.customers * 0.04)),
            reputationDelta: 2,
            logText: "Você manteve o preço cheio. O cliente saiu, mas sua política de preços ficou mais forte.",
            logTone: "neutral",
          }),
        },
      ],
    },
    {
      id: "investor_offer",
      title: "Investidor oferece aporte",
      description: `Um investidor anjo se interessou pela ${state.companyName} e oferece um aporte de caixa em troca de participação futura nos lucros.`,
      options: [
        {
          id: "accept",
          label: "Aceitar o aporte",
          description: "Cash agora, com um custo mensal permanente de governança.",
          apply: () => ({
            cashDelta: Math.round(state.cash * 0.6 + 15000),
            permanentOverheadDelta: 800,
            logText: "Você aceitou o aporte. Mais fôlego de caixa, com custos permanentes de governança.",
            logTone: "good",
          }),
        },
        {
          id: "refuse",
          label: "Recusar e manter o controle",
          description: "Sem cash extra, mas sem amarras.",
          apply: () => ({
            reputationDelta: 1,
            logText: "Você recusou o aporte e manteve o controle total da empresa.",
            logTone: "neutral",
          }),
        },
      ],
    },
    {
      id: "key_employee_raise",
      title: "Funcionário-chave pede aumento",
      description: "Seu funcionário mais experiente ameaça sair se não receber um aumento.",
      eligible: (s) => s.decisions.staff.sales + s.decisions.staff.support + s.decisions.staff.product > 0,
      options: [
        {
          id: "accept",
          label: "Dar o aumento",
          description: "Custo fixo permanente um pouco mais alto, equipe mais motivada.",
          apply: () => ({
            permanentOverheadDelta: 600,
            reputationDelta: 5,
            logText: "Você deu o aumento. A equipe ficou mais motivada.",
            logTone: "good",
          }),
        },
        {
          id: "refuse",
          label: "Recusar",
          description: "Economiza, mas a saída dele machuca a reputação.",
          apply: () => ({
            reputationDelta: -8,
            logText: "Você recusou o aumento. O funcionário saiu e isso abalou a equipe.",
            logTone: "bad",
          }),
        },
      ],
    },
    {
      id: "supplier_exclusivity",
      title: "Fornecedor oferece exclusividade",
      description: "Um fornecedor oferece preços melhores em troca de exclusividade de fornecimento.",
      options: [
        {
          id: "accept",
          label: "Fechar exclusividade",
          description: "Custo variável menor para sempre, porém menos flexibilidade.",
          apply: () => ({
            unitCostAdjustmentDelta: -2,
            reputationDelta: -2,
            logText: "Você fechou exclusividade com o fornecedor. Custo variável reduzido permanentemente.",
            logTone: "good",
          }),
        },
        {
          id: "refuse",
          label: "Manter múltiplos fornecedores",
          description: "Sem redução de custo, mas com mais flexibilidade.",
          apply: () => ({
            logText: "Você preferiu manter a flexibilidade com múltiplos fornecedores.",
            logTone: "neutral",
          }),
        },
      ],
    },
    {
      id: "pr_crisis",
      title: "Crise de imagem",
      description: "Uma reclamação viralizou nas redes sociais questionando a qualidade do seu produto ou serviço.",
      options: [
        {
          id: "respond",
          label: "Responder publicamente",
          description: "Custa caixa agora, recupera boa parte da reputação.",
          apply: () => ({
            cashDelta: -1200,
            reputationDelta: 6,
            logText: "Você respondeu publicamente e reverteu boa parte do dano.",
            logTone: "neutral",
          }),
        },
        {
          id: "ignore",
          label: "Ignorar",
          description: "Sem custo imediato, mas a reputação sofre.",
          apply: () => ({
            reputationDelta: -12,
            logText: "Você optou por não responder. A crise machucou a reputação da marca.",
            logTone: "bad",
          }),
        },
      ],
    },
    {
      id: "acquisition_offer",
      title: "Oferta de aquisição",
      description: `${state.rival.name} propõe comprar a ${state.companyName} por ${formatCurrency(acquisitionOffer)}.`,
      eligible: (s) => s.month >= 6,
      options: [
        {
          id: "accept",
          label: `Vender por ${formatCurrency(acquisitionOffer)}`,
          description: "Encerra a partida com sucesso, embolsando o valor da venda.",
          value: acquisitionOffer,
          apply: (s, value) => ({
            cashDelta: value,
            endGame: "acquired",
            logText: `Você vendeu a ${s.companyName} para ${s.rival.name} por ${formatCurrency(value!)}.`,
            logTone: "good",
          }),
        },
        {
          id: "refuse",
          label: "Recusar e continuar independente",
          description: "Sem cash extra, mas a empresa continua sua.",
          apply: (s) => ({
            reputationDelta: 3,
            logText: `Você recusou a oferta de ${s.rival.name} e decidiu continuar construindo a ${s.companyName}.`,
            logTone: "neutral",
          }),
        },
      ],
    },
  ];
}

export function rollCrossroad(state: GameState): CrossroadDefinition | null {
  if (state.month < 2) return null;
  if (Math.random() > 0.22) return null;

  const candidates = buildCrossroads(state).filter(
    (c) => !state.resolvedCrossroads.includes(c.id) && (!c.eligible || c.eligible(state)),
  );
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function toPrompt(def: CrossroadDefinition): CrossroadPrompt {
  return {
    id: def.id,
    title: def.title,
    description: def.description,
    options: def.options.map((o) => ({ id: o.id, label: o.label, description: o.description, value: o.value })),
  };
}
