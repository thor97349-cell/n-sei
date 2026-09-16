import { podeAfordarCusto } from "@/lib/imperio-sombras/engine/selectors";
import { formatarCusto, formatarDuracao } from "@/lib/imperio-sombras/format";
import type { ConexaoDef, ConexaoState, GameState } from "@/lib/imperio-sombras/types";

interface CartaoConexaoProps {
  def: ConexaoDef;
  conexaoState: ConexaoState;
  state: GameState;
  onRecrutar: (id: string) => void;
  onAcionar: (id: string) => void;
}

export default function CartaoConexao({
  def,
  conexaoState,
  state,
  onRecrutar,
  onAcionar,
}: CartaoConexaoProps) {
  if (!conexaoState.recrutada) {
    const podeRecrutar = podeAfordarCusto(state.recursos, def.custoRecrutamento);
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/30 p-4 opacity-85">
        <div className="flex items-center gap-2">
          <span className="text-2xl grayscale">{def.icone}</span>
          <h3 className="font-semibold text-white/70">{def.nome}</h3>
        </div>
        <p className="text-xs text-white/50">{def.descricao}</p>
        <p className="text-xs text-white/40">Custo: {formatarCusto(def.custoRecrutamento)}</p>
        <button
          type="button"
          disabled={!podeRecrutar}
          onClick={() => onRecrutar(def.id)}
          className="mt-1 rounded-lg bg-fuchsia-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-fuchsia-600 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30"
        >
          Recrutar
        </button>
      </div>
    );
  }

  const restanteMs = Math.max(0, conexaoState.prontoEm - state.ultimaAtualizacao);
  const pronta = restanteMs <= 0;
  const podeAcionar = pronta && podeAfordarCusto(state.recursos, def.custoAcionar);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{def.icone}</span>
        <h3 className="font-semibold text-white">{def.nome}</h3>
      </div>
      <p className="text-xs text-white/50">{def.descricao}</p>
      <button
        type="button"
        disabled={!podeAcionar}
        onClick={() => onAcionar(def.id)}
        className="mt-1 rounded-lg bg-sky-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30"
      >
        {pronta
          ? `Acionar · ${formatarCusto(def.custoAcionar)}`
          : `Em cooldown · ${formatarDuracao(restanteMs)}`}
      </button>
    </div>
  );
}
