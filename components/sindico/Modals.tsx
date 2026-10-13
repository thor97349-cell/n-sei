"use client";

import { useEffect } from "react";
import { UPGRADES } from "@/lib/sindico/data/actions";
import { EVENTS_BY_ID } from "@/lib/sindico/data/events";
import { RESIDENTS_BY_ID, TAG_LABELS } from "@/lib/sindico/data/residents";
import { hasUpgrade, isPaying, upgradeBlocker, visitBlocker, VISIT_HOURS } from "@/lib/sindico/engine";
import { approvalColor, brl, moodEmoji, senderInfo, signedBrl } from "@/lib/sindico/format";
import { GameState, Outcome, ResidentId, Tag } from "@/lib/sindico/types";

export function Modal({ onClose, children, label }: { onClose?: () => void; children: React.ReactNode; label: string }) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-40 flex items-end justify-center bg-stone-900/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="sindico-pop max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-amber-50 p-5 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function EventModal({
  state,
  uid,
  onChoose,
  onClose,
}: {
  state: GameState;
  uid: number;
  onChoose: (index: number) => void;
  onClose: () => void;
}) {
  const pending = state.pending.find((p) => p.uid === uid);
  if (!pending) return null;
  const ev = EVENTS_BY_ID[pending.eventId];
  const who = senderInfo(ev.from);

  return (
    <Modal onClose={onClose} label={ev.title}>
      <div className="flex items-start gap-3">
        <span className="text-4xl leading-none">{who.avatar}</span>
        <div>
          <h2 className="text-lg font-black text-stone-800">{ev.title}</h2>
          <p className="text-xs text-stone-500">{who.name}</p>
        </div>
      </div>
      <p className="mt-3 rounded-lg rounded-tl-none bg-white p-3 text-stone-700 shadow-sm">{ev.text}</p>

      <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-stone-500">O que você faz?</h3>
      <div className="mt-2 flex flex-col gap-2">
        {ev.choices.map((c, i) => {
          const noTime = c.hours > state.hours;
          return (
            <button
              key={i}
              disabled={noTime}
              onClick={() => onChoose(i)}
              className="rounded-lg bg-white p-3 text-left shadow-sm ring-1 ring-stone-200 transition enabled:hover:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
            >
              <span className="block font-semibold text-stone-800">{c.label}</span>
              <span className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                <span className="rounded bg-stone-100 px-1.5 py-0.5 text-stone-600">⏱ {c.hours === 0 ? "sem tempo" : `${c.hours}h`}</span>
                {c.effects.money ? (
                  <span className={`rounded px-1.5 py-0.5 ${c.effects.money > 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                    {signedBrl(c.effects.money)}
                  </span>
                ) : null}
                {c.effects.fixedCosts ? (
                  <span className="rounded bg-orange-100 px-1.5 py-0.5 text-orange-700">
                    {c.effects.fixedCosts > 0 ? "+" : "−"}R$ {Math.abs(c.effects.fixedCosts)}/mês
                  </span>
                ) : null}
                {noTime && <span className="rounded bg-rose-50 px-1.5 py-0.5 text-rose-600">sem horas livres</span>}
              </span>
            </button>
          );
        })}
      </div>
      <button onClick={onClose} className="mt-4 w-full rounded-lg py-2 text-sm font-semibold text-stone-500 hover:bg-stone-200/60">
        Deixar pra depois ({pending.weeksLeft <= 1 ? "vence esta semana!" : `${pending.weeksLeft} semanas`})
      </button>
    </Modal>
  );
}

export function DeltaList({ deltas, reasons }: { deltas: Partial<Record<ResidentId, number>>; reasons?: Partial<Record<ResidentId, string>> }) {
  const entries = (Object.entries(deltas) as [ResidentId, number][]).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return <p className="text-sm text-stone-500">Ninguém ligou muito.</p>;
  return (
    <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
      {entries.map(([id, d]) => (
        <li key={id} className="flex items-center gap-1.5 rounded bg-white px-2 py-1 text-sm shadow-sm">
          <span>{RESIDENTS_BY_ID[id].avatar}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-stone-700">{RESIDENTS_BY_ID[id].name}</span>
            {reasons?.[id] && <span className="block truncate text-[11px] text-stone-500">por causa de: {reasons[id]}</span>}
          </span>
          <span className={`font-bold tabular-nums ${d > 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {d > 0 ? "+" : ""}
            {d}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function OutcomeModal({ outcome, onClose }: { outcome: Outcome; onClose: () => void }) {
  return (
    <Modal onClose={onClose} label="Resultado">
      <p className="text-xs font-bold uppercase tracking-wide text-stone-500">{outcome.title}</p>
      <p className="mt-1 text-lg font-bold text-stone-800">{outcome.result}</p>
      {(outcome.money !== 0 || outcome.condition !== 0) && (
        <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
          {outcome.money !== 0 && (
            <span className={`rounded px-2 py-1 ${outcome.money > 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
              Caixa {signedBrl(outcome.money)}
            </span>
          )}
          {outcome.condition !== 0 && (
            <span className={`rounded px-2 py-1 ${outcome.condition > 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
              Conservação {outcome.condition > 0 ? "+" : ""}
              {outcome.condition}
            </span>
          )}
        </div>
      )}
      <h3 className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-stone-500">Aprovação dos moradores</h3>
      <DeltaList deltas={outcome.deltas} reasons={outcome.reasons} />
      <button autoFocus onClick={onClose} className="mt-5 w-full rounded-lg bg-amber-600 py-2.5 font-bold text-white hover:bg-amber-700">
        Ok
      </button>
    </Modal>
  );
}

function TagChips({ tags, tone }: { tags: Tag[]; tone: "like" | "dislike" }) {
  if (tags.length === 0) return <span className="text-sm text-stone-400">nada em especial</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span
          key={t}
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone === "like" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}
        >
          {TAG_LABELS[t].icon} {TAG_LABELS[t].label}
        </span>
      ))}
    </span>
  );
}

export function ResidentModal({
  state,
  id,
  onVisit,
  onClose,
}: {
  state: GameState;
  id: ResidentId;
  onVisit: () => void;
  onClose: () => void;
}) {
  const r = RESIDENTS_BY_ID[id];
  const approval = Math.round(state.approval[id]);
  const weights = Object.entries(r.likes) as [Tag, number][];
  const likes = weights.filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1]).map(([t]) => t);
  const dislikes = weights.filter(([, w]) => w < 0).sort((a, b) => a[1] - b[1]).map(([t]) => t);
  const paying = isPaying(state, id);
  const visitBlocked = visitBlocker(state, id);

  return (
    <Modal onClose={onClose} label={r.name}>
      <div className="flex items-center gap-3">
        <span className="text-5xl leading-none">{r.avatar}</span>
        <div>
          <h2 className="text-xl font-black text-stone-800">{r.name}</h2>
          <p className="text-sm text-stone-500">Apartamento {r.apt}</p>
        </div>
      </div>
      <p className="mt-3 text-stone-700">{r.bio}</p>
      <div className="mt-4 flex items-center gap-2">
        <span className="text-2xl">{moodEmoji(approval)}</span>
        <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-stone-200">
          <span className={`block h-full ${approvalColor(approval)}`} style={{ width: `${approval}%` }} />
        </span>
        <span className="w-12 text-right font-bold tabular-nums text-stone-700">{approval}%</span>
      </div>
      <p className="mt-1 text-xs text-stone-500">
        {approval >= 50 ? "Hoje votaria em você." : approval >= 40 ? "Hoje NÃO votaria em você." : "Votaria pela sua destituição."}
        {!paying && " · Não está pagando o condomínio."}
      </p>
      <dl className="mt-4 space-y-2">
        <div>
          <dt className="mb-1 text-xs font-bold uppercase tracking-wide text-stone-500">Liga pra</dt>
          <dd>
            <TagChips tags={likes} tone="like" />
          </dd>
        </div>
        <div>
          <dt className="mb-1 text-xs font-bold uppercase tracking-wide text-stone-500">Não suporta</dt>
          <dd>
            <TagChips tags={dislikes} tone="dislike" />
          </dd>
        </div>
        {r.special && (
          <div>
            <dt className="mb-1 text-xs font-bold uppercase tracking-wide text-stone-500">Jeito dele(a)</dt>
            <dd className="rounded-lg bg-amber-100/70 px-3 py-2 text-sm text-stone-700">⭐ {r.special}</dd>
          </div>
        )}
      </dl>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button
          onClick={onVisit}
          disabled={!!visitBlocked}
          className="flex-1 rounded-lg bg-amber-600 py-2.5 font-bold text-white enabled:hover:bg-amber-700 disabled:opacity-50"
        >
          🚪 Fazer uma visita (⏱ {VISIT_HOURS}h){visitBlocked ? ` · ${visitBlocked}` : ""}
        </button>
        <button onClick={onClose} className="rounded-lg bg-stone-200 px-4 py-2.5 font-bold text-stone-700 hover:bg-stone-300">
          Fechar
        </button>
      </div>
    </Modal>
  );
}

export function UpgradesModal({ state, onBuy, onClose }: { state: GameState; onBuy: (id: string) => void; onClose: () => void }) {
  return (
    <Modal onClose={onClose} label="Melhorias do prédio">
      <h2 className="text-xl font-black text-stone-800">🏗️ Melhorias do prédio</h2>
      <p className="mt-1 text-sm text-stone-600">
        Até R$ 6.000 o síndico aprova sozinho. Cada obra leva 1 hora livre pra organizar. Caixa atual:{" "}
        <strong className={state.money < 0 ? "text-rose-600" : ""}>{brl(state.money)}</strong>
      </p>
      <ul className="mt-4 flex flex-col gap-2">
        {UPGRADES.map((u) => {
          const done = hasUpgrade(state, u.id);
          const blocked = upgradeBlocker(state, u.id);
          return (
            <li key={u.id} className={`rounded-lg p-3 shadow-sm ring-1 ${done ? "bg-emerald-50 ring-emerald-200" : "bg-white ring-stone-200"}`}>
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none">{u.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-stone-800">{u.name}</p>
                  <p className="text-sm text-stone-600">{u.text}</p>
                  <p className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                    <span className="rounded bg-rose-100 px-1.5 py-0.5 text-rose-700">{signedBrl(-u.cost)}</span>
                    {u.monthly ? (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">
                        {u.monthly < 0 ? "economiza" : "custa"} R$ {Math.abs(u.monthly)}/mês
                      </span>
                    ) : null}
                  </p>
                </div>
                <button
                  onClick={() => onBuy(u.id)}
                  disabled={!!blocked}
                  className="shrink-0 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white enabled:hover:bg-emerald-800 disabled:bg-stone-300 disabled:text-stone-600"
                >
                  {done ? "✅ Feita" : blocked ?? "Fazer"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <button onClick={onClose} className="mt-4 w-full rounded-lg bg-stone-200 py-2.5 font-bold text-stone-700 hover:bg-stone-300">
        Fechar
      </button>
    </Modal>
  );
}
