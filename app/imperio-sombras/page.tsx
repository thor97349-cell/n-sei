import type { Metadata } from "next";
import ImperioSombrasApp from "@/components/imperio-sombras/ImperioSombrasApp";

export const metadata: Metadata = {
  title: "Império das Sombras",
  description:
    "Jogo de gerenciamento estratégico: expanda seu domínio pelas sombras, controle distritos e evite a queda do seu império.",
};

export default function ImperioSombrasPage() {
  return <ImperioSombrasApp />;
}
