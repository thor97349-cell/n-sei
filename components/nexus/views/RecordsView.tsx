import { GameState, HistoryEntry } from "@/lib/nexus/types";
import { SECTORS } from "@/lib/nexus/sectors";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/nexus/format";

interface Record {
  label: string;
  value: string;
  companyName: string;
  sectorEmoji: string;
}

function findBest(
  saves: GameState[],
  accessor: (h: HistoryEntry) => number,
): { save: GameState; entry: HistoryEntry } | null {
  let best: { save: GameState; entry: HistoryEntry } | null = null;
  for (const save of saves) {
    for (const entry of save.history) {
      if (!best || accessor(entry) > accessor(best.entry)) {
        best = { save, entry };
      }
    }
  }
  return best;
}

export default function RecordsView({ saves }: { saves: GameState[] }) {
  if (saves.length === 0) {
    return <p className="text-sm text-slate-400">Ainda sem dados suficientes para recordes.</p>;
  }

  const records: Record[] = [];

  const bestRevenue = findBest(saves, (h) => h.revenue);
  if (bestRevenue) {
    records.push({
      label: "Maior receita mensal",
      value: formatCurrency(bestRevenue.entry.revenue),
      companyName: bestRevenue.save.companyName,
      sectorEmoji: SECTORS[bestRevenue.save.sectorId].emoji,
    });
  }

  const bestProfit = findBest(saves, (h) => h.profit);
  if (bestProfit) {
    records.push({
      label: "Maior lucro mensal",
      value: formatCurrency(bestProfit.entry.profit),
      companyName: bestProfit.save.companyName,
      sectorEmoji: SECTORS[bestProfit.save.sectorId].emoji,
    });
  }

  const bestCustomers = findBest(saves, (h) => h.customers);
  if (bestCustomers) {
    records.push({
      label: "Mais clientes ativos",
      value: formatNumber(bestCustomers.entry.customers),
      companyName: bestCustomers.save.companyName,
      sectorEmoji: SECTORS[bestCustomers.save.sectorId].emoji,
    });
  }

  const bestShare = findBest(saves, (h) => h.marketShare);
  if (bestShare) {
    records.push({
      label: "Maior market share",
      value: formatPercent(bestShare.entry.marketShare),
      companyName: bestShare.save.companyName,
      sectorEmoji: SECTORS[bestShare.save.sectorId].emoji,
    });
  }

  const longestSurvival = saves.reduce((a, b) => (b.month > a.month ? b : a));
  records.push({
    label: "Mais meses sobrevivida",
    value: `${longestSurvival.month} ${longestSurvival.month === 1 ? "mês" : "meses"}`,
    companyName: longestSurvival.companyName,
    sectorEmoji: SECTORS[longestSurvival.sectorId].emoji,
  });

  const highestLevel = saves.reduce((a, b) => (b.level > a.level ? b : a));
  records.push({
    label: "Maior nível de fundador",
    value: `Nível ${highestLevel.level}`,
    companyName: highestLevel.companyName,
    sectorEmoji: SECTORS[highestLevel.sectorId].emoji,
  });

  const acquisitions = saves.filter((s) => s.gameOverReason === "acquired");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white mb-1">Seus recordes</h1>
        <p className="text-sm text-slate-400">
          O melhor entre as {saves.length} {saves.length === 1 ? "empresa que você fundou" : "empresas que você fundou"}.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {records.map((r) => (
          <div key={r.label} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">{r.label}</div>
            <div className="text-xl font-semibold text-white font-mono mb-1">{r.value}</div>
            <div className="text-xs text-slate-500">
              {r.sectorEmoji} {r.companyName}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4">
        <div className="text-xs uppercase tracking-wide text-amber-400 mb-1">Saídas bem-sucedidas</div>
        <div className="text-xl font-semibold text-white font-mono">{acquisitions.length}</div>
        <p className="text-xs text-slate-500 mt-1">
          {acquisitions.length === 0
            ? "Nenhuma empresa vendida ainda — aceite uma oferta de aquisição para conquistar essa."
            : acquisitions.map((s) => s.companyName).join(", ")}
        </p>
      </div>
    </div>
  );
}
