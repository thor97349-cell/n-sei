"use client";

import { useState } from "react";

interface InviteBoxProps {
  inviteUrl: string;
  projectName: string;
}

export default function InviteBox({ inviteUrl, projectName }: InviteBoxProps) {
  const [copied, setCopied] = useState(false);
  const whatsappText = encodeURIComponent(
    `Bora dividir as tarefas do trabalho "${projectName}"? Entra aqui: ${inviteUrl}`,
  );

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard API unavailable — the input below can still be
      // selected and copied manually.
    }
  }

  return (
    <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <summary className="cursor-pointer list-none rounded-2xl px-4 py-2 text-sm font-semibold text-ink">
        Convidar colegas
      </summary>
      <div className="space-y-3 px-4 pb-4">
        <input
          readOnly
          value={inviteUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="block w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-ink"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={copyLink}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
          >
            {copied ? "Link copiado!" : "Copiar link"}
          </button>
          <a
            href={`https://wa.me/?text=${whatsappText}`}
            target="_blank"
            rel="noreferrer"
            className="inline-block rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Enviar no WhatsApp
          </a>
        </div>
      </div>
    </details>
  );
}
