"use client";

import { useState } from "react";
import { GameState } from "@/lib/nexus/types";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/nexus/format";
import { generateAdvice } from "@/lib/nexus/advisor";
import StatCard from "../StatCard";
import MetricChart from "../MetricChart";
import EventLog from "../EventLog";
import { ViewId } from "@/lib/nexus/views";

const RANGE_OPTIONS: { id: number | "all"; label: string }[] = [
  { id: 3, label: "3 meses" },
  { id: 6, label: "6 meses" },
  { id: 12, label: "12 meses" },
  { id: "all", label: "Tudo" },
];

function timeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function goalSubtitle(state: GameState): string {
  switch (state.goal) {
    case "build":
      return `Aqui está o que está rolando com a ${state.companyName} hoje.`;
    case "learn":
      return `Veja o que os números da ${state.companyName} estão ensinando este mês.`;
    case "compete":
      return `Hora de otimizar a ${state.companyName} e bater seu recorde.`;
    case "invest":
      return `Veja como suas decisões impactaram caixa e margem da ${state.companyName}.`;
    default:
      return `Aqui está o que está rolando com a ${state.companyName} hoje.`;
  }
}

function deltaPercent(current: number, previous: number | undefined): number | undefined {
  if (previous === undefined) return undefined;
  if (previous === 0) return current === 0 ? 0 : current > 0 ? 100 : -100;
  return ((current - previous) / Math.abs(previous)) * 100;
}

const TONE_BORDER: Record<string, string> = {
  good: "border-emerald-500/40",
  bad: "border-rose-500/40",
  neutral: "border-slate-700",
};

export default function OverviewView({
  state,
  onNavigate,
}: {
  state: GameState;
  onNavigate: (view: ViewId) => void;
}) {
  const [range, setRange] = useState<number | "all">(6);

  const last = state.history.at(-1)!;
  const prev = state.history.length > 1 ? state.history.at(-2) : undefined;

  const windowed = range === "all" ? state.history : state.history.slice(-range);
  const advice = generateAdvice(state)[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            {timeGreeting()}, {state.founderName}.
          </h1>
          <p className="text-slate-400 text-sm mt-1">{goalSubtitle(state)}</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-slate-800/60 p-0.5">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => setRange(opt.id)}
              className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                range === opt.id ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Receita mensal"
          value={formatCurrency(last.revenue)}
          deltaPercent={deltaPercent(last.revenue, prev?.revenue)}
          points={state.history.slice(-12).map((h) => h.revenue)}
        />
        <StatCard
          label="Lucro mensal"
          value={formatCurrency(last.profit)}
          deltaPercent={deltaPercent(last.profit, prev?.profit)}
          points={state.history.slice(-12).map((h) => h.profit)}
        />
        <StatCard
          label="Clientes ativos"
          value={formatNumber(last.customers)}
          deltaPercent={deltaPercent(last.customers, prev?.customers)}
          points={state.history.slice(-12).map((h) => h.customers)}
        />
        <StatCard
          label="Market share"
          value={formatPercent(last.marketShare)}
          deltaPercent={deltaPercent(last.marketShare, prev?.marketShare)}
          points={state.history.slice(-12).map((h) => h.marketShare)}
        />
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <MetricChart history={windowed} />
        </div>

        <div className={`rounded-xl border bg-slate-900/50 p-4 flex flex-col ${TONE_BORDER[advice.tone]}`}>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-cyan-400 mb-2">
            🧠 Consultor IA
          </div>
          <div className="text-white font-medium mb-1.5">{advice.title}</div>
          <p className="text-sm text-slate-400 flex-1">{advice.text}</p>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => onNavigate("advisor")}
              className="flex-1 rounded-lg bg-cyan-500 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400"
            >
              Ver tudo
            </button>
            <button
              onClick={() => onNavigate("decisions")}
              className="flex-1 rounded-lg border border-slate-700 py-2 text-sm text-slate-300 hover:border-slate-500"
            >
              Decidir
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="text-sm text-slate-400 mb-2">Eventos recentes</div>
        <EventLog log={state.log} limit={6} maxHeight="max-h-56" />
      </div>
    </div>
  );
}
