"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

// O jogo depende de canvas, Web Audio e localStorage: não há o que
// pré-renderizar no servidor.
const CorridaGame = dynamic(() => import("@/components/corrida/CorridaGame"), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-black" />,
});

export default function CorridaPage() {
  return <CorridaGame footer={<Link href="/">← voltar ao site</Link>} />;
}
