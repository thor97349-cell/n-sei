import { CrossroadPrompt } from "@/lib/nexus/types";

export default function CrossroadCard({
  prompt,
  onResolve,
}: {
  prompt: CrossroadPrompt;
  onResolve: (optionId: string) => void;
}) {
  return (
    <div className="rounded-xl border border-amber-400/40 bg-amber-400/5 p-5">
      <div className="text-xs uppercase tracking-wide text-amber-400 mb-2">⚡ Encruzilhada</div>
      <h2 className="text-lg font-semibold text-white mb-1">{prompt.title}</h2>
      <p className="text-sm text-slate-300 mb-5">{prompt.description}</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {prompt.options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onResolve(opt.id)}
            className="text-left rounded-lg border border-slate-700 bg-slate-900/60 p-4 hover:border-amber-400/60 hover:bg-slate-900 transition-colors"
          >
            <div className="text-white font-medium mb-1">{opt.label}</div>
            <div className="text-xs text-slate-400">{opt.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
