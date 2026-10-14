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
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-black text-stone-800">
          <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full bg-amber-100">
            📋
          </span>
          Pendências
          <span className="rounded-full bg-stone-800 px-2 py-0.5 text-xs font-bold text-white tabular-nums">{state.pending.length}</span>
        </h2>
        {urgent > 0 && <span className="text-xs font-semibold text-rose-600">{urgent} vence(m) esta semana</span>}
      </div>

      {state.pending.length === 0 ? (
        <p className="sindico-enter rounded-xl border-2 border-dashed border-stone-300 bg-white/40 p-6 text-center text-sm text-stone-500">
          <span className="mb-1 block text-3xl" aria-hidden="true">
            🧘
          </span>
          Nenhuma pendência. Aproveite o silêncio.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {state.pending.map((p, i) => {
            const ev = EVENTS_BY_ID[p.eventId];
            const who = senderInfo(ev.from);
            const isUrgent = p.weeksLeft <= 1;
            return (
              <li key={p.uid} className="sindico-drop" style={{ animationDelay: `${i * 80}ms` }}>
                <button
                  onClick={() => onOpen(p.uid)}
                  className={`group flex w-full items-start gap-3 rounded-xl bg-white p-3 text-left shadow-sm ring-1 transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 ${
                    isUrgent ? "ring-rose-200" : "ring-stone-200/80"
                  }`}
                >
                  <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-amber-50 text-2xl ring-1 ring-amber-100">
                    {who.avatar}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-bold text-stone-800">{ev.title}</span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isUrgent ? "sindico-pulse bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {isUrgent ? "vence esta semana" : `${p.weeksLeft} semanas`}
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

      {/* No celular, o botão fica numa barra fixa embaixo da tela (ver page.tsx). */}
      <button
        onClick={onEndWeek}
        className="mt-1 hidden rounded-xl bg-amber-600 px-4 py-3 font-black text-white shadow transition hover:bg-amber-700 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-900 lg:block"
      >
        Encerrar semana ➜
      </button>
      <p className="hidden text-center text-xs text-stone-500 lg:block">Pendências não resolvidas até o prazo explodem sozinhas. Horas livres não acumulam.</p>
    </section>
  );
}
