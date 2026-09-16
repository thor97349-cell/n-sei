import { pickRivalName, SECTORS } from "./sectors";
import { Decisions, FounderTraitId, GameState, GoalId, HistoryEntry, InterestTag, LogEntry, SectorId } from "./types";
import { emptyModifiers, rollEvent } from "./events";
import { checkMilestones, levelForXp } from "./xp";
import { buildCrossroads, rollCrossroad, toPrompt } from "./crossroads";
import { getTrait } from "./traits";
import { rollMiniGame } from "./minigames";

function makeId(): string {
  return `game_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export const INITIAL_CASH = 40000;
const BANKRUPTCY_THRESHOLD = -INITIAL_CASH * 0.5;
const REFERRAL_RATE = 0.035;
const RIVAL_REPUTATION = 60;
const RIVAL_MARKETING_MULTIPLIER = 15;
const MARKET_CEILING_MULTIPLIER = 6;

export function createNewGame(params: {
  companyName: string;
  founderName: string;
  founderTrait: FounderTraitId;
  sectorId: SectorId;
  interests: InterestTag[];
  goal: GoalId;
  miniGamesEnabled?: boolean;
}): GameState {
  const { companyName, founderName, founderTrait, sectorId, interests, goal, miniGamesEnabled = true } = params;
  const trait = getTrait(founderTrait);
  const sector = SECTORS[sectorId];
  const startingCash = Math.round(INITIAL_CASH * trait.cashMultiplier);
  const startingReputation = clamp(55 + trait.startingReputationBonus, 0, 100);
  const startingCustomers = Math.round(sector.marketSize * 0.003);
  const startingStaff = { sales: 0, support: 0, product: 0 };
  const startingRivalCustomers = Math.round(startingCustomers * 2.2);
  const initialHistory: HistoryEntry = {
    month: 0,
    revenue: startingCustomers * sector.referencePrice,
    profit: 0,
    customers: startingCustomers,
    marketShare: startingCustomers / sector.marketSize,
    cash: startingCash,
    reputation: startingReputation,
    variableCosts: 0,
    staffCosts: 0,
    fixedCosts: sector.fixedCosts,
    marketingSpend: 0,
    rndSpend: 0,
    staff: startingStaff,
    rivalCustomers: startingRivalCustomers,
    rivalMarketShare: startingRivalCustomers / sector.marketSize,
  };

  const now = Date.now();
  return {
    id: makeId(),
    companyName: companyName.trim() || "Minha Empresa",
    founderName: founderName.trim() || "Fundador(a)",
    founderTrait,
    interests,
    goal,
    sectorId,
    month: 0,
    cash: startingCash,
    customers: startingCustomers,
    marketSize: sector.marketSize,
    marketCeiling: Math.round(sector.marketSize * MARKET_CEILING_MULTIPLIER),
    reputation: startingReputation,
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
    miniGamesEnabled,
    gameOver: false,
    gameOverReason: null,
    pendingCrossroad: null,
    resolvedCrossroads: [],
    pendingMiniGame: null,
    permanentOverhead: 0,
    unitCostAdjustment: 0,
    investmentRaised: false,
    lastExpansionMonth: null,
    expansionsUsed: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function applyMilestones(state: GameState): GameState {
  const { xpGained, unlocked } = checkMilestones(state);
  if (xpGained === 0) return state;
  const log = [...state.log];
  for (const m of unlocked) {
    log.push({ month: state.month, text: `🏆 Marco alcançado: ${m.label} (+${m.xp} XP)`, tone: "good" });
  }
  const xp = state.xp + xpGained;
  return {
    ...state,
    xp,
    milestonesUnlocked: [...state.milestonesUnlocked, ...unlocked.map((m) => m.id)],
    level: levelForXp(xp),
    log,
  };
}

export function advanceMonth(state: GameState, decisions: Decisions): GameState {
  if (state.gameOver || state.pendingCrossroad || state.pendingMiniGame) return state;

  const sector = SECTORS[state.sectorId];
  const trait = getTrait(state.founderTrait);
  const mods = emptyModifiers();
  const event = rollEvent();
  event.apply(mods);

  const priceRatio = decisions.price / sector.referencePrice;
  const priceDemandFactor = clamp(Math.pow(1 / Math.max(priceRatio, 0.05), 1.3), 0.1, 3.5);
  const churnPriceFactor = clamp(Math.pow(Math.max(priceRatio, 0.1), 0.6), 0.5, 2.5);

  const repFactor = 0.5 + (state.reputation / 100) * 1.0; // 0.5 - 1.5
  const churnRepFactor = 1.5 - (state.reputation / 100) * 1.0; // 0.5 - 1.5

  // Crescimento saturante: o mercado se aproxima de um teto (marketCeiling) em vez de
  // compor exponencialmente para sempre — mercados reais amadurecem e desaceleram.
  const growthRoom = Math.max(0, state.marketCeiling - state.marketSize);
  const newMarketSize = Math.min(
    state.marketCeiling,
    Math.round(state.marketSize + growthRoom * sector.marketGrowth * mods.marketSizeMultiplier),
  );

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

  const effectiveCac = (sector.cacBase * trait.cacMultiplier) / repFactor;
  const rawLeads = decisions.marketingSpend / effectiveCac;
  const saturation = 1 / (1 + rawLeads / 500);
  const referralGrowth = state.customers * REFERRAL_RATE * (state.reputation / 100);
  let newCustomers =
    rawLeads * saturation * priceDemandFactor * repFactor * mods.demandMultiplier + referralGrowth;

  const remainingMarket = Math.max(newMarketSize - state.customers - rivalCustomersAfter, 0);
  newCustomers = Math.min(newCustomers, remainingMarket);

  const churnRate = clamp(
    sector.churnBase * churnPriceFactor * churnRepFactor * mods.churnMultiplier * trait.churnMultiplier,
    0.01,
    0.6,
  );
  const churned = state.customers * churnRate;

  const customersAfter = clamp(Math.round(state.customers - churned + newCustomers), 0, newMarketSize);

  const effectiveUnitCost = Math.max(1, sector.unitCost * trait.unitCostMultiplier + state.unitCostAdjustment);
  const revenue = customersAfter * decisions.price;
  const variableCosts = customersAfter * effectiveUnitCost;
  const staffCosts =
    decisions.staff.sales * sector.salaries.sales +
    decisions.staff.support * sector.salaries.support +
    decisions.staff.product * sector.salaries.product;
  const fixedCosts = sector.fixedCosts + state.permanentOverhead;
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

  let next: GameState = {
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
    updatedAt: Date.now(),
  };

  next = applyMilestones(next);

  if (cash < BANKRUPTCY_THRESHOLD) {
    next.gameOver = true;
    next.gameOverReason = "bankruptcy";
    next.log.push({
      month,
      text: `${state.companyName} ficou sem caixa e precisou fechar as portas. Fim de jogo.`,
      tone: "bad",
    });
    return next;
  }

  const crossroad = rollCrossroad(next);
  if (crossroad) {
    next.pendingCrossroad = toPrompt(crossroad);
  } else if (next.miniGamesEnabled) {
    next.pendingMiniGame = rollMiniGame(next);
  }

  return next;
}

export const EXPANSION_LEVEL = 3;
export const EXPANSION_COOLDOWN_MONTHS = 6;
export const EXPANSION_MAX_USES = 5;
export const INVESTMENT_LEVEL = 5;

export function expansionCost(state: GameState): number {
  const base = SECTORS[state.sectorId].cacBase * 300;
  // cada uso fica mais caro — evita que a ação vire um multiplicador infinito
  return Math.round(base * Math.pow(1.4, state.expansionsUsed));
}

export function canExpandMarket(state: GameState): boolean {
  if (state.level < EXPANSION_LEVEL) return false;
  if (state.expansionsUsed >= EXPANSION_MAX_USES) return false;
  if (state.lastExpansionMonth !== null && state.month - state.lastExpansionMonth < EXPANSION_COOLDOWN_MONTHS) {
    return false;
  }
  return state.cash >= expansionCost(state);
}

export function expandMarket(state: GameState): GameState {
  if (!canExpandMarket(state)) return state;
  const cost = expansionCost(state);
  const newCeiling = Math.round(state.marketCeiling * 1.15);
  const next: GameState = {
    ...state,
    cash: state.cash - cost,
    marketCeiling: newCeiling,
    lastExpansionMonth: state.month,
    expansionsUsed: state.expansionsUsed + 1,
    log: [
      ...state.log,
      {
        month: state.month,
        text: `${state.companyName} investiu em expansão de mercado: o teto de crescimento do mercado subiu para ${newCeiling.toLocaleString("pt-BR")} (${state.expansionsUsed + 1}/${EXPANSION_MAX_USES} expansões usadas).`,
        tone: "good",
      },
    ],
    updatedAt: Date.now(),
  };
  return applyMilestones(next);
}

export function investmentAmount(): number {
  return Math.round(INITIAL_CASH * 1.5);
}

export function canRaiseInvestment(state: GameState): boolean {
  return state.level >= INVESTMENT_LEVEL && !state.investmentRaised;
}

export function raiseInvestment(state: GameState): GameState {
  if (!canRaiseInvestment(state)) return state;
  const amount = investmentAmount();
  const next: GameState = {
    ...state,
    cash: state.cash + amount,
    permanentOverhead: state.permanentOverhead + 1200,
    investmentRaised: true,
    log: [
      ...state.log,
      {
        month: state.month,
        text: `${state.companyName} captou uma rodada de investimento e recebeu um aporte de caixa, com custo fixo permanente adicional.`,
        tone: "good",
      },
    ],
    updatedAt: Date.now(),
  };
  return applyMilestones(next);
}

export function applyDailyBonus(state: GameState, xpBonus: number, streakDays: number): GameState {
  const xp = state.xp + xpBonus;
  const next: GameState = {
    ...state,
    xp,
    level: levelForXp(xp),
    log: [
      ...state.log,
      {
        month: state.month,
        text: `🔥 ${streakDays} ${streakDays === 1 ? "dia seguido" : "dias seguidos"} jogando! Bônus de +${xpBonus} XP.`,
        tone: "good",
      },
    ],
    updatedAt: Date.now(),
  };
  return applyMilestones(next);
}

export function resolvePitchGame(state: GameState, stopPosition: number): GameState {
  const prompt = state.pendingMiniGame;
  if (!prompt || prompt.type !== "pitch") return state;

  const distance = Math.abs(stopPosition - prompt.targetCenter);
  const halfWidth = prompt.targetWidth / 2;
  const accuracy = clamp(1 - distance / halfWidth, 0, 1);
  const cashBonus = Math.round(500 + accuracy * 3500);
  const reputationBonus = Math.round(accuracy * 8);

  const tone: LogEntry["tone"] = accuracy >= 0.8 ? "good" : accuracy >= 0.4 ? "neutral" : "bad";
  const quality = accuracy >= 0.8 ? "impecável" : accuracy >= 0.4 ? "razoável" : "fraco";
  const text = `${prompt.title}: resultado ${quality}. +${cashBonus.toLocaleString("pt-BR")} em caixa${reputationBonus > 0 ? `, +${reputationBonus} de reputação` : ""}.`;

  const next: GameState = {
    ...state,
    pendingMiniGame: null,
    cash: state.cash + cashBonus,
    reputation: clamp(state.reputation + reputationBonus, 0, 100),
    log: [...state.log, { month: state.month, text, tone }],
    updatedAt: Date.now(),
  };
  return applyMilestones(next);
}

export function setMiniGamesEnabled(state: GameState, enabled: boolean): GameState {
  return { ...state, miniGamesEnabled: enabled, updatedAt: Date.now() };
}

export function resolveQuizGame(state: GameState, selectedIndex: number): GameState {
  const prompt = state.pendingMiniGame;
  if (!prompt || prompt.type !== "quiz") return state;

  const correct = selectedIndex === prompt.correctIndex;
  const xpBonus = correct ? 25 : 0;
  const text = correct
    ? `✅ Resposta certa! ${prompt.explanation} (+${xpBonus} XP)`
    : `❌ Não dessa vez. ${prompt.explanation}`;

  const xp = state.xp + xpBonus;
  const next: GameState = {
    ...state,
    pendingMiniGame: null,
    xp,
    level: levelForXp(xp),
    log: [...state.log, { month: state.month, text, tone: correct ? "good" : "neutral" }],
    updatedAt: Date.now(),
  };
  return applyMilestones(next);
}

export function resolveCrossroad(state: GameState, optionId: string): GameState {
  const prompt = state.pendingCrossroad;
  if (!prompt) return state;

  const definitions = buildCrossroads(state);
  const definition = definitions.find((d) => d.id === prompt.id);
  const optionDef = definition?.options.find((o) => o.id === optionId);
  const storedOption = prompt.options.find((o) => o.id === optionId);
  if (!definition || !optionDef || !storedOption) return state;

  const effect = optionDef.apply(state, storedOption.value);

  let next: GameState = {
    ...state,
    pendingCrossroad: null,
    resolvedCrossroads: [...state.resolvedCrossroads, prompt.id],
    cash: state.cash + (effect.cashDelta ?? 0),
    reputation: clamp(state.reputation + (effect.reputationDelta ?? 0), 0, 100),
    customers: Math.max(0, Math.round(state.customers + (effect.customersDelta ?? 0))),
    permanentOverhead: Math.max(0, state.permanentOverhead + (effect.permanentOverheadDelta ?? 0)),
    unitCostAdjustment: state.unitCostAdjustment + (effect.unitCostAdjustmentDelta ?? 0),
    log: [...state.log, { month: state.month, text: effect.logText, tone: effect.logTone }],
    updatedAt: Date.now(),
  };

  next = applyMilestones(next);

  if (effect.endGame === "acquired") {
    next.gameOver = true;
    next.gameOverReason = "acquired";
  }

  return next;
}
