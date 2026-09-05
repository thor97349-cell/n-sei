import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";

export default async function ObrigadoPage({
  searchParams,
}: PageProps<"/obrigado">) {
  const { tipo } = await searchParams;

  const isProfessional = tipo === "profissional";

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
              ? "Obrigado por se cadastrar. Vamos te chamar no WhatsApp assim que surgir um negócio que combine com o seu perfil."
              : "Obrigado pelo cadastro. Nossa equipe vai analisar sua necessidade e te chamar no WhatsApp com um profissional indicado."}
          </p>
          <Link
            href="/"
            className="mt-8 inline-block rounded-full bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-slate-800"
          >
            Voltar para o início
          </Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
