import { PAUTAS_BY_ID } from "@/lib/sindico/data/pautas";
import { RESIDENTS, RESIDENTS_BY_ID } from "@/lib/sindico/data/residents";
import { MAJORITY, predictVote } from "@/lib/sindico/engine";
import { brl, moodEmoji, signedBrl } from "@/lib/sindico/format";
import { GameState, ResidentId, Votes } from "@/lib/sindico/types";

// goodWhenYes=false inverte as cores (na destituição, "sim" é ruim pro síndico).
// Os votos aparecem um por um (startMs + i * VOTE_STEP_MS), pra criar suspense.
const VOTE_STEP_MS = 320;
const VOTES_DONE_MS = RESIDENTS.length * VOTE_STEP_MS;

function VoteGrid({
  votes,
  yesLabel,
  noLabel,
  goodWhenYes = true,
  startMs = 0,
}: {
  votes: Votes;
  yesLabel: string;
  noLabel: string;
  goodWhenYes?: boolean;
  startMs?: number;
}) {
  return (
    <ul className="grid grid-cols-4 gap-2">
      {RESIDENTS.map((r, i) => {
        const v = votes[r.id];
        const good = v === goodWhenYes;
        return (
          <li
            key={r.id}
            style={{ animationDelay: `${startMs + i * VOTE_STEP_MS}ms` }}
            className={`sindico-pop flex flex-col items-center rounded-xl p-2 text-center ${good ? "bg-emerald-100" : "bg-rose-100"}`}
          >
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

function yesCount(state: GameState, pautaId: string) {
  return RESIDENTS.filter((r) => predictVote(state, pautaId, r.id)).length;
}

function Lobby({
  state,
  pautaId,
  onLobby,
  onVote,
}: {
  state: GameState;
  pautaId: string;
  onLobby: (id: ResidentId) => void;
  onVote: () => void;
}) {
  const a = state.assembly!;
  const p = PAUTAS_BY_ID[pautaId];
  const left = state.config.lobbySlots - a.lobbied.length;
  const c = climate(yesCount(state, pautaId));
  return (
    <section className="mt-6">
      <div className="rounded-xl bg-stone-100 p-4 text-stone-800">
        <div className="flex items-start justify-between gap-2">
          <p className="font-black">{p.title}</p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${c.style}`}>{c.label}</span>
        </div>
        <p className="text-sm text-stone-600">{p.text}</p>
      </div>

      <h2 className="mt-5 text-sm font-bold uppercase tracking-wide text-stone-300">🗣️ Conversas de corredor antes da votação</h2>
      <p className="mt-1 text-sm text-stone-400">
        Você tem <strong className="text-amber-300">{left}</strong> {left === 1 ? "conversa" : "conversas"}. Conversar descobre o voto e puxa a pessoa pro seu lado.
      </p>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {RESIDENTS.map((r) => {
          const talked = a.lobbied.includes(r.id);
          const vote = predictVote(state, pautaId, r.id);
          return (
            <li key={r.id}>
              <button
                onClick={() => onLobby(r.id)}
                disabled={talked || left === 0}
                className={`flex h-full w-full flex-col items-center rounded-lg p-2 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                  talked ? (vote ? "bg-emerald-100 text-stone-800" : "bg-rose-100 text-stone-800") : "bg-stone-700 text-stone-100 enabled:hover:bg-stone-600 disabled:opacity-60"
                }`}
              >
                <span className="text-2xl">{r.avatar}</span>
                <span className="line-clamp-1 text-xs font-semibold">{r.name}</span>
                <span className="text-[11px]">{moodEmoji(state.approval[r.id])}</span>
                <span className={`text-[11px] font-black ${talked ? (vote ? "text-emerald-700" : "text-rose-700") : "text-amber-300"}`}>
                  {talked ? (vote ? "Vota SIM" : "Continua contra") : left > 0 ? "Conversar" : "?"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <button onClick={onVote} className="mt-5 w-full rounded-lg bg-amber-500 py-3 font-black text-stone-900 hover:bg-amber-400">
        🔨 Abrir votação
      </button>
    </section>
  );
}

export default function AssemblyScreen({
  state,
  onSelect,
  onLobby,
  onVote,
  onContinue,
}: {
  state: GameState;
  onSelect: (pautaId: string | null) => void;
  onLobby: (id: ResidentId) => void;
  onVote: () => void;
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
              <p className="font-bold tabular-nums text-emerald-400">{signedBrl(report.income)}</p>
            </div>
            <div className="rounded bg-stone-800 p-2">
              <p className="text-stone-400">Saiu</p>
              <p className="font-bold tabular-nums text-rose-400">{signedBrl(-report.costs)}</p>
            </div>
            <div className="rounded bg-stone-800 p-2">
              <p className="text-stone-400">Caixa</p>
              <p className={`font-bold tabular-nums ${state.money < 0 ? "text-rose-400" : "text-stone-100"}`}>{brl(state.money)}</p>
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

        {a.result ? (
          (() => {
            const r = a.result;
            // Linha do tempo: votos um por um, depois o resultado, depois o resto.
            const bannerAt = r.pautaId ? VOTES_DONE_MS + 250 : 0;
            const textAt = bannerAt + 500;
            const removalAt = textAt + 400;
            const removalResultAt = removalAt + 600 + VOTES_DONE_MS;
            const buttonAt = a.removal ? removalResultAt + 400 : textAt + 300;
            return (
              <section className="mt-6 space-y-4">
                {r.pautaId && (
                  <div>
                    <h2 className="mb-2 text-center text-sm font-bold uppercase tracking-wide text-stone-300">
                      Votação: {PAUTAS_BY_ID[r.pautaId].title}
                    </h2>
                    <VoteGrid votes={r.votes} yesLabel="SIM" noLabel="NÃO" />
                    <div
                      style={{ animationDelay: `${bannerAt}ms` }}
                      className={`sindico-pop mt-3 rounded-xl p-4 text-center shadow-lg ${r.passed ? "bg-emerald-600" : "bg-rose-700"}`}
                    >
                      <p className="text-3xl font-black tracking-wide">{r.passed ? "✅ APROVADA" : "❌ REJEITADA"}</p>
                      <p className="text-sm font-semibold tabular-nums opacity-90">
                        {Object.values(r.votes).filter(Boolean).length} x {Object.values(r.votes).filter((v) => !v).length}
                        {r.minerva && " · empate desfeito pelo seu voto de minerva"}
                      </p>
                    </div>
                  </div>
                )}
                <p style={{ animationDelay: `${textAt}ms` }} className="sindico-enter rounded-xl bg-stone-700/60 p-3 text-center">
                  {r.text}
                </p>

                {a.removal && (
                  <div style={{ animationDelay: `${removalAt}ms` }} className="sindico-enter rounded-xl border-2 border-rose-500 p-4">
                    <p className="text-center font-black text-rose-300">⚠️ O Dr. Valdemar pediu a palavra: proposta de destituição do síndico!</p>
                    <div className="mt-3">
                      <VoteGrid votes={a.removal.votes} yesLabel="FORA" noLabel="FICA" goodWhenYes={false} startMs={removalAt + 600} />
                    </div>
                    <p style={{ animationDelay: `${removalResultAt}ms` }} className="sindico-pop mt-2 text-center text-lg font-black">
                      {a.removal.removed ? "🚪 Você foi destituído." : "😮‍💨 Você sobreviveu. Por enquanto."}
                    </p>
                  </div>
                )}

                <button
                  onClick={onContinue}
                  style={{ animationDelay: `${buttonAt}ms` }}
                  className="sindico-enter w-full rounded-xl bg-amber-500 py-3 font-black text-stone-900 transition hover:bg-amber-400 active:scale-[0.98]"
                >
                  {state.phase === "ended" ? "Ver o fim da história" : "Voltar ao trabalho ➜"}
                </button>
              </section>
            );
          })()
        ) : a.selected ? (
          <Lobby state={state} pautaId={a.selected} onLobby={onLobby} onVote={onVote} />
        ) : (
          <section className="mt-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-stone-300">Qual pauta você coloca em votação?</h2>
            <div className="mt-2 flex flex-col gap-2">
              {a.offered.map((id) => {
                const p = PAUTAS_BY_ID[id];
                const c = climate(yesCount(state, id));
                return (
                  <button
                    key={id}
                    onClick={() => onSelect(id)}
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
                onClick={() => onSelect(null)}
                className="rounded-lg border-2 border-dashed border-stone-500 p-3 text-left text-stone-300 hover:border-stone-300 hover:text-stone-100"
              >
                <span className="font-bold">Sem pauta</span>
                <span className="block text-sm">Só prestar contas e liberar todo mundo cedo.</span>
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
