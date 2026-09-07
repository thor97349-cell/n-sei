import type { Task } from "./types";

export const CONTRIBUTION_LEVELS = ["alta", "moderada", "baixa"] as const;

export type ContributionLevel = (typeof CONTRIBUTION_LEVELS)[number];

export const CONTRIBUTION_LEVEL_LABELS: Record<ContributionLevel, string> = {
  alta: "Alta contribuição",
  moderada: "Contribuição moderada",
  baixa: "Contribuição baixa",
};

export const CONTRIBUTION_LEVEL_BADGE: Record<ContributionLevel, string> = {
  alta: "bg-success text-white",
  moderada: "bg-amber-500 text-white",
  baixa: "bg-alert text-white",
};

export interface MemberContribution {
  assignedCount: number;
  completedCount: number;
  assignedWeight: number;
  completedWeight: number;
  evidenceCount: number;
  activeDays: number;
  score: number;
  level: ContributionLevel;
}

// Blends how much of the assigned weight got done with how often that work
// came with evidence attached, then buckets it into three bands instead of
// a raw percentage. A member with no tasks assigned yet reads as
// "moderada" (not enough data), not "baixa" — they haven't had a chance to
// contribute, so scoring them as low would be unfair.
export function computeMemberContribution(memberTasks: Task[]): MemberContribution {
  const completed = memberTasks.filter((t) => t.status === "concluida");
  const assignedWeight = memberTasks.reduce((sum, t) => sum + t.weight, 0);
  const completedWeight = completed.reduce((sum, t) => sum + t.weight, 0);
  const evidenceCount = completed.filter((t) => t.proof_type != null).length;

  const activeDays = new Set(
    completed
      .filter((t) => t.completed_at)
      .map((t) => t.completed_at!.slice(0, 10)),
  ).size;

  if (assignedWeight === 0) {
    return {
      assignedCount: memberTasks.length,
      completedCount: completed.length,
      assignedWeight,
      completedWeight,
      evidenceCount,
      activeDays,
      score: 0,
      level: "moderada",
    };
  }

  const weightScore = completedWeight / assignedWeight;
  const evidenceScore = completed.length > 0 ? evidenceCount / completed.length : 0;
  const score = weightScore * 0.7 + evidenceScore * 0.3;
  const level: ContributionLevel =
    score >= 0.66 ? "alta" : score >= 0.33 ? "moderada" : "baixa";

  return {
    assignedCount: memberTasks.length,
    completedCount: completed.length,
    assignedWeight,
    completedWeight,
    evidenceCount,
    activeDays,
    score,
    level,
  };
}
