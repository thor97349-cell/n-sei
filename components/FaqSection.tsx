const FAQS = [
  {
    question: "É seguro?",
    answer:
      "Sim. Antes de qualquer contato, nossa equipe analisa manualmente o cadastro do profissional e a necessidade do negócio. Vocês se falam diretamente pelo WhatsApp, sem intermediário escondido nem repasse de dados a terceiros.",
  },
  {
    question: "Como funciona o pagamento?",
    answer:
      "O pagamento é combinado direto entre o negócio e o profissional — a HoraCerta não processa o pagamento do serviço nesta fase. Cobramos apenas uma comissão de 15–20% sobre o valor da hora quando um match é efetivamente fechado.",
  },
  {
    question: "Quanto custa se cadastrar?",
    answer:
      "Nada. O cadastro é 100% gratuito tanto para negócios quanto para profissionais. Só existe cobrança se um match realmente se concretizar.",
  },
  {
    question: "Quanto tempo leva pra receber contato?",
    answer:
      "Normalmente em até 48 horas úteis após o cadastro, nossa equipe já entra em contato pelo WhatsApp com uma indicação ou para entender melhor a sua necessidade.",
  },
];

export default function FaqSection() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-2xl px-6">
        <h2 className="text-center text-2xl font-bold text-slate-900">
          Perguntas frequentes
        </h2>
        <div className="mt-8 divide-y divide-slate-200 border-y border-slate-200">
          {FAQS.map((faq) => (
            <details key={faq.question} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-slate-900">
                {faq.question}
                <span
                  aria-hidden
                  className="shrink-0 text-amber-600 transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm text-slate-600">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
