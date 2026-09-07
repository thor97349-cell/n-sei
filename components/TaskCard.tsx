import { reactToTaskAction, updateTaskStatusAction } from "@/app/actions";
import Avatar from "@/components/Avatar";
import StatusIcon from "@/components/StatusIcon";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  PROOF_TYPE_LABELS,
  TASK_STATUS_LABELS,
  TASK_WEIGHT_LABELS,
  type Task,
  type TaskReaction,
} from "@/lib/types";

interface TaskCardProps {
  task: Task;
  isOwner: boolean;
  currentMemberId: number | null;
  reactions: TaskReaction[];
}

const STATUS_BADGE: Record<Task["status"], string> = {
  pendente: "bg-slate-100 text-slate-600",
  em_andamento: "bg-amber-100 text-amber-700",
  concluida: "bg-emerald-100 text-emerald-700",
};

function ProofTypeTag({ type }: { type: Task["proof_type"] }) {
  if (!type) return null;
  return (
    <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
      {PROOF_TYPE_LABELS[type]}
    </span>
  );
}

export default function TaskCard({
  task,
  isOwner,
  currentMemberId,
  reactions,
}: TaskCardProps) {
  const confirmCount = reactions.filter((r) => r.reaction === "confirma").length;
  const contestCount = reactions.filter((r) => r.reaction === "contesta").length;
  const myReaction = reactions.find((r) => r.member_id === currentMemberId)?.reaction;
  const canReact =
    task.status === "concluida" && !isOwner && currentMemberId != null;

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">{task.title}</p>
          {task.description && (
            <p className="mt-1 text-sm text-slate-600">{task.description}</p>
          )}
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE[task.status]}`}
        >
          <StatusIcon status={task.status} className="h-3.5 w-3.5" />
          {TASK_STATUS_LABELS[task.status]}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
        <Avatar name={task.assignee_name} seed={task.assignee_id} size="sm" />
        <span>
          <span className="font-medium text-ink">{task.assignee_name}</span>
          {" · "}Prazo: {formatDate(task.deadline)}
          {" · "}Peso: {TASK_WEIGHT_LABELS[task.weight]} ({task.weight})
        </span>
      </div>

      {task.status === "concluida" && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
          <p className="flex items-center gap-2 text-xs text-slate-500">
            Concluída em {formatDateTime(task.completed_at)}
            <ProofTypeTag type={task.proof_type} />
          </p>

          {task.proof_type === "nota" && task.proof_text && (
            <p className="mt-1 break-words text-ink">{task.proof_text}</p>
          )}

          {task.proof_type === "link" && task.proof_text && (
            <p className="mt-1 break-words">
              <a
                href={task.proof_text}
                target="_blank"
                rel="noreferrer"
                className="text-brand underline"
              >
                {task.proof_text}
              </a>
            </p>
          )}

          {task.proof_type === "arquivo" &&
            task.proof_file &&
            (task.proof_file.startsWith("data:image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={task.proof_file}
                alt={`Prova de conclusão de ${task.title}`}
                className="mt-2 max-h-48 rounded-lg border border-slate-200 object-contain"
              />
            ) : (
              <a
                href={task.proof_file}
                download={task.proof_file_name ?? undefined}
                className="mt-1 inline-block break-all text-brand underline"
              >
                {task.proof_file_name ?? "Baixar arquivo"}
              </a>
            ))}

          {!task.proof_type && <p className="text-slate-400">Sem prova anexada.</p>}
        </div>
      )}

      {task.status === "concluida" && (confirmCount > 0 || contestCount > 0 || canReact) && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {canReact ? (
            <>
              <form action={reactToTaskAction}>
                <input type="hidden" name="project_id" value={task.project_id} />
                <input type="hidden" name="task_id" value={task.id} />
                <input type="hidden" name="reaction" value="confirma" />
                <button
                  type="submit"
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    myReaction === "confirma"
                      ? "border-success bg-success text-white"
                      : "border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Confirmar ({confirmCount})
                </button>
              </form>
              <form action={reactToTaskAction}>
                <input type="hidden" name="project_id" value={task.project_id} />
                <input type="hidden" name="task_id" value={task.id} />
                <input type="hidden" name="reaction" value="contesta" />
                <button
                  type="submit"
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    myReaction === "contesta"
                      ? "border-alert bg-alert text-white"
                      : "border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Contestar ({contestCount})
                </button>
              </form>
            </>
          ) : (
            <p className="text-xs text-slate-500">
              {confirmCount} confirmaram · {contestCount} contestaram
            </p>
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
          <summary className="cursor-pointer list-none text-sm font-semibold text-success-dark">
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

            <fieldset className="space-y-1.5">
              <legend className="block text-xs font-medium text-slate-700">
                Tipo de prova (opcional)
              </legend>
              <label className="flex items-center gap-1.5 text-sm text-ink">
                <input
                  type="radio"
                  name="proof_type"
                  value="nenhuma"
                  defaultChecked
                />
                Nenhuma
              </label>
              <label className="flex items-center gap-1.5 text-sm text-ink">
                <input type="radio" name="proof_type" value="nota" />
                Nota (texto explicando o que fez)
              </label>
              <label className="flex items-center gap-1.5 text-sm text-ink">
                <input type="radio" name="proof_type" value="link" />
                Link externo (Google Docs, Drive, GitHub, Canva...)
              </label>
              <label className="flex items-center gap-1.5 text-sm text-ink">
                <input type="radio" name="proof_type" value="arquivo" />
                Arquivo anexado
              </label>
            </fieldset>

            <textarea
              name="proof_text"
              rows={2}
              placeholder="Escreva a nota, ou cole o link aqui"
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />

            <input
              type="file"
              name="proof_file"
              className="block w-full text-sm text-slate-600"
            />
            <p className="text-xs text-slate-400">
              Preencha só o campo do tipo escolhido acima (máx 2MB pra
              arquivo).
            </p>

            <button
              type="submit"
              className="rounded-full bg-success px-4 py-1.5 text-sm font-semibold text-white hover:bg-success-dark"
            >
              Concluir tarefa
            </button>
          </form>
        </details>
      )}
    </li>
  );
}
