import { DISTRITOS } from "@/lib/imperio-sombras/data/distritos";
import type { GameState } from "@/lib/imperio-sombras/types";
import CartaoDistrito from "./CartaoDistrito";

interface AbaDistritosProps {
  state: GameState;
  onInvestir: (id: string) => void;
  onReforcarSeguranca: (id: string) => void;
  onDesbloquear: (id: string) => void;
}

export default function AbaDistritos({
  state,
  onInvestir,
  onReforcarSeguranca,
  onDesbloquear,
}: AbaDistritosProps) {
  const distritosOrdenados = [...DISTRITOS].sort((a, b) => {
    const aDesbloqueado = state.distritos[a.id]?.desbloqueado ? 0 : 1;
    const bDesbloqueado = state.distritos[b.id]?.desbloqueado ? 0 : 1;
    if (aDesbloqueado !== bDesbloqueado) return aDesbloqueado - bDesbloqueado;
    return a.tier - b.tier;
  });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {distritosOrdenados.map((def) => {
        const distritoState = state.distritos[def.id];
        if (!distritoState) return null;
        return (
          <CartaoDistrito
            key={def.id}
            def={def}
            distritoState={distritoState}
            state={state}
            onInvestir={onInvestir}
            onReforcarSeguranca={onReforcarSeguranca}
            onDesbloquear={onDesbloquear}
          />
        );
      })}
    </div>
  );
}
