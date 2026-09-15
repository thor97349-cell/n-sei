import { HistoryEntry } from "@/lib/nexus/types";

export default function RevenueChart({ history }: { history: HistoryEntry[] }) {
  const points = history.slice(-24);
  if (points.length < 2) {
    return <div className="text-sm text-slate-500">Dados insuficientes ainda.</div>;
  }

  const width = 100;
  const height = 36;
  const max = Math.max(...points.map((p) => p.revenue), 1);
  const min = Math.min(...points.map((p) => p.revenue), 0);
  const range = max - min || 1;

  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((p.revenue - min) / range) * height;
    return `${x},${y}`;
  });

  const areaPath = `M0,${height} L${coords.join(" L")} L${width},${height} Z`;
  const linePath = `M${coords.join(" L")}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24" preserveAspectRatio="none">
      <path d={areaPath} fill="url(#nexusRevenueGradient)" opacity={0.5} />
      <path d={linePath} fill="none" stroke="#22d3ee" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
      <defs>
        <linearGradient id="nexusRevenueGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.6} />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
        </linearGradient>
      </defs>
    </svg>
  );
}
