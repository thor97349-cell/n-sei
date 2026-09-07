import { createTaskAction } from "@/app/actions";
import { TASK_WEIGHTS, TASK_WEIGHT_LABELS, type Member } from "@/lib/types";

interface NewTaskFormProps {
  projectId: number;
  members: Member[];
}

export default function NewTaskForm({ projectId, members }: NewTaskFormProps) {
  return (
    <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <summary className="cursor-pointer list-none rounded-2xl px-5 py-4 font-semibold text-ink">
        + Nova tarefa
      </summary>
      <form action={createTaskAction} className="space-y-4 px-5 pb-5">
        <input type="hidden" name="project_id" value={projectId} />

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-slate-700">
            Título
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-ink shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-slate-700"
          >
            Descrição (opcional)
          </label>
          <textarea
            id="description"
            name="description"
            rows={2}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-ink shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="assignee_id"
              className="block text-sm font-medium text-slate-700"
            >
              Responsável
            </label>
            <select
              id="assignee_id"
              name="assignee_id"
              required
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-ink shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="deadline"
              className="block text-sm font-medium text-slate-700"
            >
              Prazo (opcional)
            </label>
            <input
              id="deadline"
              name="deadline"
              type="date"
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-ink shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
        </div>

        <div>
          <label htmlFor="weight" className="block text-sm font-medium text-slate-700">
            Peso da tarefa
          </label>
          <select
            id="weight"
            name="weight"
            defaultValue={3}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-ink shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          >
            {TASK_WEIGHTS.map((weight) => (
              <option key={weight} value={weight}>
                {weight} — {TASK_WEIGHT_LABELS[weight]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-400">
            Quanto maior o peso, mais essa tarefa conta na contribuição de
            quem a concluir.
          </p>
        </div>

        <button
          type="submit"
          className="w-full rounded-full bg-brand px-6 py-2.5 font-semibold text-white hover:bg-brand-dark sm:w-auto"
        >
          Criar tarefa
        </button>
      </form>
    </details>
  );
}
