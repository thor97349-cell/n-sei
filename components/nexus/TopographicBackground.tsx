export default function TopographicBackground() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07]"
      preserveAspectRatio="none"
      viewBox="0 0 800 600"
      aria-hidden="true"
    >
      <path
        d="M-20 480 Q 120 400 260 460 T 540 440 T 820 480"
        fill="none"
        stroke="#f59e0b"
        strokeWidth="1.5"
      />
      <path
        d="M-20 520 Q 140 450 300 500 T 580 490 T 820 520"
        fill="none"
        stroke="#f59e0b"
        strokeWidth="1.5"
      />
      <path
        d="M-20 560 Q 160 510 340 545 T 620 540 T 820 560"
        fill="none"
        stroke="#f59e0b"
        strokeWidth="1.5"
      />
      <path
        d="M-20 240 L 220 60 L 340 190 L 430 40 L 560 200 L 680 90 L 820 220"
        fill="none"
        stroke="#f59e0b"
        strokeWidth="1.2"
      />
      <path
        d="M-20 300 L 220 130 L 340 250 L 430 110 L 560 260 L 680 160 L 820 280"
        fill="none"
        stroke="#f59e0b"
        strokeWidth="1"
      />
    </svg>
  );
}
