"use client";

import { useState } from "react";
import { Decisions, StaffCounts } from "@/lib/nexus/types";
import { SectorConfig } from "@/lib/nexus/types";
import { formatCurrency } from "@/lib/nexus/format";

const STAFF_LABELS: Record<keyof StaffCounts, string> = {
  sales: "Vendas",
  support: "Suporte",
  product: "Produto",
};

export default function DecisionPanel({
  sector,
  initial,
  onAdvance,
  disabled,
}: {
  sector: SectorConfig;
  initial: Decisions;
  onAdvance: (decisions: Decisions) => void;
  disabled: boolean;
}) {
  const [decisions, setDecisions] = useState<Decisions>(initial);

  const staffCost =
    decisions.staff.sales * sector.salaries.sales +
    decisions.staff.support * sector.salaries.support +
    decisions.staff.product * sector.salaries.product;

  const totalCommitted = decisions.marketingSpend + decisions.rndSpend + staffCost + sector.fixedCosts;

  function updateStaff(role: keyof StaffCounts, delta: number) {
    setDecisions((d) => ({
      ...d,
      staff: { ...d.staff, [role]: Math.max(0, d.staff[role] + delta) },
    }));
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-6">
      <div>
        <div className="flex justify-between text-sm text-slate-400 mb-1">
          <span>Preço mensal por cliente</span>
          <span className="font-mono text-white">{formatCurrency(decisions.price)}</span>
        </div>
        <input
          type="range"
          min={Math.round(sector.referencePrice * 0.4)}
          max={Math.round(sector.referencePrice * 2.2)}
          step={1}
          value={decisions.price}
          onChange={(e) => setDecisions((d) => ({ ...d, price: Number(e.target.value) }))}
          className="w-full accent-cyan-400"
        />
        <div className="text-[11px] text-slate-500 mt-1">
          Referência de mercado: {formatCurrency(sector.referencePrice)}
        </div>
      </div>

      <div>
        <div className="flex justify-between text-sm text-slate-400 mb-1">
          <span>Investimento em marketing / mês</span>
          <span className="font-mono text-white">{formatCurrency(decisions.marketingSpend)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={Math.round(sector.cacBase * 200)}
          step={50}
          value={decisions.marketingSpend}
          onChange={(e) => setDecisions((d) => ({ ...d, marketingSpend: Number(e.target.value) }))}
          className="w-full accent-cyan-400"
        />
      </div>

      <div>
        <div className="flex justify-between text-sm text-slate-400 mb-1">
          <span>Investimento em P&D / mês</span>
          <span className="font-mono text-white">{formatCurrency(decisions.rndSpend)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={8000}
          step={100}
          value={decisions.rndSpend}
          onChange={(e) => setDecisions((d) => ({ ...d, rndSpend: Number(e.target.value) }))}
          className="w-full accent-cyan-400"
        />
        <div className="text-[11px] text-slate-500 mt-1">Melhora reputação/qualidade ao longo do tempo.</div>
      </div>

      <div>
        <div className="text-sm text-slate-400 mb-2">Equipe</div>
        <div className="space-y-2">
          {(Object.keys(STAFF_LABELS) as (keyof StaffCounts)[]).map((role) => (
            <div key={role} className="flex items-center justify-between">
              <span className="text-sm text-slate-300">
                {STAFF_LABELS[role]}{" "}
                <span className="text-slate-500 text-xs">
                  ({formatCurrency(sector.salaries[role])}/pessoa)
                </span>
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => updateStaff(role, -1)}
                  className="w-7 h-7 rounded border border-slate-700 text-slate-300 hover:border-slate-500"
                >
                  −
                </button>
                <span className="w-5 text-center font-mono text-white">{decisions.staff[role]}</span>
                <button
                  onClick={() => updateStaff(role, 1)}
                  className="w-7 h-7 rounded border border-slate-700 text-slate-300 hover:border-slate-500"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-800 pt-4 text-sm text-slate-400 flex justify-between">
        <span>Custos comprometidos no mês</span>
        <span className="font-mono text-white">{formatCurrency(totalCommitted)}</span>
      </div>

      <button
        disabled={disabled}
        onClick={() => onAdvance(decisions)}
        className="w-full rounded-lg bg-cyan-500 py-3 font-medium text-slate-950 hover:bg-cyan-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        Avançar para o próximo mês →
      </button>
    </div>
  );
}
