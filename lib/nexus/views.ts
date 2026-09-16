export type ViewId =
  | "overview"
  | "company"
  | "market"
  | "finance"
  | "decisions"
  | "challenges"
  | "advisor"
  | "learn";

export interface NavItem {
  id: ViewId;
  label: string;
  icon: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { id: "overview", label: "Visão geral", icon: "▦" },
      { id: "company", label: "Minha empresa", icon: "🏢" },
      { id: "market", label: "Mercado", icon: "📈" },
      { id: "finance", label: "Finanças", icon: "💰" },
    ],
  },
  {
    label: "Jogar",
    items: [
      { id: "decisions", label: "Decisões", icon: "🎛️" },
      { id: "challenges", label: "Desafios", icon: "🏆" },
    ],
  },
  {
    label: "Crescer",
    items: [
      { id: "advisor", label: "Consultor IA", icon: "🧠" },
      { id: "learn", label: "Aprender", icon: "📘" },
    ],
  },
];
