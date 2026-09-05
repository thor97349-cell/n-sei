"use client";

import { LEAD_STATUSES } from "@/lib/types";

export default function StatusSelect({
  defaultValue,
}: {
  defaultValue: string;
}) {
  return (
    <select
      name="status"
      defaultValue={defaultValue}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className="rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
    >
      {LEAD_STATUSES.map((status) => (
        <option key={status} value={status}>
          {status}
        </option>
      ))}
    </select>
  );
}
