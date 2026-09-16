import { SECTORS } from "@/lib/nexus/sectors";
import { SectorId } from "@/lib/nexus/types";
import { NAV_GROUPS, ViewId } from "@/lib/nexus/views";
import VertexMark from "../VertexMark";

export default function Topbar({
  companyName,
  sectorId,
  month,
  active,
  onNavigate,
  onRestart,
}: {
  companyName: string;
  sectorId: SectorId;
  month: number;
  active: ViewId;
  onNavigate: (view: ViewId) => void;
  onRestart: () => void;
}) {
  const sector = SECTORS[sectorId];

  return (
    <header className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/80 px-6 py-3.5">
      <div className="flex items-center gap-3 min-w-0">
        <VertexMark size={26} />
        <span className="font-semibold text-white tracking-wide shrink-0">VÉRTICE</span>
        <span className="hidden sm:inline text-slate-600">·</span>
        <span className="hidden sm:inline text-sm text-slate-400 truncate">
          {sector.emoji} {companyName} — mês {month}
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <select
          value={active}
          onChange={(e) => onNavigate(e.target.value as ViewId)}
          className="md:hidden rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
        >
          {NAV_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button onClick={onRestart} className="text-xs text-slate-500 hover:text-slate-300 whitespace-nowrap">
          Nova empresa
        </button>
      </div>
    </header>
  );
}
