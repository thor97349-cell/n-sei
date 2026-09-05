import type { NextRequest } from "next/server";
import { toCsv } from "@/lib/csv";
import { listProfessionals } from "@/lib/repo";
import type { LeadStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const professionals = await listProfessionals({
    expertiseArea: searchParams.get("expertise_area") || undefined,
    city: searchParams.get("city") || undefined,
    status: (searchParams.get("status") as LeadStatus) || undefined,
  });

  const csv = toCsv(
    [
      { key: "id", label: "ID" },
      { key: "name", label: "Nome" },
      { key: "email", label: "E-mail" },
      { key: "phone", label: "WhatsApp" },
      { key: "city", label: "Cidade" },
      { key: "expertise_area", label: "Área de expertise" },
      { key: "years_experience", label: "Anos de experiência" },
      { key: "hourly_rate", label: "Valor da hora" },
      { key: "availability", label: "Disponibilidade" },
      { key: "linkedin_url", label: "LinkedIn/portfólio" },
      { key: "bio", label: "Bio" },
      { key: "status", label: "Status" },
      { key: "created_at", label: "Cadastrado em" },
    ],
    professionals,
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="profissionais.csv"',
    },
  });
}
