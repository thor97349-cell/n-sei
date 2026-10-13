"use client";

import { useState, useSyncExternalStore } from "react";
import ActionsPanel from "@/components/sindico/ActionsPanel";
import AssemblyScreen from "@/components/sindico/AssemblyScreen";
import Building from "@/components/sindico/Building";
import GroupChat from "@/components/sindico/GroupChat";
import Hud from "@/components/sindico/Hud";
import { EventModal, OutcomeModal, ResidentModal, UpgradesModal } from "@/components/sindico/Modals";
import PendingList from "@/components/sindico/PendingList";
import { EndScreen, StartScreen } from "@/components/sindico/Screens";
import {
  buyUpgrade,
  chooseOption,
  closeAssembly,
  createGame,
  dismissOutcome,
  doAction,
  endWeek,
  holdAssembly,
  lobbyResident,
  selectPauta,
  visitResident,
} from "@/lib/sindico/engine";
import { play, setMuted as setSfxMuted } from "@/lib/sindico/sfx";
import { loadGame, loadMuted, loadRecords, recordEnding, Records, saveGame, saveMuted } from "@/lib/sindico/storage";
import { DifficultyId, GameState, ProfileId, ResidentId } from "@/lib/sindico/types";

const noopSubscribe = () => () => {};

// localStorage só existe no cliente; isso evita diferença entre o HTML do
// servidor e o do navegador na hidratação.
function useIsClient() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

function sumDeltas(s: GameState) {
  return Object.values(s.lastOutcome?.deltas ?? {}).reduce((a, b) => a + (b ?? 0), 0);
}

export default function SindicoPage() {
  const isClient = useIsClient();
  const [loaded, setLoaded] = useState(false);
  const [state, setState] = useState<GameState | null>(null);
  const [saved, setSaved] = useState<GameState | null>(null);
  const [records, setRecords] = useState<Records>({ bestScore: 0, games: 0, wins: 0, achievements: [] });
  const [newAchievements, setNewAchievements] = useState<string[]>([]);
  const [muted, setMuted] = useState(false);
  const [openEvent, setOpenEvent] = useState<number | null>(null);
  const [openResident, setOpenResident] = useState<ResidentId | null>(null);
  const [openUpgrades, setOpenUpgrades] = useState(false);
  // Quando a assembleia termina em destituição, mostra o resultado da votação
  // antes da tela final.
  const [endAcknowledged, setEndAcknowledged] = useState(false);

  if (isClient && !loaded) {
    setLoaded(true);
    setSaved(loadGame());
    setRecords(loadRecords());
    const m = loadMuted();
    setMuted(m);
    setSfxMuted(m);
  }

  // Toda mudança de estado passa por aqui: salva, registra o fim e toca som.
  function commit(next: GameState) {
    if (next === state) return;
    if (next.phase === "ended" && state?.phase !== "ended") {
      const result = recordEnding(next);
      setRecords(result.records);
      setNewAchievements(result.newAchievements);
      saveGame(null);
      setSaved(null);
      play("end");
    } else {
      saveGame(next);
    }
    setState(next);
  }

  function start(profile: ProfileId, difficulty: DifficultyId) {
    // A seed vem do relógio só no clique, então não há mismatch de hidratação.
    const game = createGame(Date.now(), profile, difficulty);
    setOpenEvent(null);
    setOpenResident(null);
    setOpenUpgrades(false);
    setEndAcknowledged(false);
    setNewAchievements([]);
    play("notify");
    commit(game);
  }

  function goToMenu() {
    setSaved(state && state.phase !== "ended" ? state : loadGame());
    setState(null);
    setOpenEvent(null);
    setOpenResident(null);
    setOpenUpgrades(false);
  }

  function toggleMute() {
    const m = !muted;
    setMuted(m);
    setSfxMuted(m);
    saveMuted(m);
  }

  // Ação que gera um resultado com variação de aprovação: som bom ou ruim.
  function commitWithOutcome(next: GameState) {
    if (next === state) return;
    play(sumDeltas(next) >= 0 ? "good" : "bad");
    commit(next);
  }

  if (!isClient) return <div className="min-h-screen" />;

  if (!state) {
    return (
      <StartScreen
        saved={saved}
        records={records}
        onStart={start}
        onContinue={() => {
          if (!saved) return;
          setEndAcknowledged(false);
          setState(saved);
        }}
      />
    );
  }

  if (state.phase === "ended" && (!state.assembly || endAcknowledged)) {
    return <EndScreen state={state} records={records} newAchievements={newAchievements} onRestart={() => setState(null)} />;
  }

  if (state.assembly) {
    return (
      <AssemblyScreen
        state={state}
        onSelect={(id) => {
          const selected = selectPauta(state, id);
          // Sem pauta não tem conversa de corredor: vai direto pro resultado.
          if (id === null) {
            play("vote");
            commit(holdAssembly(selected));
          } else commit(selected);
        }}
        onLobby={(id) => commit(lobbyResident(state, id))}
        onVote={() => {
          const next = holdAssembly(state);
          play(next.assembly?.result?.passed ? "good" : "vote");
          commit(next);
        }}
        onContinue={() => {
          if (state.phase === "ended") setEndAcknowledged(true);
          else {
            play("notify");
            commit(closeAssembly(state));
          }
        }}
      />
    );
  }

  return (
    <>
      <Hud state={state} muted={muted} onToggleMute={toggleMute} onQuit={goToMenu} />
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="order-2 lg:order-1">
          <Building state={state} onSelectResident={setOpenResident} />
        </div>
        <div className="order-1 flex flex-col gap-6 lg:order-2">
          <PendingList
            state={state}
            onOpen={setOpenEvent}
            onEndWeek={() => {
              setOpenEvent(null);
              const next = endWeek(state);
              if (next.phase === "assembly") play("vote");
              else if (next.pending.length > 0) play("notify");
              commit(next);
            }}
          />
          <ActionsPanel state={state} onAction={(id) => commitWithOutcome(doAction(state, id))} onOpenUpgrades={() => setOpenUpgrades(true)} />
        </div>
        <div className="order-3">
          <GroupChat messages={state.chat} />
        </div>
      </main>

      {openEvent !== null && (
        <EventModal
          state={state}
          uid={openEvent}
          onChoose={(i) => {
            setOpenEvent(null);
            commitWithOutcome(chooseOption(state, openEvent, i));
          }}
          onClose={() => setOpenEvent(null)}
        />
      )}
      {openUpgrades && !state.lastOutcome && (
        <UpgradesModal
          state={state}
          onBuy={(id) => {
            setOpenUpgrades(false);
            commitWithOutcome(buyUpgrade(state, id));
          }}
          onClose={() => setOpenUpgrades(false)}
        />
      )}
      {openResident && !state.lastOutcome && (
        <ResidentModal
          state={state}
          id={openResident}
          onVisit={() => {
            setOpenResident(null);
            commitWithOutcome(visitResident(state, openResident));
          }}
          onClose={() => setOpenResident(null)}
        />
      )}
      {state.lastOutcome && <OutcomeModal outcome={state.lastOutcome} onClose={() => commit(dismissOutcome(state))} />}
    </>
  );
}
