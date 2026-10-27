"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Game, Phase, RunResult } from "@/lib/corrida/engine";
import { loadBest, loadMuted, saveMuted } from "@/lib/corrida/storage";

const MIN_ASPECT = 4 / 3;
const MAX_ASPECT = 2.2;
const MAX_INTERNAL_WIDTH = 1600;

const neon = (color: string) => ({ textShadow: `0 0 8px ${color}, 0 0 24px ${color}` });

type Key = "left" | "right" | "down";

// Este componente só roda no cliente (carregado com ssr: false), então
// pode ler localStorage e matchMedia direto nos inicializadores de estado.
export default function CorridaGame() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [phase, setPhase] = useState<Phase>("attract");
  const [result, setResult] = useState<RunResult | null>(null);
  const [best, setBest] = useState(() => loadBest());
  const [muted, setMuted] = useState(() => loadMuted());
  const [touch] = useState(() => window.matchMedia("(pointer: coarse)").matches);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const game = new Game(canvas, {
      onPhase: setPhase,
      onGameOver: (r) => {
        setResult(r);
        setBest(r.best);
      },
    });
    game.sound.setMuted(loadMuted());
    gameRef.current = game;

    const fit = () => {
      const W = wrap.clientWidth;
      const H = wrap.clientHeight;
      if (!W || !H) return;
      const aspect = Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, W / H));
      const w = W / H > aspect ? H * aspect : W;
      const h = w / aspect;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5, MAX_INTERNAL_WIDTH / w);
      game.resize(w * ratio, h * ratio);
      setSize({ w, h });
    };
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    fit();

    return () => {
      ro.disconnect();
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const game = gameRef.current;
      if (!game || e.repeat) return;
      if (e.code === "Enter") {
        const p = game.getPhase();
        if (p === "attract" || p === "over") start();
      }
      if (e.code === "KeyM") toggleMute();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function start() {
    const game = gameRef.current;
    if (!game) return;
    setResult(null);
    game.autoGas = touch;
    game.start();
  }

  function toggleMute() {
    setMuted((m) => {
      const next = !m;
      gameRef.current?.sound.setMuted(next);
      saveMuted(next);
      return next;
    });
  }

  function press(key: Key, down: boolean) {
    gameRef.current?.setKey(key, down);
  }

  const touchButton = (key: Key, label: string, className: string) => (
    <button
      type="button"
      aria-label={label}
      className={`pointer-events-auto select-none touch-none rounded-2xl border border-white/20 bg-white/10 font-black text-white/80 backdrop-blur-sm active:bg-white/25 ${className}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        press(key, true);
      }}
      onPointerUp={() => press(key, false)}
      onPointerCancel={() => press(key, false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );

  const driving = phase === "playing" || phase === "countdown";
  const hudScale = Math.min(size.h / 540, size.w / 760);

  return (
    <div ref={wrapRef} className="fixed inset-0 flex items-center justify-center overflow-hidden bg-black">
      <div className="relative" style={{ width: size.w, height: size.h }}>
        <canvas ref={canvasRef} className="block h-full w-full" />

        {/* Dirigindo, os botões ficam embaixo dos corações do HUD (mesma escala do canvas). */}
        <div
          className={`absolute z-20 flex gap-2 ${driving ? "" : "right-3 top-3"}`}
          style={driving ? { left: 18 * hudScale, top: 114 * hudScale } : undefined}
        >
          {driving && (
            <button
              type="button"
              onClick={() => gameRef.current?.togglePause()}
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-sm text-white/80 hover:bg-black/60"
              aria-label="Pausar"
            >
              ❚❚
            </button>
          )}
          <button
            type="button"
            onClick={toggleMute}
            className="rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-sm text-white/80 hover:bg-black/60"
            aria-label={muted ? "Ligar som" : "Desligar som"}
          >
            {muted ? "🔇" : "🔊"}
          </button>
        </div>
      </div>

      {phase === "attract" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gradient-to-b from-black/60 via-black/30 to-black/70 px-6 text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.4em] text-violet-300/80">corrida noturna</p>
          <h1
            className="mb-3 text-6xl font-black italic tracking-tight text-[#ff2d95] sm:text-8xl"
            style={neon("#ff2d95")}
          >
            999
          </h1>
          <p className="mb-6 max-w-md text-sm text-violet-100/80 sm:text-base">
            Atravesse a cidade antes do tempo acabar. Cada checkpoint dá mais segundos. Pegue{" "}
            <span className="font-bold text-[#ff2d95]">9 corações seguidos</span> e o negativo vira positivo: modo 999,
            mais rápido, e quem bater em você é que voa.
          </p>
          <button
            type="button"
            onClick={start}
            className="mb-5 rounded-full bg-[#ff2d95] px-10 py-3 text-lg font-black italic tracking-wide text-white shadow-[0_0_30px_rgba(255,45,149,0.6)] transition hover:scale-105 hover:bg-[#ff4da6]"
          >
            CORRER
          </button>
          {best > 0 && <p className="mb-4 text-sm text-violet-200/70">Recorde: {best.toLocaleString("pt-BR")}</p>}
          <p className="max-w-md text-xs text-violet-200/50">
            {touch
              ? "Acelera sozinho. Segure ◀ ▶ pra virar e FREIO pra frear."
              : "← → ou A D: direção · ↑ ou W: acelerar · ↓ ou espaço: frear · P: pausa · M: som · Enter: correr"}
          </p>
          <Link
            href="/"
            className="mt-6 text-xs text-violet-300/50 underline-offset-4 hover:text-violet-200 hover:underline"
          >
            ← voltar ao site
          </Link>
        </div>
      )}

      {phase === "paused" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/60 backdrop-blur-sm">
          <h2 className="mb-4 text-4xl font-black italic text-white" style={neon("#b26bff")}>
            PAUSADO
          </h2>
          <button
            type="button"
            onClick={() => gameRef.current?.togglePause()}
            className="w-48 rounded-full bg-[#b26bff] py-2.5 font-black italic text-white hover:bg-[#c28aff]"
          >
            CONTINUAR
          </button>
          <button
            type="button"
            onClick={start}
            className="w-48 rounded-full border border-white/25 py-2.5 font-bold text-white/85 hover:bg-white/10"
          >
            Recomeçar
          </button>
          <button
            type="button"
            onClick={() => gameRef.current?.quitToMenu()}
            className="w-48 rounded-full py-2 text-sm text-white/60 hover:text-white"
          >
            Menu
          </button>
        </div>
      )}

      {phase === "over" && result && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/65 px-6 text-center backdrop-blur-[2px]">
          <p className="mb-1 text-sm uppercase tracking-[0.3em] text-violet-300/80">
            {result.reason === "time" ? "o tempo acabou" : "seus corações acabaram"}
          </p>
          <h2 className="mb-4 text-5xl font-black italic text-[#ff2d55]" style={neon("#ff2d55")}>
            FIM DA LINHA
          </h2>
          <p className="text-5xl font-black italic text-white">{result.score.toLocaleString("pt-BR")}</p>
          {result.newBest ? (
            <p className="mt-2 text-sm font-bold text-[#ffd166]" style={neon("#ffb627")}>
              NOVO RECORDE
            </p>
          ) : (
            <p className="mt-2 text-sm text-violet-200/60">Recorde: {result.best.toLocaleString("pt-BR")}</p>
          )}
          <div className="mb-6 mt-5 flex gap-6 text-sm text-violet-100/80">
            <span>
              Etapa <b className="text-white">{result.stage}</b>
            </span>
            <span>
              <b className="text-white">{result.distanceKm.toFixed(1)}</b> km
            </span>
            <span>
              <b className="text-[#ff2d95]">♥</b> <b className="text-white">{result.hearts}</b>
            </span>
          </div>
          <button
            type="button"
            onClick={start}
            className="mb-3 rounded-full bg-[#ff2d95] px-8 py-3 font-black italic text-white shadow-[0_0_30px_rgba(255,45,149,0.6)] transition hover:scale-105 hover:bg-[#ff4da6]"
          >
            CORRER DE NOVO
          </button>
          <button
            type="button"
            onClick={() => gameRef.current?.quitToMenu()}
            className="text-sm text-white/60 hover:text-white"
          >
            Menu
          </button>
        </div>
      )}

      {touch && driving && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between p-3">
          <div className="flex gap-3">
            {touchButton("left", "◀", "h-20 w-20 text-3xl")}
            {touchButton("right", "▶", "h-20 w-20 text-3xl")}
          </div>
          {touchButton("down", "FREIO", "mb-12 h-16 w-24 text-sm tracking-widest")}
        </div>
      )}
    </div>
  );
}
