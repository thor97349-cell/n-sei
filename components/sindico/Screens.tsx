"use client";

import { useEffect, useState } from "react";
import { ACHIEVEMENTS, ACHIEVEMENTS_BY_ID } from "@/lib/sindico/data/achievements";
import { ALL_ENDING_IDS, ENDING_INFO } from "@/lib/sindico/data/endings";
import { DIFFICULTIES, PROFILES } from "@/lib/sindico/data/profiles";
import { RESIDENTS } from "@/lib/sindico/data/residents";
import { averageApproval, currentMonth } from "@/lib/sindico/engine";
import { brl } from "@/lib/sindico/format";
import { Records } from "@/lib/sindico/storage";
import { DifficultyId, EpilogueSubject, GameState, ProfileId } from "@/lib/sindico/types";

function Choice({
  selected,
  onClick,
  icon,
  name,
  text,
}: {
  selected: boolean;
  onClick: () => void;
  icon: string;
  name: string;
  text: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`flex items-start gap-2.5 rounded-xl p-2.5 text-left transition active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 ${
        selected ? "bg-amber-600 text-white shadow-md" : "bg-white text-stone-800 shadow-sm ring-1 ring-stone-200/80 hover:ring-amber-400"
      }`}
    >
      <span aria-hidden="true" className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xl ${selected ? "bg-white/25" : "bg-amber-100"}`}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold">{name}</span>
        <span className={`block text-xs ${selected ? "text-amber-50" : "text-stone-500"}`}>{text}</span>
      </span>
    </button>
  );
}

export function AchievementGrid({ unlocked, highlight = [] }: { unlocked: string[]; highlight?: string[] }) {
  return (
    <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
      {ACHIEVEMENTS.map((a) => {
        const got = unlocked.includes(a.id);
        const isNew = highlight.includes(a.id);
        return (
          <li
            key={a.id}
            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs ${got ? "bg-white/90 text-stone-800 shadow-sm" : "bg-stone-200/60 text-stone-400"} ${isNew ? "sindico-pop ring-2 ring-amber-500" : ""}`}
          >
            <span className={`text-lg ${got ? "" : "grayscale"}`}>{got ? a.icon : "🔒"}</span>
            <span className="min-w-0">
              <span className="block font-bold">
                {a.title} {isNew && <span className="ml-1 rounded bg-amber-500 px-1 text-[10px] text-white">NOVA</span>}
              </span>
              <span className="block">{a.text}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// Prédio de emojis da tela inicial: sobe andar por andar, do térreo ao telhado.
function MiniBuilding() {
  const floors: (typeof RESIDENTS)[] = [];
  for (let i = 0; i < RESIDENTS.length; i += 2) floors.push(RESIDENTS.slice(i, i + 2));
  const step = 130;
  return (
    <div className="mx-auto mt-6 w-60" aria-label="Os moradores do Edifício Primavera">
      <div className="sindico-rise flex items-end justify-between px-6" style={{ animationDelay: `${(floors.length + 1) * step}ms` }}>
        <span aria-hidden="true" className="text-lg">🐦</span>
        <span aria-hidden="true" className="rounded-t-md bg-stone-300 px-3 py-0.5 text-[9px] font-bold tracking-wide text-stone-600">CAIXA D&apos;ÁGUA</span>
        <span aria-hidden="true" className="text-lg">📡</span>
      </div>
      <div className="overflow-hidden rounded-t-xl border-4 border-amber-900/30 bg-orange-300 shadow-lg">
        {floors.map((pair, i) => (
          <div
            key={i}
            className="sindico-rise grid grid-cols-2 gap-1.5 border-b-4 border-amber-900/15 px-2 py-1.5"
            style={{ animationDelay: `${(floors.length - i) * step}ms` }}
          >
            {pair.map((r) => (
              <span key={r.id} title={`${r.name} · ${r.apt}`} className="sindico-wave-hover grid h-12 place-items-center rounded-lg bg-sky-100 text-3xl shadow-inner">
                <span className="sindico-wave-target">{r.avatar}</span>
              </span>
            ))}
          </div>
        ))}
        <div className="sindico-rise grid grid-cols-2 gap-1.5 bg-orange-200 px-2 py-1.5" style={{ animationDelay: "0ms" }}>
          <span title="Zé, o porteiro" className="sindico-wave-hover grid h-12 place-items-center rounded-lg bg-amber-100 text-3xl">
            <span className="sindico-wave-target">👨🏽‍✈️</span>
          </span>
          <span aria-hidden="true" className="grid h-12 place-items-center rounded-lg bg-stone-600 text-2xl">🚪</span>
        </div>
      </div>
      <div className="h-2.5 rounded-sm bg-stone-500" />
    </div>
  );
}

