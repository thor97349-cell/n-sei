import { GameState } from "@/lib/nexus/types";
import { ViewId } from "@/lib/nexus/views";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppShell({
  state,
  active,
  onNavigate,
  onRestart,
  children,
}: {
  state: GameState;
  active: ViewId;
  onNavigate: (view: ViewId) => void;
  onRestart: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar xp={state.xp} active={active} onNavigate={onNavigate} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          companyName={state.companyName}
          sectorId={state.sectorId}
          month={state.month}
          onRestart={onRestart}
        />
        <main className="flex-1 overflow-y-auto px-6 py-6 max-w-6xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
