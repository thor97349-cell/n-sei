import { GameState } from "@/lib/nexus/types";
import { formatCurrency, formatNumber } from "@/lib/nexus/format";

export default function GameOverScreen({ state, onRestart }: { state: GameState; onRestart: () => void }) {
  const best = state.history.reduce((a, b) => (b.revenue > a.revenue ? b : a));

  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <p className="text-sm tracking-[0.3em] text-rose-400 uppercase mb-3">Fim de jogo</p>
      <h1 className="text-3xl font-semibold text-white mb-4">{state.companyName} fechou as portas</h1>
      <p className="text-slate-400 mb-8">
        Sobreviveu {state.month} meses, alcançou {formatNumber(best.customers)} clientes e um pico de
        receita mensal de {formatCurrency(best.revenue)}. XP acumulado: {formatNumber(state.xp)}.
      </p>
      <button
        onClick={onRestart}
        className="rounded-lg bg-cyan-500 px-8 py-3 font-medium text-slate-950 hover:bg-cyan-400"
      >
        Começar uma nova empresa
      </button>
    </div>
  );
}
