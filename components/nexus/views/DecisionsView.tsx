import { GameState, Decisions } from "@/lib/nexus/types";
import { SECTORS } from "@/lib/nexus/sectors";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/nexus/format";
import DecisionPanel from "../DecisionPanel";
import CrossroadCard from "../CrossroadCard";
import SpecialActions from "../SpecialActions";

export default function DecisionsView({
  state,
  onAdvance,
  onResolveCrossroad,
  onExpandMarket,
  onRaiseInvestment,
}: {
  state: GameState;
  onAdvance: (decisions: Decisions) => void;
  onResolveCrossroad: (optionId: string) => void;
  onExpandMarket: () => void;
  onRaiseInvestment: () => void;
}) {
  const last = state.history.at(-1)!;

  if (state.pendingCrossroad) {
    return <CrossroadCard prompt={state.pendingCrossroad} onResolve={onResolveCrossroad} />;
  }

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6">
      <div className="space-y-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
          <div className="text-sm text-slate-400">Resumo antes de decidir — mês {state.month}</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-slate-500 text-xs">Caixa</div>
              <div className="text-white font-mono">{formatCurrency(state.cash)}</div>
            </div>
            <div>
              <div className="text-slate-500 text-xs">Clientes</div>
              <div className="text-white font-mono">{formatNumber(state.customers)}</div>
            </div>
            <div>
              <div className="text-slate-500 text-xs">Market share</div>
              <div className="text-white font-mono">{formatPercent(last.marketShare)}</div>
            </div>
            <div>
              <div className="text-slate-500 text-xs">Reputação</div>
              <div className="text-white font-mono">{Math.round(state.reputation)}/100</div>
            </div>
            <div>
              <div className="text-slate-500 text-xs">Lucro último mês</div>
              <div className={`font-mono ${last.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {formatCurrency(last.profit)}
              </div>
            </div>
            <div>
              <div className="text-slate-500 text-xs">Preço de referência</div>
              <div className="text-white font-mono">{formatCurrency(SECTORS[state.sectorId].referencePrice)}</div>
            </div>
          </div>
          <p className="text-xs text-slate-500 pt-2 border-t border-slate-800">
            Ajuste preço, marketing, P&D e equipe no painel ao lado e clique em avançar para simular o próximo mês.
          </p>
        </div>

        <SpecialActions state={state} onExpand={onExpandMarket} onInvest={onRaiseInvestment} />
      </div>

      <DecisionPanel
        sector={SECTORS[state.sectorId]}
        initial={state.decisions}
        onAdvance={onAdvance}
        disabled={state.gameOver}
      />
    </div>
  );
}
