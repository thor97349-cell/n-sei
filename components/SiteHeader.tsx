import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-10">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-lg font-bold tracking-tight text-ink">
            HoraCerta
          </span>
          <span className="hidden text-sm text-slate-500 sm:inline">
            experiência sênior, sob medida
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium text-slate-600">
          <Link
            href="/profissionais"
            className="hidden hover:text-ink sm:inline-block"
          >
            Sou profissional
          </Link>
          <Link
            href="/negocios"
            className="rounded-full bg-brand px-3 py-2 text-white hover:bg-brand-dark sm:px-4"
          >
            Preciso de ajuda
          </Link>
        </nav>
      </div>
    </header>
  );
}
