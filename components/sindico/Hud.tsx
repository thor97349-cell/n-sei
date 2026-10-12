import { averageApproval, currentMonth, electionForecast, HOURS_PER_WEEK, MONTHS, weekOfMonth, WEEKS_PER_MONTH } from "@/lib/sindico/engine";
import { brl } from "@/lib/sindico/format";
import { GameState } from "@/lib/sindico/types";

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-lg bg-white/70 px-3 py-1.5 shadow-sm ring-1 ring-stone-200">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">{label}</span>
      <span className="text-sm font-bold text-stone-800">{children}</span>
    </div>
  );
}

export default function Hud({ state }: { state: GameState }) {
  const forecast = electionForecast(state);
  const avg = Math.round(averageApproval(state));
  return (
    <header className="z-20 lg:sticky lg:top-0 border-b border-amber-200 bg-amber-50/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2">
        <div className="mr-auto w-full sm:w-auto">
          <h1 className="text-lg font-black leading-tight text-stone-800">🏢 Síndico</h1>
          <p className="text-xs text-stone-500">Edifício Primavera</p>
        </div>
        <Stat label="Mandato">
          Mês {currentMonth(state)}/{MONTHS} · Sem. {weekOfMonth(state)}/{WEEKS_PER_MONTH}
        </Stat>
        <Stat label="Caixa">
          <span className={state.money < 0 ? "text-rose-600" : ""}>{brl(state.money)}</span>
        </Stat>
        <Stat label="Conservação">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-14 overflow-hidden rounded-full bg-stone-200">
              <span
                className={`block h-full ${state.condition >= 50 ? "bg-emerald-500" : state.condition >= 30 ? "bg-amber-400" : "bg-rose-500"}`}
                style={{ width: `${state.condition}%` }}
              />
            </span>
            {state.condition}%
          </span>
        </Stat>
        <Stat label="Horas livres">
          <span className="tracking-widest">
            {"●".repeat(state.hours)}
            <span className="text-stone-300">{"●".repeat(Math.max(0, HOURS_PER_WEEK - state.hours))}</span>
          </span>
        </Stat>
        <Stat label="Aprovação">{avg}%</Stat>
        <Stat label="Eleição hoje">
          <span className={forecast >= 5 ? "text-emerald-600" : forecast === 4 ? "text-amber-600" : "text-rose-600"}>
            {forecast}/8 votos
          </span>
        </Stat>
      </div>
    </header>
  );
}
