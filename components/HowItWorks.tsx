const STEPS = [
  {
    icon: "📝",
    title: "Cadastro",
    description:
      "O negócio conta que tipo de ajuda precisa (ou o profissional cadastra sua expertise).",
  },
  {
    icon: "🤝",
    title: "Match",
    description:
      "Nossa equipe analisa e conecta o negócio ao profissional sênior mais adequado.",
  },
  {
    icon: "💬",
    title: "Contato direto",
    description:
      "Vocês se falam pelo WhatsApp, sem intermediários, e combinam os detalhes.",
  },
  {
    icon: "✅",
    title: "Fechamento",
    description:
      "Horas e valor são combinados diretamente entre as partes. Trabalho realizado.",
  },
];

export default function HowItWorks() {
  return (
    <section id="como-funciona" className="py-16">
      <div className="mx-auto max-w-5xl px-6">
        <h2 className="text-center text-2xl font-bold text-slate-900">
          Como funciona
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-slate-600">
          Do cadastro ao trabalho feito, em 4 passos simples.
        </p>

        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <div key={step.title} className="relative flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-2xl ring-1 ring-amber-200">
                {step.icon}
              </div>
              <div className="mt-4 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="font-semibold text-slate-900">{step.title}</h3>
              </div>
              <p className="mt-2 text-sm text-slate-600">{step.description}</p>
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className="absolute top-8 left-[calc(50%+2.5rem)] hidden h-px w-[calc(100%-5rem)] bg-amber-200 lg:block"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
