import { GameState } from "@/lib/nexus/types";
import { SECTORS } from "@/lib/nexus/sectors";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/nexus/format";
import MetricChart from "../MetricChart";
import EventLog from "../EventLog";

export default function MarketView({ state }: { state: GameState }) {
  const sector = SECTORS[state.sectorId];
  const last = state.history.at(-1)!;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">{sector.emoji}</span>
          <h1 className="text-lg font-semibold text-white">{sector.name}</h1>
        </div>
        <p className="text-sm text-slate-400 mb-4">{sector.tagline}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-slate-500 text-xs mb-0.5">Tamanho do mercado</div>
            <div className="text-white font-mono">{formatNumber(state.marketSize)}</div>
          </div>
          <div>
            <div className="text-slate-500 text-xs mb-0.5">Crescimento/mês</div>
            <div className="text-white font-mono">{formatPercent(sector.marketGrowth)}</div>
          </div>
          <div>
            <div className="text-slate-500 text-xs mb-0.5">Preço de referência</div>
            <div className="text-white font-mono">{formatCurrency(sector.referencePrice)}</div>
          </div>
          <div>
            <div className="text-slate-500 text-xs mb-0.5">Seu market share</div>
            <div className="text-white font-mono">{formatPercent(last.marketShare)}</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <MetricChart history={state.history} metrics={["marketShare", "customers"]} />
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="text-sm text-slate-400 mb-2">Histórico de eventos de mercado</div>
        <EventLog log={state.log} limit={50} maxHeight="max-h-[28rem]" />
      </div>
    </div>
  );
}
