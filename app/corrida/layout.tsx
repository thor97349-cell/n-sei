import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "999 — Corrida Noturna",
  description:
    "Corrida arcade noturna em pseudo-3D: atravesse a cidade antes do tempo acabar e pegue 9 corações seguidos pra ativar o modo 999.",
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function CorridaLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-black">{children}</div>;
}
