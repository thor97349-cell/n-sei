import type { LogEntry } from "@/lib/imperio-sombras/types";

const COR_TIPO: Record<LogEntry["tipo"], string> = {
  info: "text-white/60",
  positivo: "text-emerald-400",
  negativo: "text-red-400",
  evento: "text-fuchsia-400",
};

function formatarHora(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function AbaRegistro({ registro }: { registro: LogEntry[] }) {
  if (registro.length === 0) {
    return <p className="text-sm text-white/40">Nada aconteceu ainda.</p>;
  }

  return (
    <ul className="space-y-1.5">
      {registro.map((entrada) => (
        <li key={entrada.id} className="flex gap-2 text-sm">
          <span className="shrink-0 font-mono text-xs text-white/30">
            {formatarHora(entrada.timestamp)}
          </span>
          <span className={COR_TIPO[entrada.tipo]}>{entrada.mensagem}</span>
        </li>
      ))}
    </ul>
  );
}
