import { updateTaskStatusAction } from "@/app/actions";
import { formatDate, formatDateTime } from "@/lib/format";
import { TASK_STATUS_LABELS, type Task } from "@/lib/types";

interface TaskCardProps {
  task: Task;
  isOwner: boolean;
}

const STATUS_BADGE: Record<Task["status"], string> = {
  pendente: "bg-slate-100 text-slate-600",
  em_andamento: "bg-amber-100 text-amber-700",
  concluida: "bg-emerald-100 text-emerald-700",
};

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export default function TaskCard({ task, isOwner }: TaskCardProps) {
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">{task.title}</p>
          {task.description && (
            <p className="mt-1 text-sm text-slate-600">{task.description}</p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE[task.status]}`}
        >
          {TASK_STATUS_LABELS[task.status]}
        </span>
      </div>

      <p className="mt-2 text-xs text-slate-500">
        Responsável: <span className="font-medium text-ink">{task.assignee_name}</span>
        {" · "}Prazo: {formatDate(task.deadline)}
      </p>

      {task.status === "concluida" && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
          <p className="text-xs text-slate-500">
            Concluída em {formatDateTime(task.completed_at)}
          </p>
          {task.proof_text && (
            <p className="mt-1 break-words text-ink">
              {isUrl(task.proof_text) ? (
                <a
                  href={task.proof_text}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand underline"
                >
                  {task.proof_text}
                </a>
              ) : (
                task.proof_text
              )}
            </p>
          )}
          {task.proof_image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={task.proof_image}
              alt={`Prova de conclusão de ${task.title}`}
              className="mt-2 max-h-48 rounded-lg border border-slate-200 object-contain"
            />
          )}
          {!task.proof_text && !task.proof_image && (
            <p className="text-slate-400">Sem prova anexada.</p>
          )}
        </div>
      )}

      {isOwner && task.status === "pendente" && (
        <form action={updateTaskStatusAction} className="mt-3">
          <input type="hidden" name="project_id" value={task.project_id} />
          <input type="hidden" name="task_id" value={task.id} />
          <input type="hidden" name="status" value="em_andamento" />
          <button
            type="submit"
            className="rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-white hover:bg-ink/90"
          >
            Iniciar tarefa
          </button>
        </form>
      )}

      {isOwner && task.status === "em_andamento" && (
        <details className="mt-3">
          <summary className="cursor-pointer list-none text-sm font-semibold text-brand-dark">
            Marcar como concluída
          </summary>
          <form
            action={updateTaskStatusAction}
            encType="multipart/form-data"
            className="mt-2 space-y-2"
          >
            <input type="hidden" name="project_id" value={task.project_id} />
            <input type="hidden" name="task_id" value={task.id} />
            <input type="hidden" name="status" value="concluida" />

            <label className="block text-xs font-medium text-slate-700">
              Prova (link ou explicação do que foi feito) — opcional
            </label>
            <textarea
              name="proof_text"
              rows={2}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />

            <label className="block text-xs font-medium text-slate-700">
              Print ou imagem (opcional, máx 2MB)
            </label>
            <input
              type="file"
              name="proof_image"
              accept="image/*"
              className="block w-full text-sm text-slate-600"
            />

            <button
              type="submit"
              className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              Concluir tarefa
            </button>
          </form>
        </details>
      )}
    </li>
  );
}
