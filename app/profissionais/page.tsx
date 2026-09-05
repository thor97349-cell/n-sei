import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { submitProfessional } from "@/app/actions";
import { EXPERTISE_AREAS } from "@/lib/types";

const inputClass =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";
const labelClass = "block text-sm font-medium text-slate-700";

export default function ProfissionaisPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-6 py-16">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Continue ativo, no seu ritmo.
          </h1>
          <p className="mt-3 text-slate-600">
            Cadastre-se gratuitamente e avisaremos você via WhatsApp sempre
            que um negócio local precisar da sua expertise. Você escolhe
            quais oportunidades aceitar.
          </p>

          <form
            action={submitProfessional}
            className="mt-10 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className={labelClass}>
                  Nome completo *
                </label>
                <input
                  id="name"
                  name="name"
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
                <label htmlFor="expertise_area" className={labelClass}>
                  Área de expertise *
                </label>
                <select
                  id="expertise_area"
                  name="expertise_area"
                  required
                  defaultValue=""
                  className={inputClass}
                >
                  <option value="" disabled>
                    Selecione
                  </option>
                  {EXPERTISE_AREAS.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="years_experience" className={labelClass}>
                  Anos de experiência *
                </label>
                <input
                  id="years_experience"
                  name="years_experience"
                  type="number"
                  min={0}
                  max={80}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="hourly_rate" className={labelClass}>
                  Valor da hora desejado (R$) *
                </label>
                <input
                  id="hourly_rate"
                  name="hourly_rate"
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="availability" className={labelClass}>
                  Disponibilidade *
                </label>
                <input
                  id="availability"
                  name="availability"
                  required
                  placeholder="Ex: seg a sex, período da manhã"
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label htmlFor="bio" className={labelClass}>
                Conte um pouco da sua trajetória (opcional)
              </label>
              <textarea
                id="bio"
                name="bio"
                rows={4}
                className={inputClass}
                placeholder="Ex: 30 anos como contador, atendi pequenas empresas do varejo e serviços..."
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-full bg-amber-500 px-6 py-3 font-semibold text-white shadow-sm hover:bg-amber-600 sm:w-auto"
            >
              Quero me cadastrar
            </button>
          </form>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
