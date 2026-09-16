import { VELOCIDADES } from "@/lib/imperio-sombras/constants";

export default function SeletorVelocidade({
  velocidade,
  onDefinir,
}: {
  velocidade: number;
  onDefinir: (velocidade: number) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
      {VELOCIDADES.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onDefinir(v)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
            velocidade === v
              ? "bg-fuchsia-700 text-white"
              : "text-white/50 hover:text-white/80"
          }`}
        >
          {v}x
        </button>
      ))}
    </div>
  );
}
