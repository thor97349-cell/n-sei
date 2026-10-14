import { averageApproval, currentMonth, electionForecast, MONTHS, weekOfMonth, WEEKS_PER_MONTH } from "@/lib/sindico/engine";
import { brl } from "@/lib/sindico/format";
import { GameState } from "@/lib/sindico/types";

// Cada número do jogo tem um emoji fixo, sempre o mesmo em todas as telas.
function Stat({ icon, tint, label, children }: { icon: string; tint: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl bg-white px-2 py-1.5 shadow-sm ring-1 ring-stone-200/80">
      <span aria-hidden="true" className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-base ${tint}`}>
        {icon}
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-stone-500">{label}</span>
        <span className="truncate text-sm font-bold text-stone-800 tabular-nums">{children}</span>
      </span>
    </div>
  );
}

export default function Hud({
  state,
  muted,
  onToggleMute,
  onQuit,
}: {
  state: GameState;
  muted: boolean;
  onToggleMute: () => void;
  onQuit: () => void;
}) {
  const forecast = electionForecast(state);
  const avg = Math.round(averageApproval(state));
  const maxHours = state.config.hoursPerWeek;
  return (
    <header className="z-20 border-b border-amber-200/80 bg-amber-50/95 backdrop-blur lg:sticky lg:top-0">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2 lg:flex-row lg:items-center">
        <div className="flex items-center justify-between gap-2 lg:mr-auto">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500 text-xl shadow-sm">
              🏢
            </span>
            <div className="leading-tight">
              <h1 className="text-lg font-black text-stone-800">Síndico</h1>
              <p className="text-xs text-stone-500">Edifício Primavera</p>
            </div>
          </div>
          <div className="flex gap-1">
            <button
              onClick={onToggleMute}
              aria-label={muted ? "Ligar som" : "Desligar som"}
              title={muted ? "Ligar som" : "Desligar som"}
              className="grid h-9 w-9 place-items-center rounded-xl text-lg transition hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
            >
              {muted ? "🔇" : "🔊"}
            </button>
            <button
              onClick={onQuit}
              title="Voltar ao menu (a partida fica salva)"
              className="h-9 rounded-xl px-3 text-xs font-bold text-stone-600 transition hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
            >
              Menu
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:flex lg:flex-wrap lg:gap-2">
          <Stat icon="📅" tint="bg-sky-100" label={`Mês ${currentMonth(state)} de ${MONTHS}`}>
            Semana {weekOfMonth(state)}/{WEEKS_PER_MONTH}
          </Stat>
          <Stat icon="💰" tint="bg-amber-100" label="Caixa">
            <span className={state.money < 0 ? "text-rose-600" : ""}>{brl(state.money)}</span>
          </Stat>
          <Stat icon="🛠️" tint="bg-stone-100" label="Conservação">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-10 overflow-hidden rounded-full bg-stone-200">
                <span
                  className={`block h-full transition-all duration-500 ${state.condition >= 50 ? "bg-emerald-500" : state.condition >= 30 ? "bg-amber-400" : "bg-rose-500"}`}
                  style={{ width: `${state.condition}%` }}
                />
              </span>
              {state.condition}%
            </span>
          </Stat>
          <Stat icon="⏱️" tint="bg-violet-100" label="Horas livres">
            <span className="tracking-widest" aria-label={`${state.hours} de ${maxHours} horas`}>
              {"●".repeat(state.hours)}
              <span className="text-stone-300">{"●".repeat(Math.max(0, maxHours - state.hours))}</span>
            </span>
          </Stat>
          <Stat icon="🙂" tint="bg-emerald-100" label="Aprovação">
            {avg}%
          </Stat>
          <Stat icon="🗳️" tint="bg-rose-100" label="Eleição hoje">
            <span className={forecast >= 5 ? "text-emerald-600" : forecast === 4 ? "text-amber-600" : "text-rose-600"}>{forecast}/8 votos</span>
          </Stat>
        </div>
      </div>
    </header>
  );
}
