"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Onboarding from "@/components/nexus/Onboarding";
import Dashboard from "@/components/nexus/Dashboard";
import DecisionPanel from "@/components/nexus/DecisionPanel";
import GameOverScreen from "@/components/nexus/GameOverScreen";
import { createNewGame, advanceMonth } from "@/lib/nexus/engine";
import { loadGame, saveGame, clearGame } from "@/lib/nexus/storage";
import { SECTORS } from "@/lib/nexus/sectors";
import { GameState, SectorId, Decisions } from "@/lib/nexus/types";

const noopSubscribe = () => () => {};

// localStorage só existe no cliente; usamos useSyncExternalStore para saber
// quando a hidratação terminou sem gerar mismatch entre server/client render.
function useIsClient() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export default function NexusPage() {
  const isClient = useIsClient();
  const [state, setState] = useState<GameState | null>(null);
  const [loadedFromStorage, setLoadedFromStorage] = useState(false);

  if (isClient && !loadedFromStorage) {
    setLoadedFromStorage(true);
    setState(loadGame());
  }

  useEffect(() => {
    if (state) saveGame(state);
  }, [state]);

  function handleStart(companyName: string, sectorId: SectorId) {
    setState(createNewGame(companyName, sectorId));
  }

  function handleAdvance(decisions: Decisions) {
    setState((prev) => (prev ? advanceMonth(prev, decisions) : prev));
  }

  function handleRestart() {
    clearGame();
    setState(null);
  }

  if (!isClient) {
    return <div className="min-h-screen" />;
  }

  if (!state) {
    return <Onboarding onStart={handleStart} />;
  }

  if (state.gameOver) {
    return <GameOverScreen state={state} onRestart={handleRestart} />;
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div className="text-sm tracking-[0.3em] text-cyan-400 uppercase">Vértice</div>
        <button onClick={handleRestart} className="text-xs text-slate-500 hover:text-slate-300">
          Encerrar e começar nova empresa
        </button>
      </div>
      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <Dashboard state={state} />
        <DecisionPanel
          sector={SECTORS[state.sectorId]}
          initial={state.decisions}
          onAdvance={handleAdvance}
          disabled={state.gameOver}
        />
      </div>
    </div>
  );
}
