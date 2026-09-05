import Link from "next/link";
import { updateLeadStatus, updatePaymentStatus } from "@/app/actions";
import AdminFilterBar from "@/components/AdminFilterBar";
import InlineSelect from "@/components/InlineSelect";
import { formatDateTime } from "@/lib/format";
import { listBusinesses } from "@/lib/repo";
import {
  BUSINESS_TYPES,
  LEAD_STATUSES,
  PAYMENT_STATUSES,
  type LeadStatus,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminNegociosPage({
  searchParams,
}: PageProps<"/admin/negocios">) {
  const params = await searchParams;
  const businessType = typeof params.business_type === "string" ? params.business_type : "";
  const city = typeof params.city === "string" ? params.city : "";
  const status = typeof params.status === "string" ? params.status : "";

  const businesses = await listBusinesses({
    businessType: businessType || undefined,
    city: city || undefined,
    status: (status as LeadStatus) || undefined,
  });

  const query = new URLSearchParams({
    ...(businessType && { business_type: businessType }),
    ...(city && { city }),
    ...(status && { status }),
  }).toString();

  return (
    <main className="mx-auto max-w-5xl flex-1 px-6 py-12">
      <Link href="/admin" className="text-sm text-slate-500 hover:text-ink">
        ← Painel
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-ink">
        Negócios cadastrados ({businesses.length})
      </h1>

      <AdminFilterBar
        action="/admin/negocios"
        exportHref={`/admin/negocios/export${query ? `?${query}` : ""}`}
        categoryParam="business_type"
        categoryLabel="Tipo de negócio"
        categoryOptions={BUSINESS_TYPES}
        categoryValue={businessType}
        cityValue={city}
        statusValue={status}
        hasActiveFilters={Boolean(businessType || city || status)}
      />

      <div className="mt-6 space-y-4">
        {businesses.length === 0 && (
          <p className="text-slate-500">Nenhum cadastro encontrado.</p>
        )}
        {businesses.map((b) => (
          <div
            key={b.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-ink">
                  {b.business_name}
                </p>
                <p className="text-sm text-slate-500">
                  {b.business_type} · {b.num_employees} funcionários ·{" "}
                  {b.city}
                </p>
                <p className="text-sm text-slate-500">
                  Urgência: {b.urgency}
                  {b.budget ? ` · Orçamento: ${b.budget}` : ""}
                  {b.willingness_to_pay != null
                    ? ` · Pagaria: R$ ${b.willingness_to_pay.toFixed(2)}/h`
                    : ""}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {b.contact_name} · {b.email} · {b.phone}
                </p>
                <p className="mt-2 text-sm font-medium text-ink">
                  {b.help_needed}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {b.description}
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  Cadastrado em {formatDateTime(b.created_at)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <form action={updateLeadStatus} className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Lead</span>
                  <input type="hidden" name="type" value="business" />
                  <input type="hidden" name="id" value={b.id} />
                  <InlineSelect
                    name="status"
                    defaultValue={b.status}
                    options={LEAD_STATUSES}
                  />
                </form>
                <form action={updatePaymentStatus} className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Pagamento</span>
                  <input type="hidden" name="type" value="business" />
                  <input type="hidden" name="id" value={b.id} />
                  <InlineSelect
                    name="payment_status"
                    defaultValue={b.payment_status}
                    options={PAYMENT_STATUSES}
                  />
                </form>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
