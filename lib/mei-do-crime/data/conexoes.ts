import type { ConexaoDef } from "../types";

export const CONEXOES: ConexaoDef[] = [
  {
    id: "delegado",
    nome: "Delegado Corrupto",
    descricao:
      "Abafa investigações. Ao ser acionado, derruba o risco do distrito mais quente do seu império.",
    icone: "👮",
    custoRecrutamento: { dinheiro: 800, influencia: 20 },
    custoAcionar: { dinheiro: 200 },
    cooldownMs: 60_000,
    efeito: { tipo: "reduzir_risco_maior_distrito", valor: 55 },
  },
  {
    id: "advogada",
    nome: "Advogada de Confiança",
    descricao: "Renegocia suas dívidas com o agiota, quitando parte do que você deve na hora.",
    icone: "⚖️",
    custoRecrutamento: { dinheiro: 1000, influencia: 15 },
    custoAcionar: { influencia: 25 },
    cooldownMs: 90_000,
    efeito: { tipo: "reduzir_divida_percentual", valor: 0.3 },
  },
  {
    id: "fixer",
    nome: "Fixer de Rua",
    descricao: "Resolve na marra qualquer problema em andamento — garante o melhor desfecho possível.",
    icone: "🕶️",
    custoRecrutamento: { dinheiro: 600, influencia: 10 },
    custoAcionar: { dinheiro: 150, seguranca: 10 },
    cooldownMs: 45_000,
    efeito: { tipo: "resolver_evento_ativo", valor: 1 },
  },
  {
    id: "jornalista",
    nome: "Jornalista Aliado",
    descricao: "Publica matérias favoráveis para reconstruir sua imagem quando ela desaba.",
    icone: "📰",
    custoRecrutamento: { dinheiro: 700, influencia: 25 },
    custoAcionar: { influencia: 20 },
    cooldownMs: 90_000,
    efeito: { tipo: "restaurar_reputacao", valor: 30 },
  },
];

export const CONEXOES_POR_ID: Record<string, ConexaoDef> = Object.fromEntries(
  CONEXOES.map((c) => [c.id, c]),
);
