import { useEffect, useState } from "react";
import { EVENTOS_POR_ID } from "@/lib/imperio-sombras/data/eventos";
import { getDistritoDef } from "@/lib/imperio-sombras/engine/selectors";
import { formatarCusto } from "@/lib/imperio-sombras/format";
import type { EventoAtivo, Recursos } from "@/lib/imperio-sombras/types";
import BarraProgresso from "./BarraProgresso";

interface ModalEventoProps {
  eventoAtivo: EventoAtivo;
  recursos: Recursos;
  onResolver: (opcaoId: string) => void;
}

export default function ModalEvento({
  eventoAtivo,
  recursos,
  onResolver,
}: ModalEventoProps) {
  // Começa em `criadoEm` (valor puro vindo de props) e só passa a refletir
  // o relógio real dentro do efeito, para não chamar Date.now() no render.
  const [agora, setAgora] = useState(eventoAtivo.criadoEm);
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const def = EVENTOS_POR_ID[eventoAtivo.eventoId];
  if (!def) return null;

  const distritoDef = eventoAtivo.distritoId ? getDistritoDef(eventoAtivo.distritoId) : undefined;
  const restanteMs = Math.max(0, eventoAtivo.expiraEm - agora);
  const totalMs = eventoAtivo.expiraEm - eventoAtivo.criadoEm;
  const percentualRestante = totalMs > 0 ? (restanteMs / totalMs) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-fuchsia-500/30 bg-zinc-950 p-5 shadow-2xl shadow-fuchsia-900/30">
        <div className="mb-3 flex items-center gap-3">
          <span className="text-3xl">{def.icone}</span>
          <div>
            <h2 className="text-lg font-bold text-white">{def.titulo}</h2>
            {distritoDef && (
              <p className="text-xs text-white/50">
                Afeta {distritoDef.icone} {distritoDef.nome}
              </p>
            )}
          </div>
        </div>

        <p className="mb-4 text-sm text-white/70">{def.descricao}</p>

        <div className="mb-4">
          <BarraProgresso valor={percentualRestante} corClasse="bg-fuchsia-500" alturaClasse="h-1.5" />
        </div>

        <div className="flex flex-col gap-2">
          {def.opcoes.map((opcao) => {
            const custoTexto = opcao.custo ? formatarCusto(opcao.custo) : null;
            const semRecurso =
              opcao.custo &&
              Object.entries(opcao.custo).some(
                ([chave, valor]) => recursos[chave as keyof Recursos] < (valor ?? 0),
              );
            return (
              <button
                key={opcao.id}
                type="button"
                onClick={() => onResolver(opcao.id)}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white transition hover:border-fuchsia-500/50 hover:bg-white/10"
              >
                <span>{opcao.texto}</span>
                {custoTexto && (
                  <span className={`text-xs ${semRecurso ? "text-red-400" : "text-white/50"}`}>
                    {custoTexto}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
