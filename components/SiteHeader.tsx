import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="border-b border-black/5 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="text-2xl font-extrabold tracking-tight text-ink"
        >
          Justo
        </Link>
        <Link
          href="/criar"
          className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark"
        >
          Criar projeto
        </Link>
      </div>
    </header>
  );
}