export function StartScreen({
  saved,
  records,
  onStart,
  onContinue,
}: {
  saved: GameState | null;
  records: Records;
  onStart: (profile: ProfileId, difficulty: DifficultyId) => void;
  onContinue: () => void;
}) {
  const [profile, setProfile] = useState<ProfileId>("novato");
  const [difficulty, setDifficulty] = useState<DifficultyId>("normal");
  const [showAchievements, setShowAchievements] = useState<"conquistas" | "finais" | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-200 via-amber-50 to-orange-100 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="text-center">
          <h1 className="sindico-enter text-5xl font-black tracking-tight text-stone-800 sm:text-6xl">Síndico</h1>
          <p className="mt-1 font-semibold text-amber-800">Edifício Primavera · protótipo</p>
          <p className="mx-auto mt-5 max-w-lg text-lg text-stone-700">
            Você ganhou a eleição pra síndico por <strong>1 voto</strong>. O antigo síndico sumiu sem avisar ninguém. Agora aguenta.
          </p>
          <MiniBuilding />
        </div>

        {saved && (
          <button
            onClick={onContinue}
            className="mx-auto mt-6 flex w-full max-w-md flex-col items-center rounded-xl bg-emerald-700 px-6 py-3 font-black text-white shadow-lg transition hover:bg-emerald-800"
          >
            <span className="text-lg">▶ Continuar partida</span>
            <span className="text-xs font-semibold text-emerald-100">
              Mês {currentMonth(saved)} · {PROFILES.find((p) => p.id === saved.config.profile)?.name} ·{" "}
              {DIFFICULTIES.find((d) => d.id === saved.config.difficulty)?.name}
            </span>
          </button>
        )}

        <section className="mt-8 rounded-2xl bg-white/60 p-4 shadow-sm ring-1 ring-amber-200">
          <h2 className="font-black text-stone-800">{saved ? "Ou comece um mandato novo" : "Novo mandato"}</h2>
          <h3 className="mt-3 text-xs font-bold uppercase tracking-wide text-stone-500">Quem é você?</h3>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PROFILES.map((p) => (
              <Choice key={p.id} selected={profile === p.id} onClick={() => setProfile(p.id)} icon={p.icon} name={p.name} text={p.text} />
            ))}
          </div>
          <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-stone-500">Dificuldade</h3>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {DIFFICULTIES.map((d) => (
              <Choice key={d.id} selected={difficulty === d.id} onClick={() => setDifficulty(d.id)} icon={d.icon} name={d.name} text={d.text} />
            ))}
          </div>
          <button
            onClick={() => onStart(profile, difficulty)}
            className="mt-5 w-full rounded-xl bg-amber-600 px-8 py-4 text-lg font-black text-white shadow-lg transition hover:bg-amber-700"
          >
            Assumir o cargo
          </button>
        </section>

        <ul className="mx-auto mt-6 max-w-lg space-y-2 text-sm text-stone-700">
          <li>📋 Toda semana chegam <strong>pendências</strong>, e suas <strong>horas livres</strong> são poucas.</li>
          <li>⏰ Pendência ignorada até o prazo <strong>explode sozinha</strong>, quase sempre pior.</li>
          <li>🛠️ Sobrou tempo? <strong>Visite moradores</strong>, faça eventos e invista em <strong>melhorias</strong>.</li>
          <li>🗳️ Todo fim de mês tem <strong>assembleia</strong>. Converse no corredor antes de votar. Se o prédio te odiar, te tiram do cargo.</li>
          <li>🏆 Sobreviva <strong>6 meses</strong> e ganhe a reeleição (5 de 8 votos).</li>
        </ul>

        <section className="mt-6 text-center text-sm text-stone-600">
          {records.games > 0 ? (
            <p>
              🏅 Recorde: <strong>{records.bestScore.toLocaleString("pt-BR")} pontos</strong> · {records.wins} reeleição(ões) em {records.games} mandato(s)
            </p>
          ) : (
            <p>Seu primeiro mandato. Boa sorte.</p>
          )}
          <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
            <button
              onClick={() => setShowAchievements((v) => (v === "conquistas" ? null : "conquistas"))}
              aria-expanded={showAchievements === "conquistas"}
              className="font-semibold text-amber-800 underline-offset-2 hover:underline"
            >
              🏅 Conquistas ({records.achievements.length}/{ACHIEVEMENTS.length})
            </button>
            <button
              onClick={() => setShowAchievements((v) => (v === "finais" ? null : "finais"))}
              aria-expanded={showAchievements === "finais"}
              className="font-semibold text-amber-800 underline-offset-2 hover:underline"
            >
              🎬 Finais ({records.endings.length}/{ALL_ENDING_IDS.length})
            </button>
          </div>
          {showAchievements === "conquistas" && (
            <div className="mt-3">
              <AchievementGrid unlocked={records.achievements} />
            </div>
          )}
          {showAchievements === "finais" && (
            <ul className="mt-3 grid grid-cols-1 gap-1.5 text-left sm:grid-cols-2">
              {ALL_ENDING_IDS.map((id) => {
                const got = records.endings.includes(id);
                const info = ENDING_INFO[id];
                return (
                  <li
                    key={id}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${got ? "bg-white/90 text-stone-800 shadow-sm" : "bg-stone-200/60 text-stone-400"}`}
                  >
                    <span className="text-lg" aria-hidden="true">
                      {got ? info.icon : "🔒"}
                    </span>
                    <span className="font-bold">{got ? info.title : "Final ainda não descoberto"}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
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

const CONFETTI = ["🎉", "🎊", "✨", "🌸", "🏆", "🥳"];

// Posições "aleatórias" mas fixas (pelo índice), pra não mudar a cada render.
function Confetti() {
  return (
    <div aria-hidden="true">
      {Array.from({ length: 36 }, (_, i) => {
        const left = (i * 37) % 100;
        const delay = (i * 173) % 1800;
        const duration = 2600 + ((i * 97) % 1800);
        const size = 18 + ((i * 7) % 16);
        return (
          <span
            key={i}
            className="sindico-confetti"
            style={{ left: `${left}%`, fontSize: size, animationDelay: `${delay}ms`, animationDuration: `${duration}ms` }}
          >
            {CONFETTI[i % CONFETTI.length]}
          </span>
        );
      })}
    </div>
  );
}

// Pontuação subindo de 0 até o valor final.
function useCountUp(target: number, ms = 1400) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);
  return value;
}

export function EndScreen({
  state,
  records,
  newAchievements,
  newEnding,
  onRestart,
}: {
  state: GameState;
  records: Records;
  newAchievements: string[];
  newEnding: boolean;
  onRestart: () => void;
}) {
  const ending = state.ending;
  if (!ending) return null;
  return <EndScreenBody state={state} records={records} newAchievements={newAchievements} newEnding={newEnding} onRestart={onRestart} />;
}

function epilogueWho(who: EpilogueSubject): { name: string; avatar: string } {
  if (who === "predio") return { name: "O Edifício Primavera", avatar: "🏢" };
  if (who === "voce") return { name: "Você", avatar: "🫵" };
  if (who === "ze") return { name: "Zé, o porteiro", avatar: "👨🏽‍✈️" };
  const r = RESIDENTS.find((x) => x.id === who)!;
  return { name: r.name, avatar: r.avatar };
}

function EndScreenBody({
  state,
  records,
  newAchievements,
  newEnding,
  onRestart,
}: {
  state: GameState;
  records: Records;
  newAchievements: string[];
  newEnding: boolean;
  onRestart: () => void;
}) {
  const ending = state.ending!;
  const style = ENDING_STYLE[ending.kind];
  const isRecord = ending.score >= records.bestScore;
  const shownScore = useCountUp(ending.score);
  const highlights = [...state.decisions].sort((a, b) => b.impact - a.impact).slice(0, 3);
  // Linha do tempo: votos, depois o epílogo um por um.
  const epilogueStart = ending.votes ? 300 + RESIDENTS.length * 250 + 300 : 600;

  return (
    <div className={`min-h-screen bg-gradient-to-b ${style.bg} px-4 py-10`}>
      {ending.kind === "reeleito" && <Confetti />}
      <div className="mx-auto w-full max-w-xl text-center">
        <p className="sindico-pop text-6xl">{ending.icon ?? style.emoji}</p>
        <h1 className="mt-2 text-4xl font-black text-balance text-stone-800">{ending.title}</h1>
        {newEnding && (
          <p className="sindico-pop mt-2 inline-block rounded-full bg-amber-500 px-3 py-1 text-xs font-black text-white" style={{ animationDelay: "400ms" }}>
            🆕 Final inédito! {records.endings.length}/{ALL_ENDING_IDS.length} descobertos
          </p>
        )}
        <p className="mt-4 text-lg text-stone-700">{ending.text}</p>

        {ending.votes && (
          <ul className="mt-6 grid grid-cols-4 gap-2">
            {RESIDENTS.map((r, i) => (
              <li
                key={r.id}
                style={{ animationDelay: `${300 + i * 250}ms` }}
                className={`sindico-pop rounded-xl p-2 ${ending.votes?.[r.id] ? "bg-emerald-100" : "bg-rose-100"}`}
              >
                <span className="block text-2xl">{r.avatar}</span>
                <span className="block truncate text-[11px] font-semibold text-stone-700">{r.name}</span>
              </li>
            ))}
          </ul>
        )}

        <section className="mt-8 text-left" aria-label="Epílogo">
          <h2 className="mb-3 text-center text-sm font-bold uppercase tracking-wide text-stone-600">E o que aconteceu com cada um...</h2>
          <ul className="flex flex-col gap-2">
            {ending.epilogue.map((line, i) => {
              const who = epilogueWho(line.who);
              return (
                <li
                  key={line.who}
                  style={{ animationDelay: `${epilogueStart + i * 260}ms` }}
                  className="sindico-enter flex items-start gap-3 rounded-xl bg-white/90 p-3 shadow-sm ring-1 ring-stone-200/80"
                >
                  <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-50 text-2xl ring-1 ring-amber-100">
                    {who.avatar}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-stone-800">{who.name}</span>
                    <span className="block text-sm text-stone-600">{line.text}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {highlights.length > 0 && (
          <section className="mt-8 rounded-2xl bg-white/90 p-4 text-left shadow-sm ring-1 ring-stone-200/80" aria-label="Resumo do mandato">
            <h2 className="mb-2 text-center text-sm font-bold uppercase tracking-wide text-stone-600">📒 Resumo do mandato</h2>
            <p className="mb-2 text-center text-xs text-stone-500">As decisões que mais mexeram com o prédio</p>
            <ol className="flex flex-col gap-2">
              {highlights.map((d, i) => (
                <li key={i} className="flex gap-3 rounded-xl bg-amber-50 p-2.5">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-amber-500 text-xs font-black text-white">{i + 1}</span>
                  <span className="min-w-0 text-sm">
                    <span className="block font-bold text-stone-800">
                      {d.title} <span className="font-normal text-stone-500">· semana {d.week}</span>
                    </span>
                    <span className="block text-stone-600">Você escolheu: {d.choice}</span>
                  </span>
                </li>
              ))}
            </ol>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
              <div className="rounded-lg bg-stone-50 p-2">
                <dt className="text-stone-500">Resolvidas</dt>
                <dd className="text-base font-black text-stone-800">{state.stats.resolved}</dd>
              </div>
              <div className="rounded-lg bg-stone-50 p-2">
                <dt className="text-stone-500">Explodiram</dt>
                <dd className="text-base font-black text-stone-800">{state.stats.expired}</dd>
              </div>
              <div className="rounded-lg bg-stone-50 p-2">
                <dt className="text-stone-500">Pautas aprovadas</dt>
                <dd className="text-base font-black text-stone-800">{state.stats.passedPautas}</dd>
              </div>
              <div className="rounded-lg bg-stone-50 p-2">
                <dt className="text-stone-500">Melhorias</dt>
                <dd className="text-base font-black text-stone-800">{state.stats.upgrades}</dd>
              </div>
            </dl>
          </section>
        )}

        <div className="mt-6 rounded-2xl bg-white/90 p-4 shadow-sm ring-1 ring-stone-200/80">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Pontuação</p>
          <p className="text-4xl font-black tabular-nums text-stone-800" aria-label={`${ending.score} pontos`}>
            {shownScore.toLocaleString("pt-BR")}
          </p>
          <p className="text-sm text-stone-500">{isRecord ? "🎉 Novo recorde!" : `Recorde: ${records.bestScore.toLocaleString("pt-BR")}`}</p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div className="rounded-lg bg-amber-50 p-2">
              <dt className="text-stone-500">Durou</dt>
              <dd className="font-bold">{currentMonth(state)} meses</dd>
            </div>
            <div className="rounded-lg bg-amber-50 p-2">
              <dt className="text-stone-500">Caixa</dt>
              <dd className="font-bold tabular-nums">{brl(state.money)}</dd>
            </div>
            <div className="rounded-lg bg-amber-50 p-2">
              <dt className="text-stone-500">Conservação</dt>
              <dd className="font-bold">{state.condition}%</dd>
            </div>
            <div className="rounded-lg bg-amber-50 p-2">
              <dt className="text-stone-500">Aprovação</dt>
              <dd className="font-bold">{Math.round(averageApproval(state))}%</dd>
            </div>
          </dl>
        </div>

        <section className="mt-6 text-left">
          <h2 className="mb-2 text-center text-sm font-bold uppercase tracking-wide text-stone-600">
            Conquistas desta partida ({ending.achievements.length})
          </h2>
          {ending.achievements.length === 0 ? (
            <p className="text-center text-sm text-stone-500">Nenhuma desta vez. Tem {ACHIEVEMENTS.length} pra descobrir.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {ending.achievements.map((id) => {
                const a = ACHIEVEMENTS_BY_ID[id];
                const isNew = newAchievements.includes(id);
                return (
                  <li key={id} className={`flex items-center gap-2 rounded-lg bg-white/90 px-2 py-1.5 text-xs shadow-sm ${isNew ? "sindico-pop ring-2 ring-amber-500" : ""}`}>
                    <span className="text-lg">{a.icon}</span>
                    <span className="min-w-0">
                      <span className="block font-bold text-stone-800">
                        {a.title} {isNew && <span className="ml-1 rounded bg-amber-500 px-1 text-[10px] text-white">NOVA</span>}
                      </span>
                      <span className="block text-stone-600">{a.text}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-2 text-center text-xs text-stone-500">
            Conquistas: {records.achievements.length}/{ACHIEVEMENTS.length} · Finais descobertos: {records.endings.length}/{ALL_ENDING_IDS.length}
          </p>
        </section>

        <button onClick={onRestart} className="mt-8 rounded-xl bg-amber-600 px-8 py-3 font-black text-white shadow transition hover:bg-amber-700 active:scale-[0.98]">
          Jogar de novo
        </button>
      </div>
    </div>
  );
}
