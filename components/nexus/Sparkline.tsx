export default function Sparkline({ points, color = "#f59e0b" }: { points: number[]; color?: string }) {
  if (points.length < 2) {
    return <div className="h-6" />;
  }

  const width = 100;
  const height = 24;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;

  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((p - min) / range) * height;
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-6" preserveAspectRatio="none">
      <path d={`M${coords.join(" L")}`} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
