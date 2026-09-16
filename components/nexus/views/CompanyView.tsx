import { GameState } from "@/lib/nexus/types";
import { SECTORS } from "@/lib/nexus/sectors";
import { formatCurrency } from "@/lib/nexus/format";
import { interestLabel, goalLabel } from "@/lib/nexus/options";

const STAFF_LABELS: Record<string, string> = { sales: "Vendas", support: "Suporte", product: "Produto" };

export default function CompanyView({ state }: { state: GameState }) {
  const sector = SECTORS[state.sectorId];
  const last = state.history.at(-1)!;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">{sector.emoji}</span>
          <h1 className="text-xl font-semibold text-white">{state.companyName}</h1>
        </div>
        <p className="text-sm text-slate-400">
          {sector.name} · fundada por {state.founderName} · mês {state.month}
        </p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">
            Objetivo: {goalLabel(state.goal)}
          </span>
          {state.interests.map((i) => (
            <span key={i} className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs text-amber-300">
              {interestLabel(i)}
            </span>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <div className="text-sm text-slate-400 mb-3">Reputação</div>
          <div className="flex items-end gap-2 mb-2">
            <span className="text-3xl font-semibold text-white font-mono">{Math.round(state.reputation)}</span>
            <span className="text-slate-500 mb-1">/100</span>
          </div>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full ${state.reputation >= 60 ? "bg-emerald-400" : state.reputation >= 35 ? "bg-amber-400" : "bg-rose-400"}`}
              style={{ width: `${state.reputation}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Influenciada por equipe de suporte, investimento em P&D e se o preço está alinhado ao mercado.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <div className="text-sm text-slate-400 mb-3">Equipe atual</div>
          <div className="space-y-2">
            {(Object.keys(STAFF_LABELS) as (keyof typeof STAFF_LABELS)[]).map((role) => (
              <div key={role} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">{STAFF_LABELS[role]}</span>
                <span className="font-mono text-white">
                  {state.decisions.staff[role as keyof typeof state.decisions.staff]}{" "}
                  <span className="text-slate-500">
                    ({formatCurrency(sector.salaries[role as keyof typeof sector.salaries])}/pessoa)
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="text-sm text-slate-400 mb-3">Demonstrativo do mês {state.month}</div>
        <div className="space-y-1.5 text-sm font-mono">
          <div className="flex justify-between text-slate-300">
            <span>Receita</span>
            <span>{formatCurrency(last.revenue)}</span>
          </div>
          <div className="flex justify-between text-rose-300/80">
            <span>Custo variável</span>
            <span>-{formatCurrency(last.variableCosts)}</span>
          </div>
          <div className="flex justify-between text-rose-300/80">
            <span>Folha de pagamento</span>
            <span>-{formatCurrency(last.staffCosts)}</span>
          </div>
          <div className="flex justify-between text-rose-300/80">
            <span>Custos fixos</span>
            <span>-{formatCurrency(last.fixedCosts)}</span>
          </div>
          <div className="flex justify-between text-rose-300/80">
            <span>Marketing</span>
            <span>-{formatCurrency(last.marketingSpend)}</span>
          </div>
          <div className="flex justify-between text-rose-300/80">
            <span>P&D</span>
            <span>-{formatCurrency(last.rndSpend)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-800 pt-2 mt-2 text-white font-semibold">
            <span>Lucro líquido</span>
            <span className={last.profit >= 0 ? "text-emerald-400" : "text-rose-400"}>
              {formatCurrency(last.profit)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
