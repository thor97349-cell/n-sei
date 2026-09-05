import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";

const PROFESSIONAL_STEPS = [
  "Nossa equipe confere seu cadastro (geralmente em até 48 horas úteis).",
  "Quando surgir um negócio com necessidade compatível com seu perfil, te chamamos no WhatsApp.",
  "Você decide se aceita a oportunidade e combina os detalhes direto com o negócio.",
];

const BUSINESS_STEPS = [
  "Nossa equipe analisa sua necessidade (geralmente em até 48 horas úteis).",
  "Buscamos o profissional sênior com a expertise mais adequada pro seu caso.",
  "Te chamamos no WhatsApp com a indicação, pra vocês combinarem horas e valor direto.",
];

export default async function ObrigadoPage({
  searchParams,
}: PageProps<"/obrigado">) {
  const { tipo } = await searchParams;

  const isProfessional = tipo === "profissional";
  const steps = isProfessional ? PROFESSIONAL_STEPS : BUSINESS_STEPS;

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-2xl px-6 py-24 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Cadastro recebido! 🎉
          </h1>
          <p className="mt-4 text-slate-600">
            {isProfessional
              ? "Obrigado por se cadastrar. Veja o que acontece a partir de agora:"
              : "Obrigado pelo cadastro. Veja o que acontece a partir de agora:"}
          </p>

          <ol className="mx-auto mt-8 max-w-md space-y-4 text-left">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span className="text-slate-700">{step}</span>
              </li>
            ))}
          </ol>

          <Link
            href="/"
            className="mt-10 inline-block rounded-full bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-slate-800"
          >
            Voltar para o início
          </Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
