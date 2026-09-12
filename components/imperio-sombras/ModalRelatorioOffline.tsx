import { formatarDuracao, formatarNumero } from "@/lib/imperio-sombras/format";
import type { RelatorioOffline } from "@/lib/imperio-sombras/types";

export default function ModalRelatorioOffline({
  relatorio,
  onFechar,
}: {
  relatorio: RelatorioOffline;
  onFechar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-zinc-950 p-5 shadow-2xl shadow-amber-900/20">
        <h2 className="mb-1 text-lg font-bold text-white">🌙 Enquanto você esteve fora</h2>
        <p className="mb-4 text-sm text-white/50">
          {formatarDuracao(relatorio.duracaoMs)} se passaram para o seu império.
        </p>

        <div className="mb-4 space-y-2 rounded-lg bg-white/5 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-white/60">Dinheiro arrecadado</span>
            <span className="font-mono text-amber-400">
              +{formatarNumero(relatorio.dinheiroGanho)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Influência ganha</span>
            <span className="font-mono text-violet-400">
              +{formatarNumero(relatorio.influenciaGanha)}
            </span>
          </div>
        </div>

        {relatorio.criseOcorreu && (
          <p className="mb-4 text-sm text-red-400">
            ⚠️ Um ou mais distritos entraram em crise enquanto você estava fora.
          </p>
        )}

        <button
          type="button"
          onClick={onFechar}
          className="w-full rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-500"
        >
          Continuar governando
        </button>
      </div>
    </div>
  );
}
