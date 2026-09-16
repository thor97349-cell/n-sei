import Sparkline from "./Sparkline";

export default function StatCard({
  label,
  value,
  deltaPercent,
  points,
}: {
  label: string;
  value: string;
  deltaPercent?: number;
  points?: number[];
}) {
  const hasDelta = deltaPercent !== undefined && Number.isFinite(deltaPercent);
  const isGood = hasDelta && deltaPercent! >= 0;
  const deltaColor = hasDelta ? (isGood ? "text-emerald-400" : "text-rose-400") : "text-slate-500";

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex items-start justify-between mb-1">
        <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
        {hasDelta && (
          <span className={`text-xs font-medium ${deltaColor}`}>
            {isGood ? "↑" : "↓"} {Math.abs(deltaPercent!).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="text-xl font-semibold text-white font-mono mb-2">{value}</div>
      {points && points.length > 1 && (
        <Sparkline points={points} color={!hasDelta ? "#f59e0b" : isGood ? "#34d399" : "#fb7185"} />
      )}
    </div>
  );
}
