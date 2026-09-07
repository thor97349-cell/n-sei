export const TASK_STATUSES = ["pendente", "em_andamento", "concluida"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pendente: "A fazer",
  em_andamento: "Em andamento",
  concluida: "Concluída",
};

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
  proof_text: string | null;
  proof_image: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface MemberStats {
  member: Member;
  assigned: number;
  completed: number;
  percent: number;
}
