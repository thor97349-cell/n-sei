"use client";

import { useEffect, useRef, useState } from "react";
import { Game, Phase, RunResult } from "@/lib/corrida/engine";
import { loadProgress, Progress, updateProgress } from "@/lib/corrida/progress";
import Garage from "./Garage";
import "./corrida.css";

const MIN_ASPECT = 4 / 3;
const MAX_ASPECT = 2.2;
const MAX_INTERNAL_WIDTH = 1600;

type Key = "left" | "right" | "drift";

// Este componente só roda no cliente (carregado com ssr: false), então
// pode ler localStorage e matchMedia direto nos inicializadores de estado.
export default function CorridaGame({ footer }: { footer?: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [phase, setPhase] = useState<Phase>("attract");
  const [result, setResult] = useState<RunResult | null>(null);
  const [progress, setProgress] = useState<Progress>(() => loadProgress());
  const [garage, setGarage] = useState(false);
  const [touch] = useState(() => window.matchMedia("(pointer: coarse)").matches);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [pressed, setPressed] = useState<Record<Key, boolean>>({ left: false, right: false, drift: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return;

    const game = new Game(canvas, {
      onPhase: (p) => {
        setPhase(p);
        if (p === "attract") setProgress(loadProgress());
      },
      onGameOver: (r) => {
        setResult(r);
        setProgress(loadProgress());
      },
    });
    game.sound.setMuted(loadProgress().muted);
    gameRef.current = game;

    // A fonte de display vem do CSS (next/font no site, Google Fonts no artefato).
    const family = getComputedStyle(root).getPropertyValue("--font-drfl").trim() || '"Racing Sans One"';
    game.setFont(`${family}, system-ui, sans-serif`);
    void document.fonts?.load(`40px ${family}`).catch(() => undefined);

    const fit = () => {
      const W = root.clientWidth;
      const H = root.clientHeight;
      if (!W || !H) return;
      const aspect = Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, W / H));
      const w = W / H > aspect ? H * aspect : W;
      const h = w / aspect;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5, MAX_INTERNAL_WIDTH / w);
      game.resize(w * ratio, h * ratio);
      setSize({ w, h });
    };
    const ro = new ResizeObserver(fit);
    ro.observe(root);
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
      const p = game.getPhase();
      if (e.code === "Enter" && !garage && (p === "attract" || p === "over")) start();
      if (e.code === "Escape" && garage) setGarage(false);
      if (e.code === "KeyM") toggleMute();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function start() {
    const game = gameRef.current;
    if (!game) return;
    setResult(null);
    setGarage(false);
    game.autoGas = touch;
    game.start();
  }

  function toggleMute() {
    const next = updateProgress((p) => {
      p.muted = !p.muted;
    });
    gameRef.current?.sound.setMuted(next.muted);
    setProgress(next);
  }

  function openGarage() {
    setProgress(loadProgress());
    setGarage(true);
  }

  function closeGarage() {
    gameRef.current?.refreshCar();
    setGarage(false);
  }

  function quitToMenu() {
    gameRef.current?.quitToMenu();
    setResult(null);
  }

  function press(key: Key, down: boolean) {
    gameRef.current?.setKey(key, down);
    setPressed((s) => (s[key] === down ? s : { ...s, [key]: down }));
  }

  const touchButton = (key: Key, label: string, className: string, aria: string) => (
    <button
      type="button"
      aria-label={aria}
      className={`drfl-tb ${className} ${pressed[key] ? "on" : ""}`}
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
  const fmt = (n: number) => n.toLocaleString("pt-BR");

  return (
    <div ref={rootRef} className="drfl-root">
      <div className="drfl-stage" style={{ width: size.w, height: size.h }}>
        <canvas ref={canvasRef} />

        {/* Dirigindo, os botões ficam embaixo dos corações do HUD (mesma escala do canvas). */}
        <div
          className="drfl-chips"
          style={driving ? { left: 18 * hudScale, top: 114 * hudScale } : { right: 12, top: 12 }}
          hidden={garage}
        >
          {driving && (
            <button
              type="button"
              className="drfl-chip"
              onClick={() => gameRef.current?.togglePause()}
              aria-label="Pausar"
            >
              ❚❚
            </button>
          )}
          <button
            type="button"
            className="drfl-chip"
            onClick={toggleMute}
            aria-label={progress.muted ? "Ligar som" : "Desligar som"}
          >
            {progress.muted ? "🔇" : "🔊"}
          </button>
        </div>
      </div>

      {phase === "attract" && !garage && (
        <div className="drfl-overlay drfl-menu">
          <div className="drfl-topbar">
            <span className="drfl-1p">1P</span>
            <span className="drfl-heartcount">♥ {fmt(progress.hearts)}</span>
          </div>
          <p className="drfl-eyebrow">999 apresenta</p>
          <h1 className="drfl-logo">
            <span className="drfl-logo-line">DEATH RACE</span>
            <span className="drfl-logo-for">FOR</span>
            <span className="drfl-logo-line">LOVE</span>
          </h1>
          <span className="drfl-plate">999</span>
          <p className="drfl-lede">
            Chicago de madrugada, uma etapa pra cada faixa do álbum. Drift nas curvas carrega o turbo, passar raspando
            nos carros sobe o multiplicador e <b>9 corações seguidos</b> transformam o negativo em positivo.
          </p>
          <button type="button" className="drfl-go" onClick={start}>
            <span className="drfl-blink">APERTE START</span>
          </button>
          <div className="drfl-row">
            <button type="button" className="drfl-ghost" onClick={openGarage}>
              GARAGEM
            </button>
            {progress.best > 0 && <span className="drfl-best">Recorde: {fmt(progress.best)}</span>}
          </div>
          <p className="drfl-help">
            {touch ? (
              <>Acelera sozinho. ◀ ▶ vira. Segure DRIFT virando pra derrapar e solte pro turbo.</>
            ) : (
              <>
                <kbd>← →</kbd> direção · <kbd>↑</kbd> acelerar · <kbd>↓</kbd> frear · segure <kbd>ESPAÇO</kbd> virando
                pra derrapar, solte pro turbo · <kbd>P</kbd> pausa · <kbd>M</kbd> som
              </>
            )}
          </p>
          <p className="drfl-tribute">fan game em homenagem a Juice WRLD (1998–2019) · 999</p>
          {footer && <div className="drfl-footer">{footer}</div>}
        </div>
      )}

      {garage && <Garage progress={progress} onChange={setProgress} onClose={closeGarage} />}

      {phase === "paused" && (
        <div className="drfl-overlay drfl-pause">
          <h2 className="drfl-h2">PAUSADO</h2>
          <button type="button" className="drfl-go" onClick={() => gameRef.current?.togglePause()}>
            CONTINUAR
          </button>
          <button type="button" className="drfl-ghost" onClick={start}>
            Recomeçar
          </button>
          <button type="button" className="drfl-link" onClick={quitToMenu}>
            Menu
          </button>
        </div>
      )}

      {phase === "over" && result && !garage && (
        <div className="drfl-overlay drfl-over">
          <p className="drfl-eyebrow">{result.reason === "time" ? "o tempo acabou" : "seu coração não aguentou"}</p>
          <h2 className="drfl-h2">LEGENDS NEVER DIE</h2>
          <p className="drfl-score">{fmt(result.score)}</p>
          {result.newBest ? (
            <p className="drfl-newbest">NOVO RECORDE</p>
          ) : (
            <p className="drfl-best">Recorde: {fmt(result.best)}</p>
          )}
          <div className="drfl-stats">
            <span>
              <b>{result.stageName}</b>etapa {result.stage}
            </span>
            <span>
              <b>{result.distanceKm.toFixed(1)}</b>km
            </span>
            <span>
              <b>x{result.maxMult}</b>maior multiplicador
            </span>
            <span>
              <b>{result.nearMisses}</b>raspões
            </span>
          </div>
          <p className="drfl-earned">
            <b>+{result.earned} ♥</b> pra garagem · total {fmt(result.wallet)}
          </p>
          <button type="button" className="drfl-go" onClick={start}>
            CORRER DE NOVO
          </button>
          <div className="drfl-row">
            <button type="button" className="drfl-ghost" onClick={openGarage}>
              GARAGEM
            </button>
            <button type="button" className="drfl-link" onClick={quitToMenu}>
              Menu
            </button>
          </div>
        </div>
      )}

      {touch && driving && (
        <div className="drfl-touch">
          <div className="drfl-pad">
            {touchButton("left", "◀", "drfl-arrow", "Virar à esquerda")}
            {touchButton("right", "▶", "drfl-arrow", "Virar à direita")}
          </div>
          {touchButton("drift", "DRIFT", "drfl-drift", "Drift (sem virar, freia)")}
        </div>
      )}
    </div>
  );
}
