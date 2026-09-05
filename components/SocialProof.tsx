const TESTIMONIALS = [
  {
    quote:
      "Em menos de dois dias já estava conversando com um contador que resolveu exatamente o que eu precisava, sem contratar ninguém fixo.",
    name: "Nome do cliente",
    role: "Tipo de negócio, cidade",
  },
  {
    quote:
      "Voltei a usar minha experiência de décadas ajudando negócios locais, no meu ritmo, sem cobrança de metas.",
    name: "Nome do profissional",
    role: "Área de expertise",
  },
  {
    quote:
      "O contato foi direto pelo WhatsApp, sem burocracia. Combinamos tudo em uma conversa só.",
    name: "Nome do cliente",
    role: "Tipo de negócio, cidade",
  },
];

export default function SocialProof({
  professionalsCount,
}: {
  professionalsCount: number | null;
}) {
  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-5xl px-6">
        {professionalsCount !== null && professionalsCount > 0 ? (
          <p className="mx-auto mb-12 max-w-xl text-center text-lg text-slate-700">
            <span className="text-3xl font-bold text-slate-900">
              {professionalsCount}
            </span>{" "}
            {professionalsCount === 1
              ? "profissional sênior já cadastrado"
              : "profissionais seniores já cadastrados"}
          </p>
        ) : (
          <p className="mx-auto mb-12 max-w-xl text-center text-lg text-slate-700">
            Novos profissionais seniores se cadastrando toda semana.
          </p>
        )}

        <div className="grid gap-6 sm:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <figure
              key={i}
              className="relative rounded-xl border border-slate-200 bg-white p-6"
            >
              <span className="absolute top-3 right-3 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
                Exemplo
              </span>
              <blockquote className="text-sm text-slate-700">
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-4 text-sm">
                <span className="font-semibold text-slate-900">{t.name}</span>
                <span className="text-slate-500"> · {t.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
