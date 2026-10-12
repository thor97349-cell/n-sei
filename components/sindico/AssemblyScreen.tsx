import { PAUTAS_BY_ID } from "@/lib/sindico/data/pautas";
import { RESIDENTS, RESIDENTS_BY_ID } from "@/lib/sindico/data/residents";
import { MAJORITY, predictVote } from "@/lib/sindico/engine";
import { brl, signedBrl } from "@/lib/sindico/format";
import { GameState, Votes } from "@/lib/sindico/types";

// goodWhenYes=false inverte as cores (na destituição, "sim" é ruim pro síndico).
function VoteGrid({ votes, yesLabel, noLabel, goodWhenYes = true }: { votes: Votes; yesLabel: string; noLabel: string; goodWhenYes?: boolean }) {
  return (
    <ul className="grid grid-cols-4 gap-2">
      {RESIDENTS.map((r) => {
        const v = votes[r.id];
        const good = v === goodWhenYes;
        return (
          <li key={r.id} className={`flex flex-col items-center rounded-lg p-2 text-center ${good ? "bg-emerald-100" : "bg-rose-100"}`}>
            <span className="text-2xl">{r.avatar}</span>
            <span className="line-clamp-1 text-[11px] font-semibold text-stone-700">{r.name}</span>
            <span className={`text-[11px] font-black ${good ? "text-emerald-700" : "text-rose-700"}`}>{v ? yesLabel : noLabel}</span>
          </li>
        );
      })}
    </ul>
  );
}

function climate(yes: number) {
  if (yes >= MAJORITY) return { label: "Clima favorável", style: "bg-emerald-100 text-emerald-800" };
  if (yes === MAJORITY - 1) return { label: "Dividido (voto de minerva)", style: "bg-amber-100 text-amber-800" };
  return { label: "Clima contra", style: "bg-rose-100 text-rose-800" };
}

export default function AssemblyScreen({
  state,
  onPropose,
  onContinue,
}: {
  state: GameState;
  onPropose: (pautaId: string | null) => void;
  onContinue: () => void;
}) {
  const a = state.assembly;
  if (!a) return null;
  const { report } = a;

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-800 to-stone-900 px-4 py-8 text-stone-100">
      <div className="mx-auto max-w-2xl">
        <p className="text-center text-xs font-bold uppercase tracking-[0.3em] text-amber-400">Salão de festas · 20h</p>
        <h1 className="mt-1 text-center text-3xl font-black">🗳️ Assembleia do mês {a.month}</h1>

        <section className="mt-6 rounded-xl bg-stone-700/60 p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-stone-300">Prestação de contas</h2>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div className="rounded bg-stone-800 p-2">
              <p className="text-stone-400">Entrou</p>
              <p className="font-bold text-emerald-400">{signedBrl(report.income)}</p>
            </div>
            <div className="rounded bg-stone-800 p-2">
              <p className="text-stone-400">Saiu</p>
              <p className="font-bold text-rose-400">{signedBrl(-report.costs)}</p>
            </div>
            <div className="rounded bg-stone-800 p-2">
              <p className="text-stone-400">Caixa</p>
              <p className={`font-bold ${state.money < 0 ? "text-rose-400" : "text-stone-100"}`}>{brl(state.money)}</p>
            </div>
            <div className="rounded bg-stone-800 p-2">
              <p className="text-stone-400">Pagaram</p>
              <p className="font-bold">{report.payers}/8</p>
            </div>
          </div>
          {report.defaulters.length > 0 && (
            <p className="mt-2 text-sm text-stone-300">
              💸 Não pagaram: {report.defaulters.map((id) => `${RESIDENTS_BY_ID[id].avatar} ${RESIDENTS_BY_ID[id].name}`).join(", ")}
            </p>
          )}
          <p className="mt-1 text-xs text-stone-400">
            O prédio se desgastou (−{report.conditionLoss}% de conservação) e o pessoal ficou um pouco mais impaciente com o síndico.
            {state.money < 0 && " ⚠️ Caixa negativo! Mais um mês assim e o condomínio quebra."}
          </p>
        </section>

        {!a.result ? (
          <section className="mt-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-stone-300">Qual pauta você coloca em votação?</h2>
            <div className="mt-2 flex flex-col gap-2">
              {a.offered.map((id) => {
                const p = PAUTAS_BY_ID[id];
                const yes = RESIDENTS.filter((r) => predictVote(state, id, r.id)).length;
                const c = climate(yes);
                return (
                  <button
                    key={id}
                    onClick={() => onPropose(id)}
                    className="rounded-lg bg-stone-100 p-3 text-left text-stone-800 transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-bold">{p.title}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${c.style}`}>{c.label}</span>
                    </span>
                    <span className="mt-1 block text-sm text-stone-600">{p.text}</span>
                  </button>
                );
              })}
              <button
                onClick={() => onPropose(null)}
                className="rounded-lg border-2 border-dashed border-stone-500 p-3 text-left text-stone-300 hover:border-stone-300 hover:text-stone-100"
              >
                <span className="font-bold">Sem pauta</span>
                <span className="block text-sm">Só prestar contas e liberar todo mundo cedo.</span>
              </button>
            </div>
          </section>
        ) : (
          <section className="mt-6 space-y-4">
            {a.result.pautaId && (
              <div>
                <div
                  className={`rounded-xl p-4 text-center ${a.result.passed ? "bg-emerald-600" : "bg-rose-700"}`}
                >
                  <p className="text-sm font-semibold opacity-90">{PAUTAS_BY_ID[a.result.pautaId].title}</p>
                  <p className="text-2xl font-black">{a.result.passed ? "APROVADA" : "REJEITADA"}</p>
                  {a.result.minerva && <p className="text-sm">Empate 4 x 4: você desempatou com o voto de minerva.</p>}
                </div>
                <div className="mt-3">
                  <VoteGrid votes={a.result.votes} yesLabel="SIM" noLabel="NÃO" />
                </div>
              </div>
            )}
            <p className="rounded-lg bg-stone-700/60 p-3 text-center">{a.result.text}</p>

            {a.removal && (
              <div className="rounded-xl border-2 border-rose-500 p-4">
                <p className="text-center font-black text-rose-300">⚠️ O Dr. Valdemar pediu a palavra: proposta de destituição do síndico!</p>
                <div className="mt-3">
                  <VoteGrid votes={a.removal.votes} yesLabel="FORA" noLabel="FICA" goodWhenYes={false} />
                </div>
                <p className="mt-2 text-center font-bold">{a.removal.removed ? "Você foi destituído." : "Você sobreviveu. Por enquanto."}</p>
              </div>
            )}

            <button
              onClick={onContinue}
              className="w-full rounded-lg bg-amber-500 py-3 font-black text-stone-900 hover:bg-amber-400"
            >
              {state.phase === "ended" ? "Ver o fim da história" : "Voltar ao trabalho ➜"}
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
