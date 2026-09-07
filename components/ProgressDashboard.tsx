import Avatar from "@/components/Avatar";
import { formatDate, formatDateTime } from "@/lib/format";
import { isTaskOverdue } from "@/lib/tasks";
import type { Member, Task } from "@/lib/types";

interface ProgressDashboardProps {
  members: Member[];
  tasks: Task[];
}

export default function ProgressDashboard({
  members,
  tasks,
}: ProgressDashboardProps) {
  const stats = members.map((member) => {
    const assigned = tasks.filter((t) => t.assignee_id === member.id);
    const completed = assigned.filter((t) => t.status === "concluida");
    const percent = assigned.length
      ? Math.round((completed.length / assigned.length) * 100)
      : 0;
    return { member, assigned: assigned.length, completed: completed.length, percent };
  });

  const overdueTasks = tasks.filter(isTaskOverdue);

  const timeline = tasks
    .filter((t) => t.status === "concluida" && t.completed_at)
    .sort(
      (a, b) =>
        new Date(a.completed_at!).getTime() -
        new Date(b.completed_at!).getTime(),
    );

  return (
    <div className="space-y-8">
      {overdueTasks.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-alert-dark">
            Tarefas atrasadas
          </h2>
          <ul className="mt-3 space-y-3">
            {overdueTasks.map((task) => (
              <li
                key={task.id}
                className="flex items-center gap-3 rounded-2xl border border-alert/40 bg-orange-50 p-4"
              >
                <Avatar name={task.assignee_name} seed={task.assignee_id} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{task.title}</p>
                  <p className="text-xs font-medium text-alert-dark">
                    {task.assignee_name} · prazo era {formatDate(task.deadline)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Contribuição por pessoa
        </h2>
        <div className="mt-3 space-y-3">
          {stats.map(({ member, assigned, completed, percent }) => (
            <div
              key={member.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Avatar name={member.name} seed={member.id} />
                  <p className="font-semibold text-ink">{member.name}</p>
                </div>
                <p className="text-sm text-slate-500">
                  {completed}/{assigned} tarefas ({percent}%)
                </p>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-success"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Linha do tempo
        </h2>
        {timeline.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            Nenhuma tarefa concluída ainda.
          </p>
        ) : (
          <ol className="mt-3 space-y-4 border-l-2 border-slate-200 pl-4">
            {timeline.map((task) => (
              <li key={task.id} className="flex items-start gap-2">
                <Avatar name={task.assignee_name} seed={task.assignee_id} size="sm" />
                <div>
                  <p className="text-sm text-slate-500">
                    {formatDateTime(task.completed_at)}
                  </p>
                  <p className="text-ink">
                    <span className="font-semibold">{task.assignee_name}</span>{" "}
                    concluiu &ldquo;{task.title}&rdquo;
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
