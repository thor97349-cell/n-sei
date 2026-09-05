import type { NextRequest } from "next/server";
import { toCsv } from "@/lib/csv";
import { listBusinesses } from "@/lib/repo";
import type { LeadStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const businesses = await listBusinesses({
    businessType: searchParams.get("business_type") || undefined,
    city: searchParams.get("city") || undefined,
    status: (searchParams.get("status") as LeadStatus) || undefined,
  });

  const csv = toCsv(
    [
      { key: "id", label: "ID" },
      { key: "business_name", label: "Nome do negócio" },
      { key: "contact_name", label: "Contato" },
      { key: "email", label: "E-mail" },
      { key: "phone", label: "WhatsApp" },
      { key: "city", label: "Cidade" },
      { key: "business_type", label: "Tipo de negócio" },
      { key: "num_employees", label: "Funcionários" },
      { key: "help_needed", label: "Ajuda necessária" },
      { key: "description", label: "Descrição" },
      { key: "urgency", label: "Urgência" },
      { key: "budget", label: "Orçamento" },
      { key: "willingness_to_pay", label: "Quanto pagaria (R$/hora)" },
      { key: "status", label: "Status" },
      { key: "payment_status", label: "Status de pagamento" },
      { key: "created_at", label: "Cadastrado em" },
    ],
    businesses,
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="negocios.csv"',
    },
  });
}
