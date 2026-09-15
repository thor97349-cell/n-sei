export function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

export function formatPercent(value: number): string {
  return `${(value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}
