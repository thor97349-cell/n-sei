"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Onboarding, { OnboardingResult } from "@/components/nexus/Onboarding";
import GameOverScreen from "@/components/nexus/GameOverScreen";
import AppShell from "@/components/nexus/shell/AppShell";
import OverviewView from "@/components/nexus/views/OverviewView";
import CompanyView from "@/components/nexus/views/CompanyView";
import MarketView from "@/components/nexus/views/MarketView";
import FinanceView from "@/components/nexus/views/FinanceView";
import DecisionsView from "@/components/nexus/views/DecisionsView";
import ChallengesView from "@/components/nexus/views/ChallengesView";
import AdvisorView from "@/components/nexus/views/AdvisorView";
import LearnView from "@/components/nexus/views/LearnView";
import { createNewGame, advanceMonth } from "@/lib/nexus/engine";
import { loadGame, saveGame, clearGame } from "@/lib/nexus/storage";
import { GameState, Decisions } from "@/lib/nexus/types";
import { ViewId } from "@/lib/nexus/views";

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
  const [activeView, setActiveView] = useState<ViewId>("overview");

  if (isClient && !loadedFromStorage) {
    setLoadedFromStorage(true);
    setState(loadGame());
  }

  useEffect(() => {
    if (state) saveGame(state);
  }, [state]);

  function handleOnboardingComplete(result: OnboardingResult) {
    setState(createNewGame(result));
    setActiveView("overview");
  }

  function handleAdvance(decisions: Decisions) {
    setState((prev) => (prev ? advanceMonth(prev, decisions) : prev));
  }

  function handleRestart() {
    clearGame();
    setState(null);
    setActiveView("overview");
  }

  if (!isClient) {
    return <div className="min-h-screen bg-slate-950" />;
  }

  if (!state) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  if (state.gameOver) {
    return <GameOverScreen state={state} onRestart={handleRestart} />;
  }

  return (
    <AppShell state={state} active={activeView} onNavigate={setActiveView} onRestart={handleRestart}>
      {activeView === "overview" && <OverviewView state={state} onNavigate={setActiveView} />}
      {activeView === "company" && <CompanyView state={state} />}
      {activeView === "market" && <MarketView state={state} />}
      {activeView === "finance" && <FinanceView state={state} />}
      {activeView === "decisions" && <DecisionsView state={state} onAdvance={handleAdvance} />}
      {activeView === "challenges" && <ChallengesView state={state} />}
      {activeView === "advisor" && <AdvisorView state={state} />}
      {activeView === "learn" && <LearnView />}
    </AppShell>
  );
}
