import type { Metadata } from "next";
import MeiDoCrimeApp from "@/components/mei-do-crime/MeiDoCrimeApp";

export const metadata: Metadata = {
  title: "MEI do Crime",
  description:
    "Jogo de gerenciamento estratégico: formalize sua operação, controle distritos, gerencie o risco e a dívida, e evite a queda do seu negócio.",
};

export default function MeiDoCrimePage() {
  return <MeiDoCrimeApp />;
}
