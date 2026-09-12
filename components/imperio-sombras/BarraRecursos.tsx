import { formatarNumero } from "@/lib/imperio-sombras/format";
import type { Recursos } from "@/lib/imperio-sombras/types";

const ITENS: { chave: keyof Recursos; icone: string; nome: string; cor: string }[] = [
  { chave: "dinheiro", icone: "💰", nome: "Dinheiro", cor: "text-amber-400" },
  { chave: "influencia", icone: "🕸️", nome: "Influência", cor: "text-violet-400" },
  { chave: "seguranca", icone: "🛡️", nome: "Segurança", cor: "text-sky-400" },
  { chave: "reputacao", icone: "👑", nome: "Reputação", cor: "text-rose-400" },
];

export default function BarraRecursos({ recursos }: { recursos: Recursos }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
      {ITENS.map((item) => (
        <div
          key={item.chave}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
        >
          <span className="text-lg leading-none">{item.icone}</span>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-white/50">
              {item.nome}
            </div>
            <div className={`truncate font-mono text-sm font-semibold ${item.cor}`}>
              {formatarNumero(recursos[item.chave])}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
