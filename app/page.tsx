import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-5xl px-6 py-20 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Ajuda especializada, só quando você precisa.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
            Contador, advogado, designer ou engenheiro sênior — pelas horas
            que o seu negócio precisa, sem o custo de uma contratação fixa.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/negocios"
              className="rounded-full bg-amber-500 px-6 py-3 font-semibold text-white shadow-sm hover:bg-amber-600"
            >
              Sou um negócio, preciso de ajuda
            </Link>
            <Link
              href="/profissionais"
              className="rounded-full border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-800 hover:bg-slate-50"
            >
              Sou profissional sênior
            </Link>
          </div>
        </section>

        {/* Problem */}
        <section className="bg-white py-16">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="text-center text-2xl font-bold text-slate-900">
              O problema que todo pequeno negócio já viveu
            </h2>
            <div className="mt-10 grid gap-8 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-6">
                <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">
                  Donos de negócio
                </p>
                <p className="mt-2 text-slate-700">
                  Um salão, restaurante, loja ou clínica precisa revisar um
                  contrato, organizar as finanças ou repensar a marca — mas
                  isso acontece 1 ou 2 vezes por ano. Contratar um profissional
                  fixo não faz sentido para uma necessidade pontual.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-6">
                <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">
                  Profissionais seniores
                </p>
                <p className="mt-2 text-slate-700">
                  Décadas de experiência acumulada, mas pouca demanda
                  recorrente após a aposentadoria ou semi-aposentadoria. Muita
                  vontade de continuar ativo, sem os canais certos para
                  encontrar quem precisa desse conhecimento.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-16">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="text-center text-2xl font-bold text-slate-900">
              Como funciona
            </h2>
            <div className="mt-10 grid gap-8 sm:grid-cols-2">
              <div>
                <h3 className="font-semibold text-slate-900">
                  Para negócios
                </h3>
                <ol className="mt-4 space-y-4">
                  {[
                    "Conte o tipo de ajuda que você precisa, a urgência e o orçamento.",
                    "Nossa equipe entende sua necessidade e conecta você com o profissional certo pelo WhatsApp.",
                    "Vocês combinam as horas e o valor diretamente — sem burocracia.",
                  ].map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                        {i + 1}
                      </span>
                      <span className="text-slate-700">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">
                  Para profissionais
                </h3>
                <ol className="mt-4 space-y-4">
                  {[
                    "Cadastre sua área de expertise, experiência, valor da hora e disponibilidade.",
                    "Avisamos você via WhatsApp quando surge um negócio que combina com seu perfil.",
                    "Você decide se aceita, negocia direto e realiza o trabalho.",
                  ].map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
                        {i + 1}
                      </span>
                      <span className="text-slate-700">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>

        {/* Commission */}
        <section className="bg-white py-16">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <h2 className="text-2xl font-bold text-slate-900">
              Transparente e sem risco
            </h2>
            <p className="mt-4 text-slate-700">
              Cadastro é gratuito para os dois lados. Só cobramos uma pequena
              comissão (15–20%) sobre o valor da hora quando um match é
              efetivamente fechado. Sem mensalidade, sem taxa de cadastro, sem
              letras miúdas.
            </p>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <h2 className="text-2xl font-bold text-slate-900">
              Pronto para começar?
            </h2>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/negocios"
                className="rounded-full bg-amber-500 px-6 py-3 font-semibold text-white shadow-sm hover:bg-amber-600"
              >
                Quero encontrar um profissional
              </Link>
              <Link
                href="/profissionais"
                className="rounded-full border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-800 hover:bg-slate-50"
              >
                Quero me cadastrar como profissional
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
