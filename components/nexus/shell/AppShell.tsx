import { GameState } from "@/lib/nexus/types";
import { ViewId } from "@/lib/nexus/views";
import TopNav from "./TopNav";
import TopographicBackground from "../TopographicBackground";

export default function AppShell({
  state,
  active,
  onNavigate,
  onRestart,
  streakDays,
  children,
}: {
  state: GameState;
  active: ViewId;
  onNavigate: (view: ViewId) => void;
  onRestart: () => void;
  streakDays: number;
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-slate-950">
      <div className="fixed inset-0 z-0">
        <TopographicBackground />
      </div>
      <div className="relative z-10 flex min-h-screen flex-col">
        <TopNav
          companyName={state.companyName}
          sectorId={state.sectorId}
          month={state.month}
          xp={state.xp}
          streakDays={streakDays}
          active={active}
          onNavigate={onNavigate}
          onRestart={onRestart}
        />
        <main className="flex-1 overflow-y-auto px-6 py-6 max-w-6xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
