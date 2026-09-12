import { custoUpgrade, podeAfordarCusto } from "@/lib/imperio-sombras/engine/selectors";
import { formatarCusto, formatarNumero } from "@/lib/imperio-sombras/format";
import type { GameState, UpgradeDef } from "@/lib/imperio-sombras/types";

const DESCRICAO_EFEITO: Record<string, (v: number) => string> = {
  multiplicador_dinheiro: (v) => `+${(v * 100).toFixed(0)}% dinheiro`,
  multiplicador_influencia: (v) => `+${(v * 100).toFixed(0)}% influência`,
  geracao_seguranca: (v) => `+${v.toFixed(2)} segurança/s`,
  reducao_risco: (v) => `-${(v * 100).toFixed(0)}% crescimento de risco`,
  reducao_custo_desbloqueio: (v) => `-${(v * 100).toFixed(0)}% custo de desbloqueio`,
  reducao_custo_investimento: (v) => `-${(v * 100).toFixed(0)}% custo de investimento`,
  reducao_evento_negativo: (v) => `-${(v * 100).toFixed(0)}% impacto de eventos ruins`,
};

interface CartaoUpgradeProps {
  def: UpgradeDef;
  nivelAtual: number;
  state: GameState;
  onComprar: (id: string) => void;
}

export default function CartaoUpgrade({
  def,
  nivelAtual,
  state,
  onComprar,
}: CartaoUpgradeProps) {
  const noMax = nivelAtual >= def.nivelMax;
  const custo = custoUpgrade(def, nivelAtual);
  const reputacaoOk =
    !def.requisitoReputacao || state.recursos.reputacao >= def.requisitoReputacao;
  const podeComprar = !noMax && reputacaoOk && podeAfordarCusto(state.recursos, custo);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center gap-2">
        <span className="text-xl">{def.icone}</span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-white">{def.nome}</h3>
          <p className="text-xs text-white/40">{def.descricao}</p>
        </div>
        <span className="whitespace-nowrap rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70">
          {nivelAtual}/{def.nivelMax}
        </span>
      </div>

      <p className="text-xs text-emerald-400">
        {DESCRICAO_EFEITO[def.efeito.tipo]?.(def.efeito.valorPorNivel) ?? ""}
      </p>

      {def.requisitoReputacao && !reputacaoOk && (
        <p className="text-xs text-red-400">
          Requer 👑 {formatarNumero(def.requisitoReputacao)} reputação
        </p>
      )}

      <button
        type="button"
        disabled={!podeComprar}
        onClick={() => onComprar(def.id)}
        className="mt-1 rounded-lg bg-violet-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30"
      >
        {noMax ? "Nível máximo" : `Evoluir · ${formatarCusto(custo)}`}
      </button>
    </div>
  );
}
