export const EXPERTISE_AREAS = [
  "Contabilidade / Financeiro",
  "Jurídico",
  "Marketing e Vendas",
  "Design e Marca",
  "Engenharia e Processos",
  "Recursos Humanos",
  "Tecnologia / TI",
  "Gestão e Estratégia",
  "Outro",
] as const;

export const BUSINESS_TYPES = [
  "Salão de beleza / Estética",
  "Restaurante / Bar / Lanchonete",
  "Loja / Varejo",
  "Clínica / Consultório",
  "Academia / Estúdio",
  "Serviços em geral",
  "Outro",
] as const;

export const URGENCY_LEVELS = [
  "Urgente (essa semana)",
  "Esse mês",
  "Sem pressa, só pesquisando",
] as const;

export const BUDGET_RANGES = [
  "Até R$100/hora",
  "R$100–300/hora",
  "R$300–500/hora",
  "Acima de R$500/hora",
] as const;

export const LEAD_STATUSES = [
  "novo",
  "em contato",
  "match feito",
  "fechado",
  "sem interesse",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export interface Professional {
  id: number;
  name: string;
  email: string;
  phone: string;
  city: string;
  expertise_area: string;
  years_experience: number;
  hourly_rate: number;
  availability: string;
  bio: string | null;
  linkedin_url: string | null;
  status: LeadStatus;
  created_at: string;
}

export interface Business {
  id: number;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  city: string;
  business_type: string;
  num_employees: number;
  help_needed: string;
  description: string;
  urgency: string;
  budget: string | null;
  status: LeadStatus;
  created_at: string;
}
