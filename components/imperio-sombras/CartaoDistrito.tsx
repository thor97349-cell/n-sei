import { CUSTO_REFORCO_SEGURANCA } from "@/lib/imperio-sombras/constants";
import { formatarCusto, formatarNumero } from "@/lib/imperio-sombras/format";
import {
  custoDesbloqueio,
  custoInvestimento,
  rendaEfetivaDistrito,
} from "@/lib/imperio-sombras/engine/selectors";
import type { DistritoDef, DistritoState, GameState } from "@/lib/imperio-sombras/types";
import BarraProgresso from "./BarraProgresso";

interface CartaoDistritoProps {
  def: DistritoDef;
  distritoState: DistritoState;
  state: GameState;
  onInvestir: (id: string) => void;
  onReforcarSeguranca: (id: string) => void;
  onDesbloquear: (id: string) => void;
}

function corRisco(risco: number): string {
  if (risco >= 70) return "bg-red-500";
  if (risco >= 40) return "bg-orange-400";
  return "bg-emerald-500";
}

export default function CartaoDistrito({
  def,
  distritoState,
  state,
  onInvestir,
  onReforcarSeguranca,
  onDesbloquear,
}: CartaoDistritoProps) {
  if (!distritoState.desbloqueado) {
    const custo = custoDesbloqueio(def, state);
    const reputacaoOk = state.recursos.reputacao >= def.requisitoReputacao;
    const dinheiroOk = Object.entries(custo).every(
      ([chave, valor]) =>
        state.recursos[chave as keyof typeof state.recursos] >= (valor ?? 0),
    );
    const podeDesbloquear = reputacaoOk && dinheiroOk;

    return (
      <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/30 p-4 opacity-80">
        <div className="flex items-center gap-2">
          <span className="text-2xl grayscale">{def.icone}</span>
          <div>
            <h3 className="font-semibold text-white/70">{def.nome}</h3>
            <p className="text-xs text-white/40">Distrito bloqueado</p>
          </div>
        </div>
        <p className="text-sm text-white/50">{def.descricao}</p>
        <div className="text-xs text-white/50">
          Requer{" "}
          <span className={reputacaoOk ? "text-emerald-400" : "text-red-400"}>
            👑 {formatarNumero(def.requisitoReputacao)} reputação
          </span>
        </div>
        <div className="text-xs text-white/50">Custo: {formatarCusto(custo)}</div>
        <button
          type="button"
          disabled={!podeDesbloquear}
          onClick={() => onDesbloquear(def.id)}
          className="mt-1 rounded-lg bg-fuchsia-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-fuchsia-600 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30"
        >
          Desbloquear distrito
        </button>
      </div>
    );
  }

  const renda = rendaEfetivaDistrito(def, distritoState, state);
  const custoInvest = custoInvestimento(def, distritoState, state);
  const podeInvestir =
    state.recursos.dinheiro >= custoInvest && distritoState.nivelControle < 100;
  const podeReforcar =
    state.recursos.seguranca >= CUSTO_REFORCO_SEGURANCA && distritoState.risco > 0;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent p-4 shadow-lg shadow-black/30">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{def.icone}</span>
          <div>
            <h3 className="font-semibold text-white">{def.nome}</h3>
            <p className="text-xs text-white/40">{def.descricao}</p>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-white/60">
          <span>Controle</span>
          <span>{distritoState.nivelControle.toFixed(0)}%</span>
        </div>
        <BarraProgresso valor={distritoState.nivelControle} corClasse="bg-amber-400" />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-white/60">
          <span>Risco</span>
          <span>{distritoState.risco.toFixed(0)}%</span>
        </div>
        <BarraProgresso valor={distritoState.risco} corClasse={corRisco(distritoState.risco)} />
      </div>

      <div className="flex gap-3 text-xs text-white/70">
        <span>💰 {formatarNumero(renda.dinheiro)}/s</span>
        {renda.influencia > 0 && <span>🕸️ {renda.influencia.toFixed(2)}/s</span>}
      </div>

      <div className="mt-1 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={!podeInvestir}
          onClick={() => onInvestir(def.id)}
          className="flex-1 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30"
        >
          Investir · 💰{formatarNumero(custoInvest)}
        </button>
        <button
          type="button"
          disabled={!podeReforcar}
          onClick={() => onReforcarSeguranca(def.id)}
          className="flex-1 rounded-lg bg-sky-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30"
        >
          Reforçar · 🛡️{CUSTO_REFORCO_SEGURANCA}
        </button>
      </div>
    </div>
  );
}
