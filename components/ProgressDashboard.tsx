import Avatar from "@/components/Avatar";
import {
  CONTRIBUTION_LEVEL_BADGE,
  CONTRIBUTION_LEVEL_LABELS,
  computeMemberContribution,
} from "@/lib/contribution";
import { formatDate, formatDateTime } from "@/lib/format";
import { isTaskOverdue } from "@/lib/tasks";
import type { Member, Task, TaskReaction } from "@/lib/types";

interface ProgressDashboardProps {
  members: Member[];
  tasks: Task[];
  reactions: TaskReaction[];
}

export default function ProgressDashboard({
  members,
  tasks,
  reactions,
}: ProgressDashboardProps) {
  const stats = members.map((member) => {
    const memberTasks = tasks.filter((t) => t.assignee_id === member.id);
    return { member, contribution: computeMemberContribution(memberTasks) };
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
          {stats.map(({ member, contribution }) => (
            <details
              key={member.id}
              className="rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-2">
                  <Avatar name={member.name} seed={member.id} />
                  <p className="font-semibold text-ink">{member.name}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${CONTRIBUTION_LEVEL_BADGE[contribution.level]}`}
                >
                  {CONTRIBUTION_LEVEL_LABELS[contribution.level]}
                </span>
              </summary>
              <div className="space-y-1 border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
                <p>
                  {contribution.completedCount}/{contribution.assignedCount}{" "}
                  tarefas concluídas ({contribution.completedWeight}/
                  {contribution.assignedWeight} pontos de peso)
                </p>
                <p>{contribution.evidenceCount} tarefa(s) com evidência anexada</p>
                <p>{contribution.activeDays} dia(s) de participação ativa</p>
              </div>
            </details>
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
            {timeline.map((task) => {
              const taskReactions = reactions.filter((r) => r.task_id === task.id);
              const confirmCount = taskReactions.filter(
                (r) => r.reaction === "confirma",
              ).length;
              const contestCount = taskReactions.filter(
                (r) => r.reaction === "contesta",
              ).length;
              return (
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
                    {(confirmCount > 0 || contestCount > 0) && (
                      <p className="text-xs text-slate-500">
                        {confirmCount} confirmaram · {contestCount} contestaram
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
