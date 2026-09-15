export default function StatCard({
  label,
  value,
  delta,
  accent,
}: {
  label: string;
  value: string;
  delta?: string;
  accent?: "good" | "bad" | "neutral";
}) {
  const deltaColor =
    accent === "good" ? "text-emerald-400" : accent === "bad" ? "text-rose-400" : "text-slate-400";

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">{label}</div>
      <div className="text-xl font-semibold text-white font-mono">{value}</div>
      {delta && <div className={`text-xs mt-1 ${deltaColor}`}>{delta}</div>}
    </div>
  );
}
