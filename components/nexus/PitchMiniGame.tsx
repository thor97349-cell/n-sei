"use client";

import { useEffect, useRef, useState } from "react";
import { PitchMiniGamePrompt } from "@/lib/nexus/types";

const SPEED = 55; // % da barra por segundo

export default function PitchMiniGame({
  prompt,
  onResolve,
}: {
  prompt: PitchMiniGamePrompt;
  onResolve: (stopPosition: number) => void;
}) {
  const [position, setPosition] = useState(0);
  const positionRef = useRef(0);
  const directionRef = useRef(1);
  const lastTsRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    function tick(ts: number) {
      if (stoppedRef.current) return;
      if (lastTsRef.current === null) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;

      let next = positionRef.current + directionRef.current * SPEED * dt;
      if (next >= 100) {
        next = 100;
        directionRef.current = -1;
      } else if (next <= 0) {
        next = 0;
        directionRef.current = 1;
      }
      positionRef.current = next;
      setPosition(next);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  function handleStop() {
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    onResolve(positionRef.current);
  }

  const zoneLeft = Math.max(0, prompt.targetCenter - prompt.targetWidth / 2);

  return (
    <div className="rounded-xl border border-amber-400/40 bg-amber-400/5 p-5">
      <div className="text-xs uppercase tracking-wide text-amber-400 mb-2">🎯 Mini-desafio</div>
      <h2 className="text-lg font-semibold text-white mb-1">{prompt.title}</h2>
      <p className="text-sm text-slate-300 mb-6">{prompt.description}</p>

      <div className="relative h-4 rounded-full bg-slate-800 overflow-hidden mb-6">
        <div
          className="absolute top-0 h-full bg-emerald-500/40 border-x-2 border-emerald-400"
          style={{ left: `${zoneLeft}%`, width: `${prompt.targetWidth}%` }}
        />
        <div
          className="absolute top-0 h-full w-1 bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]"
          style={{ left: `${position}%` }}
        />
      </div>

      <button
        onClick={handleStop}
        className="w-full rounded-lg bg-amber-500 py-3 font-medium text-slate-950 hover:bg-amber-400 transition-colors"
      >
        Parar! →
      </button>
    </div>
  );
}
