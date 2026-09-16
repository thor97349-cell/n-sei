import { GameState } from "@/lib/nexus/types";
import { SECTORS } from "@/lib/nexus/sectors";
import { formatCurrency } from "@/lib/nexus/format";
import VertexMark from "./VertexMark";
import TopographicBackground from "./TopographicBackground";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export default function GameSelect({
  saves,
  onContinue,
  onNew,
  onDelete,
}: {
  saves: GameState[];
  onContinue: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden px-6 py-16">
      <TopographicBackground />
      <div className="relative mx-auto max-w-2xl">
        <div className="flex items-center gap-3 mb-8">
          <VertexMark size={32} />
          <span className="text-xl font-semibold text-white tracking-wide">VÉRTICE</span>
        </div>

        <h1 className="text-2xl font-semibold text-white mb-1">Suas empresas</h1>
        <p className="text-slate-400 text-sm mb-6">Continue uma partida ou funde uma nova empresa.</p>

        <div className="space-y-3 mb-6">
          {saves.map((state) => {
            const sector = SECTORS[state.sectorId];
            const last = state.history.at(-1)!;
            return (
              <div
                key={state.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
              >
                <button onClick={() => onContinue(state.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                  <span className="text-2xl shrink-0">{sector.emoji}</span>
                  <div className="min-w-0">
                    <div className="text-white font-medium truncate">{state.companyName}</div>
                    <div className="text-xs text-slate-500">
                      {sector.name} · mês {state.month} · {formatCurrency(last.cash)} em caixa ·{" "}
                      {formatDate(state.updatedAt)}
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onContinue(state.id)}
                    className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-amber-400"
                  >
                    Continuar
                  </button>
                  <button
                    onClick={() => onDelete(state.id)}
                    className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-500 hover:border-rose-500/50 hover:text-rose-400"
                    aria-label="Excluir"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={onNew}
          className="w-full rounded-lg border border-dashed border-slate-700 py-3 text-sm text-slate-300 hover:border-amber-400/50 hover:text-amber-300 transition-colors"
        >
          + Fundar nova empresa
        </button>
      </div>
    </div>
  );
}
