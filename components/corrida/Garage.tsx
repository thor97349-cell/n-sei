"use client";

import { useEffect, useRef, useState } from "react";
import { CarDef, CARS, effectiveStats, UPGRADES, UpgradeId } from "@/lib/corrida/cars";
import { drawCar } from "@/lib/corrida/draw";
import { buyCar, buyUpgrade, Progress, updateProgress } from "@/lib/corrida/progress";

// Carro girando devagar num chão de neon, como uma vitrine de jogo de corrida.
function CarPreview({ car, locked }: { car: CarDef; locked: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const start = performance.now();
    const draw = (now: number) => {
      const t = (now - start) / 1000;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(canvas.clientWidth * ratio);
      const h = Math.round(canvas.clientHeight * ratio);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#07020e");
      sky.addColorStop(0.62, "#2a0a30");
      sky.addColorStop(0.62, "#0b0614");
      sky.addColorStop(1, "#05020a");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      // Grade do piso em perspectiva.
      const horizon = h * 0.62;
      ctx.strokeStyle = "rgba(255,45,149,0.35)";
      ctx.lineWidth = Math.max(1, ratio);
      ctx.beginPath();
      for (let i = -8; i <= 8; i++) {
        ctx.moveTo(w / 2 + i * w * 0.04, horizon);
        ctx.lineTo(w / 2 + i * w * 0.2, h);
      }
      for (let r = 0; r < 6; r++) {
        const p = ((r + ((t * 0.6) % 1)) / 6) ** 2;
        const y = horizon + (h - horizon) * p;
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();
      const glow = ctx.createRadialGradient(w / 2, h * 0.88, 0, w / 2, h * 0.88, w * 0.35);
      glow.addColorStop(0, locked ? "rgba(120,100,160,0.25)" : car.color + "66");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      const bob = Math.sin(t * 2) * h * 0.006;
      drawCar(ctx, w / 2, h * 0.9 + bob, Math.min(w * 0.46, h * 1.1), locked ? "#1b1428" : car.color, {
        plate: car.plate,
        accent: locked ? "#2a2238" : car.accent,
        spoiler: car.spoiler,
        stripes: car.stripes,
        lean: Math.sin(t * 0.8) * 0.6,
      });
      if (locked) {
        ctx.fillStyle = "rgba(244,236,255,0.85)";
        ctx.font = `700 ${Math.round(h * 0.07)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("BLOQUEADO", w / 2, h * 0.2);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [car, locked]);

  return <canvas ref={ref} className="drfl-preview" aria-label={`Carro ${car.name}`} />;
}

const STAT_LABELS: { key: keyof CarDef["stats"]; label: string }[] = [
  { key: "speed", label: "Velocidade" },
  { key: "accel", label: "Aceleração" },
  { key: "grip", label: "Aderência" },
  { key: "turbo", label: "Turbo" },
];

export default function Garage({
  progress,
  onChange,
  onClose,
}: {
  progress: Progress;
  onChange: (p: Progress) => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(() =>
    Math.max(
      0,
      CARS.findIndex((c) => c.id === progress.car),
    ),
  );
  const car = CARS[index];
  const owned = progress.owned.includes(car.id);
  const selected = progress.car === car.id;
  const stats = effectiveStats(car, progress.upgrades);

  function cycle(dir: number) {
    setIndex((i) => (i + dir + CARS.length) % CARS.length);
  }

  function act() {
    if (selected) return;
    if (owned) {
      onChange(
        updateProgress((p) => {
          p.car = car.id;
        }),
      );
      return;
    }
    const next = buyCar(car.id);
    if (next) onChange(next);
  }

  function upgrade(id: UpgradeId) {
    const next = buyUpgrade(id);
    if (next) onChange(next);
  }

  let action = "EM USO";
  if (!selected)
    action = owned
      ? "USAR ESTE"
      : progress.hearts >= car.price
        ? `COMPRAR · ${car.price} ♥`
        : `FALTAM ${car.price - progress.hearts} ♥`;

  return (
    <div className="drfl-overlay drfl-garage">
      <div className="drfl-garage-head">
        <h2 className="drfl-h2">GARAGEM</h2>
        <span className="drfl-wallet" aria-label={`${progress.hearts} corações`}>
          ♥ {progress.hearts.toLocaleString("pt-BR")}
        </span>
      </div>
      <div className="drfl-garage-body">
        <section className="drfl-panel">
          <CarPreview car={car} locked={!owned} />
          <div className="drfl-carnav">
            <button type="button" onClick={() => cycle(-1)} aria-label="Carro anterior">
              ◀
            </button>
            <span className="drfl-carname">{car.name}</span>
            <button type="button" onClick={() => cycle(1)} aria-label="Próximo carro">
              ▶
            </button>
          </div>
          <p className="drfl-tagline">{car.tagline}</p>
          <div className="drfl-statlist">
            {STAT_LABELS.map(({ key, label }) => (
              <div className="drfl-stat" key={key}>
                <span>{label}</span>
                <span className="drfl-bar">
                  <span style={{ width: `${Math.min(100, ((stats[key] - 0.6) / 1.2) * 100)}%` }} />
                </span>
              </div>
            ))}
          </div>
          <button
            type="button"
            className={`drfl-go drfl-buy ${selected ? "drfl-owned" : ""}`}
            onClick={act}
            disabled={selected || (!owned && progress.hearts < car.price)}
          >
            {action}
          </button>
        </section>
        <section className="drfl-panel drfl-upgrades">
          <h3>Upgrades</h3>
          <p>Valem pra todos os carros. Os corações que você pega na pista pagam tudo.</p>
          {UPGRADES.map((u) => {
            const level = progress.upgrades[u.id];
            const price = u.prices[level];
            return (
              <div className="drfl-up" key={u.id}>
                <span className="drfl-up-name">{u.name}</span>
                <span className="drfl-up-effect">{u.effect}</span>
                <span className="drfl-pips" aria-label={`Nível ${level} de ${u.prices.length}`}>
                  {u.prices.map((_, i) => (
                    <span key={i} className={i < level ? "on" : ""} />
                  ))}
                </span>
                <button
                  type="button"
                  onClick={() => upgrade(u.id)}
                  disabled={price === undefined || progress.hearts < price}
                >
                  {price === undefined ? "MÁX" : `+ ${price} ♥`}
                </button>
              </div>
            );
          })}
        </section>
      </div>
      <button type="button" className="drfl-ghost drfl-back" onClick={onClose}>
        VOLTAR
      </button>
    </div>
  );
}
