import { LogEntry } from "@/lib/nexus/types";

const TONE_STYLES: Record<LogEntry["tone"], string> = {
  good: "border-emerald-500/40 text-emerald-300",
  bad: "border-rose-500/40 text-rose-300",
  neutral: "border-slate-700 text-slate-300",
};

export default function EventLog({ log, limit = 12, maxHeight = "max-h-80" }: { log: LogEntry[]; limit?: number; maxHeight?: string }) {
  const recent = [...log].reverse().slice(0, limit);
  return (
    <div className={`space-y-2 overflow-y-auto pr-1 ${maxHeight}`}>
      {recent.map((entry, i) => (
        <div
          key={`${entry.month}-${i}`}
          className={`rounded-md border-l-2 bg-slate-900/40 px-3 py-2 text-sm ${TONE_STYLES[entry.tone]}`}
        >
          <span className="text-slate-500 mr-2 font-mono text-xs">M{entry.month}</span>
          {entry.text}
        </div>
      ))}
    </div>
  );
}
