import { GameState } from "@/lib/nexus/types";
import { SECTORS } from "@/lib/nexus/sectors";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/nexus/format";
import MetricChart from "../MetricChart";
import EventLog from "../EventLog";
import Sparkline from "../Sparkline";

export default function MarketView({ state }: { state: GameState }) {
  const sector = SECTORS[state.sectorId];
  const last = state.history.at(-1)!;
  const youAhead = last.customers >= last.rivalCustomers;

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

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-slate-400">Você vs. concorrência</div>
          <span
            className={`text-xs rounded-full px-2.5 py-1 ${
              youAhead ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"
            }`}
          >
            {youAhead ? "Você lidera" : `${state.rival.name} lidera`}
          </span>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-4">
            <div className="text-xs text-amber-300 mb-1">{state.companyName} (você)</div>
            <div className="text-xl font-mono text-white mb-1">{formatNumber(last.customers)} clientes</div>
            <div className="text-xs text-slate-400 mb-2">{formatPercent(last.marketShare)} de market share</div>
            <Sparkline points={state.history.slice(-12).map((h) => h.customers)} color="#f59e0b" />
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4">
            <div className="text-xs text-slate-400 mb-1">{state.rival.name}</div>
            <div className="text-xl font-mono text-white mb-1">{formatNumber(last.rivalCustomers)} clientes</div>
            <div className="text-xs text-slate-400 mb-2">{formatPercent(last.rivalMarketShare)} de market share</div>
            <Sparkline points={state.history.slice(-12).map((h) => h.rivalCustomers)} color="#94a3b8" />
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-4">
          {state.rival.name} é uma concorrente simulada dentro da sua própria partida — não são dados de
          outros jogadores. Ela mantém preço estável na referência do setor e disputa o mesmo mercado que você.
        </p>
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
