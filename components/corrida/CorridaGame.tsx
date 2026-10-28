"use client";

import { useEffect, useRef, useState } from "react";
import { carById } from "@/lib/corrida/cars";
import { Game, Phase, RunResult } from "@/lib/corrida/engine";
import { loadProgress, Progress, updateProgress } from "@/lib/corrida/progress";
import { Renderer3D } from "@/lib/corrida/render3d";
import { TitleScene } from "@/lib/corrida/title";
import type { Title3D } from "@/lib/corrida/title3d";

// O que as duas versões da tela inicial (2D desenhada e 3D com o modelo) têm em comum.
type TitleView = Pick<TitleScene, "setCar" | "setCrt" | "setDim" | "playIntro" | "skipIntro" | "reset" | "destroy">;
import Garage from "./Garage";
import "./corrida.css";

const MIN_ASPECT = 4 / 3;
const MAX_ASPECT = 2.2;
const MAX_INTERNAL_WIDTH = 1600;

type Key = "left" | "right" | "drift";
type Screen = "splash" | "menu" | "garage" | "records" | "options" | "intro" | "race";

const DIM: Record<Screen, number> = {
  splash: 0.45,
  menu: 0,
  garage: 0.7,
  records: 0.7,
  options: 0.7,
  intro: 0,
  race: 0,
};

const fmt = (n: number) => n.toLocaleString("pt-BR");

