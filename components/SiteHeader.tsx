import Link from "next/link";
import { signOutAction } from "@/app/actions";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { getSessionUser } from "@/lib/auth";
import { getOrigin } from "@/lib/url";

export default async function SiteHeader() {
  const user = await getSessionUser();
  const origin = await getOrigin();

  return (
    <header className="border-b border-black/5 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="text-2xl font-extrabold tracking-tight text-ink"
        >
          Justo
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/criar"
            className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark"
          >
            Criar projeto
          </Link>

          {user ? (
            <div className="flex items-center gap-2">
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.image}
                  alt={user.name}
                  className="h-8 w-8 rounded-full"
                />
              ) : null}
              <span className="hidden text-sm text-slate-600 sm:inline">
                {user.name}
              </span>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="text-sm font-medium text-slate-500 hover:text-ink"
                >
                  Sair
                </button>
              </form>
            </div>
          ) : (
            <GoogleSignInButton
              callbackUrl={origin}
              label="Entrar"
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
            />
          )}
        </div>
      </div>
    </header>
  );
}
