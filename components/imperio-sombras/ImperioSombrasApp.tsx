"use client";

import { useState } from "react";
import { useGameEngine } from "@/lib/imperio-sombras/engine/useGameEngine";
import AbaDistritos from "./AbaDistritos";
import AbaEstatisticas from "./AbaEstatisticas";
import AbaRegistro from "./AbaRegistro";
import AbaUpgrades from "./AbaUpgrades";
import BarraRecursos from "./BarraRecursos";
import ModalEvento from "./ModalEvento";
import ModalRelatorioOffline from "./ModalRelatorioOffline";

type Aba = "distritos" | "upgrades" | "registro" | "estatisticas";

const ABAS: { id: Aba; nome: string; icone: string }[] = [
  { id: "distritos", nome: "Distritos", icone: "🗺️" },
  { id: "upgrades", nome: "Upgrades", icone: "⚙️" },
  { id: "registro", nome: "Registro", icone: "📜" },
  { id: "estatisticas", nome: "Império", icone: "👑" },
];

export default function ImperioSombrasApp() {
  const {
    state,
    carregado,
    investirDistrito,
    reforcarSeguranca,
    desbloquearDistrito,
    comprarUpgrade,
    resolverEvento,
    dispensarRelatorioOffline,
    reiniciarJogo,
  } = useGameEngine();
  const [abaAtiva, setAbaAtiva] = useState<Aba>("distritos");

  if (!carregado) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zinc-950 text-white/60">
        Carregando o império...
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-zinc-950 text-white">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <header className="mb-5">
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            🌑 Império das Sombras
          </h1>
          <p className="text-xs text-white/40">
            Expanda seu domínio, gerencie o risco e torne-se uma lenda das sombras.
          </p>
        </header>

        <div className="mb-5">
          <BarraRecursos recursos={state.recursos} />
        </div>

        <nav className="mb-5 flex gap-1 overflow-x-auto rounded-lg border border-white/10 bg-white/[0.03] p-1">
          {ABAS.map((aba) => (
            <button
              key={aba.id}
              type="button"
              onClick={() => setAbaAtiva(aba.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                abaAtiva === aba.id
                  ? "bg-fuchsia-700 text-white"
                  : "text-white/50 hover:bg-white/5 hover:text-white/80"
              }`}
            >
              <span>{aba.icone}</span>
              {aba.nome}
            </button>
          ))}
        </nav>

        <main>
          {abaAtiva === "distritos" && (
            <AbaDistritos
              state={state}
              onInvestir={investirDistrito}
              onReforcarSeguranca={reforcarSeguranca}
              onDesbloquear={desbloquearDistrito}
            />
          )}
          {abaAtiva === "upgrades" && (
            <AbaUpgrades state={state} onComprar={comprarUpgrade} />
          )}
          {abaAtiva === "registro" && <AbaRegistro registro={state.registro} />}
          {abaAtiva === "estatisticas" && (
            <AbaEstatisticas state={state} onReiniciar={reiniciarJogo} />
          )}
        </main>
      </div>

      {state.eventoAtivo && (
        <ModalEvento
          eventoAtivo={state.eventoAtivo}
          recursos={state.recursos}
          onResolver={resolverEvento}
        />
      )}

      {state.relatorioOffline && (
        <ModalRelatorioOffline
          relatorio={state.relatorioOffline}
          onFechar={dispensarRelatorioOffline}
        />
      )}
    </div>
  );
}
