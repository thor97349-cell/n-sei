import { EVENTS_BY_ID } from "@/lib/sindico/data/events";
import { senderInfo } from "@/lib/sindico/format";
import { GameState } from "@/lib/sindico/types";

export default function PendingList({
  state,
  onOpen,
  onEndWeek,
}: {
  state: GameState;
  onOpen: (uid: number) => void;
  onEndWeek: () => void;
}) {
  const urgent = state.pending.filter((p) => p.weeksLeft <= 1).length;
  return (
    <section aria-label="Pendências" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-black text-stone-800">📋 Pendências ({state.pending.length})</h2>
        {urgent > 0 && <span className="text-xs font-semibold text-rose-600">{urgent} vence(m) esta semana</span>}
      </div>

      {state.pending.length === 0 ? (
        <p className="rounded-lg border-2 border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
          Nenhuma pendência. Aproveite o silêncio. 🧘
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {state.pending.map((p) => {
            const ev = EVENTS_BY_ID[p.eventId];
            const who = senderInfo(ev.from);
            return (
              <li key={p.uid}>
                <button
                  onClick={() => onOpen(p.uid)}
                  className="flex w-full items-start gap-3 rounded-lg bg-white p-3 text-left shadow-sm ring-1 ring-stone-200 transition hover:ring-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
                >
                  <span className="text-2xl leading-none">{who.avatar}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-bold text-stone-800">{ev.title}</span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          p.weeksLeft <= 1 ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {p.weeksLeft <= 1 ? "vence esta semana" : `${p.weeksLeft} semanas`}
                      </span>
                    </span>
                    <span className="block text-xs text-stone-500">{who.name}</span>
                    <span className="mt-1 line-clamp-2 block text-sm text-stone-600">{ev.text}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        onClick={onEndWeek}
        className="mt-1 rounded-lg bg-amber-600 px-4 py-3 font-black text-white shadow transition hover:bg-amber-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-900"
      >
        Encerrar semana ➜
      </button>
      <p className="text-center text-xs text-stone-500">
        Pendências não resolvidas até o prazo explodem sozinhas. Horas livres não acumulam.
      </p>
    </section>
  );
}
