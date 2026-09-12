const SUFIXOS = ["", "K", "M", "B", "T"];

export function formatarNumero(valor: number): string {
  const sinal = valor < 0 ? "-" : "";
  const abs = Math.abs(valor);
  if (abs < 1000) return sinal + Math.floor(abs).toString();

  let ordem = Math.floor(Math.log10(abs) / 3);
  ordem = Math.min(ordem, SUFIXOS.length - 1);
  const reduzido = abs / Math.pow(1000, ordem);
  return `${sinal}${reduzido.toFixed(reduzido < 10 ? 2 : 1)}${SUFIXOS[ordem]}`;
}

export function formatarTaxa(valorPorSegundo: number): string {
  return `${formatarNumero(valorPorSegundo)}/s`;
}

export function formatarDuracao(ms: number): string {
  const totalSegundos = Math.floor(ms / 1000);
  const horas = Math.floor(totalSegundos / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);
  const segundos = totalSegundos % 60;
  if (horas > 0) return `${horas}h ${minutos}min`;
  if (minutos > 0) return `${minutos}min ${segundos}s`;
  return `${segundos}s`;
}

export function formatarCusto(custo: Partial<Record<string, number>>): string {
  const icones: Record<string, string> = {
    dinheiro: "💰",
    influencia: "🕸️",
    seguranca: "🛡️",
    reputacao: "👑",
  };
  return Object.entries(custo)
    .filter(([, valor]) => (valor ?? 0) !== 0)
    .map(([chave, valor]) => `${icones[chave] ?? ""} ${formatarNumero(valor ?? 0)}`)
    .join("  ");
}
