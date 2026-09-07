export const TASK_STATUSES = ["pendente", "em_andamento", "concluida"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pendente: "A fazer",
  em_andamento: "Em andamento",
  concluida: "Concluída",
};

export const TASK_WEIGHTS = [1, 2, 3, 4, 5] as const;

export type TaskWeight = (typeof TASK_WEIGHTS)[number];

export const TASK_WEIGHT_LABELS: Record<TaskWeight, string> = {
  1: "Rápida",
  2: "Pequena",
  3: "Média",
  4: "Grande",
  5: "Muito grande",
};

export const PROOF_TYPES = ["nota", "link", "arquivo"] as const;

export type ProofType = (typeof PROOF_TYPES)[number];

export const PROOF_TYPE_LABELS: Record<ProofType, string> = {
  nota: "Nota",
  link: "Link externo",
  arquivo: "Arquivo",
};

export const REACTIONS = ["confirma", "contesta"] as const;

export type ReactionType = (typeof REACTIONS)[number];

export interface TaskReaction {
  id: number;
  task_id: number;
  member_id: number;
  reaction: ReactionType;
  created_at: string;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  deadline: string | null;
  invite_token: string;
  created_at: string;
}

export interface Member {
  id: number;
  project_id: number;
  name: string;
  email: string;
  created_at: string;
}

export interface Task {
  id: number;
  project_id: number;
  title: string;
  description: string | null;
  assignee_id: number;
  assignee_name: string;
  deadline: string | null;
  status: TaskStatus;
  weight: TaskWeight;
  proof_type: ProofType | null;
  proof_text: string | null;
  proof_file: string | null;
  proof_file_name: string | null;
  completed_at: string | null;
  status_changed_at: string;
  created_at: string;
}

