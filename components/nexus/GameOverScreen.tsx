import { GameState } from "@/lib/nexus/types";
import { formatCurrency, formatNumber } from "@/lib/nexus/format";
import TopographicBackground from "./TopographicBackground";
import VertexMark from "./VertexMark";

export default function GameOverScreen({ state, onRestart }: { state: GameState; onRestart: () => void }) {
  const best = state.history.reduce((a, b) => (b.revenue > a.revenue ? b : a));
  const acquired = state.gameOverReason === "acquired";

  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center">
      <TopographicBackground />
      <div className="relative mx-auto max-w-xl px-6 py-24 text-center">
        <div className="mb-6 flex justify-center opacity-70">
          <VertexMark size={40} />
        </div>
        <p
          className={`text-sm tracking-[0.3em] uppercase mb-3 ${acquired ? "text-emerald-400" : "text-rose-400"}`}
        >
          {acquired ? "Saída bem-sucedida" : "Fim de jogo"}
        </p>
        <h1 className="text-3xl font-semibold text-white mb-4">
          {acquired ? `${state.companyName} foi adquirida! 🎉` : `${state.companyName} fechou as portas`}
        </h1>
        <p className="text-slate-400 mb-8">
          {acquired ? (
            <>
              Você vendeu a empresa após {state.month} meses, alcançando {formatNumber(best.customers)}{" "}
              clientes e um pico de receita mensal de {formatCurrency(best.revenue)}. XP acumulado:{" "}
              {formatNumber(state.xp)}.
            </>
          ) : (
            <>
              Sobreviveu {state.month} meses, alcançou {formatNumber(best.customers)} clientes e um pico de
              receita mensal de {formatCurrency(best.revenue)}. XP acumulado: {formatNumber(state.xp)}.
            </>
          )}
        </p>
        <button
          onClick={onRestart}
          className="rounded-lg bg-amber-500 px-8 py-3 font-medium text-slate-950 hover:bg-amber-400"
        >
          Ver minhas empresas
        </button>
      </div>
    </div>
  );
}
