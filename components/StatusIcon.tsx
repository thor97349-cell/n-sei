import type { TaskStatus } from "@/lib/types";

interface StatusIconProps {
  status: TaskStatus;
  className?: string;
}

export default function StatusIcon({ status, className }: StatusIconProps) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (status === "pendente") {
    // Clock — a fazer.
    return (
      <svg {...common} aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </svg>
    );
  }

  if (status === "em_andamento") {
    // Dotted circle — em andamento.
    return (
      <svg {...common} aria-hidden="true">
        <circle cx="12" cy="12" r="9" strokeDasharray="3 3.5" />
      </svg>
    );
  }

  // Check — concluída.
  return (
    <svg {...common} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </svg>
  );
}
