import { GameState } from "@/lib/nexus/types";
import { getMilestonesStatus } from "@/lib/nexus/xp";

export default function ChallengesView({ state }: { state: GameState }) {
  const milestones = getMilestonesStatus(state);
  const unlockedCount = milestones.filter((m) => m.unlocked).length;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="text-sm text-slate-400 mb-1">Progresso de desafios</div>
        <div className="text-2xl font-semibold text-white font-mono">
          {unlockedCount}/{milestones.length}
        </div>
        <div className="mt-2 h-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 to-indigo-400"
            style={{ width: `${(unlockedCount / milestones.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {milestones.map((m) => (
          <div
            key={m.id}
            className={`rounded-xl border p-4 ${
              m.unlocked ? "border-emerald-500/30 bg-emerald-500/5" : "border-slate-800 bg-slate-900/50"
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className={`font-medium ${m.unlocked ? "text-emerald-300" : "text-white"}`}>
                {m.unlocked ? "✓ " : "🔒 "}
                {m.label}
              </span>
              <span className="text-xs font-mono text-slate-500 shrink-0">+{m.xp} XP</span>
            </div>
            <p className="text-xs text-slate-500">{m.hint}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
