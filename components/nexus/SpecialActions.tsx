import { GameState } from "@/lib/nexus/types";
import { formatCurrency } from "@/lib/nexus/format";
import {
  EXPANSION_COOLDOWN_MONTHS,
  EXPANSION_LEVEL,
  INVESTMENT_LEVEL,
  canExpandMarket,
  canRaiseInvestment,
  expansionCost,
  investmentAmount,
} from "@/lib/nexus/engine";
import { xpProgress } from "@/lib/nexus/xp";

export default function SpecialActions({
  state,
  onExpand,
  onInvest,
}: {
  state: GameState;
  onExpand: () => void;
  onInvest: () => void;
}) {
  const { level } = xpProgress(state.xp);

  const expansionUnlocked = level >= EXPANSION_LEVEL;
  const expansionCooling =
    state.lastExpansionMonth !== null && state.month - state.lastExpansionMonth < EXPANSION_COOLDOWN_MONTHS;
  const expansionAvailable = canExpandMarket(state);

  const investmentUnlocked = level >= INVESTMENT_LEVEL;
  const investmentAvailable = canRaiseInvestment(state);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
      <div className="text-sm text-slate-400">Ações especiais (desbloqueadas por nível)</div>

      <div className={`rounded-lg border p-4 ${expansionUnlocked ? "border-slate-700" : "border-slate-800 opacity-50"}`}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-white font-medium">🗺️ Expandir mercado</span>
          {!expansionUnlocked && <span className="text-xs text-slate-500">Nível {EXPANSION_LEVEL}+</span>}
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Investe em expansão para crescer o mercado endereçável em 15% permanentemente. Cooldown de{" "}
          {EXPANSION_COOLDOWN_MONTHS} meses.
        </p>
        {expansionUnlocked && (
          <button
            disabled={!expansionAvailable}
            onClick={onExpand}
            className="w-full rounded-lg bg-amber-500 py-2 text-sm font-medium text-slate-950 hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {expansionCooling
              ? `Em cooldown até o mês ${(state.lastExpansionMonth ?? 0) + EXPANSION_COOLDOWN_MONTHS}`
              : `Expandir por ${formatCurrency(expansionCost(state))}`}
          </button>
        )}
      </div>

      <div className={`rounded-lg border p-4 ${investmentUnlocked ? "border-slate-700" : "border-slate-800 opacity-50"}`}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-white font-medium">💼 Captar investimento</span>
          {!investmentUnlocked && <span className="text-xs text-slate-500">Nível {INVESTMENT_LEVEL}+</span>}
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Rodada única: aporte de caixa em troca de um custo fixo permanente adicional de governança.
        </p>
        {investmentUnlocked && (
          <button
            disabled={!investmentAvailable}
            onClick={onInvest}
            className="w-full rounded-lg bg-amber-500 py-2 text-sm font-medium text-slate-950 hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {state.investmentRaised ? "Já captada" : `Captar ${formatCurrency(investmentAmount())}`}
          </button>
        )}
      </div>
    </div>
  );
}
