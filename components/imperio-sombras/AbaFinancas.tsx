import { LIMITE_DIVIDA_COBRANCA, OFERTAS_EMPRESTIMO } from "@/lib/imperio-sombras/constants";
import { getJurosDividaPorSegundo } from "@/lib/imperio-sombras/engine/selectors";
import { formatarNumero } from "@/lib/imperio-sombras/format";
import type { GameState } from "@/lib/imperio-sombras/types";

interface AbaFinancasProps {
  state: GameState;
  onPegarEmprestimo: (ofertaId: string) => void;
  onPagarDivida: () => void;
}

export default function AbaFinancas({
  state,
  onPegarEmprestimo,
  onPagarDivida,
}: AbaFinancasProps) {
  const jurosPorSegundo = getJurosDividaPorSegundo(state);
  const emCobranca = state.divida > LIMITE_DIVIDA_COBRANCA;
  const valorPagavel = Math.min(state.recursos.dinheiro, state.divida);

  return (
    <div className="space-y-6">
      <section
        className={`rounded-xl border p-5 ${
          emCobranca ? "border-red-500/40 bg-red-950/20" : "border-white/10 bg-white/[0.04]"
        }`}
      >
        <p className="text-xs uppercase tracking-wide text-white/50">Dívida atual</p>
        <p className="font-mono text-3xl font-bold text-red-400">
          💳 {formatarNumero(state.divida)}
        </p>
        {state.divida > 0 && (
          <p className="mt-1 text-xs text-white/50">
            Juros: +{formatarNumero(jurosPorSegundo)}/s
          </p>
        )}
        {emCobranca && (
          <p className="mt-2 text-sm text-red-300">
            ⚠️ Os cobradores estão de olho: o risco cresce mais rápido em todos os
            distritos até a dívida cair abaixo de {formatarNumero(LIMITE_DIVIDA_COBRANCA)}.
          </p>
        )}
        <button
          type="button"
          disabled={valorPagavel <= 0}
          onClick={onPagarDivida}
          className="mt-3 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30"
        >
          Pagar o quanto puder · 💰{formatarNumero(valorPagavel)}
        </button>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/50">
          Pedir empréstimo
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {OFERTAS_EMPRESTIMO.map((oferta) => (
            <div
              key={oferta.id}
              className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-4"
            >
              <span className="text-2xl">{oferta.icone}</span>
              <h3 className="font-semibold text-white">{oferta.nome}</h3>
              <p className="text-xs text-white/40">{oferta.descricao}</p>
              <p className="text-xs text-emerald-400">
                +💰{formatarNumero(oferta.valorRecebido)} agora
              </p>
              <p className="text-xs text-red-400">
                +💳{formatarNumero(oferta.valorDivida)} de dívida
              </p>
              <button
                type="button"
                onClick={() => onPegarEmprestimo(oferta.id)}
                className="mt-1 rounded-lg bg-amber-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-amber-600"
              >
                Pegar empréstimo
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
