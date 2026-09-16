"use client";

import { useState } from "react";
import { GameState } from "@/lib/nexus/types";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/nexus/format";
import { generateAdvice } from "@/lib/nexus/advisor";
import Sparkline from "../Sparkline";
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

function DeltaTag({ deltaPercent: dp }: { deltaPercent?: number }) {
  const hasDelta = dp !== undefined && Number.isFinite(dp);
  if (!hasDelta) return null;
  const isGood = dp! >= 0;
  return (
    <span className={`text-xs font-medium shrink-0 ${isGood ? "text-emerald-400" : "text-rose-400"}`}>
      {isGood ? "↑" : "↓"} {Math.abs(dp!).toFixed(1)}%
    </span>
  );
}

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

  const secondaryMetrics = [
    { label: "Receita mensal", value: formatCurrency(last.revenue), delta: deltaPercent(last.revenue, prev?.revenue) },
    { label: "Clientes ativos", value: formatNumber(last.customers), delta: deltaPercent(last.customers, prev?.customers) },
    { label: "Market share", value: formatPercent(last.marketShare), delta: deltaPercent(last.marketShare, prev?.marketShare) },
  ];

  return (
    <div className="space-y-5">
      {(state.pendingCrossroad || state.pendingMiniGame) && (
        <div className="flex flex-col sm:flex-row gap-2">
          {state.pendingCrossroad && (
            <button
              onClick={() => onNavigate("decisions")}
              className="flex-1 flex items-center justify-between gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-left hover:bg-amber-400/15 transition-colors"
            >
              <span className="text-sm text-amber-200">
                ⚡ <strong>{state.pendingCrossroad.title}</strong> precisa da sua decisão.
              </span>
              <span className="text-xs text-amber-300 shrink-0">Decidir →</span>
            </button>
          )}
          {state.pendingMiniGame && (
            <button
              onClick={() => onNavigate("decisions")}
              className="flex-1 flex items-center justify-between gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-left hover:bg-amber-400/15 transition-colors"
            >
              <span className="text-sm text-amber-200">
                🎯 <strong>{state.pendingMiniGame.title}</strong> disponível.
              </span>
              <span className="text-xs text-amber-300 shrink-0">Jogar →</span>
            </button>
          )}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-semibold text-white">
          {timeGreeting()}, {state.founderName}.
        </h1>
        <p className="text-slate-400 text-sm mt-1">{goalSubtitle(state)}</p>
      </div>

      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-4">
        <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/80 to-slate-900/30 p-5">
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Lucro mensal</div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-4xl font-semibold text-white font-mono break-all">
              {formatCurrency(last.profit)}
            </span>
            <DeltaTag deltaPercent={deltaPercent(last.profit, prev?.profit)} />
          </div>
          <div className="mt-4">
            <Sparkline points={state.history.slice(-12).map((h) => h.profit)} color="#f59e0b" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 divide-y divide-slate-800">
          {secondaryMetrics.map((m) => (
            <div key={m.label} className="flex items-center justify-between gap-3 px-5 py-3.5 min-w-0">
              <span className="text-sm text-slate-400">{m.label}</span>
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-sm font-mono text-white break-all">{m.value}</span>
                <DeltaTag deltaPercent={m.delta} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <div className="text-sm text-slate-400">Evolução</div>
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
        <MetricChart history={windowed} />
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-4">
        <div className={`rounded-2xl border bg-slate-900/50 p-4 flex flex-col ${TONE_BORDER[advice.tone]}`}>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-amber-400 mb-2">
            🧠 Consultor IA
          </div>
          <div className="text-white font-medium mb-1.5">{advice.title}</div>
          <p className="text-sm text-slate-400 flex-1">{advice.text}</p>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => onNavigate("advisor")}
              className="flex-1 rounded-lg bg-amber-500 py-2 text-sm font-medium text-slate-950 hover:bg-amber-400"
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

        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="text-sm text-slate-400 mb-2">Eventos recentes</div>
          <EventLog log={state.log} limit={6} maxHeight="max-h-56" />
        </div>
      </div>
    </div>
  );
}
