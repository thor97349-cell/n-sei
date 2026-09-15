import { GameState } from "@/lib/nexus/types";
import { SECTORS } from "@/lib/nexus/sectors";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/nexus/format";
import { xpProgress } from "@/lib/nexus/xp";
import StatCard from "./StatCard";
import RevenueChart from "./RevenueChart";
import EventLog from "./EventLog";

export default function Dashboard({ state }: { state: GameState }) {
  const sector = SECTORS[state.sectorId];
  const last = state.history.at(-1)!;
  const prev = state.history.at(-2);
  const profitDelta = prev ? last.profit - prev.profit : 0;

  const { level, currentXp, neededXp } = xpProgress(state.xp);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-400 mb-1">
            {sector.emoji} {sector.name} · Mês {state.month}
          </div>
          <h1 className="text-2xl font-semibold text-white">{state.companyName}</h1>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500 mb-1">Nível {level}</div>
          <div className="w-40 h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-cyan-400"
              style={{ width: `${Math.min(100, (currentXp / neededXp) * 100)}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            {currentXp}/{neededXp} XP
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Caixa" value={formatCurrency(state.cash)} />
        <StatCard label="Receita mensal" value={formatCurrency(last.revenue)} />
        <StatCard
          label="Lucro mensal"
          value={formatCurrency(last.profit)}
          delta={prev ? `${profitDelta >= 0 ? "+" : ""}${formatCurrency(profitDelta)} vs mês anterior` : undefined}
          accent={last.profit >= 0 ? "good" : "bad"}
        />
        <StatCard label="Clientes ativos" value={formatNumber(state.customers)} />
        <StatCard label="Market share" value={formatPercent(last.marketShare)} />
        <StatCard label="Reputação" value={`${Math.round(state.reputation)}/100`} />
        <StatCard label="Tamanho do mercado" value={formatNumber(state.marketSize)} />
        <StatCard label="XP total" value={formatNumber(state.xp)} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="text-sm text-slate-400 mb-2">Receita — últimos meses</div>
          <RevenueChart history={state.history} />
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="text-sm text-slate-400 mb-2">Eventos recentes</div>
          <EventLog log={state.log} />
        </div>
      </div>
    </div>
  );
}
