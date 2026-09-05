import Link from "next/link";
import { LEAD_STATUSES } from "@/lib/types";

const selectClass =
  "rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-ink shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

export default function AdminFilterBar({
  action,
  exportHref,
  categoryParam,
  categoryLabel,
  categoryOptions,
  categoryValue,
  cityValue,
  statusValue,
  hasActiveFilters,
}: {
  action: string;
  exportHref: string;
  categoryParam: string;
  categoryLabel: string;
  categoryOptions: readonly string[];
  categoryValue: string;
  cityValue: string;
  statusValue: string;
  hasActiveFilters: boolean;
}) {
  return (
    <form
      action={action}
      method="get"
      className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4"
    >
      <div>
        <label className="block text-xs font-medium text-slate-500">
          {categoryLabel}
        </label>
        <select
          name={categoryParam}
          defaultValue={categoryValue}
          className={selectClass}
        >
          <option value="">Todas</option>
          {categoryOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500">
          Cidade
        </label>
        <input
          type="text"
          name="city"
          defaultValue={cityValue}
          placeholder="Buscar cidade..."
          className={selectClass}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500">
          Status
        </label>
        <select
          name="status"
          defaultValue={statusValue}
          className={selectClass}
        >
          <option value="">Todos</option>
          {LEAD_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        className="rounded-lg bg-ink px-4 py-1.5 text-sm font-semibold text-white hover:bg-ink/90"
      >
        Filtrar
      </button>

      {hasActiveFilters && (
        <Link
          href={action}
          className="text-sm text-slate-500 underline hover:text-ink"
        >
          Limpar filtros
        </Link>
      )}

      <a
        href={exportHref}
        className="ml-auto rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        Exportar CSV
      </a>
    </form>
  );
}
