export default function VertexMark({ size = 28 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 24 24"
        width={size * 0.6}
        height={size * 0.6}
        fill="none"
        stroke="#0f172a"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 18L10 6l4 6 3-4 4 10" />
        <circle cx="17" cy="8" r="1.4" fill="#0f172a" stroke="none" />
      </svg>
    </div>
  );
}
