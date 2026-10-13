import { hasUpgrade, isPaying } from "@/lib/sindico/engine";
import { UPGRADES } from "@/lib/sindico/data/actions";
import { EVENTS_BY_ID } from "@/lib/sindico/data/events";
import { RESIDENTS } from "@/lib/sindico/data/residents";
import { approvalColor, moodEmoji } from "@/lib/sindico/format";
import { GameState, Resident, ResidentId } from "@/lib/sindico/types";

function Apartment({
  resident,
  state,
  hasMessage,
  onClick,
}: {
  resident: Resident;
  state: GameState;
  hasMessage: boolean;
  onClick: () => void;
}) {
  const approval = Math.round(state.approval[resident.id]);
  const paying = isPaying(state, resident.id);
  const delta = state.fx.deltas[resident.id] ?? 0;
  // A key muda a cada decisão, o que reinicia as animações (CSS puro, sem timers).
  const fxKey = `${state.fx.tick}-${resident.id}`;
  const anim = delta <= -4 ? "sindico-shake" : delta >= 4 ? "sindico-glow" : "";

  return (
    <button
      key={delta ? fxKey : resident.id}
      onClick={onClick}
      className={`group relative flex flex-col items-center rounded-md border-2 border-amber-900/20 bg-sky-100 px-1.5 py-2 text-center shadow-inner transition hover:-translate-y-0.5 hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 ${anim}`}
    >
      <span className="absolute left-1 top-0.5 text-[10px] font-bold text-stone-500">{resident.apt}</span>
      {hasMessage && <span className="absolute right-1 top-0.5 animate-bounce text-sm">📩</span>}
      {delta !== 0 && (
        <span
          key={fxKey}
          aria-hidden="true"
          className={`sindico-float pointer-events-none absolute left-1/2 top-1 z-10 rounded-full px-1.5 text-sm font-black shadow ${
            delta > 0 ? "bg-emerald-500 text-white" : "bg-rose-600 text-white"
          }`}
        >
          {delta > 0 ? "+" : ""}
          {delta}
        </span>
      )}
      <span className="text-3xl leading-none">{resident.avatar}</span>
      <span className="mt-1 line-clamp-1 text-xs font-semibold text-stone-800">{resident.name}</span>
      <span className="mt-0.5 flex w-full items-center gap-1">
        <span className="text-sm">{moodEmoji(approval)}</span>
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-300">
          <span className={`block h-full transition-all duration-700 ${approvalColor(approval)}`} style={{ width: `${approval}%` }} />
        </span>
      </span>
      {!paying && <span className="mt-1 rounded bg-rose-100 px-1 text-[10px] font-semibold text-rose-700">💸 não paga</span>}
    </button>
  );
}

export default function Building({ state, onSelectResident }: { state: GameState; onSelectResident: (id: ResidentId) => void }) {
  const senders = new Set(state.pending.map((p) => EVENTS_BY_ID[p.eventId].from));
  // RESIDENTS já vem de cima pra baixo; agrupa 2 apartamentos por andar.
  const floors: Resident[][] = [];
  for (let i = 0; i < RESIDENTS.length; i += 2) floors.push(RESIDENTS.slice(i, i + 2));
  const shabby = state.condition < 40;
  const semZe = state.flags.includes("sem_ze");
  const built = UPGRADES.filter((u) => hasUpgrade(state, u.id));

  return (
    <section aria-label="Prédio" className="flex flex-col items-center">
      {/* telhado */}
      <div className="flex w-[92%] items-end justify-between px-6">
        <span className="text-xl">{state.seen.includes("pombos") ? "🐦" : ""}</span>
        <div className="rounded-t-md border-2 border-b-0 border-stone-400 bg-stone-300 px-3 py-1 text-[10px] font-bold text-stone-600">CAIXA D&apos;ÁGUA</div>
        <span className="text-xl">{hasUpgrade(state, "solar") ? "☀️" : "📡"}</span>
      </div>
      <div
        className={`w-full rounded-t-lg border-4 border-amber-900/40 p-2 shadow-lg transition-colors duration-700 ${
          shabby ? "bg-stone-400" : state.condition >= 70 ? "bg-orange-200" : "bg-orange-300"
        }`}
      >
        <p className="mb-2 text-center text-xs font-black tracking-[0.25em] text-amber-950/70">EDIFÍCIO PRIMAVERA</p>
        <div className="space-y-2">
          {floors.map((pair, i) => (
            <div key={i} className="grid grid-cols-[1.5rem_1fr_1fr] items-stretch gap-2">
              <span className="self-center text-center text-[10px] font-bold text-amber-950/60">{floors.length - i}º</span>
              {pair.map((r) => (
                <Apartment key={r.id} resident={r} state={state} hasMessage={senders.has(r.id)} onClick={() => onSelectResident(r.id)} />
              ))}
            </div>
          ))}
          {/* térreo */}
          <div className="grid grid-cols-[1.5rem_1fr_1fr] items-stretch gap-2 border-t-4 border-amber-900/30 pt-2">
            <span className="self-center text-center text-[10px] font-bold text-amber-950/60">T</span>
            <div className="relative flex flex-col items-center rounded-md bg-amber-100 py-2 text-center">
              {senders.has("ze") && <span className="absolute right-1 top-0.5 animate-bounce text-sm">📩</span>}
              <span className="text-2xl">{semZe ? "📟" : "👨🏽‍✈️"}</span>
              <span className="text-xs font-semibold text-stone-700">{semZe ? "Portaria remota" : "Portaria · Zé"}</span>
            </div>
            <div className="flex flex-col items-center rounded-md bg-stone-600 py-2 text-center text-stone-100">
              <span className="text-2xl">🚗</span>
              <span className="text-xs font-semibold">Garagem</span>
            </div>
          </div>
        </div>
      </div>
      <div className="h-3 w-[104%] rounded-sm bg-stone-500" />
      {built.length > 0 && (
        <div className="mt-2 flex flex-wrap justify-center gap-1" aria-label="Melhorias feitas">
          {built.map((u) => (
            <span key={u.id} title={u.name} className="sindico-pop rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold text-stone-700 shadow-sm">
              {u.icon} {u.name}
            </span>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-stone-500">Toque num apartamento pra ver o morador ou fazer uma visita.</p>
    </section>
  );
}
