import { GameState } from "@/lib/nexus/types";

export default function SettingsView({
  state,
  onToggleMiniGames,
}: {
  state: GameState;
  onToggleMiniGames: (enabled: boolean) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white mb-1">Ajustes</h1>
        <p className="text-sm text-slate-400">Preferências desta empresa.</p>
      </div>

      <button
        onClick={() => onToggleMiniGames(!state.miniGamesEnabled)}
        className="w-full flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 p-5 text-left hover:border-slate-700 transition-colors"
      >
        <span>
          <span className="text-white font-medium block mb-1">Desafio de Pitch</span>
          <span className="text-sm text-slate-400">
            De vez em quando, ao avançar o mês, aparece um desafio de timing (pitch/negociação).
            Desativar não afeta encruzilhadas nem eventos de mercado, que continuam normalmente.
          </span>
        </span>
        <span
          className={`shrink-0 ml-4 w-12 h-7 rounded-full relative transition-colors ${
            state.miniGamesEnabled ? "bg-amber-500" : "bg-slate-700"
          }`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${
              state.miniGamesEnabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </span>
      </button>
    </div>
  );
}
