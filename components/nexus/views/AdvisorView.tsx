"use client";

import { useState } from "react";
import { GameState } from "@/lib/nexus/types";
import { generateAdvice } from "@/lib/nexus/advisor";
import { interestLabel } from "@/lib/nexus/options";
import { CONSULTANT_TOPICS, askConsultant } from "@/lib/nexus/consultant";

const TONE_STYLES: Record<string, string> = {
  good: "border-emerald-500/40 bg-emerald-500/5",
  bad: "border-rose-500/40 bg-rose-500/5",
  neutral: "border-slate-800 bg-slate-900/50",
};

interface Message {
  role: "user" | "consultant";
  text: string;
}

export default function AdvisorView({ state }: { state: GameState }) {
  const advice = generateAdvice(state);
  const [thread, setThread] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  function ask(question: string) {
    if (!question.trim()) return;
    const answer = askConsultant(state, question);
    setThread((t) => [...t, { role: "user", text: question }, { role: "consultant", text: answer }]);
    setInput("");
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-white mb-1">Consultor IA</h1>
        <p className="text-sm text-slate-400">
          Análise gerada a partir dos números reais da {state.companyName} neste mês.
          {state.interests.length > 0 && (
            <> Priorizando temas de {state.interests.map(interestLabel).join(", ")}.</>
          )}
        </p>
      </div>

      <div className="space-y-3">
        {advice.map((a) => (
          <div key={a.id} className={`rounded-xl border p-4 ${TONE_STYLES[a.tone]}`}>
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">{interestLabel(a.category)}</div>
            <div className="text-white font-medium mb-1">{a.title}</div>
            <p className="text-sm text-slate-400">{a.text}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="text-sm text-slate-400 mb-3">Pergunte ao consultor</div>

        {thread.length > 0 && (
          <div className="space-y-3 mb-4 max-h-96 overflow-y-auto pr-1">
            {thread.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "ml-auto max-w-[85%] rounded-lg rounded-br-sm bg-amber-500/15 border border-amber-400/30 px-3 py-2 text-sm text-amber-100"
                    : "mr-auto max-w-[85%] rounded-lg rounded-bl-sm bg-slate-800/60 border border-slate-700 px-3 py-2 text-sm text-slate-200"
                }
              >
                {m.text}
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          {CONSULTANT_TOPICS.map((topic) => (
            <button
              key={topic.id}
              onClick={() => ask(topic.question)}
              className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-amber-400/60 hover:text-amber-300 transition-colors"
            >
              {topic.question}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ou digite sua pergunta..."
            className="flex-1 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-amber-500 transition-colors"
          />
          <button
            type="submit"
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-amber-400 transition-colors"
          >
            Perguntar
          </button>
        </form>
      </div>
    </div>
  );
}
