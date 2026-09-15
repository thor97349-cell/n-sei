import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vértice — Simulador de Negócios",
  description:
    "Construa e opere uma empresa fictícia: preço, marketing, equipe e P&D moldam receita, lucro e market share em um mercado que reage às suas decisões.",
};

export default function NexusLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-950">{children}</div>;
}
