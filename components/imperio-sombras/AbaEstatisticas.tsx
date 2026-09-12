import { TITULOS_IMPERIO } from "@/lib/imperio-sombras/constants";
import {
  getPontuacaoImperio,
  getProximoTitulo,
  getTituloAtual,
} from "@/lib/imperio-sombras/engine/selectors";
import { formatarDuracao, formatarNumero } from "@/lib/imperio-sombras/format";
import type { GameState } from "@/lib/imperio-sombras/types";
import BarraProgresso from "./BarraProgresso";

export default function AbaEstatisticas({
  state,
  onReiniciar,
}: {
  state: GameState;
  onReiniciar: () => void;
}) {
  const pontuacao = getPontuacaoImperio(state);
  const tituloAtual = getTituloAtual(state);
  const proximoTitulo = getProximoTitulo(state);
  const indiceAtual = TITULOS_IMPERIO.findIndex((t) => t.nome === tituloAtual.nome);
  const progressoTitulo = proximoTitulo
    ? ((pontuacao - tituloAtual.pontosMinimos) /
        (proximoTitulo.pontosMinimos - tituloAtual.pontosMinimos)) *
      100
    : 100;

  const distritosDesbloqueados = Object.values(state.distritos).filter(
    (d) => d.desbloqueado,
  ).length;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-white/10 bg-gradient-to-br from-fuchsia-950/40 to-transparent p-5">
        <p className="text-xs uppercase tracking-wide text-white/50">Título do Império</p>
        <h2 className="text-2xl font-bold text-white">{tituloAtual.nome}</h2>
        <p className="mt-1 text-xs text-white/50">
          Pontuação do império: {formatarNumero(pontuacao)}
        </p>
        {proximoTitulo && (
          <div className="mt-3 space-y-1.5">
            <div className="flex justify-between text-xs text-white/50">
              <span>Rumo a &quot;{proximoTitulo.nome}&quot;</span>
              <span>{Math.max(0, progressoTitulo).toFixed(0)}%</span>
            </div>
            <BarraProgresso valor={progressoTitulo} corClasse="bg-fuchsia-500" />
          </div>
        )}
        <p className="mt-2 text-xs text-white/40">
          Nível {indiceAtual + 1} de {TITULOS_IMPERIO.length} · bônus de +
          {(tituloAtual.bonusMultiplicadorDinheiro * 100).toFixed(0)}% no dinheiro
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Estatistica
          rotulo="Distritos"
          valor={`${distritosDesbloqueados}/${Object.keys(state.distritos).length}`}
        />
        <Estatistica
          rotulo="Dinheiro total"
          valor={formatarNumero(state.estatisticas.totalDinheiroGanho)}
        />
        <Estatistica
          rotulo="Eventos resolvidos"
          valor={formatarNumero(state.estatisticas.eventosResolvidos)}
        />
        <Estatistica
          rotulo="Tempo de império"
          valor={formatarDuracao(state.estatisticas.tempoJogadoMs)}
        />
      </section>

      <section className="rounded-xl border border-red-500/20 bg-red-950/10 p-4">
        <h3 className="mb-1 text-sm font-semibold text-red-300">Zona de perigo</h3>
        <p className="mb-3 text-xs text-white/50">
          Reinicia todo o progresso do império. Essa ação não pode ser desfeita.
        </p>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Reiniciar o Império das Sombras do zero?")) {
              onReiniciar();
            }
          }}
          className="rounded-lg border border-red-500/40 px-3 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/10"
        >
          Reiniciar império
        </button>
      </section>
    </div>
  );
}

function Estatistica({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
      <p className="text-[11px] uppercase tracking-wide text-white/40">{rotulo}</p>
      <p className="font-mono text-lg font-semibold text-white">{valor}</p>
    </div>
  );
}
