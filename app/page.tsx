import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            Chega de carregar o trabalho em grupo sozinho.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
            O Justo divide as tarefas, mostra quem fez o quê e gera um
            relatório pronto pra provar a contribuição de cada um — sem
            planilha, sem discussão de última hora com o professor.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/criar"
              className="rounded-full bg-brand px-6 py-3 font-semibold text-white shadow-sm hover:bg-brand-dark"
            >
              Criar meu projeto grátis
            </Link>
          </div>
          <p className="mt-3 text-sm text-slate-400">
            Sem senha. Funciona direto pelo link no WhatsApp.
          </p>
        </section>

        <section className="bg-white py-16">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="text-center text-2xl font-bold text-ink">
              O problema de sempre
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-slate-600">
              Em quase todo trabalho em grupo, 1 ou 2 pessoas fazem a maior
              parte do esforço enquanto o resto contribui pouco — e na hora
              de entregar, ninguém consegue provar quem fez o quê. Resultado:
              nota injusta e climão no grupo.
            </p>
          </div>
        </section>

        <section className="py-16">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="text-center text-2xl font-bold text-ink">
              Como funciona
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
              {[
                {
                  title: "1. Crie o projeto",
                  text: "Nome, descrição e prazo final do trabalho.",
                },
                {
                  title: "2. Convide o grupo",
                  text: "Compartilhe um link no WhatsApp. Sem senha.",
                },
                {
                  title: "3. Divida as tarefas",
                  text: "Cada tarefa tem um responsável e um prazo.",
                },
                {
                  title: "4. Acompanhe o progresso",
                  text: "Cada um marca o que fez, com prova opcional.",
                },
                {
                  title: "5. Gere o relatório",
                  text: "PDF de 1 página pra anexar ou mostrar ao professor.",
                },
              ].map((step) => (
                <div
                  key={step.title}
                  className="rounded-xl border border-slate-200 bg-white p-5"
                >
                  <p className="font-semibold text-brand-dark">{step.title}</p>
                  <p className="mt-2 text-sm text-slate-600">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white py-16">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <h2 className="text-2xl font-bold text-ink">
              Pronto para acabar com a injustiça no seu grupo?
            </h2>
            <div className="mt-8">
              <Link
                href="/criar"
                className="rounded-full bg-brand px-6 py-3 font-semibold text-white shadow-sm hover:bg-brand-dark"
              >
                Criar meu projeto grátis
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
