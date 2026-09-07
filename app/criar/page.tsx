import { createProjectAction } from "@/app/actions";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";

export default function CriarProjetoPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1 px-6 py-12">
        <div className="mx-auto w-full max-w-md">
          <h1 className="text-2xl font-bold text-ink">Criar projeto</h1>
          <p className="mt-1 text-sm text-slate-500">
            Depois de criar, você recebe um link para convidar o resto do
            grupo.
          </p>

          <form
            action={createProjectAction}
            className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700">
                Nome do trabalho
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                autoFocus
                placeholder="Ex: Trabalho de Biologia — Ecossistemas"
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

            <div>
              <label
                htmlFor="deadline"
                className="block text-sm font-medium text-slate-700"
              >
                Prazo final (opcional)
              </label>
              <input
                id="deadline"
                name="deadline"
                type="date"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-ink shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>

            <hr className="border-slate-200" />

            <p className="text-sm font-semibold text-slate-700">Seus dados</p>

            <div>
              <label
                htmlFor="creator_name"
                className="block text-sm font-medium text-slate-700"
              >
                Seu nome
              </label>
              <input
                id="creator_name"
                name="creator_name"
                type="text"
                required
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-ink shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>

            <div>
              <label
                htmlFor="creator_email"
                className="block text-sm font-medium text-slate-700"
              >
                Seu e-mail
              </label>
              <input
                id="creator_email"
                name="creator_email"
                type="email"
                required
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-ink shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-full bg-brand px-6 py-2.5 font-semibold text-white hover:bg-brand-dark"
            >
              Criar projeto
            </button>
          </form>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
