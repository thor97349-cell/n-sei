import Link from "next/link";
import { updateLeadStatus } from "@/app/actions";
import AdminFilterBar from "@/components/AdminFilterBar";
import StatusSelect from "@/components/StatusSelect";
import { formatDateTime } from "@/lib/format";
import { listProfessionals } from "@/lib/repo";
import { EXPERTISE_AREAS, type LeadStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminProfissionaisPage({
  searchParams,
}: PageProps<"/admin/profissionais">) {
  const params = await searchParams;
  const expertiseArea = typeof params.expertise_area === "string" ? params.expertise_area : "";
  const city = typeof params.city === "string" ? params.city : "";
  const status = typeof params.status === "string" ? params.status : "";

  const professionals = await listProfessionals({
    expertiseArea: expertiseArea || undefined,
    city: city || undefined,
    status: (status as LeadStatus) || undefined,
  });

  const query = new URLSearchParams({
    ...(expertiseArea && { expertise_area: expertiseArea }),
    ...(city && { city }),
    ...(status && { status }),
  }).toString();

  return (
    <main className="mx-auto max-w-5xl flex-1 px-6 py-12">
      <Link href="/admin" className="text-sm text-slate-500 hover:text-ink">
        ← Painel
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-ink">
        Profissionais cadastrados ({professionals.length})
      </h1>

      <AdminFilterBar
        action="/admin/profissionais"
        exportHref={`/admin/profissionais/export${query ? `?${query}` : ""}`}
        categoryParam="expertise_area"
        categoryLabel="Área de expertise"
        categoryOptions={EXPERTISE_AREAS}
        categoryValue={expertiseArea}
        cityValue={city}
        statusValue={status}
        hasActiveFilters={Boolean(expertiseArea || city || status)}
      />

      <div className="mt-6 space-y-4">
        {professionals.length === 0 && (
          <p className="text-slate-500">Nenhum cadastro encontrado.</p>
        )}
        {professionals.map((p) => (
          <div
            key={p.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-ink">{p.name}</p>
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
                {p.linkedin_url && (
                  <a
                    href={p.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-sm text-brand-dark underline hover:text-ink"
                  >
                    Ver perfil / portfólio
                  </a>
                )}
                <p className="mt-2 text-xs text-slate-400">
                  Cadastrado em {formatDateTime(p.created_at)}
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
