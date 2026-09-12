import { UPGRADES } from "@/lib/imperio-sombras/data/upgrades";
import type { CategoriaUpgrade, GameState } from "@/lib/imperio-sombras/types";
import CartaoUpgrade from "./CartaoUpgrade";

const CATEGORIAS: { id: CategoriaUpgrade; nome: string }[] = [
  { id: "operacoes", nome: "Operações" },
  { id: "influencia", nome: "Influência" },
  { id: "seguranca", nome: "Segurança" },
  { id: "especial", nome: "Especiais" },
];

export default function AbaUpgrades({
  state,
  onComprar,
}: {
  state: GameState;
  onComprar: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      {CATEGORIAS.map((categoria) => {
        const upgradesDaCategoria = UPGRADES.filter((u) => u.categoria === categoria.id);
        if (upgradesDaCategoria.length === 0) return null;
        return (
          <section key={categoria.id}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/50">
              {categoria.nome}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {upgradesDaCategoria.map((def) => (
                <CartaoUpgrade
                  key={def.id}
                  def={def}
                  nivelAtual={state.upgrades[def.id]?.nivel ?? 0}
                  state={state}
                  onComprar={onComprar}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
