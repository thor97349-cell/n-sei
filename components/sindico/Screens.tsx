"use client";

import { useState } from "react";
import { ACHIEVEMENTS, ACHIEVEMENTS_BY_ID } from "@/lib/sindico/data/achievements";
import { DIFFICULTIES, PROFILES } from "@/lib/sindico/data/profiles";
import { RESIDENTS } from "@/lib/sindico/data/residents";
import { averageApproval, currentMonth } from "@/lib/sindico/engine";
import { brl } from "@/lib/sindico/format";
import { Records } from "@/lib/sindico/storage";
import { DifficultyId, GameState, ProfileId } from "@/lib/sindico/types";

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
      className={`flex items-start gap-2 rounded-lg p-2.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 ${
        selected ? "bg-amber-600 text-white shadow" : "bg-white/80 text-stone-800 ring-1 ring-stone-200 hover:ring-amber-400"
      }`}
    >
      <span className="text-xl leading-none">{icon}</span>
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
  const [showAchievements, setShowAchievements] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-200 via-amber-50 to-orange-100 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="text-center">
          <p className="text-6xl">🏢</p>
          <h1 className="mt-2 text-5xl font-black tracking-tight text-stone-800">Síndico</h1>
          <p className="mt-1 font-semibold text-amber-800">Edifício Primavera · protótipo</p>
          <p className="mx-auto mt-5 max-w-lg text-lg text-stone-700">
            Você ganhou a eleição pra síndico por <strong>1 voto</strong>. O antigo síndico sumiu sem avisar ninguém. Agora aguenta.
          </p>
          <div className="mx-auto mt-4 flex max-w-sm justify-center gap-1 text-3xl">
            {RESIDENTS.map((r) => (
              <span key={r.id} title={r.name}>
                {r.avatar}
              </span>
            ))}
          </div>
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

        <section className="mt-8 rounded-2xl bg-white/50 p-4 shadow-sm ring-1 ring-amber-200">
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
          <button onClick={() => setShowAchievements((v) => !v)} className="mt-2 font-semibold text-amber-800 underline-offset-2 hover:underline">
            {showAchievements ? "Esconder conquistas" : `Conquistas (${records.achievements.length}/${ACHIEVEMENTS.length})`}
          </button>
          {showAchievements && (
            <div className="mt-3">
              <AchievementGrid unlocked={records.achievements} />
            </div>
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

export function EndScreen({
  state,
  records,
  newAchievements,
  onRestart,
}: {
  state: GameState;
  records: Records;
  newAchievements: string[];
  onRestart: () => void;
}) {
  const ending = state.ending;
  if (!ending) return null;
  const style = ENDING_STYLE[ending.kind];
  const isRecord = ending.score >= records.bestScore;
  return (
    <div className={`min-h-screen bg-gradient-to-b ${style.bg} px-4 py-10`}>
      <div className="mx-auto w-full max-w-lg text-center">
        <p className="sindico-pop text-6xl">{style.emoji}</p>
        <h1 className="mt-2 text-4xl font-black text-stone-800">{ending.title}</h1>
        <p className="mt-4 text-lg text-stone-700">{ending.text}</p>

        {ending.votes && (
          <ul className="mt-6 grid grid-cols-4 gap-2">
            {RESIDENTS.map((r, i) => (
              <li
                key={r.id}
                style={{ animationDelay: `${i * 120}ms` }}
                className={`sindico-pop rounded-lg p-2 ${ending.votes?.[r.id] ? "bg-emerald-100" : "bg-rose-100"}`}
              >
                <span className="block text-2xl">{r.avatar}</span>
                <span className="block truncate text-[11px] font-semibold text-stone-700">{r.name}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 rounded-2xl bg-white/80 p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Pontuação</p>
          <p className="text-4xl font-black tabular-nums text-stone-800">{ending.score.toLocaleString("pt-BR")}</p>
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
            Total desbloqueado: {records.achievements.length}/{ACHIEVEMENTS.length}
          </p>
        </section>

        <button onClick={onRestart} className="mt-8 rounded-xl bg-amber-600 px-8 py-3 font-black text-white shadow hover:bg-amber-700">
          Jogar de novo
        </button>
      </div>
    </div>
  );
}
