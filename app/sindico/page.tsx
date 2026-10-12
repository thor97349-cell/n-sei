"use client";

import { useState } from "react";
import AssemblyScreen from "@/components/sindico/AssemblyScreen";
import Building from "@/components/sindico/Building";
import GroupChat from "@/components/sindico/GroupChat";
import Hud from "@/components/sindico/Hud";
import { EventModal, OutcomeModal, ResidentModal } from "@/components/sindico/Modals";
import PendingList from "@/components/sindico/PendingList";
import { EndScreen, StartScreen } from "@/components/sindico/Screens";
import { chooseOption, closeAssembly, createGame, dismissOutcome, endWeek, holdAssembly } from "@/lib/sindico/engine";
import { GameState, ResidentId } from "@/lib/sindico/types";

export default function SindicoPage() {
  const [state, setState] = useState<GameState | null>(null);
  const [openEvent, setOpenEvent] = useState<number | null>(null);
  const [openResident, setOpenResident] = useState<ResidentId | null>(null);
  // Quando a assembleia termina em destituição, mostra o resultado da votação
  // antes da tela final.
  const [endAcknowledged, setEndAcknowledged] = useState(false);

  function start() {
    // A seed vem do relógio só no clique, então não há mismatch de hidratação.
    setState(createGame(Date.now()));
    setOpenEvent(null);
    setOpenResident(null);
    setEndAcknowledged(false);
  }

  if (!state) return <StartScreen onStart={start} />;

  if (state.phase === "ended" && (!state.assembly || endAcknowledged)) {
    return <EndScreen state={state} onRestart={start} />;
  }

  if (state.assembly) {
    return (
      <AssemblyScreen
        state={state}
        onPropose={(id) => setState(holdAssembly(state, id))}
        onContinue={() => {
          if (state.phase === "ended") setEndAcknowledged(true);
          else setState(closeAssembly(state));
        }}
      />
    );
  }

  return (
    <>
      <Hud state={state} />
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="order-2 lg:order-1">
          <Building state={state} onSelectResident={setOpenResident} />
        </div>
        <div className="order-1 lg:order-2">
          <PendingList
            state={state}
            onOpen={setOpenEvent}
            onEndWeek={() => {
              setOpenEvent(null);
              setState(endWeek(state));
            }}
          />
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
            setState(chooseOption(state, openEvent, i));
            setOpenEvent(null);
          }}
          onClose={() => setOpenEvent(null)}
        />
      )}
      {state.lastOutcome && <OutcomeModal outcome={state.lastOutcome} onClose={() => setState(dismissOutcome(state))} />}
      {openResident && <ResidentModal state={state} id={openResident} onClose={() => setOpenResident(null)} />}
    </>
  );
}
