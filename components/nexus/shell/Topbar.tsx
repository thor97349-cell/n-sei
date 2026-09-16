import { SECTORS } from "@/lib/nexus/sectors";
import { SectorId } from "@/lib/nexus/types";

export default function Topbar({
  companyName,
  sectorId,
  month,
  onRestart,
}: {
  companyName: string;
  sectorId: SectorId;
  month: number;
  onRestart: () => void;
}) {
  const sector = SECTORS[sectorId];

  return (
    <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 py-3.5">
      <div className="flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-md border border-cyan-400/40 text-xs font-bold text-cyan-300">
          V
        </div>
        <span className="font-semibold text-white tracking-wide">VÉRTICE</span>
        <span className="hidden sm:inline text-slate-600">·</span>
        <span className="hidden sm:inline text-sm text-slate-400">
          {sector.emoji} {companyName} — mês {month}
        </span>
      </div>
      <button onClick={onRestart} className="text-xs text-slate-500 hover:text-slate-300">
        Encerrar e começar nova empresa
      </button>
    </header>
  );
}
