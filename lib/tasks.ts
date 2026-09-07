import type { Task } from "./types";

export function isTaskOverdue(task: Pick<Task, "status" | "deadline">): boolean {
  if (task.status === "concluida" || !task.deadline) return false;
  const todayUtc = new Date().toISOString().slice(0, 10);
  return task.deadline < todayUtc;
}
