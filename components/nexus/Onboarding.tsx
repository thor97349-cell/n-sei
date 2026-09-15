"use client";

import { useState } from "react";
import { SECTOR_LIST } from "@/lib/nexus/sectors";
import { SectorId } from "@/lib/nexus/types";

export default function Onboarding({
  onStart,
}: {
  onStart: (companyName: string, sectorId: SectorId) => void;
}) {
  const [companyName, setCompanyName] = useState("");
  const [sectorId, setSectorId] = useState<SectorId | null>(null);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-sm tracking-[0.3em] text-cyan-400 uppercase mb-3">Vértice · Dia 1</p>
      <h1 className="text-3xl md:text-4xl font-semibold text-white mb-3">
        Você é a fundadora. A decisão é sua.
      </h1>
      <p className="text-slate-400 mb-10 max-w-xl">
        Escolha um setor, dê um nome à empresa e comece a operar. Cada mês você define preço,
        marketing, equipe e investimento — o mercado reage às suas escolhas.
      </p>

      <label className="block text-sm text-slate-300 mb-2">Nome da empresa</label>
      <input
        value={companyName}
        onChange={(e) => setCompanyName(e.target.value)}
        placeholder="Ex: Norte Digital"
        className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3 text-white placeholder:text-slate-600 mb-8 outline-none focus:border-cyan-500 transition-colors"
        maxLength={40}
      />

      <label className="block text-sm text-slate-300 mb-3">Escolha o setor</label>
      <div className="grid sm:grid-cols-2 gap-3 mb-10">
        {SECTOR_LIST.map((sector) => {
          const active = sectorId === sector.id;
          return (
            <button
              key={sector.id}
              onClick={() => setSectorId(sector.id)}
              className={`text-left rounded-xl border p-4 transition-colors ${
                active
                  ? "border-cyan-400 bg-cyan-400/10"
                  : "border-slate-700 bg-slate-900/40 hover:border-slate-500"
              }`}
            >
              <div className="text-2xl mb-2">{sector.emoji}</div>
              <div className="text-white font-medium mb-1">{sector.name}</div>
              <div className="text-xs text-slate-400">{sector.tagline}</div>
            </button>
          );
        })}
      </div>

      <button
        disabled={!sectorId}
        onClick={() => sectorId && onStart(companyName, sectorId)}
        className="w-full sm:w-auto rounded-lg bg-cyan-500 px-8 py-3 font-medium text-slate-950 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed hover:bg-cyan-400"
      >
        Abrir a empresa →
      </button>
    </div>
  );
}
