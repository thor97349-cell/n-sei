import { GameState } from "../types";

export interface AchievementDef {
  id: string;
  icon: string;
  title: string;
  text: string;
  check: (s: GameState) => boolean;
}

const won = (s: GameState) => s.ending?.kind === "reeleito";
const votes = (s: GameState) => Object.values(s.ending?.votes ?? {}).filter(Boolean).length;
const flag = (s: GameState, f: string) => s.flags.includes(f);

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "reeleito", icon: "🏆", title: "Mais dois anos", text: "Ganhar a reeleição.", check: won },
  { id: "unanimidade", icon: "👑", title: "Unanimidade", text: "Ser reeleito com os 8 votos.", check: (s) => won(s) && votes(s) === 8 },
  { id: "caotico", icon: "🔥", title: "Sobrevivente do caos", text: "Ser reeleito no modo Caótico.", check: (s) => won(s) && s.config.difficulty === "caotico" },
  { id: "taxa", icon: "💰", title: "Taxa congelada", text: "Terminar os 6 meses sem aumentar a taxa.", check: (s) => s.week >= 24 && s.fee <= 600 },
  { id: "impecavel", icon: "✨", title: "Prédio impecável", text: "Terminar com conservação de 80% ou mais.", check: (s) => s.week >= 24 && s.condition >= 80 },
  { id: "caixa", icon: "🏦", title: "Cofre cheio", text: "Terminar com R$ 10.000 ou mais no caixa.", check: (s) => s.week >= 24 && s.money >= 10000 },
  { id: "pacificador", icon: "🕊️", title: "Nada explodiu", text: "Chegar ao fim sem deixar nenhuma pendência vencer.", check: (s) => s.week >= 24 && s.stats.expired === 0 },
  { id: "ze", icon: "👨🏽‍✈️", title: "O Zé fica", text: "Terminar com o Zé feliz na portaria.", check: (s) => s.week >= 24 && flag(s, "ze_feliz") && !flag(s, "sem_ze") },
  { id: "detetive", icon: "🕵️", title: "Detetive", text: "Fazer o antigo síndico devolver o dinheiro.", check: (s) => flag(s, "gilberto_condenado") },
  { id: "cupido", icon: "💍", title: "Cupido", text: "Casar o Marcão com a Kelly.", check: (s) => flag(s, "cupido") },
  { id: "doutor", icon: "👨🏻‍⚖️", title: "Conquistou o Doutor", text: "Terminar com o Dr. Valdemar acima de 70%.", check: (s) => s.week >= 24 && s.approval.valdemar >= 70 },
  { id: "rock", icon: "🤘", title: "Síndico rock'n'roll", text: "Terminar com o Marcão acima de 90%.", check: (s) => s.approval.marcao >= 90 },
  { id: "construtor", icon: "🏗️", title: "Construtor", text: "Fazer 4 melhorias no prédio.", check: (s) => s.stats.upgrades >= 4 },
  { id: "politico", icon: "🗣️", title: "Político de corredor", text: "Fazer 8 conversas de corredor numa partida.", check: (s) => s.stats.lobbied >= 8 },
  { id: "falido", icon: "💸", title: "Quebrou o prédio", text: "Levar o condomínio à falência.", check: (s) => s.ending?.kind === "falido" },
];

export const ACHIEVEMENTS_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a])) as Record<string, AchievementDef>;
