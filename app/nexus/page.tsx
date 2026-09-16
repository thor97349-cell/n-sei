"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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
import RecordsView from "@/components/nexus/views/RecordsView";
import {
  createNewGame,
  advanceMonth,
  resolveCrossroad,
  expandMarket,
  raiseInvestment,
  applyDailyBonus,
  resolvePitchGame,
  resolveQuizGame,
} from "@/lib/nexus/engine";
import { loadActiveGame, listSaves, saveGame, setActiveId, loadSave, deleteSave } from "@/lib/nexus/storage";
import { getStreak, registerPlaySession, DAILY_BONUS_XP } from "@/lib/nexus/streak";
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
  const [streakDays, setStreakDays] = useState(0);
  const lastAdvanceAtRef = useRef(0);

  if (isClient && !loadedFromStorage) {
    setLoadedFromStorage(true);
    setStreakDays(getStreak().streakDays);
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
    // Segunda camada de proteção contra spam (segurar Enter/clique repetido),
    // independente do cooldown visual do próprio botão.
    const now = Date.now();
    if (now - lastAdvanceAtRef.current < 400) return;
    lastAdvanceAtRef.current = now;

    const { streak, isNewDay } = registerPlaySession();
    setStreakDays(streak.streakDays);
    setState((prev) => {
      if (!prev) return prev;
      const advanced = advanceMonth(prev, decisions);
      return isNewDay ? applyDailyBonus(advanced, DAILY_BONUS_XP, streak.streakDays) : advanced;
    });
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

  function handleResolvePitch(stopPosition: number) {
    setState((prev) => (prev ? resolvePitchGame(prev, stopPosition) : prev));
  }

  function handleResolveQuiz(selectedIndex: number) {
    setState((prev) => (prev ? resolveQuizGame(prev, selectedIndex) : prev));
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

  const recordSaves = (() => {
    const all = listSaves();
    const idx = all.findIndex((s) => s.id === state.id);
    if (idx >= 0) all[idx] = state;
    else all.push(state);
    return all;
  })();

  return (
    <AppShell state={state} active={activeView} onNavigate={setActiveView} onRestart={goToSelect} streakDays={streakDays}>
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
            onResolvePitch={handleResolvePitch}
            onResolveQuiz={handleResolveQuiz}
          />
        )}
        {activeView === "challenges" && <ChallengesView state={state} />}
        {activeView === "advisor" && <AdvisorView state={state} />}
        {activeView === "records" && <RecordsView saves={recordSaves} />}
        {activeView === "learn" && <LearnView />}
      </div>
    </AppShell>
  );
}
