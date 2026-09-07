import { joinProjectAction } from "@/app/actions";
import type { Member } from "@/lib/types";

interface JoinFormProps {
  token?: string;
  projectId?: number;
  projectName: string;
  members: Member[];
}

export default function JoinForm({
  token,
  projectId,
  projectName,
  members,
}: JoinFormProps) {
  return (
    <div className="mx-auto w-full max-w-sm">
      <h1 className="text-xl font-bold text-ink">{projectName}</h1>
      <p className="mt-1 text-sm text-slate-500">
        Diga quem você é para entrar no projeto.
      </p>

      <form
        action={joinProjectAction}
        className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        {token && <input type="hidden" name="token" value={token} />}
        {projectId != null && (
          <input type="hidden" name="project_id" value={projectId} />
        )}

        <label htmlFor="name" className="block text-sm font-medium text-slate-700">
          Seu nome
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          autoFocus
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-ink shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />

        <label
          htmlFor="email"
          className="mt-4 block text-sm font-medium text-slate-700"
        >
          Seu e-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-ink shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
        <p className="mt-1 text-xs text-slate-400">
          Já é do grupo? Use o mesmo e-mail de antes para continuar de onde
          parou.
        </p>

        <button
          type="submit"
          className="mt-6 w-full rounded-full bg-brand px-6 py-2.5 font-semibold text-white hover:bg-brand-dark"
        >
          Entrar no projeto
        </button>
      </form>

      {members.length > 0 && (
        <p className="mt-4 text-center text-sm text-slate-500">
          Já estão no projeto: {members.map((m) => m.name).join(", ")}
        </p>
      )}
    </div>
  );
}
