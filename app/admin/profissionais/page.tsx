import Link from "next/link";
import { updateLeadStatus } from "@/app/actions";
import StatusSelect from "@/components/StatusSelect";
import { listProfessionals } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default function AdminProfissionaisPage() {
  const professionals = listProfessionals();

  return (
    <main className="mx-auto max-w-5xl flex-1 px-6 py-12">
      <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-800">
        ← Painel
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">
        Profissionais cadastrados ({professionals.length})
      </h1>

      <div className="mt-6 space-y-4">
        {professionals.length === 0 && (
          <p className="text-slate-500">Nenhum cadastro ainda.</p>
        )}
        {professionals.map((p) => (
          <div
            key={p.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-slate-900">{p.name}</p>
                <p className="text-sm text-slate-500">
                  {p.expertise_area} · {p.years_experience} anos de
                  experiência · R$ {p.hourly_rate.toFixed(2)}/h
                </p>
                <p className="text-sm text-slate-500">
                  {p.city} · {p.availability}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {p.email} · {p.phone}
                </p>
                {p.bio && (
                  <p className="mt-2 text-sm text-slate-600">{p.bio}</p>
                )}
                <p className="mt-2 text-xs text-slate-400">
                  Cadastrado em {p.created_at}
                </p>
              </div>
              <form action={updateLeadStatus} className="shrink-0">
                <input type="hidden" name="type" value="professional" />
                <input type="hidden" name="id" value={p.id} />
                <StatusSelect defaultValue={p.status} />
              </form>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
