import type { Metadata, Viewport } from "next";
import { Racing_Sans_One } from "next/font/google";

const racing = Racing_Sans_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-drfl",
});

export const metadata: Metadata = {
  title: "Death Race for Love — 999",
  description:
    "Fan game de corrida arcade em homenagem a Juice WRLD: nove etapas pela Chicago de madrugada, drift com turbo, garagem e o modo 999.",
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function CorridaLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${racing.variable} min-h-screen bg-black`}>{children}</div>;
}