// Este componente só roda no cliente (carregado com ssr: false), então
// pode ler localStorage e matchMedia direto nos inicializadores de estado.
export default function CorridaGame({
  footer,
  titleTrack,
  juiceModel,
}: {
  footer?: React.ReactNode;
  titleTrack?: string;
  // Modelo 3D (.glb) do personagem. Sem ele (ou sem WebGL), a tela inicial fica em 2D.
  juiceModel?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const fontRef = useRef('"Racing Sans One", system-ui, sans-serif');
  const titleCanvasRef = useRef<HTMLCanvasElement>(null);
  const title3dRef = useRef<HTMLCanvasElement>(null);
  const titleOverlayRef = useRef<HTMLCanvasElement>(null);
  const screenRef = useRef<Screen>("splash");
  const [title3d, setTitle3d] = useState(false);
  const menuRef = useRef<HTMLElement>(null);
  const againRef = useRef<HTMLButtonElement>(null);
  const gameRef = useRef<Game | null>(null);
  const titleRef = useRef<TitleView | null>(null);
  const [screen, setScreen] = useState<Screen>("splash");
  const [phase, setPhase] = useState<Phase>("attract");
  const [result, setResult] = useState<RunResult | null>(null);
  const [progress, setProgress] = useState<Progress>(() => loadProgress());
  const [touch] = useState(() => window.matchMedia("(pointer: coarse)").matches);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [pressed, setPressed] = useState<Record<Key, boolean>>({ left: false, right: false, drift: false });
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(id);
  }, [notice]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const titleCanvas = titleCanvasRef.current;
    const root = rootRef.current;
    if (!canvas || !titleCanvas || !root) return;

    const saved = loadProgress();
    const game = new Game(canvas, {
      onPhase: setPhase,
      onGameOver: (r) => {
        setResult(r);
        setProgress(loadProgress());
      },
      onSlow3D: () => {
        game.setRenderer3D(null);
        setProgress(
          updateProgress((p) => {
            p.graphics3d = false;
          }),
        );
        setNotice("Gráficos 3D desligados pra rodar liso. Dá pra religar em Opções.");
      },
    });
    game.setIdle(true);
    game.setCrt(saved.crt);
    game.sound.setMuted(saved.muted);
    game.sound.setVolumes(saved.musicVol, saved.sfxVol);
    gameRef.current = game;

    const title = new TitleScene(titleCanvas, carById(saved.car), {
      door: () => game.sound.door(),
      rev: () => game.sound.rev(),
    });
    title.setCrt(saved.crt);
    titleRef.current = title;
    let disposed = false;

    // A fonte de display vem do CSS (next/font no site, Google Fonts no artefato).
    const family = getComputedStyle(root).getPropertyValue("--font-drfl").trim() || '"Racing Sans One"';
    fontRef.current = `${family}, system-ui, sans-serif`;
    game.setFont(fontRef.current);
    const gl = glRef.current;
    if (saved.graphics3d && gl) {
      try {
        const coarse = window.matchMedia("(pointer: coarse)").matches;
        game.setRenderer3D(new Renderer3D(gl, fontRef.current, !coarse));
      } catch {
        // Sem WebGL: fica no 2D clássico.
      }
    }
    void document.fonts?.load(`40px ${family}`).catch(() => undefined);

    // Tela inicial 3D: carrega o modelo em segundo plano e troca quando estiver pronto.
    const gl3 = title3dRef.current;
    const overlay = titleOverlayRef.current;
    if (juiceModel && saved.graphics3d && gl3 && overlay) {
      void import("@/lib/corrida/title3d")
        .then(async ({ Title3D }) => {
          const model = await Title3D.load(juiceModel);
          if (disposed) return;
          const coarse = window.matchMedia("(pointer: coarse)").matches;
          const p = loadProgress();
          const t3: Title3D = new Title3D(
            gl3,
            overlay,
            model,
            carById(p.car),
            { door: () => game.sound.door(), rev: () => game.sound.rev() },
            fontRef.current,
            coarse,
          );
          t3.setCrt(p.crt);
          t3.setDim(DIM[screenRef.current]);
          if (screenRef.current === "intro") return t3.destroy();
          titleRef.current?.destroy();
          titleRef.current = t3;
          setTitle3d(true);
        })
        .catch(() => {
          // Sem o arquivo do modelo ou sem WebGL: continua a tela 2D.
        });
    }

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
      disposed = true;
      ro.disconnect();
      titleRef.current?.destroy();
      game.destroy();
      titleRef.current = null;
      gameRef.current = null;
    };
    // juiceModel é fixo durante a vida do componente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    screenRef.current = screen;
    titleRef.current?.setDim(DIM[screen]);
    if (screen === "menu") menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [screen]);

  useEffect(() => {
    if (phase === "over" && result) againRef.current?.focus();
  }, [phase, result]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === "KeyM") {
        toggleMute();
        return;
      }
      if (screen === "splash") {
        e.preventDefault();
        enterMenu();
      } else if (screen === "intro") {
        titleRef.current?.skipIntro();
      } else if (screen === "menu" && (e.code === "ArrowDown" || e.code === "ArrowUp")) {
        e.preventDefault();
        const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
        const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = buttons[(i + (e.code === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length];
        next?.focus();
        gameRef.current?.sound.tick();
      } else if (e.code === "Escape" && (screen === "garage" || screen === "records" || screen === "options")) {
        backToMenu();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function enterMenu() {
    const game = gameRef.current;
    if (!game) return;
    game.sound.init();
    game.sound.setVolumes(progress.musicVol, progress.sfxVol);
    game.sound.playTitle(titleTrack ?? null);
    setScreen("menu");
  }

  function play() {
    const game = gameRef.current;
    const title = titleRef.current;
    if (!game || !title) return;
    game.sound.stopTitle(3);
    setScreen("intro");
    title.playIntro(startRace);
  }

  function startRace() {
    const game = gameRef.current;
    if (!game) return;
    setResult(null);
    setScreen("race");
    game.setIdle(false);
    game.autoGas = touch;
    game.start();
  }

  function retry() {
    const game = gameRef.current;
    if (!game) return;
    setResult(null);
    game.autoGas = touch;
    game.start();
  }

  function toMenu(next: Screen = "menu") {
    const game = gameRef.current;
    const title = titleRef.current;
    if (!game || !title) return;
    game.quitToMenu();
    game.setIdle(true);
    game.sound.stopMusic();
    game.sound.playTitle(titleTrack ?? null);
    const p = loadProgress();
    setProgress(p);
    title.reset();
    title.setCar(carById(p.car));
    setResult(null);
    setScreen(next);
  }

  function backToMenu() {
    const p = loadProgress();
    setProgress(p);
    titleRef.current?.setCar(carById(p.car));
    gameRef.current?.refreshCar();
    setScreen("menu");
  }

  // Liga o 3D se o aparelho tiver WebGL; senão fica no 2D clássico.
  function apply3D(on: boolean) {
    const game = gameRef.current;
    const gl = glRef.current;
    if (!game || !gl) return;
    if (!on) {
      game.setRenderer3D(null);
      return;
    }
    try {
      game.setRenderer3D(new Renderer3D(gl, fontRef.current, !touch));
    } catch {
      game.setRenderer3D(null);
    }
  }

  function saveSettings(change: (p: Progress) => void) {
    const next = updateProgress(change);
    const game = gameRef.current;
    game?.sound.setMuted(next.muted);
    game?.sound.setVolumes(next.musicVol, next.sfxVol);
    game?.setCrt(next.crt);
    if (next.graphics3d !== progress.graphics3d) apply3D(next.graphics3d);
    titleRef.current?.setCrt(next.crt);
    setProgress(next);
  }

  function toggleMute() {
    saveSettings((p) => {
      p.muted = !p.muted;
    });
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

  const race = screen === "race";
  const driving = race && (phase === "playing" || phase === "countdown");
  const hudScale = Math.min(size.h / 540, size.w / 760);
  const muteButton = (
    <button
      type="button"
      className="drfl-chip"
      onClick={toggleMute}
      aria-label={progress.muted ? "Ligar som" : "Desligar som"}
    >
      {progress.muted ? "🔇" : "🔊"}
    </button>
  );

  const logo = (
    <h1 className="drfl-logo">
      <span className="drfl-logo-line">DEATH RACE</span>
      <span className="drfl-logo-for">FOR</span>
      <span className="drfl-logo-line">LOVE</span>
    </h1>
  );

  return (
    <div ref={rootRef} className="drfl-root">
      <div className="drfl-stage" style={{ width: size.w, height: size.h }} hidden={!race}>
        <canvas ref={glRef} hidden={!progress.graphics3d} />
        <canvas ref={canvasRef} />
        {driving && (
          <div className="drfl-chips" style={{ left: 18 * hudScale, top: 114 * hudScale }}>
            <button
              type="button"
              className="drfl-chip"
              onClick={() => gameRef.current?.togglePause()}
              aria-label="Pausar"
            >
              ❚❚
            </button>
            {muteButton}
          </div>
        )}
      </div>

      <canvas ref={titleCanvasRef} className="drfl-title-canvas" hidden={race || title3d} aria-hidden="true" />
      <canvas ref={title3dRef} className="drfl-title-canvas" hidden={race || !title3d} aria-hidden="true" />
      <canvas ref={titleOverlayRef} className="drfl-title-canvas" hidden={race || !title3d} aria-hidden="true" />

      {!race && screen !== "intro" && (
        <div className="drfl-corner" hidden={screen === "splash"}>
          {muteButton}
        </div>
      )}

      {screen === "splash" && (
        <div className="drfl-overlay drfl-splash" onPointerDown={enterMenu}>
          <p className="drfl-eyebrow">999 apresenta</p>
          {logo}
          <span className="drfl-plate">999</span>
          <button type="button" className="drfl-go" onClick={enterMenu}>
            <span className="drfl-blink">APERTE START</span>
          </button>
          <p className="drfl-help">{touch ? "Toque na tela" : "Clique ou aperte qualquer tecla"}</p>
          <p className="drfl-tribute">fan game em homenagem a Juice WRLD (1998–2019) · 999</p>
        </div>
      )}

      {screen === "menu" && (
        <div className="drfl-title">
          <div className="drfl-topbar">
            <span className="drfl-1p">1P</span>
            <span className="drfl-heartcount">♥ {fmt(progress.hearts)}</span>
          </div>
          <header className="drfl-title-logo">{logo}</header>
          <nav ref={menuRef} className="drfl-mainmenu" aria-label="Menu principal">
            {(
              [
                ["JOGAR", play],
                ["GARAGEM", () => setScreen("garage")],
                ["RECORDES", () => setScreen("records")],
                ["OPÇÕES", () => setScreen("options")],
              ] as const
            ).map(([label, action], i) => (
              <button
                key={label}
                type="button"
                className="drfl-menu-btn"
                style={{ animationDelay: `${i * 70}ms` }}
                onClick={action}
                onMouseEnter={(e) => {
                  e.currentTarget.focus();
                  gameRef.current?.sound.tick();
                }}
              >
                {label}
              </button>
            ))}
          </nav>
          <footer className="drfl-title-foot">
            {progress.best > 0 && <span>Recorde: {fmt(progress.best)}</span>}
            <span className="drfl-tribute">fan game em homenagem a Juice WRLD (1998–2019) · 999</span>
            {footer && <span className="drfl-footer">{footer}</span>}
          </footer>
        </div>
      )}

      {screen === "intro" && (
        <button type="button" className="drfl-skip" onClick={() => titleRef.current?.skipIntro()}>
          PULAR ▸
        </button>
      )}

      {screen === "garage" && <Garage progress={progress} onChange={setProgress} onClose={backToMenu} />}

      {screen === "records" && (
        <div className="drfl-overlay drfl-sub">
          <div className="drfl-sub-head">
            <h2 className="drfl-h2">RECORDES</h2>
            <span className="drfl-wallet">♥ {fmt(progress.hearts)}</span>
          </div>
          <section className="drfl-panel drfl-records">
            {progress.runs.length === 0 ? (
              <p className="drfl-empty">Nenhuma corrida ainda. Seus 10 melhores resultados aparecem aqui.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Pontos</th>
                    <th>Etapa</th>
                    <th>Carro</th>
                    <th>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {progress.runs.map((r, i) => (
                    <tr key={`${r.date}-${i}`} className={i === 0 ? "drfl-top" : ""}>
                      <td>{i + 1}</td>
                      <td className="drfl-num">{fmt(r.score)}</td>
                      <td>
                        {r.stage} · {r.stageName}
                      </td>
                      <td>{carById(r.car).name}</td>
                      <td>{new Date(r.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          <button type="button" className="drfl-ghost drfl-back" onClick={backToMenu}>
            VOLTAR
          </button>
        </div>
      )}

      {screen === "options" && (
        <div className="drfl-overlay drfl-sub">
          <div className="drfl-sub-head">
            <h2 className="drfl-h2">OPÇÕES</h2>
          </div>
          <section className="drfl-panel drfl-options">
            <label className="drfl-opt" htmlFor="drfl-music">
              <span>Música</span>
              <input
                id="drfl-music"
                type="range"
                min={0}
                max={100}
                value={Math.round(progress.musicVol * 100)}
                onChange={(e) => {
                  const v = Number(e.target.value) / 100;
                  saveSettings((p) => {
                    p.musicVol = v;
                  });
                }}
              />
              <b>{Math.round(progress.musicVol * 100)}</b>
            </label>
            <label className="drfl-opt" htmlFor="drfl-sfx">
              <span>Efeitos</span>
              <input
                id="drfl-sfx"
                type="range"
                min={0}
                max={100}
                value={Math.round(progress.sfxVol * 100)}
                onChange={(e) => {
                  const v = Number(e.target.value) / 100;
                  saveSettings((p) => {
                    p.sfxVol = v;
                  });
                }}
              />
              <b>{Math.round(progress.sfxVol * 100)}</b>
            </label>
            <label className="drfl-opt drfl-check" htmlFor="drfl-3d">
              <span>Gráficos 3D (desligue se o celular travar)</span>
              <input
                id="drfl-3d"
                type="checkbox"
                checked={progress.graphics3d}
                onChange={(e) => {
                  const on = e.target.checked;
                  saveSettings((p) => {
                    p.graphics3d = on;
                  });
                }}
              />
            </label>
            <label className="drfl-opt drfl-check" htmlFor="drfl-crt">
              <span>Efeito de TV antiga</span>
              <input
                id="drfl-crt"
                type="checkbox"
                checked={progress.crt}
                onChange={(e) => {
                  const on = e.target.checked;
                  saveSettings((p) => {
                    p.crt = on;
                  });
                }}
              />
            </label>
            <h3>Controles</h3>
            <dl className="drfl-controls">
              <dt>← → ou A D</dt>
              <dd>Virar</dd>
              <dt>↑ ou W</dt>
              <dd>Acelerar</dd>
              <dt>↓ ou S</dt>
              <dd>Frear</dd>
              <dt>Espaço (segurando e virando)</dt>
              <dd>Drift. Solte pra soltar o turbo</dd>
              <dt>P ou Esc</dt>
              <dd>Pausar</dd>
              <dt>M</dt>
              <dd>Ligar e desligar o som</dd>
              <dt>No celular</dt>
              <dd>Acelera sozinho. ◀ ▶ viram e DRIFT derrapa (sem virar, freia)</dd>
            </dl>
          </section>
          <button type="button" className="drfl-ghost drfl-back" onClick={backToMenu}>
            VOLTAR
          </button>
        </div>
      )}

      {race && phase === "paused" && (
        <div className="drfl-overlay drfl-pause">
          <h2 className="drfl-h2">PAUSADO</h2>
          <button type="button" className="drfl-go" onClick={() => gameRef.current?.togglePause()}>
            CONTINUAR
          </button>
          <button type="button" className="drfl-ghost" onClick={retry}>
            Recomeçar
          </button>
          <button type="button" className="drfl-link" onClick={() => toMenu()}>
            Menu
          </button>
        </div>
      )}

      {race && phase === "over" && result && (
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
          <button ref={againRef} type="button" className="drfl-go" onClick={retry}>
            CORRER DE NOVO
          </button>
          <div className="drfl-row">
            <button type="button" className="drfl-ghost" onClick={() => toMenu("garage")}>
              GARAGEM
            </button>
            <button type="button" className="drfl-link" onClick={() => toMenu()}>
              Menu
            </button>
          </div>
        </div>
      )}

      {notice && (
        <p className="drfl-notice" role="status">
          {notice}
        </p>
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
