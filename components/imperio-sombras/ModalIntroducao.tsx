"use client";

import { useState } from "react";
import { DIFICULDADES } from "@/lib/imperio-sombras/constants";
import type { Dificuldade } from "@/lib/imperio-sombras/types";

export default function ModalIntroducao({
  onIniciar,
}: {
  onIniciar: (dificuldade: Dificuldade) => void;
}) {
  const [selecionada, setSelecionada] = useState<Dificuldade>("normal");

  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-950 p-4 text-white">
      <div className="w-full max-w-lg space-y-6 py-8">
        <div className="text-center">
          <div className="mb-2 text-4xl">🌑</div>
          <h1 className="text-2xl font-bold">Império das Sombras</h1>
          <p className="mt-2 text-sm text-white/60">
            Construa seu domínio pelas sombras: tome distritos, gerencie o risco,
            pague suas dívidas e torne-se uma lenda do submundo — ou um alvo fácil.
          </p>
        </div>

        <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/70">
          <p>💰 <b className="text-white">Dinheiro</b> paga investimentos, upgrades e dívidas.</p>
          <p>🕸️ <b className="text-white">Influência</b> abre portas: distritos e conexões.</p>
          <p>🛡️ <b className="text-white">Segurança</b> abaixa o risco dos seus territórios.</p>
          <p>👑 <b className="text-white">Reputação</b> mede sua ascensão no submundo.</p>
          <p>💳 Fuja do dinheiro fácil dos agiotas — a <b className="text-white">dívida</b> cresce sozinha com juros.</p>
        </div>

        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">
            Escolha a dificuldade
          </h2>
          <div className="space-y-2">
            {Object.values(DIFICULDADES).map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelecionada(d.id)}
                className={`w-full rounded-lg border p-3 text-left transition ${
                  selecionada === d.id
                    ? "border-fuchsia-500 bg-fuchsia-500/10"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <div className="font-semibold text-white">{d.nome}</div>
                <div className="text-xs text-white/50">{d.descricao}</div>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onIniciar(selecionada)}
          className="w-full rounded-lg bg-fuchsia-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-fuchsia-600"
        >
          Começar a construir o império
        </button>
      </div>
    </div>
  );
}
