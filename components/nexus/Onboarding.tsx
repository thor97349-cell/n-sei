"use client";

import { useState } from "react";
import { SECTOR_LIST } from "@/lib/nexus/sectors";
import { GoalId, InterestTag, SectorId } from "@/lib/nexus/types";
import { GOAL_OPTIONS, INTEREST_OPTIONS } from "@/lib/nexus/options";
import VertexMark from "./VertexMark";
import TopographicBackground from "./TopographicBackground";

export interface OnboardingResult {
  companyName: string;
  founderName: string;
  sectorId: SectorId;
  interests: InterestTag[];
  goal: GoalId;
}

const TOTAL_STEPS = 4;

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full ${i < step ? "bg-amber-400" : "bg-slate-800"}`}
        />
      ))}
    </div>
  );
}

function WizardCard({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center px-6 py-16">
      <TopographicBackground />
      <div className="relative w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900/70 p-8 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-6">
          <span className="text-xs tracking-[0.2em] text-slate-500 uppercase">
            Passo {step} de {TOTAL_STEPS}
          </span>
          <div className="w-40">
            <ProgressBar step={step} />
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function Onboarding({ onComplete }: { onComplete: (result: OnboardingResult) => void }) {
  const [step, setStep] = useState(1);
  const [interests, setInterests] = useState<InterestTag[]>([]);
  const [goal, setGoal] = useState<GoalId | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [founderName, setFounderName] = useState("");
  const [sectorId, setSectorId] = useState<SectorId | null>(null);

  function toggleInterest(id: InterestTag) {
    setInterests((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }

  if (step === 1) {
    return (
      <WizardCard step={1}>
        <div className="mb-2">
          <VertexMark size={48} />
        </div>
        <h1 className="text-3xl font-semibold text-white mt-4 mb-3">Bem-vindo ao Vértice.</h1>
        <p className="text-slate-400 mb-8">
          O laboratório de negócios onde você funda uma empresa, toma decisões reais de preço,
          marketing e equipe, e vê o mercado reagir mês a mês.
        </p>
        <button
          onClick={() => setStep(2)}
          className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 font-medium text-slate-950 hover:opacity-90 transition-opacity"
        >
          Começar →
        </button>
      </WizardCard>
    );
  }

  if (step === 2) {
    return (
      <WizardCard step={2}>
        <h1 className="text-2xl font-semibold text-white mb-1">O que você quer explorar?</h1>
        <p className="text-slate-400 text-sm mb-6">Escolha quantos fizer sentido.</p>
        <div className="flex flex-wrap gap-2 mb-8">
          {INTEREST_OPTIONS.map((opt) => {
            const active = interests.includes(opt.id);
            return (
              <button
                key={opt.id}
                onClick={() => toggleInterest(opt.id)}
                className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                  active
                    ? "border-amber-400 bg-amber-400/10 text-amber-300"
                    : "border-slate-700 text-slate-300 hover:border-slate-500"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setStep(1)}
            className="rounded-lg border border-slate-700 px-5 py-2.5 text-slate-300 hover:border-slate-500"
          >
            Voltar
          </button>
          <button
            onClick={() => setStep(3)}
            className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-2.5 font-medium text-slate-950 hover:opacity-90 transition-opacity"
          >
            Continuar →
          </button>
        </div>
      </WizardCard>
    );
  }

  if (step === 3) {
    return (
      <WizardCard step={3}>
        <h1 className="text-2xl font-semibold text-white mb-6">Qual é o seu objetivo?</h1>
        <div className="space-y-2 mb-8">
          {GOAL_OPTIONS.map((opt) => {
            const active = goal === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setGoal(opt.id)}
                className={`w-full text-left rounded-lg border px-4 py-3 transition-colors ${
                  active
                    ? "border-amber-400 bg-amber-400/10"
                    : "border-slate-700 hover:border-slate-500"
                }`}
              >
                <div className="text-white font-medium">{opt.label}</div>
                <div className="text-xs text-slate-400 mt-0.5">{opt.description}</div>
              </button>
            );
          })}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setStep(2)}
            className="rounded-lg border border-slate-700 px-5 py-2.5 text-slate-300 hover:border-slate-500"
          >
            Voltar
          </button>
          <button
            disabled={!goal}
            onClick={() => setStep(4)}
            className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-2.5 font-medium text-slate-950 disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            Continuar →
          </button>
        </div>
      </WizardCard>
    );
  }

  const canFinish = sectorId !== null;

  return (
    <WizardCard step={4}>
      <h1 className="text-2xl font-semibold text-white mb-6">Configure sua empresa.</h1>

      <label className="block text-sm text-slate-300 mb-2">Seu nome</label>
      <input
        value={founderName}
        onChange={(e) => setFounderName(e.target.value)}
        placeholder="Ex: Marina"
        className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-2.5 text-white placeholder:text-slate-600 mb-5 outline-none focus:border-amber-500 transition-colors"
        maxLength={30}
      />

      <label className="block text-sm text-slate-300 mb-2">Nome da empresa</label>
      <input
        value={companyName}
        onChange={(e) => setCompanyName(e.target.value)}
        placeholder="Ex: Norte Digital"
        className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-2.5 text-white placeholder:text-slate-600 mb-5 outline-none focus:border-amber-500 transition-colors"
        maxLength={40}
      />

      <label className="block text-sm text-slate-300 mb-3">Setor</label>
      <div className="grid sm:grid-cols-2 gap-3 mb-8">
        {SECTOR_LIST.map((sector) => {
          const active = sectorId === sector.id;
          return (
            <button
              key={sector.id}
              onClick={() => setSectorId(sector.id)}
              className={`text-left rounded-xl border p-3 transition-colors ${
                active
                  ? "border-amber-400 bg-amber-400/10"
                  : "border-slate-700 bg-slate-950/40 hover:border-slate-500"
              }`}
            >
              <div className="text-xl mb-1">{sector.emoji}</div>
              <div className="text-white text-sm font-medium mb-0.5">{sector.name}</div>
              <div className="text-xs text-slate-500">{sector.tagline}</div>
            </button>
          );
        })}
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setStep(3)}
          className="rounded-lg border border-slate-700 px-5 py-2.5 text-slate-300 hover:border-slate-500"
        >
          Voltar
        </button>
        <button
          disabled={!canFinish}
          onClick={() =>
            sectorId &&
            goal &&
            onComplete({ companyName, founderName, sectorId, interests, goal })
          }
          className="flex-1 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-2.5 font-medium text-slate-950 disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          Abrir a empresa →
        </button>
      </div>
    </WizardCard>
  );
}
