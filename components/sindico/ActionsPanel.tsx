import { ACTIONS, UPGRADES } from "@/lib/sindico/data/actions";
import { actionBlocker, hasUpgrade } from "@/lib/sindico/engine";
import { GameState } from "@/lib/sindico/types";

export default function ActionsPanel({
  state,
  onAction,
  onOpenUpgrades,
}: {
  state: GameState;
  onAction: (id: string) => void;
  onOpenUpgrades: () => void;
}) {
  const built = UPGRADES.filter((u) => hasUpgrade(state, u.id)).length;
  return (
    <section aria-label="Ações do síndico" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-black text-stone-800">🛠️ Por conta própria</h2>
        <span className="text-xs text-stone-500">gasta horas livres</span>
      </div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ACTIONS.map((a) => {
          const blocked = actionBlocker(state, a.id);
          return (
            <li key={a.id}>
              <button
                onClick={() => onAction(a.id)}
                disabled={!!blocked}
                className="flex h-full w-full items-start gap-2 rounded-lg bg-white/80 p-2.5 text-left shadow-sm ring-1 ring-stone-200 transition enabled:hover:ring-amber-400 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
              >
                <span className="text-xl leading-none">{a.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-1">
                    <span className="text-sm font-bold text-stone-800">{a.label}</span>
                    <span className="shrink-0 rounded bg-stone-100 px-1.5 text-[10px] font-semibold text-stone-600">⏱ {a.hours}h</span>
                  </span>
                  <span className="block text-xs text-stone-500">{blocked ?? a.text}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <button
        onClick={onOpenUpgrades}
        className="flex items-center justify-between rounded-lg bg-emerald-700 px-3 py-2.5 text-left font-bold text-white shadow transition hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-900"
      >
        <span>🏗️ Melhorias do prédio</span>
        <span className="text-xs font-semibold text-emerald-100">
          {built}/{UPGRADES.length} feitas
        </span>
      </button>
    </section>
  );
}
