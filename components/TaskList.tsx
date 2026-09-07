import TaskCard from "@/components/TaskCard";
import { TASK_STATUSES, TASK_STATUS_LABELS, type Task } from "@/lib/types";

interface TaskListProps {
  tasks: Task[];
  currentMemberId: number | null;
}

export default function TaskList({ tasks, currentMemberId }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
        Nenhuma tarefa criada ainda. Use &ldquo;+ Nova tarefa&rdquo; para
        começar a dividir o trabalho.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {TASK_STATUSES.map((status) => {
        const group = tasks.filter((task) => task.status === status);
        if (group.length === 0) return null;
        return (
          <section key={status}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {TASK_STATUS_LABELS[status]} ({group.length})
            </h2>
            <ul className="space-y-3">
              {group.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isOwner={task.assignee_id === currentMemberId}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
