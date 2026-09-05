import Link from "next/link";
import { adminLogout } from "@/app/actions";
import { counts } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const { professionals, businesses } = await counts();

  return (
    <main className="mx-auto max-w-4xl flex-1 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">
          Painel de leads
        </h1>
        <form action={adminLogout}>
          <button
            type="submit"
            className="text-sm font-medium text-slate-500 hover:text-ink"
          >
            Sair
          </button>
        </form>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <Link
          href="/admin/profissionais"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-brand"
        >
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-dark">
            Profissionais
          </p>
          <p className="mt-2 text-3xl font-bold text-ink">
            {professionals}
          </p>
          <p className="mt-1 text-sm text-slate-500">cadastros recebidos</p>
        </Link>
        <Link
          href="/admin/negocios"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-brand"
        >
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-dark">
            Negócios
          </p>
          <p className="mt-2 text-3xl font-bold text-ink">
            {businesses}
          </p>
          <p className="mt-1 text-sm text-slate-500">pedidos de ajuda</p>
        </Link>
      </div>

      <p className="mt-10 text-sm text-slate-500">
        Use as listas acima para fazer o match manual: veja o que cada
        negócio precisa, encontre um profissional com a expertise certa e
        conecte os dois via WhatsApp. Atualize o status de cada lead conforme
        o andamento da conversa.
      </p>
    </main>
  );
}
