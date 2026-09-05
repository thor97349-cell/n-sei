import { adminLogin } from "@/app/actions";

export default async function AdminLoginPage({
  searchParams,
}: PageProps<"/admin/login">) {
  const { erro } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center bg-slate-50 px-6">
      <form
        action={adminLogin}
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <h1 className="text-xl font-bold text-slate-900">Área interna</h1>
        <p className="mt-1 text-sm text-slate-500">
          HoraCerta — painel de leads
        </p>
        {erro && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            Senha incorreta. Tente novamente.
          </p>
        )}
        <label htmlFor="password" className="mt-6 block text-sm font-medium text-slate-700">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoFocus
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
        <button
          type="submit"
          className="mt-6 w-full rounded-full bg-slate-900 px-6 py-2.5 font-semibold text-white hover:bg-slate-800"
        >
          Entrar
        </button>
      </form>
    </main>
  );
}
