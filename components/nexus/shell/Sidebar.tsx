import { NAV_GROUPS, ViewId } from "@/lib/nexus/views";
import { xpProgress } from "@/lib/nexus/xp";

export default function Sidebar({
  xp,
  active,
  onNavigate,
}: {
  xp: number;
  active: ViewId;
  onNavigate: (view: ViewId) => void;
}) {
  const { level, currentXp, neededXp } = xpProgress(xp);

  return (
    <aside className="relative z-10 hidden md:flex w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-950/90 px-4 py-6">
      <div className="mb-6 px-1">
        <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Nível de fundador</div>
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-semibold text-white font-mono">L{level}</span>
          <span className="text-xs text-slate-500 font-mono">
            {currentXp}/{neededXp} XP
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-orange-400"
            style={{ width: `${Math.min(100, (currentXp / neededXp) * 100)}%` }}
          />
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="px-2 mb-1.5 text-[11px] uppercase tracking-wider text-slate-600">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = active === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors text-left ${
                      isActive
                        ? "bg-amber-400/10 text-amber-300"
                        : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                    }`}
                  >
                    <span className="text-base leading-none">{item.icon}</span>
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
