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
  // Arquivos opcionais, fora do git: public/corrida/menu.mp3 (música da tela inicial)
  // e public/corrida/juice/ (personagem 3D: model.txt + texturas .jpg). Sem eles,
  // o jogo usa a batida própria e a tela inicial 2D só com o carro.
  return (
    <CorridaGame
      titleTrack="/corrida/menu.mp3"
      juiceModel="/corrida/juice/"
      footer={<Link href="/">← voltar ao site</Link>}
    />
  );
}
