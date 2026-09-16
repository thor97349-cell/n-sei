"use client";

import { useState } from "react";
import { QuizMiniGamePrompt } from "@/lib/nexus/types";

export default function QuizMiniGame({
  prompt,
  onResolve,
}: {
  prompt: QuizMiniGamePrompt;
  onResolve: (selectedIndex: number) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="rounded-xl border border-amber-400/40 bg-amber-400/5 p-5">
      <div className="text-xs uppercase tracking-wide text-amber-400 mb-2">🧠 Quiz relâmpago</div>
      <h2 className="text-lg font-semibold text-white mb-5">{prompt.question}</h2>

      <div className="space-y-2 mb-5">
        {prompt.options.map((opt, i) => {
          const isSelected = selected === i;
          const isCorrect = i === prompt.correctIndex;
          const showFeedback = selected !== null;
          let stateClass = "border-slate-700 hover:border-slate-500";
          if (showFeedback && isCorrect) stateClass = "border-emerald-400 bg-emerald-400/10";
          else if (showFeedback && isSelected && !isCorrect) stateClass = "border-rose-400 bg-rose-400/10";

          return (
            <button
              key={i}
              disabled={showFeedback}
              onClick={() => setSelected(i)}
              className={`w-full text-left rounded-lg border px-4 py-3 text-sm text-white transition-colors disabled:cursor-default ${stateClass}`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {selected !== null && (
        <>
          <p className="text-sm text-slate-300 mb-4">{prompt.explanation}</p>
          <button
            onClick={() => onResolve(selected)}
            className="w-full rounded-lg bg-amber-500 py-3 font-medium text-slate-950 hover:bg-amber-400 transition-colors"
          >
            Continuar →
          </button>
        </>
      )}
    </div>
  );
}
