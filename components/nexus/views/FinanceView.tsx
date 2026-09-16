import { GameState } from "@/lib/nexus/types";
import { formatCurrency } from "@/lib/nexus/format";
import MetricChart from "../MetricChart";

export default function FinanceView({ state }: { state: GameState }) {
  const last = state.history.at(-1)!;
  const months = [...state.history].reverse().slice(0, 12);

  const runwayMonths =
    last.profit < 0 ? Math.max(0, Math.floor(state.cash / -last.profit)) : null;

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Caixa atual</div>
          <div className="text-xl font-semibold text-white font-mono">{formatCurrency(state.cash)}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Lucro do mês</div>
          <div className={`text-xl font-semibold font-mono ${last.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {formatCurrency(last.profit)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Runway estimado</div>
          <div className="text-xl font-semibold text-white font-mono">
            {runwayMonths === null ? "Lucrativa" : `${runwayMonths} meses`}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <MetricChart history={state.history} metrics={["cash", "revenue", "profit"]} />
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 overflow-x-auto">
        <div className="text-sm text-slate-400 mb-3">Histórico mensal</div>
        <table className="w-full text-sm min-w-[520px]">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-800">
              <th className="pb-2 pr-3">Mês</th>
              <th className="pb-2 pr-3">Receita</th>
              <th className="pb-2 pr-3">Custos totais</th>
              <th className="pb-2 pr-3">Lucro</th>
              <th className="pb-2">Caixa</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {months.map((m) => {
              const totalCosts = m.variableCosts + m.staffCosts + m.fixedCosts + m.marketingSpend + m.rndSpend;
              return (
                <tr key={m.month} className="border-b border-slate-900">
                  <td className="py-1.5 pr-3 text-slate-400">M{m.month}</td>
                  <td className="py-1.5 pr-3 text-slate-200">{formatCurrency(m.revenue)}</td>
                  <td className="py-1.5 pr-3 text-slate-200">{formatCurrency(totalCosts)}</td>
                  <td className={`py-1.5 pr-3 ${m.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {formatCurrency(m.profit)}
                  </td>
                  <td className="py-1.5 text-slate-200">{formatCurrency(m.cash)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
