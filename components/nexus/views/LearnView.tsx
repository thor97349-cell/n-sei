const TERMS: { term: string; text: string }[] = [
  {
    term: "CAC (Custo de Aquisição de Cliente)",
    text: "Quanto você gasta em marketing para conquistar um novo cliente. No Vértice, cada setor tem um CAC base — sua reputação reduz esse custo (empresas mais confiáveis convertem mais barato).",
  },
  {
    term: "Churn",
    text: "A fração de clientes que cancela por mês. Sobe quando o preço está muito acima da referência do setor ou quando a reputação está baixa.",
  },
  {
    term: "Market share",
    text: "Sua fatia do mercado total do setor (clientes ativos ÷ tamanho do mercado). O mercado cresce sozinho a cada mês, então ficar parado significa perder participação relativa.",
  },
  {
    term: "Margem",
    text: "Lucro dividido pela receita. Margens saudáveis (acima de ~15%) indicam que o preço cobre bem os custos variáveis, folha e overhead.",
  },
  {
    term: "Reputação",
    text: "Métrica de 0 a 100 que resume a percepção do mercado sobre sua empresa. Sobe com equipe de suporte, investimento em produto/P&D; cai quando o preço está muito acima do valor percebido.",
  },
  {
    term: "Runway",
    text: "Quantos meses seu caixa atual aguenta no ritmo de queima (burn) atual, se o prejuízo mensal se mantiver constante.",
  },
  {
    term: "P&D (Pesquisa e Desenvolvimento)",
    text: "Investimento mensal que melhora a qualidade percebida do produto ao longo do tempo, elevando a reputação gradualmente.",
  },
  {
    term: "Elasticidade de preço",
    text: "O quanto a demanda reage a mudanças de preço. Preços muito acima da referência do setor reduzem a atração de novos clientes e aumentam o churn dos atuais.",
  },
];

export default function LearnView() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-white mb-1">Aprender</h1>
        <p className="text-sm text-slate-400">Glossário rápido dos conceitos usados na simulação.</p>
      </div>
      <div className="space-y-3">
        {TERMS.map((t) => (
          <div key={t.term} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="text-white font-medium mb-1">{t.term}</div>
            <p className="text-sm text-slate-400">{t.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
