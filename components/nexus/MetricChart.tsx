"use client";

import { useState } from "react";
import { HistoryEntry } from "@/lib/nexus/types";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/nexus/format";

type MetricId = "revenue" | "profit" | "customers" | "marketShare" | "cash";

const ALL_METRICS: Record<MetricId, { label: string; accessor: (h: HistoryEntry) => number; format: (v: number) => string; color: string }> = {
  revenue: { label: "Receita", accessor: (h) => h.revenue, format: formatCurrency, color: "#22d3ee" },
  profit: { label: "Lucro", accessor: (h) => h.profit, format: formatCurrency, color: "#34d399" },
  customers: { label: "Clientes", accessor: (h) => h.customers, format: formatNumber, color: "#a78bfa" },
  marketShare: { label: "Market share", accessor: (h) => h.marketShare, format: formatPercent, color: "#f472b6" },
  cash: { label: "Caixa", accessor: (h) => h.cash, format: formatCurrency, color: "#fbbf24" },
};

export default function MetricChart({
  history,
  metrics = ["revenue", "profit", "customers"],
}: {
  history: HistoryEntry[];
  metrics?: MetricId[];
}) {
  const METRICS = Object.fromEntries(metrics.map((id) => [id, ALL_METRICS[id]])) as typeof ALL_METRICS;
  const [metric, setMetric] = useState<MetricId>(metrics[0]);
  const config = METRICS[metric];
  const points = history.slice(-24);

  const width = 100;
  const height = 46;
  let path: string | null = null;
  let areaPath: string | null = null;

  if (points.length >= 2) {
    const values = points.map(config.accessor);
    const max = Math.max(...values, 0);
    const min = Math.min(...values, 0);
    const range = max - min || 1;

    const coords = points.map((p, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((config.accessor(p) - min) / range) * height;
      return `${x},${y}`;
    });

    path = `M${coords.join(" L")}`;
    areaPath = `M0,${height} L${coords.join(" L")} L${width},${height} Z`;
  }

  const last = points.at(-1);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-slate-400">
          {config.label} — últimos meses
          {last && <span className="ml-2 text-white font-mono text-sm">{config.format(config.accessor(last))}</span>}
        </div>
        <div className="flex gap-1 rounded-lg bg-slate-800/60 p-0.5">
          {(Object.keys(METRICS) as MetricId[]).map((id) => (
            <button
              key={id}
              onClick={() => setMetric(id)}
              className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                metric === id ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {METRICS[id].label}
            </button>
          ))}
        </div>
      </div>
      {path ? (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40" preserveAspectRatio="none">
          <path d={areaPath!} fill={`url(#nexusMetricGradient-${metric})`} opacity={0.4} />
          <path d={path} fill="none" stroke={config.color} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
          <defs>
            <linearGradient id={`nexusMetricGradient-${metric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={config.color} stopOpacity={0.6} />
              <stop offset="100%" stopColor={config.color} stopOpacity={0} />
            </linearGradient>
          </defs>
        </svg>
      ) : (
        <div className="text-sm text-slate-500 h-40 flex items-center">Dados insuficientes ainda.</div>
      )}
    </div>
  );
}
