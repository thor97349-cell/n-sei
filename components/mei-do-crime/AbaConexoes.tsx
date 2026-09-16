import { CONEXOES } from "@/lib/mei-do-crime/data/conexoes";
import type { GameState } from "@/lib/mei-do-crime/types";
import CartaoConexao from "./CartaoConexao";

interface AbaConexoesProps {
  state: GameState;
  onRecrutar: (id: string) => void;
  onAcionar: (id: string) => void;
}

export default function AbaConexoes({ state, onRecrutar, onAcionar }: AbaConexoesProps) {
  return (
    <div>
      <p className="mb-4 text-sm text-white/50">
        Recrute contatos para resolver B.O.&apos;s na hora: abafar batidas, renegociar
        dívidas, resolver um evento em andamento ou recuperar reputação.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {CONEXOES.map((def) => {
          const conexaoState = state.conexoes[def.id];
          if (!conexaoState) return null;
          return (
            <CartaoConexao
              key={def.id}
              def={def}
              conexaoState={conexaoState}
              state={state}
              onRecrutar={onRecrutar}
              onAcionar={onAcionar}
            />
          );
        })}
      </div>
    </div>
  );
}
