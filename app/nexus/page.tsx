"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Onboarding, { OnboardingResult } from "@/components/nexus/Onboarding";
import GameSelect from "@/components/nexus/GameSelect";
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
import { createNewGame, advanceMonth, resolveCrossroad, expandMarket, raiseInvestment } from "@/lib/nexus/engine";
import { loadActiveGame, listSaves, saveGame, setActiveId, loadSave, deleteSave } from "@/lib/nexus/storage";
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

type Screen = "select" | "onboarding" | "game";

export default function NexusPage() {
  const isClient = useIsClient();
  const [state, setState] = useState<GameState | null>(null);
  const [saves, setSaves] = useState<GameState[]>([]);
  const [screen, setScreen] = useState<Screen>("select");
  const [loadedFromStorage, setLoadedFromStorage] = useState(false);
  const [activeView, setActiveView] = useState<ViewId>("overview");

  if (isClient && !loadedFromStorage) {
    setLoadedFromStorage(true);
    const active = loadActiveGame();
    if (active) {
      setState(active);
      setScreen("game");
    } else {
      const existing = listSaves();
      setSaves(existing);
      setScreen(existing.length > 0 ? "select" : "onboarding");
    }
  }

  useEffect(() => {
    if (state) saveGame(state);
  }, [state]);

  function goToSelect() {
    setActiveId(null);
    setState(null);
    setSaves(listSaves());
    setScreen("select");
  }

  function handleOnboardingComplete(result: OnboardingResult) {
    const game = createNewGame(result);
    saveGame(game);
    setActiveId(game.id);
    setState(game);
    setActiveView("overview");
    setScreen("game");
  }

  function handleContinue(id: string) {
    const game = loadSave(id);
    if (!game) return;
    setActiveId(id);
    setState(game);
    setActiveView("overview");
    setScreen("game");
  }

  function handleDeleteSave(id: string) {
    deleteSave(id);
    setSaves(listSaves());
  }

  function handleAdvance(decisions: Decisions) {
    setState((prev) => (prev ? advanceMonth(prev, decisions) : prev));
  }

  function handleResolveCrossroad(optionId: string) {
    setState((prev) => (prev ? resolveCrossroad(prev, optionId) : prev));
  }

  function handleExpandMarket() {
    setState((prev) => (prev ? expandMarket(prev) : prev));
  }

  function handleRaiseInvestment() {
    setState((prev) => (prev ? raiseInvestment(prev) : prev));
  }

  if (!isClient) {
    return <div className="min-h-screen bg-slate-950" />;
  }

  if (screen === "select") {
    return (
      <GameSelect saves={saves} onContinue={handleContinue} onNew={() => setScreen("onboarding")} onDelete={handleDeleteSave} />
    );
  }

  if (screen === "onboarding" || !state) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  if (state.gameOver) {
    return <GameOverScreen state={state} onRestart={goToSelect} />;
  }

  return (
    <AppShell state={state} active={activeView} onNavigate={setActiveView} onRestart={goToSelect}>
      <div key={activeView} className="nexus-view-transition">
        {activeView === "overview" && <OverviewView state={state} onNavigate={setActiveView} />}
        {activeView === "company" && <CompanyView state={state} />}
        {activeView === "market" && <MarketView state={state} />}
        {activeView === "finance" && <FinanceView state={state} />}
        {activeView === "decisions" && (
          <DecisionsView
            state={state}
            onAdvance={handleAdvance}
            onResolveCrossroad={handleResolveCrossroad}
            onExpandMarket={handleExpandMarket}
            onRaiseInvestment={handleRaiseInvestment}
          />
        )}
        {activeView === "challenges" && <ChallengesView state={state} />}
        {activeView === "advisor" && <AdvisorView state={state} />}
        {activeView === "learn" && <LearnView />}
      </div>
    </AppShell>
  );
}
