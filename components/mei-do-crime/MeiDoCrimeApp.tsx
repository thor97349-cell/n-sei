"use client";

import { useState } from "react";
import { useGameEngine } from "@/lib/mei-do-crime/engine/useGameEngine";
import { formatarNumero } from "@/lib/mei-do-crime/format";
import AbaConexoes from "./AbaConexoes";
import AbaDistritos from "./AbaDistritos";
import AbaEstatisticas from "./AbaEstatisticas";
import AbaFinancas from "./AbaFinancas";
import AbaRegistro from "./AbaRegistro";
import AbaUpgrades from "./AbaUpgrades";
import BarraRecursos from "./BarraRecursos";
import ModalEvento from "./ModalEvento";
import ModalIntroducao from "./ModalIntroducao";
import ModalRelatorioOffline from "./ModalRelatorioOffline";
import SeletorVelocidade from "./SeletorVelocidade";

type Aba = "distritos" | "upgrades" | "financas" | "conexoes" | "registro" | "estatisticas";

const ABAS: { id: Aba; nome: string; icone: string }[] = [
  { id: "distritos", nome: "Distritos", icone: "🗺️" },
  { id: "upgrades", nome: "Upgrades", icone: "⚙️" },
  { id: "financas", nome: "Finanças", icone: "🏦" },
  { id: "conexoes", nome: "Conexões", icone: "🤝" },
  { id: "registro", nome: "Registro", icone: "📜" },
  { id: "estatisticas", nome: "Império", icone: "👑" },
];

export default function MeiDoCrimeApp() {
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
    pegarEmprestimo,
    pagarDivida,
    recrutarConexao,
    acionarConexao,
    definirVelocidade,
    iniciarJogo,
  } = useGameEngine();
  const [abaAtiva, setAbaAtiva] = useState<Aba>("distritos");

  if (!carregado) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zinc-950 text-white/60">
        Carregando o MEI...
      </div>
    );
  }

  if (!state.introVista) {
    return <ModalIntroducao onIniciar={iniciarJogo} />;
  }

  return (
    <div className="min-h-dvh bg-zinc-950 text-white">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              🧾 MEI do Crime
            </h1>
            <p className="text-xs text-white/40">
              Formalize a operação, gerencie o risco e vire referência no ramo — sem nunca emitir nota.
            </p>
          </div>
          <SeletorVelocidade velocidade={state.velocidade} onDefinir={definirVelocidade} />
        </header>

        <div className="mb-3">
          <BarraRecursos recursos={state.recursos} />
        </div>

        {state.divida > 0 && (
          <button
            type="button"
            onClick={() => setAbaAtiva("financas")}
            className="mb-3 flex w-full items-center justify-between rounded-lg border border-red-500/20 bg-red-950/10 px-3 py-2 text-left text-xs text-red-300 transition hover:bg-red-950/20"
          >
            <span>💳 Dívida com o agiota: {formatarNumero(state.divida)}</span>
            <span className="text-red-300/70">ver em Finanças →</span>
          </button>
        )}

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
          {abaAtiva === "financas" && (
            <AbaFinancas
              state={state}
              onPegarEmprestimo={pegarEmprestimo}
              onPagarDivida={pagarDivida}
            />
          )}
          {abaAtiva === "conexoes" && (
            <AbaConexoes
              state={state}
              onRecrutar={recrutarConexao}
              onAcionar={acionarConexao}
            />
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
          state={state}
          onResolver={resolverEvento}
          onAcionarConexao={acionarConexao}
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
