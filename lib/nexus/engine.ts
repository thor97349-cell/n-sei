import { SECTORS } from "./sectors";
import { Decisions, GameState, HistoryEntry, LogEntry, SectorId } from "./types";
import { emptyModifiers, rollEvent } from "./events";
import { checkMilestones, levelForXp } from "./xp";

const BANKRUPTCY_THRESHOLD = -5000;

export function createNewGame(companyName: string, sectorId: SectorId): GameState {
  const sector = SECTORS[sectorId];
  const startingCustomers = Math.round(sector.marketSize * 0.003);
  const initialHistory: HistoryEntry = {
    month: 0,
    revenue: startingCustomers * sector.referencePrice,
    profit: 0,
    customers: startingCustomers,
    marketShare: startingCustomers / sector.marketSize,
    cash: 20000,
    reputation: 55,
  };

  return {
    companyName: companyName.trim() || "Minha Empresa",
    sectorId,
    month: 0,
    cash: 20000,
    customers: startingCustomers,
    marketSize: sector.marketSize,
    reputation: 55,
    xp: 0,
    level: 1,
    decisions: {
      price: sector.referencePrice,
      marketingSpend: Math.round(sector.cacBase * 20),
      rndSpend: 0,
      staff: { sales: 1, support: 1, product: 1 },
    },
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

  const effectiveCac = sector.cacBase / repFactor;
  const rawLeads = decisions.marketingSpend / effectiveCac;
  const saturation = 1 / (1 + rawLeads / 500);
  let newCustomers = rawLeads * saturation * priceDemandFactor * repFactor * mods.demandMultiplier;

  const newMarketSize = Math.round(state.marketSize * (1 + sector.marketGrowth) * mods.marketSizeMultiplier);

  const remainingMarket = Math.max(newMarketSize - state.customers, 0);
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
  const target = clamp(50 + supportEffect + productEffect + rndEffect - overpricingPenalty, 0, 100);
  let reputation = state.reputation + (target - state.reputation) * 0.25 + mods.reputationDelta;
  reputation = clamp(reputation, 0, 100);

  const marketShare = newMarketSize > 0 ? customersAfter / newMarketSize : 0;

  const month = state.month + 1;
  const historyEntry: HistoryEntry = {
    month,
    revenue,
    profit,
    customers: customersAfter,
    marketShare,
    cash,
    reputation,
  };

  const log: LogEntry[] = [
    ...state.log,
    { month, text: event.text(state.companyName), tone: event.tone },
  ];

  const next: GameState = {
    ...state,
    month,
    cash,
    customers: customersAfter,
    marketSize: newMarketSize,
    reputation,
    decisions,
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
