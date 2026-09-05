import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { submitBusiness } from "@/app/actions";
import { BUSINESS_TYPES, URGENCY_LEVELS } from "@/lib/types";

const inputClass =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";
const labelClass = "block text-sm font-medium text-slate-700";

export default function NegociosPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-6 py-16">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Ajuda especializada, sem contratar ninguém fixo.
          </h1>
          <p className="mt-3 text-slate-600">
            Conte o que você precisa e conectamos você, via WhatsApp, com um
            profissional sênior experiente para resolver essa necessidade
            pontual.
          </p>

          <form
            action={submitBusiness}
            className="mt-10 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="business_name" className={labelClass}>
                  Nome do negócio *
                </label>
                <input
                  id="business_name"
                  name="business_name"
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="contact_name" className={labelClass}>
                  Seu nome *
                </label>
                <input
                  id="contact_name"
                  name="contact_name"
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="email" className={labelClass}>
                  E-mail *
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="phone" className={labelClass}>
                  WhatsApp *
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  placeholder="(11) 99999-9999"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="city" className={labelClass}>
                  Cidade *
                </label>
                <input
                  id="city"
                  name="city"
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="business_type" className={labelClass}>
                  Tipo de negócio *
                </label>
                <select
                  id="business_type"
                  name="business_type"
                  required
                  defaultValue=""
                  className={inputClass}
                >
                  <option value="" disabled>
                    Selecione
                  </option>
                  {BUSINESS_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="num_employees" className={labelClass}>
                  Número de funcionários *
                </label>
                <input
                  id="num_employees"
                  name="num_employees"
                  type="number"
                  min={0}
                  max={15}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="urgency" className={labelClass}>
                  Urgência *
                </label>
                <select
                  id="urgency"
                  name="urgency"
                  required
                  defaultValue=""
                  className={inputClass}
                >
                  <option value="" disabled>
                    Selecione
                  </option>
                  {URGENCY_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="help_needed" className={labelClass}>
                Que tipo de ajuda você precisa? *
              </label>
              <input
                id="help_needed"
                name="help_needed"
                required
                placeholder="Ex: revisar contrato de aluguel, organizar o financeiro..."
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="description" className={labelClass}>
                Descreva a sua necessidade com mais detalhes *
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="budget" className={labelClass}>
                Orçamento disponível (opcional)
              </label>
              <input
                id="budget"
                name="budget"
                placeholder="Ex: até R$ 200/hora"
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-full bg-amber-500 px-6 py-3 font-semibold text-white shadow-sm hover:bg-amber-600 sm:w-auto"
            >
              Quero encontrar um profissional
            </button>
          </form>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
