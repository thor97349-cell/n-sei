import { NAV_GROUPS, ViewId } from "@/lib/nexus/views";
import { SECTORS } from "@/lib/nexus/sectors";
import { SectorId } from "@/lib/nexus/types";
import { xpProgress } from "@/lib/nexus/xp";
import VertexMark from "../VertexMark";

export default function TopNav({
  companyName,
  sectorId,
  month,
  xp,
  streakDays,
  active,
  onNavigate,
  onRestart,
}: {
  companyName: string;
  sectorId: SectorId;
  month: number;
  xp: number;
  streakDays: number;
  active: ViewId;
  onNavigate: (view: ViewId) => void;
  onRestart: () => void;
}) {
  const sector = SECTORS[sectorId];
  const { level, currentXp, neededXp } = xpProgress(xp);
  const allItems = NAV_GROUPS.flatMap((group) => group.items);

  return (
    <header className="relative z-10 border-b border-slate-800 bg-slate-950/90 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 px-6 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <VertexMark size={26} />
          <span className="font-semibold text-white tracking-wide shrink-0">VÉRTICE</span>
          <span className="hidden sm:inline text-slate-600">·</span>
          <span className="hidden sm:inline text-sm text-slate-400 truncate">
            {sector.emoji} {companyName} — mês {month}
          </span>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="hidden md:flex items-center gap-2" title={`Nível ${level} · ${currentXp}/${neededXp} XP`}>
            <span className="text-xs font-mono text-slate-500">L{level}</span>
            <div className="h-1.5 w-16 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-orange-400"
                style={{ width: `${Math.min(100, (currentXp / neededXp) * 100)}%` }}
              />
            </div>
          </div>
          {streakDays > 0 && (
            <span className="hidden sm:inline text-xs text-amber-300 whitespace-nowrap">
              🔥 {streakDays} {streakDays === 1 ? "dia" : "dias"}
            </span>
          )}
          <button onClick={onRestart} className="text-xs text-slate-500 hover:text-slate-300 whitespace-nowrap">
            Minhas empresas
          </button>
        </div>
      </div>

      <nav className="flex items-center gap-1 overflow-x-auto px-4 pb-2">
        {allItems.map((item) => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex items-center gap-1.5 shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                isActive
                  ? "bg-amber-400/15 text-amber-300"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              }`}
            >
              <span className="text-sm leading-none">{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
