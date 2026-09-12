import { TITULOS_IMPERIO } from "../constants";
import { DISTRITOS, DISTRITOS_POR_ID } from "../data/distritos";
import { UPGRADES_POR_ID } from "../data/upgrades";
import type {
  DistritoDef,
  DistritoState,
  GameState,
  Recursos,
  TipoEfeitoUpgrade,
  TituloImperio,
  UpgradeDef,
} from "../types";

function efeitoTotal(state: GameState, tipo: TipoEfeitoUpgrade): number {
  let total = 0;
  for (const upState of Object.values(state.upgrades)) {
    if (upState.nivel <= 0) continue;
    const def = UPGRADES_POR_ID[upState.id];
    if (!def || def.efeito.tipo !== tipo) continue;
    total += def.efeito.valorPorNivel * upState.nivel;
  }
  return total;
}

export function getPontuacaoImperio(state: GameState): number {
  const controleMedio = mediaControleDesbloqueados(state);
  return state.recursos.reputacao + controleMedio * 2;
}

export function getTituloAtual(state: GameState): TituloImperio {
  const pontos = getPontuacaoImperio(state);
  let atual = TITULOS_IMPERIO[0];
  for (const titulo of TITULOS_IMPERIO) {
    if (pontos >= titulo.pontosMinimos) atual = titulo;
  }
  return atual;
}

export function getProximoTitulo(state: GameState): TituloImperio | null {
  const pontos = getPontuacaoImperio(state);
  const proximo = TITULOS_IMPERIO.find((t) => t.pontosMinimos > pontos);
  return proximo ?? null;
}

export function getMultiplicadorDinheiro(state: GameState): number {
  const bonusUpgrades = efeitoTotal(state, "multiplicador_dinheiro");
  const bonusTitulo = getTituloAtual(state).bonusMultiplicadorDinheiro;
  return 1 + bonusUpgrades + bonusTitulo;
}

export function getMultiplicadorInfluencia(state: GameState): number {
  return 1 + efeitoTotal(state, "multiplicador_influencia");
}

export function getGeracaoSegurancaPorTick(state: GameState): number {
  return efeitoTotal(state, "geracao_seguranca");
}

export function getReducaoRiscoFracao(state: GameState): number {
  return Math.min(0.85, efeitoTotal(state, "reducao_risco"));
}

export function getReducaoCustoDesbloqueioFracao(state: GameState): number {
  return Math.min(0.7, efeitoTotal(state, "reducao_custo_desbloqueio"));
}

export function getReducaoCustoInvestimentoFracao(state: GameState): number {
  return Math.min(0.7, efeitoTotal(state, "reducao_custo_investimento"));
}

export function getReducaoEventoNegativoFracao(state: GameState): number {
  return Math.min(0.75, efeitoTotal(state, "reducao_evento_negativo"));
}

function mediaControleDesbloqueados(state: GameState): number {
  const desbloqueados = Object.values(state.distritos).filter(
    (d) => d.desbloqueado,
  );
  if (desbloqueados.length === 0) return 0;
  const soma = desbloqueados.reduce((acc, d) => acc + d.nivelControle, 0);
  return soma / desbloqueados.length;
}

export function custoInvestimento(
  distritoDef: DistritoDef,
  distritoState: DistritoState,
  state: GameState,
): number {
  const reducao = getReducaoCustoInvestimentoFracao(state);
  const escala = 1 + distritoState.nivelControle / 60;
  const bruto = distritoDef.custoInvestimentoBase * escala;
  return Math.round(bruto * (1 - reducao));
}

export function custoDesbloqueio(
  distritoDef: DistritoDef,
  state: GameState,
): Partial<Recursos> {
  const reducao = getReducaoCustoDesbloqueioFracao(state);
  const resultado: Partial<Recursos> = {};
  for (const [chave, valor] of Object.entries(distritoDef.custoDesbloqueio)) {
    resultado[chave as keyof Recursos] = Math.round((valor ?? 0) * (1 - reducao));
  }
  return resultado;
}

export function custoUpgrade(
  upgradeDef: UpgradeDef,
  nivelAtual: number,
): Partial<Recursos> {
  const fator = Math.pow(upgradeDef.escalaCusto, nivelAtual);
  const resultado: Partial<Recursos> = {};
  for (const [chave, valor] of Object.entries(upgradeDef.custoBase)) {
    resultado[chave as keyof Recursos] = Math.round((valor ?? 0) * fator);
  }
  return resultado;
}

export function podeAfordarCusto(
  recursos: Recursos,
  custo: Partial<Recursos>,
): boolean {
  return Object.entries(custo).every(
    ([chave, valor]) => recursos[chave as keyof Recursos] >= (valor ?? 0),
  );
}

export function rendaEfetivaDistrito(
  distritoDef: DistritoDef,
  distritoState: DistritoState,
  state: GameState,
): { dinheiro: number; influencia: number } {
  const fatorControle = distritoState.nivelControle / 100;
  const fatorInstabilidade = 1 - distritoState.risco / 220;
  const multDinheiro = getMultiplicadorDinheiro(state);
  const multInfluencia = getMultiplicadorInfluencia(state);
  return {
    dinheiro:
      distritoDef.rendaBase * fatorControle * fatorInstabilidade * multDinheiro,
    influencia:
      distritoDef.influenciaBase *
      fatorControle *
      fatorInstabilidade *
      multInfluencia,
  };
}

export function listarDistritosDesbloqueaveis(state: GameState): DistritoDef[] {
  return DISTRITOS.filter((d) => !state.distritos[d.id]?.desbloqueado);
}

export function distritosDesbloqueadosIds(state: GameState): string[] {
  return Object.values(state.distritos)
    .filter((d) => d.desbloqueado)
    .map((d) => d.id);
}

export function getDistritoDef(id: string): DistritoDef | undefined {
  return DISTRITOS_POR_ID[id];
}
