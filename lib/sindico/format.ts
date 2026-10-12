import { RESIDENTS_BY_ID, SENDER_NAMES } from "./data/residents";
import { Sender } from "./types";

export function brl(value: number) {
  return `R$ ${Math.round(value).toLocaleString("pt-BR")}`;
}

export function signedBrl(value: number) {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${brl(Math.abs(value))}`;
}

export function senderInfo(sender: Sender): { name: string; avatar: string } {
  if (sender === "ze" || sender === "sistema" || sender === "voce") return SENDER_NAMES[sender];
  const r = RESIDENTS_BY_ID[sender];
  return { name: `${r.name} (${r.apt})`, avatar: r.avatar };
}

export function moodEmoji(approval: number) {
  if (approval >= 75) return "😍";
  if (approval >= 55) return "🙂";
  if (approval >= 40) return "😐";
  if (approval >= 20) return "😠";
  return "🤬";
}

export function approvalColor(approval: number) {
  if (approval >= 55) return "bg-emerald-500";
  if (approval >= 40) return "bg-amber-400";
  if (approval >= 20) return "bg-orange-500";
  return "bg-rose-600";
}

// Cor de nome no grupo, estilo WhatsApp.
export const SENDER_COLORS: Record<Sender, string> = {
  cida: "text-pink-700",
  rafael: "text-sky-700",
  valdemar: "text-slate-700",
  kelly: "text-fuchsia-700",
  marcao: "text-red-700",
  neide: "text-violet-700",
  osvaldo: "text-amber-700",
  patricia: "text-teal-700",
  ze: "text-emerald-700",
  sistema: "text-stone-500",
  voce: "text-emerald-800",
};
