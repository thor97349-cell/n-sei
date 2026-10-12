import { RESIDENTS } from "@/lib/sindico/data/residents";
import { averageApproval, currentMonth } from "@/lib/sindico/engine";
import { brl } from "@/lib/sindico/format";
import { GameState } from "@/lib/sindico/types";

export function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-200 via-amber-50 to-orange-100 px-4 py-10">
      <div className="max-w-lg text-center">
        <p className="text-6xl">🏢</p>
        <h1 className="mt-2 text-5xl font-black tracking-tight text-stone-800">Síndico</h1>
        <p className="mt-1 font-semibold text-amber-800">Edifício Primavera · protótipo</p>
        <p className="mt-6 text-lg text-stone-700">
          Você ganhou a eleição pra síndico por <strong>1 voto</strong>. O antigo síndico sumiu sem avisar ninguém.
          <br />
          Agora aguenta.
        </p>
        <div className="mx-auto mt-4 flex max-w-sm justify-center gap-1 text-3xl">
          {RESIDENTS.map((r) => (
            <span key={r.id} title={r.name}>
              {r.avatar}
            </span>
          ))}
        </div>
        <ul className="mx-auto mt-6 max-w-sm space-y-2 text-left text-sm text-stone-700">
          <li>📋 Toda semana chegam <strong>pendências</strong>. Você tem só <strong>3 horas livres</strong> por semana.</li>
          <li>⏰ Pendência ignorada até o prazo <strong>explode sozinha</strong>, quase sempre pior.</li>
          <li>👀 Cada morador liga pra coisas diferentes. Toque no apartamento pra conhecer.</li>
          <li>🗳️ Todo fim de mês tem <strong>assembleia</strong>. Se o prédio te odiar, te tiram do cargo.</li>
          <li>🏆 Sobreviva <strong>6 meses</strong> e ganhe a reeleição (5 de 8 votos).</li>
        </ul>
        <button
          onClick={onStart}
          className="mt-8 rounded-xl bg-amber-600 px-8 py-4 text-lg font-black text-white shadow-lg transition hover:bg-amber-700"
        >
          Assumir o cargo
        </button>
      </div>
    </div>
  );
}

const ENDING_STYLE = {
  reeleito: { emoji: "🏆", bg: "from-emerald-200 to-amber-50" },
  derrotado: { emoji: "📦", bg: "from-stone-300 to-amber-50" },
  destituido: { emoji: "🚪", bg: "from-rose-200 to-amber-50" },
  falido: { emoji: "💸", bg: "from-rose-300 to-stone-100" },
} as const;

export function EndScreen({ state, onRestart }: { state: GameState; onRestart: () => void }) {
  const ending = state.ending;
  if (!ending) return null;
  const style = ENDING_STYLE[ending.kind];
  return (
    <div className={`flex min-h-screen items-center justify-center bg-gradient-to-b ${style.bg} px-4 py-10`}>
      <div className="w-full max-w-lg text-center">
        <p className="text-6xl">{style.emoji}</p>
        <h1 className="mt-2 text-4xl font-black text-stone-800">{ending.title}</h1>
        <p className="mt-4 text-lg text-stone-700">{ending.text}</p>

        {ending.votes && (
          <ul className="mt-6 grid grid-cols-4 gap-2">
            {RESIDENTS.map((r) => (
              <li key={r.id} className={`rounded-lg p-2 ${ending.votes?.[r.id] ? "bg-emerald-100" : "bg-rose-100"}`}>
                <span className="block text-2xl">{r.avatar}</span>
                <span className="block truncate text-[11px] font-semibold text-stone-700">{r.name}</span>
              </li>
            ))}
          </ul>
        )}

        <dl className="mt-6 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div className="rounded-lg bg-white/70 p-2">
            <dt className="text-stone-500">Durou</dt>
            <dd className="font-bold">{currentMonth(state)} meses</dd>
          </div>
          <div className="rounded-lg bg-white/70 p-2">
            <dt className="text-stone-500">Caixa final</dt>
            <dd className="font-bold">{brl(state.money)}</dd>
          </div>
          <div className="rounded-lg bg-white/70 p-2">
            <dt className="text-stone-500">Conservação</dt>
            <dd className="font-bold">{state.condition}%</dd>
          </div>
          <div className="rounded-lg bg-white/70 p-2">
            <dt className="text-stone-500">Aprovação</dt>
            <dd className="font-bold">{Math.round(averageApproval(state))}%</dd>
          </div>
        </dl>

        <button onClick={onRestart} className="mt-8 rounded-xl bg-amber-600 px-8 py-3 font-black text-white shadow hover:bg-amber-700">
          Jogar de novo
        </button>
      </div>
    </div>
  );
}
