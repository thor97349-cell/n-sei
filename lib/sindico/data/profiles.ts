import { DifficultyId, ProfileId, ResidentId } from "../types";

export interface ProfileDef {
  id: ProfileId;
  icon: string;
  name: string;
  text: string;
  hoursPerWeek: number;
  lobbySlots: number;
  money?: number;
  fixedCosts?: number;
  approval?: Partial<Record<ResidentId, number>>;
  all?: number;
  flags?: string[];
}

export const PROFILES: ProfileDef[] = [
  {
    id: "novato",
    icon: "🙋",
    name: "Novato",
    text: "Nunca foi síndico na vida. Sem vantagem, sem desvantagem.",
    hoursPerWeek: 3,
    lobbySlots: 2,
  },
  {
    id: "aposentado",
    icon: "🧓",
    name: "Aposentado",
    text: "Tempo de sobra: 4 horas livres por semana. Os mais velhos te adoram, os jovens acham você chato.",
    hoursPerWeek: 4,
    lobbySlots: 2,
    approval: { cida: 10, osvaldo: 8, neide: 5, kelly: -8, marcao: -8 },
  },
  {
    id: "advogado",
    icon: "⚖️",
    name: "Advogado",
    text: "Conhece o regimento de cor. O Dr. Valdemar te respeita e nunca vai te processar. O Marcão te acha um saco.",
    hoursPerWeek: 3,
    lobbySlots: 2,
    approval: { valdemar: 25, marcao: -8, kelly: -4 },
    flags: ["perfil_advogado"],
  },
  {
    id: "influencer",
    icon: "📸",
    name: "Ex-BBB",
    text: "Famoso no bairro. A Kelly é sua fã e você convence qualquer um no corredor (3 conversas por assembleia). O Doutor te despreza.",
    hoursPerWeek: 3,
    lobbySlots: 3,
    approval: { kelly: 25, marcao: 6, valdemar: -10, cida: -5 },
  },
  {
    id: "contador",
    icon: "🧮",
    name: "Contador",
    text: "Renegociou os contratos no primeiro dia: +R$ 3.000 no caixa e −R$ 300/mês de custos. Mas ninguém acha contador simpático.",
    hoursPerWeek: 3,
    lobbySlots: 2,
    money: 3000,
    fixedCosts: -300,
    all: -4,
  },
];

export const PROFILES_BY_ID = Object.fromEntries(PROFILES.map((p) => [p.id, p])) as Record<ProfileId, ProfileDef>;

export interface DifficultyDef {
  id: DifficultyId;
  icon: string;
  name: string;
  text: string;
  monthlyWear: number;
  extraEventChance: number;
  money: number;
}

export const DIFFICULTIES: DifficultyDef[] = [
  { id: "tranquilo", icon: "☕", name: "Tranquilo", text: "Menos problemas, moradores mais pacientes.", monthlyWear: 2, extraEventChance: 0.15, money: 1000 },
  { id: "normal", icon: "🏢", name: "Normal", text: "Um prédio brasileiro típico.", monthlyWear: 3, extraEventChance: 0.35, money: 0 },
  { id: "caotico", icon: "🔥", name: "Caótico", text: "Tudo quebra, todo mundo reclama, o caixa é menor.", monthlyWear: 4, extraEventChance: 0.65, money: -1000 },
];

export const DIFFICULTIES_BY_ID = Object.fromEntries(DIFFICULTIES.map((d) => [d.id, d])) as Record<DifficultyId, DifficultyDef>;
