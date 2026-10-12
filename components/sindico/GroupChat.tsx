"use client";

import { useEffect, useRef } from "react";
import { SENDER_COLORS, senderInfo } from "@/lib/sindico/format";
import { ChatMessage } from "@/lib/sindico/types";

export default function GroupChat({ messages }: { messages: ChatMessage[] }) {
  const listRef = useRef<HTMLDivElement>(null);
  const recent = messages.slice(-60);

  useEffect(() => {
    // Rola só a lista (scrollIntoView rolaria a página inteira no celular).
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  return (
    <section aria-label="Grupo do prédio" className="flex h-[28rem] flex-col overflow-hidden rounded-xl shadow ring-1 ring-stone-300 lg:h-[calc(100vh-7rem)]">
      <div className="flex items-center gap-2 bg-emerald-800 px-3 py-2 text-white">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600">🌸</span>
        <div>
          <p className="text-sm font-bold leading-tight">Edifício Primavera 🌸</p>
          <p className="text-[11px] text-emerald-200">8 moradores, Zé, você</p>
        </div>
      </div>
      <div ref={listRef} className="flex-1 space-y-1.5 overflow-y-auto bg-[#efe7dd] p-3">
        {recent.map((m) => {
          if (m.from === "sistema") {
            return (
              <p key={m.id} className="mx-auto max-w-[90%] rounded-md bg-amber-100/90 px-2 py-1 text-center text-xs text-stone-700 shadow-sm">
                {m.text}
              </p>
            );
          }
          const who = senderInfo(m.from);
          return (
            <div key={m.id} className="flex items-end gap-1.5">
              <span className="text-lg leading-none">{who.avatar}</span>
              <div className="max-w-[85%] rounded-lg rounded-bl-none bg-white px-2 py-1 shadow-sm">
                <p className={`text-[11px] font-bold ${SENDER_COLORS[m.from]}`}>{who.name}</p>
                <p className="text-sm text-stone-800">{m.text}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
