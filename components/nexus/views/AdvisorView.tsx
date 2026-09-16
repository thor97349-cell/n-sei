import { GameState } from "@/lib/nexus/types";
import { generateAdvice } from "@/lib/nexus/advisor";
import { interestLabel } from "@/lib/nexus/options";

const TONE_STYLES: Record<string, string> = {
  good: "border-emerald-500/40 bg-emerald-500/5",
  bad: "border-rose-500/40 bg-rose-500/5",
  neutral: "border-slate-800 bg-slate-900/50",
};

export default function AdvisorView({ state }: { state: GameState }) {
  const advice = generateAdvice(state);

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
    </div>
  );
}
