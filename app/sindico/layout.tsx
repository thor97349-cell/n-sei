import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Síndico — Edifício Primavera (protótipo)",
  description:
    "Protótipo de jogo: você é o novo síndico de um prédio caótico. Resolva pendências, aguente o grupo do WhatsApp e sobreviva às assembleias.",
};

export default function SindicoLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-gradient-to-b from-sky-100 to-orange-50 text-stone-800">{children}</div>;
}
