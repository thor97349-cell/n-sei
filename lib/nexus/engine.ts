import { pickRivalName, SECTORS } from "./sectors";
import { Decisions, GameState, GoalId, HistoryEntry, InterestTag, LogEntry, SectorId } from "./types";
import { emptyModifiers, rollEvent } from "./events";
import { checkMilestones, levelForXp } from "./xp";

export const INITIAL_CASH = 40000;
const BANKRUPTCY_THRESHOLD = -INITIAL_CASH * 0.5;
const REFERRAL_RATE = 0.035;
const RIVAL_REPUTATION = 60;
const RIVAL_MARKETING_MULTIPLIER = 15;

export function createNewGame(params: {
  companyName: string;
  founderName: string;
  sectorId: SectorId;
  interests: InterestTag[];
  goal: GoalId;
}): GameState {
  const { companyName, founderName, sectorId, interests, goal } = params;
  const sector = SECTORS[sectorId];
  const startingCustomers = Math.round(sector.marketSize * 0.003);
  const startingStaff = { sales: 0, support: 0, product: 0 };
  const startingRivalCustomers = Math.round(startingCustomers * 2.2);
  const initialHistory: HistoryEntry = {
    month: 0,
    revenue: startingCustomers * sector.referencePrice,
    profit: 0,
    customers: startingCustomers,
    marketShare: startingCustomers / sector.marketSize,
    cash: INITIAL_CASH,
    reputation: 55,
    variableCosts: 0,
    staffCosts: 0,
    fixedCosts: sector.fixedCosts,
    marketingSpend: 0,
    rndSpend: 0,
    staff: startingStaff,
    rivalCustomers: startingRivalCustomers,
    rivalMarketShare: startingRivalCustomers / sector.marketSize,
  };

  return {
    companyName: companyName.trim() || "Minha Empresa",
    founderName: founderName.trim() || "Fundador(a)",
    interests,
    goal,
    sectorId,
    month: 0,
    cash: INITIAL_CASH,
    customers: startingCustomers,
    marketSize: sector.marketSize,
    reputation: 55,
    xp: 0,
    level: 1,
    decisions: {
      price: sector.referencePrice,
      marketingSpend: Math.round(sector.cacBase * 20),
      rndSpend: 0,
      staff: startingStaff,
    },
    rival: { name: pickRivalName(sectorId), customers: startingRivalCustomers },
    history: [initialHistory],
    log: [
      {
        month: 0,
        text: `${companyName || "Sua empresa"} abre as portas no setor de ${sector.name}.`,
        tone: "neutral",
      },
    ],
    milestonesUnlocked: [],
    gameOver: false,
  };
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function advanceMonth(state: GameState, decisions: Decisions): GameState {
  if (state.gameOver) return state;

  const sector = SECTORS[state.sectorId];
  const mods = emptyModifiers();
  const event = rollEvent();
  event.apply(mods);

  const priceRatio = decisions.price / sector.referencePrice;
  const priceDemandFactor = clamp(Math.pow(1 / Math.max(priceRatio, 0.05), 1.3), 0.1, 3.5);
  const churnPriceFactor = clamp(Math.pow(Math.max(priceRatio, 0.1), 0.6), 0.5, 2.5);

  const repFactor = 0.5 + (state.reputation / 100) * 1.0; // 0.5 - 1.5
  const churnRepFactor = 1.5 - (state.reputation / 100) * 1.0; // 0.5 - 1.5

  const newMarketSize = Math.round(state.marketSize * (1 + sector.marketGrowth) * mods.marketSizeMultiplier);

  // Concorrente simulada: entidade própria da partida (não são dados de outros
  // jogadores), disputa o mesmo mercado com uma estratégia estável de preço na
  // referência do setor. Sua expansão consome o espaço que sobra para você.
  const rivalRepFactor = 0.5 + (RIVAL_REPUTATION / 100) * 1.0;
  const rivalEffectiveCac = sector.cacBase / rivalRepFactor;
  const rivalMarketingSpend = sector.cacBase * RIVAL_MARKETING_MULTIPLIER;
  const rivalRawLeads = rivalMarketingSpend / rivalEffectiveCac;
  const rivalSaturation = 1 / (1 + rivalRawLeads / 500);
  const rivalReferral = state.rival.customers * REFERRAL_RATE * (RIVAL_REPUTATION / 100);
  const rivalNewRaw = rivalRawLeads * rivalSaturation * rivalRepFactor * mods.demandMultiplier + rivalReferral;
  const remainingMarketForRival = Math.max(newMarketSize - state.customers - state.rival.customers, 0);
  const rivalNewCustomers = Math.min(rivalNewRaw, remainingMarketForRival);
  const rivalChurnRate = clamp(sector.churnBase * (1.5 - RIVAL_REPUTATION / 100) * mods.churnMultiplier, 0.01, 0.6);
  const rivalChurned = state.rival.customers * rivalChurnRate;
  const rivalCustomersAfter = clamp(
    Math.round(state.rival.customers - rivalChurned + rivalNewCustomers),
    0,
    newMarketSize,
  );

  const effectiveCac = sector.cacBase / repFactor;
  const rawLeads = decisions.marketingSpend / effectiveCac;
  const saturation = 1 / (1 + rawLeads / 500);
  const referralGrowth = state.customers * REFERRAL_RATE * (state.reputation / 100);
  let newCustomers =
    rawLeads * saturation * priceDemandFactor * repFactor * mods.demandMultiplier + referralGrowth;

  const remainingMarket = Math.max(newMarketSize - state.customers - rivalCustomersAfter, 0);
  newCustomers = Math.min(newCustomers, remainingMarket);

  const churnRate = clamp(sector.churnBase * churnPriceFactor * churnRepFactor * mods.churnMultiplier, 0.01, 0.6);
  const churned = state.customers * churnRate;

  const customersAfter = clamp(Math.round(state.customers - churned + newCustomers), 0, newMarketSize);

  const revenue = customersAfter * decisions.price;
  const variableCosts = customersAfter * sector.unitCost;
  const staffCosts =
    decisions.staff.sales * sector.salaries.sales +
    decisions.staff.support * sector.salaries.support +
    decisions.staff.product * sector.salaries.product;
  const fixedCosts = sector.fixedCosts;
  const totalCosts = variableCosts + staffCosts + fixedCosts + decisions.marketingSpend + decisions.rndSpend;
  const profit = revenue - totalCosts;
  const cash = state.cash + profit + mods.cashDelta;

  const supportEffect = Math.min(decisions.staff.support * 8, 30);
  const productEffect = Math.min(decisions.staff.product * 4, 20);
  const rndEffect = Math.min(decisions.rndSpend / 500, 15);
  const overpricingPenalty = Math.max(0, priceRatio - 1) * 20;
  const supportGap = Math.max(0, customersAfter - decisions.staff.support * 300);
  const overloadPenalty = clamp(supportGap / 40, 0, 30);
  const target = clamp(
    50 + supportEffect + productEffect + rndEffect - overpricingPenalty - overloadPenalty,
    0,
    100,
  );
  let reputation = state.reputation + (target - state.reputation) * 0.25 + mods.reputationDelta;
  reputation = clamp(reputation, 0, 100);

  const marketShare = newMarketSize > 0 ? customersAfter / newMarketSize : 0;
  const rivalMarketShare = newMarketSize > 0 ? rivalCustomersAfter / newMarketSize : 0;

  const month = state.month + 1;
  const historyEntry: HistoryEntry = {
    month,
    revenue,
    profit,
    customers: customersAfter,
    marketShare,
    cash,
    reputation,
    variableCosts,
    staffCosts,
    fixedCosts,
    marketingSpend: decisions.marketingSpend,
    rndSpend: decisions.rndSpend,
    staff: decisions.staff,
    rivalCustomers: rivalCustomersAfter,
    rivalMarketShare,
  };

  const log: LogEntry[] = [
    ...state.log,
    { month, text: event.text(state.companyName), tone: event.tone },
  ];

  const wasAhead = state.customers >= state.rival.customers;
  const isAhead = customersAfter >= rivalCustomersAfter;
  if (wasAhead && !isAhead) {
    log.push({ month, text: `${state.rival.name} ultrapassou você em número de clientes.`, tone: "bad" });
  } else if (!wasAhead && isAhead) {
    log.push({ month, text: `Você ultrapassou ${state.rival.name} em número de clientes!`, tone: "good" });
  }

  const next: GameState = {
    ...state,
    month,
    cash,
    customers: customersAfter,
    marketSize: newMarketSize,
    reputation,
    decisions,
    rival: { ...state.rival, customers: rivalCustomersAfter },
    history: [...state.history, historyEntry],
    log,
  };

  const { xpGained, unlocked } = checkMilestones(next);
  if (xpGained > 0) {
    for (const m of unlocked) {
      next.log.push({ month, text: `🏆 Marco alcançado: ${m.label} (+${m.xp} XP)`, tone: "good" });
    }
    next.xp += xpGained;
    next.milestonesUnlocked = [...next.milestonesUnlocked, ...unlocked.map((m) => m.id)];
    next.level = levelForXp(next.xp);
  }

  if (cash < BANKRUPTCY_THRESHOLD) {
    next.gameOver = true;
    next.log.push({
      month,
      text: `${state.companyName} ficou sem caixa e precisou fechar as portas. Fim de jogo.`,
      tone: "bad",
    });
  }

  return next;
}
