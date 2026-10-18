import { ACHIEVEMENTS } from "./data/achievements";
import { ACTIONS_BY_ID, UPGRADES_BY_ID } from "./data/actions";
import { EPILOGUES, EPILOGUE_ORDER, SPECIAL_ENDINGS } from "./data/endings";
import { EVENTS, EVENTS_BY_ID } from "./data/events";
import { PAUTAS, PAUTAS_BY_ID } from "./data/pautas";
import { DIFFICULTIES_BY_ID, PROFILES_BY_ID } from "./data/profiles";
import { RESIDENTS, RESIDENTS_BY_ID, RESIDENT_IDS, TAG_LABELS } from "./data/residents";
import {
  AssemblyState,
  Deltas,
  DifficultyId,
  EndCondition,
  Effects,
  Ending,
  EpilogueLine,
  GameState,
  MonthReport,
  ProfileId,
  Requirements,
  ResidentId,
  Sender,
  Tag,
  Votes,
} from "./types";

export const STATE_VERSION = 3;
export const WEEKS_PER_MONTH = 4;
export const MONTHS = 6;
export const TOTAL_WEEKS = WEEKS_PER_MONTH * MONTHS;
export const MAJORITY = 5; // de 8 apartamentos
const MAX_PENDING = 6;
const CONDITION_DECAY = 4;
const DEFAULT_APPROVAL_THRESHOLD = 20; // abaixo disso o morador para de pagar "em protesto"
const REMOVAL_THRESHOLD = 40;
const REELECTION_THRESHOLD = 50;
const LOBBY_BONUS = 3; // peso de uma conversa de corredor no voto
const VISIT_BONUS = 3;
const VISIT_CAP = 70; // visita não convence quem já te adora
const UPGRADE_HOURS = 1;
export const VISIT_HOURS = 1;

// ---------- utilidades ----------

// mulberry32: RNG determinístico salvo no próprio estado, pra partida ser
// reproduzível (e o mesmo algoritmo é trivial de portar pra C#).
function rand(s: GameState): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function pick<T>(s: GameState, items: T[]): T {
  return items[Math.floor(rand(s) * items.length)];
}

function clamp(v: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

function clone(state: GameState): GameState {
  return structuredClone(state);
}

export function hasFlag(s: GameState, flag: string) {
  return s.flags.includes(flag);
}

function pushChat(s: GameState, from: Sender, text: string) {
  s.chat.push({ id: s.chat.length + 1, week: s.week, from, text });
}

function bump(s: GameState, id: ResidentId, d: number) {
  s.approval[id] = clamp(s.approval[id] + d);
}

export function currentMonth(s: GameState) {
  return Math.ceil(s.week / WEEKS_PER_MONTH);
}

export function weekOfMonth(s: GameState) {
  return ((s.week - 1) % WEEKS_PER_MONTH) + 1;
}

export function averageApproval(s: GameState) {
  return RESIDENT_IDS.reduce((sum, id) => sum + s.approval[id], 0) / RESIDENT_IDS.length;
}

// Quantos votariam em você se a eleição fosse hoje.
export function electionForecast(s: GameState) {
  return RESIDENT_IDS.filter((id) => s.approval[id] >= REELECTION_THRESHOLD).length;
}

export function isPaying(s: GameState, id: ResidentId) {
  if (s.approval[id] < DEFAULT_APPROVAL_THRESHOLD) return false;
  if (id === "osvaldo") return hasFlag(s, "osvaldo_acordo") || hasFlag(s, "osvaldo_pagou");
  if (id === "patricia") return !hasFlag(s, "patricia_atraso");
  return true;
}

function meets(s: GameState, req?: Requirements) {
  if (!req) return true;
  if (req.flags && !req.flags.every((f) => hasFlag(s, f))) return false;
  if (req.anyFlags && !req.anyFlags.some((f) => hasFlag(s, f))) return false;
  if (req.notFlags && req.notFlags.some((f) => hasFlag(s, f))) return false;
  if (req.minWeek !== undefined && s.week < req.minWeek) return false;
  if (req.maxCondition !== undefined && s.condition > req.maxCondition) return false;
  if (req.minMoney !== undefined && s.money < req.minMoney) return false;
  if (req.approvalBelow) {
    for (const [id, limit] of Object.entries(req.approvalBelow)) {
      if (s.approval[id as ResidentId] >= (limit ?? 0)) return false;
    }
  }
  return true;
}

// ---------- efeitos e reações ----------

interface Applied {
  deltas: Deltas;
  reasons: Partial<Record<ResidentId, string>>;
}

function applyEffects(s: GameState, eff: Effects, directReason = "Pessoal"): Applied {
  if (eff.money) s.money += eff.money;
  if (eff.condition) s.condition = clamp(s.condition + eff.condition);
  if (eff.fee) s.fee += eff.fee;
  if (eff.fixedCosts) s.fixedCosts = Math.max(0, s.fixedCosts + eff.fixedCosts);

  const deltas: Deltas = {};
  const reasons: Partial<Record<ResidentId, string>> = {};
  for (const r of RESIDENTS) {
    // Cada parcela da mudança, pra descobrir o motivo principal.
    const parts: [string, number][] = [];
    const direct = (eff.all ?? 0) + (eff.residents?.[r.id] ?? 0);
    if (direct) parts.push([directReason, direct]);
    for (const [tag, value] of Object.entries(eff.tags ?? {})) {
      const w = r.likes[tag as Tag] ?? 0;
      if (w && value) {
        const t = TAG_LABELS[tag as Tag];
        parts.push([`${t.icon} ${t.label}`, w * value]);
      }
    }
    const d = Math.round(parts.reduce((sum, [, v]) => sum + v, 0));
    if (d === 0) continue;
    const before = s.approval[r.id];
    s.approval[r.id] = clamp(before + d);
    const real = s.approval[r.id] - before;
    if (real === 0) continue;
    deltas[r.id] = real;
    // Motivo = a parcela que mais pesou na mesma direção da mudança.
    const main = parts.filter(([, v]) => Math.sign(v) === Math.sign(real)).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
    if (main) reasons[r.id] = main[0];
  }

  for (const f of eff.setFlags ?? []) if (!hasFlag(s, f)) s.flags.push(f);
  if (eff.clearFlags) s.flags = s.flags.filter((f) => !eff.clearFlags!.includes(f));
  for (const line of eff.chat ?? []) pushChat(s, line.from, line.text);

  return { deltas, reasons };
}

// Os moradores mais afetados comentam no grupo.
function react(s: GameState, deltas: Deltas, max = 2) {
  const strongest = (Object.entries(deltas) as [ResidentId, number][])
    .filter(([id, d]) => Math.abs(d) >= 6 && !(id === "neide" && hasFlag(s, "neide_removida")))
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, max);
  for (const [id, d] of strongest) {
    const lines = RESIDENTS_BY_ID[id].reactions[d > 0 ? "good" : "bad"];
    pushChat(s, id, pick(s, lines));
  }
}

// Registra a variação de aprovação desde `before`, pra animação no prédio.
function recordFx(s: GameState, before: Record<ResidentId, number>) {
  const deltas: Deltas = {};
  for (const id of RESIDENT_IDS) {
    const d = Math.round(s.approval[id] - before[id]);
    if (d !== 0) deltas[id] = d;
  }
  s.fx = { tick: s.fx.tick + 1, deltas };
}

function setOutcome(s: GameState, title: string, result: string, moneyBefore: number, conditionBefore: number, applied: Applied) {
  s.lastOutcome = {
    title,
    result,
    money: s.money - moneyBefore,
    condition: s.condition - conditionBefore,
    deltas: applied.deltas,
    reasons: applied.reasons,
  };
}

// ---------- eventos ----------

function addEvent(s: GameState, eventId: string) {
  const ev = EVENTS_BY_ID[eventId];
  s.pending.push({ uid: s.nextUid++, eventId, weeksLeft: ev.deadline });
  if (!s.seen.includes(eventId)) s.seen.push(eventId);
}

function drawEvents(s: GameState, count: number) {
  for (let i = 0; i < count && s.pending.length < MAX_PENDING; i++) {
    const pendingIds = new Set(s.pending.map((p) => p.eventId));
    const candidates = EVENTS.filter(
      (e) => !pendingIds.has(e.id) && (e.repeatable || !s.seen.includes(e.id)) && meets(s, e.requires),
    );
    if (candidates.length === 0) return;
    // Continuações (eventos que dependem de flag) pesam mais, pra que as
    // consequências apareçam logo depois da decisão que as causou. Eventos
    // repetíveis pesam menos, pra não tomarem o lugar das histórias novas.
    const weightOf = (e: (typeof candidates)[number]) =>
      (e.weight ?? 1) * (e.requires?.flags || e.requires?.anyFlags ? 3 : 1) * (e.repeatable ? 0.5 : 1);
    const total = candidates.reduce((sum, e) => sum + weightOf(e), 0);
    let roll = rand(s) * total;
    let chosen = candidates[candidates.length - 1];
    for (const e of candidates) {
      roll -= weightOf(e);
      if (roll <= 0) {
        chosen = e;
        break;
      }
    }
    addEvent(s, chosen.id);
  }
}

function startWeek(s: GameState) {
  s.hours = s.config.hoursPerWeek;
  drawEvents(s, 2 + (rand(s) < s.config.extraEventChance ? 1 : 0));
}

// ---------- criação ----------

export function createGame(seed: number, profileId: ProfileId = "novato", difficultyId: DifficultyId = "normal"): GameState {
  const profile = PROFILES_BY_ID[profileId];
  const difficulty = DIFFICULTIES_BY_ID[difficultyId];
  const s: GameState = {
    version: STATE_VERSION,
    config: {
      profile: profileId,
      difficulty: difficultyId,
      hoursPerWeek: profile.hoursPerWeek,
      lobbySlots: profile.lobbySlots,
      monthlyWear: difficulty.monthlyWear,
      extraEventChance: difficulty.extraEventChance,
    },
    rng: seed >>> 0,
    week: 1,
    hours: profile.hoursPerWeek,
    money: 4000 + (profile.money ?? 0) + difficulty.money,
    condition: 60,
    fee: 600,
    fixedCosts: 3600 + (profile.fixedCosts ?? 0),
    approval: Object.fromEntries(RESIDENTS.map((r) => [r.id, r.startApproval])) as Record<ResidentId, number>,
    flags: [...(profile.flags ?? [])],
    seen: [],
    usedPautas: [],
    pending: [],
    nextUid: 1,
    chat: [],
    phase: "week",
    negativeMonths: 0,
    lastOutcome: null,
    assembly: null,
    ending: null,
    actionsUsed: {},
    visitedMonth: {},
    stats: { resolved: 0, expired: 0, lobbied: 0, upgrades: 0, passedPautas: 0 },
    fx: { tick: 0, deltas: {} },
    decisions: [],
  };
  for (const id of RESIDENT_IDS) bump(s, id, (profile.approval?.[id] ?? 0) + (profile.all ?? 0));

  pushChat(s, "sistema", "Você foi eleito síndico do Edifício Primavera por 1 voto. O antigo síndico se mudou sem avisar ninguém.");
  pushChat(s, "neide", "Sejam bem-vindos ao novo síndico!!! 🌸🌸 Qualquer coisa estamos aqui 😊");
  pushChat(s, "valdemar", "Recontagem de votos solicitada. Até lá, boa sorte.");
  pushChat(s, "marcao", "🤘");
  // Primeira semana fixa, funciona como tutorial: um pedido simpático e um problema.
  addEvent(s, "bolo_cida");
  addEvent(s, "bateria_23h");
  return s;
}

// ---------- semana: pendências, ações, visitas, melhorias ----------

export function chooseOption(state: GameState, uid: number, choiceIndex: number): GameState {
  if (state.phase !== "week") return state;
  const pending = state.pending.find((p) => p.uid === uid);
  if (!pending) return state;
  const ev = EVENTS_BY_ID[pending.eventId];
  const choice = ev.choices[choiceIndex];
  if (!choice || choice.hours > state.hours) return state;

  const s = clone(state);
  const before = { ...s.approval };
  const moneyBefore = s.money;
  const conditionBefore = s.condition;
  s.hours -= choice.hours;
  s.pending = s.pending.filter((p) => p.uid !== uid);
  s.stats.resolved += 1;
  const applied = applyEffects(s, choice.effects);
  pushChat(s, "sistema", `✅ ${ev.title}: ${choice.result}`);
  react(s, applied.deltas);
  setOutcome(s, ev.title, choice.result, moneyBefore, conditionBefore, applied);
  recordDecision(s, ev.title, choice.label, applied.deltas, s.money - moneyBefore);
  recordFx(s, before);
  return s;
}

// Guarda a decisão com um "peso" (quanto mexeu com o prédio), pro resumo do mandato.
function recordDecision(s: GameState, title: string, choice: string, deltas: Deltas, money: number) {
  const impact = Object.values(deltas).reduce((sum, d) => sum + Math.abs(d ?? 0), 0) + Math.abs(money) / 250;
  s.decisions.push({ week: s.week, title, choice, impact: Math.round(impact) });
}

// Partida salva numa versão anterior: completa os campos novos.
export function migrateState(raw: GameState): GameState | null {
  if (!raw || typeof raw.version !== "number") return null;
  if (raw.version === 2) return { ...raw, version: STATE_VERSION, decisions: [] };
  return raw.version === STATE_VERSION ? raw : null;
}

function periodKey(s: GameState, limit: "week" | "month") {
  return limit === "week" ? s.week : currentMonth(s);
}

// Por que a ação não pode ser feita agora (ou null se pode).
export function actionBlocker(s: GameState, actionId: string): string | null {
  const a = ACTIONS_BY_ID[actionId];
  if (s.phase !== "week") return "fora do expediente";
  if (s.actionsUsed[actionId] === periodKey(s, a.limit)) return a.limit === "week" ? "já fez esta semana" : "já fez este mês";
  if (a.hours > s.hours) return "sem horas livres";
  if (!meets(s, a.requires)) return "indisponível";
  return null;
}

export function doAction(state: GameState, actionId: string): GameState {
  if (actionBlocker(state, actionId)) return state;
  const a = ACTIONS_BY_ID[actionId];
  const s = clone(state);
  const before = { ...s.approval };
  const moneyBefore = s.money;
  const conditionBefore = s.condition;
  s.hours -= a.hours;
  s.actionsUsed[actionId] = periodKey(s, a.limit);
  const applied = applyEffects(s, a.effects);
  pushChat(s, "sistema", `${a.icon} ${a.label}: ${a.result}`);
  react(s, applied.deltas, 1);
  setOutcome(s, a.label, a.result, moneyBefore, conditionBefore, applied);
  recordFx(s, before);
  return s;
}

export function visitBlocker(s: GameState, id: ResidentId): string | null {
  if (s.phase !== "week") return "fora do expediente";
  if (s.visitedMonth[id] === currentMonth(s)) return "já visitou este mês";
  if (s.approval[id] >= VISIT_CAP) return "já te adora";
  if (s.hours < VISIT_HOURS) return "sem horas livres";
  return null;
}

const VISIT_LINES: Record<ResidentId, string> = {
  cida: "Café, bolo e duas horas de história do prédio. Ela adorou.",
  rafael: "Você segurou o bebê pra eles tomarem banho. Heróis não usam capa.",
  valdemar: "Ele te mostrou a coleção de códigos civis. Foi... uma visita.",
  kelly: "Você apareceu num story. 'Meu síndico é um amor 💖'.",
  marcao: "Ele te mostrou a música nova. É sobre você. É boa, até.",
  neide: "Você ouviu todas as fofocas da semana. Agora ela te considera 'da turma'.",
  osvaldo: "Dominó na varanda. Você perdeu de propósito.",
  patricia: "O Thor te lambeu inteiro. As crianças te mostraram os desenhos.",
};

export function visitResident(state: GameState, id: ResidentId): GameState {
  if (visitBlocker(state, id)) return state;
  const s = clone(state);
  const before = { ...s.approval };
  s.hours -= VISIT_HOURS;
  s.visitedMonth[id] = currentMonth(s);
  // O Doutor é osso duro: visita rende menos.
  const applied = applyEffects(s, { residents: { [id]: id === "valdemar" ? 2 : VISIT_BONUS } }, "🚪 Visita");
  const r = RESIDENTS_BY_ID[id];
  setOutcome(s, `Visita a ${r.name}`, VISIT_LINES[id], s.money, s.condition, applied);
  recordFx(s, before);
  return s;
}

export function hasUpgrade(s: GameState, upgradeId: string) {
  return hasFlag(s, `melhoria_${upgradeId}`);
}

export function upgradeBlocker(s: GameState, upgradeId: string): string | null {
  const u = UPGRADES_BY_ID[upgradeId];
  if (hasUpgrade(s, upgradeId)) return "já feita";
  if (s.phase !== "week") return "fora do expediente";
  if (s.money < u.cost) return "falta dinheiro";
  if (s.hours < UPGRADE_HOURS) return "sem horas livres";
  return null;
}

export function buyUpgrade(state: GameState, upgradeId: string): GameState {
  if (upgradeBlocker(state, upgradeId)) return state;
  const u = UPGRADES_BY_ID[upgradeId];
  const s = clone(state);
  const before = { ...s.approval };
  const moneyBefore = s.money;
  const conditionBefore = s.condition;
  s.hours -= UPGRADE_HOURS;
  s.money -= u.cost;
  s.stats.upgrades += 1;
  const applied = applyEffects(s, { ...u.effects, setFlags: [...(u.effects.setFlags ?? []), `melhoria_${u.id}`] });
  pushChat(s, "sistema", `${u.icon} Melhoria: ${u.result}`);
  react(s, applied.deltas, 1);
  setOutcome(s, u.name, u.result, moneyBefore, conditionBefore, applied);
  recordFx(s, before);
  return s;
}

export function dismissOutcome(state: GameState): GameState {
  return { ...state, lastOutcome: null };
}

// ---------- fim de semana e de mês ----------

// Mecânicas próprias de alguns moradores, rodam toda semana.
function residentRoutines(s: GameState) {
  // A Neide é a dona do grupo: o humor dela contamina todo mundo um pouquinho.
  if (!hasFlag(s, "neide_removida")) {
    const shift = Math.round((s.approval.neide - 50) * 0.06);
    if (shift !== 0) {
      for (const id of RESIDENT_IDS) if (id !== "neide") bump(s, id, shift);
      if (Math.abs(shift) >= 2) {
        pushChat(s, "neide", shift > 0 ? "Gente, sinceramente, esse síndico tá de parabéns 👏" : "Gente... vocês também tão achando estranho esse síndico? 👀");
      }
    }
  }

  // Stories da Kelly, semana sim, semana não.
  if (s.week % 2 === 0) {
    if (s.approval.kelly >= 70) {
      for (const id of RESIDENT_IDS) if (id !== "kelly") bump(s, id, 1);
      pushChat(s, "kelly", "Story novo: 'meu prédio tem o melhor síndico do Brasil 💖✨' (12 mil views)");
    } else if (s.approval.kelly <= 30) {
      for (const id of RESIDENT_IDS) if (id !== "kelly") bump(s, id, -1);
      pushChat(s, "kelly", "Story novo: 'gente, deixa eu contar sobre o síndico do meu prédio... 🙄' (15 mil views)");
    }
  }

  // Ensaio do Marcão, a não ser que exista regra do silêncio ou estúdio.
  if (!hasFlag(s, "lei_silencio") && !hasFlag(s, "melhoria_estudio")) {
    bump(s, "rafael", -1);
    bump(s, "cida", -1);
    if (weekOfMonth(s) === 2) pushChat(s, "marcao", "Ensaio hoje às 21h, quem quiser colar 🥁🤘");
  }

  // Bolo da Dona Cida, uma vez por mês, se ela estiver feliz.
  if (weekOfMonth(s) === 3 && s.approval.cida >= 75) {
    for (const id of RESIDENT_IDS) if (id !== "cida") bump(s, id, 1);
    pushChat(s, "cida", "Deixei bolo de fubá na portaria pra todo mundo, viu? 🥰");
  }
}

export function endWeek(state: GameState): GameState {
  if (state.phase !== "week") return state;
  const s = clone(state);
  const before = { ...s.approval };
  s.lastOutcome = null;

  // Pendências que venceram explodem com a consequência de "ninguém fez nada".
  const stillPending = [];
  for (const p of s.pending) {
    p.weeksLeft -= 1;
    if (p.weeksLeft > 0) {
      stillPending.push(p);
      continue;
    }
    const ev = EVENTS_BY_ID[p.eventId];
    s.stats.expired += 1;
    const applied = applyEffects(s, ev.expire.effects);
    pushChat(s, "sistema", `⏰ ${ev.title}: ${ev.expire.result}`);
    react(s, applied.deltas, 1);
  }
  s.pending = stillPending;

  residentRoutines(s);

  if (weekOfMonth(s) === WEEKS_PER_MONTH) {
    const report = closeMonth(s);
    recordFx(s, before);
    if (s.phase === "ended") return s;
    if (currentMonth(s) >= MONTHS) {
      finalElection(s);
      return s;
    }
    s.phase = "assembly";
    s.assembly = { month: currentMonth(s), offered: offerPautas(s), report, lobbied: [] };
    return s;
  }

  s.week += 1;
  startWeek(s);
  recordFx(s, before);
  return s;
}

function closeMonth(s: GameState): MonthReport {
  const payers = RESIDENT_IDS.filter((id) => isPaying(s, id));
  const defaulters = RESIDENT_IDS.filter((id) => !payers.includes(id));
  const income = payers.length * s.fee;
  const costs = s.fixedCosts;
  s.money += income - costs;
  s.condition = clamp(s.condition - CONDITION_DECAY);
  // Desgaste natural do cargo: todo mês o prédio fica um pouco mais impaciente.
  for (const id of RESIDENT_IDS) bump(s, id, -s.config.monthlyWear);

  pushChat(
    s,
    "sistema",
    `📊 Fechamento do mês ${currentMonth(s)}: entrou R$ ${income.toLocaleString("pt-BR")}, saiu R$ ${costs.toLocaleString("pt-BR")}. Caixa: R$ ${s.money.toLocaleString("pt-BR")}.`,
  );

  if (s.condition < 40) {
    for (const id of RESIDENT_IDS) bump(s, id, -2);
    pushChat(s, "valdemar", "O prédio está caindo aos pedaços. Fica registrado.");
  }

  // Campanha da oposição: o Doutor convence quem já está em dúvida.
  if (hasFlag(s, "oposicao_ativa")) {
    for (const id of RESIDENT_IDS) if (id !== "valdemar" && s.approval[id] < 50) bump(s, id, -2);
    pushChat(s, "valdemar", "A chapa Ordem e Regimento segue visitando os apartamentos. Contem conosco.");
  }

  s.negativeMonths = s.money < 0 ? s.negativeMonths + 1 : 0;
  if (s.negativeMonths >= 2) {
    endGame(s, {
      kind: "falido",
      title: "Condomínio falido",
      text: "Dois meses seguidos no vermelho. A administradora assumiu, o banco bloqueou a conta e você foi afastado. O Dr. Valdemar assumiu 'em caráter emergencial'.",
    });
  }

  return { month: currentMonth(s), income, costs, payers: payers.length, defaulters, conditionLoss: CONDITION_DECAY };
}

// ---------- assembleia ----------

function offerPautas(s: GameState): string[] {
  const eligible = PAUTAS.filter((p) => meets(s, p.requires) && (p.repeatable || !s.usedPautas.includes(p.id)));
  const requested = eligible.filter((p) => p.requires?.flags);
  const others = eligible.filter((p) => !p.requires?.flags);
  // embaralha as genéricas
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(rand(s) * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  return [...requested, ...others].slice(0, 3).map((p) => p.id);
}

// Voto de cada morador numa pauta: interesse pessoal + confiança no síndico
// + conversa de corredor, se houve.
export function predictVote(s: GameState, pautaId: string, id: ResidentId): boolean {
  const p = PAUTAS_BY_ID[pautaId];
  const r = RESIDENTS_BY_ID[id];
  let score = (s.approval[id] - 50) / 12;
  for (const [tag, value] of Object.entries(p.leaning)) {
    score += (r.likes[tag as Tag] ?? 0) * (value ?? 0);
  }
  if (s.assembly?.lobbied.includes(id)) score += LOBBY_BONUS;
  return score > 0;
}

export function selectPauta(state: GameState, pautaId: string | null): GameState {
  if (state.phase !== "assembly" || !state.assembly || state.assembly.result || state.assembly.selected !== undefined) return state;
  const s = clone(state);
  s.assembly!.selected = pautaId;
  return s;
}

export function lobbyResident(state: GameState, id: ResidentId): GameState {
  const a = state.assembly;
  if (state.phase !== "assembly" || !a || a.result || !a.selected) return state;
  if (a.lobbied.includes(id) || a.lobbied.length >= state.config.lobbySlots) return state;
  const s = clone(state);
  s.assembly!.lobbied.push(id);
  s.stats.lobbied += 1;
  return s;
}

export function holdAssembly(state: GameState): GameState {
  const a0 = state.assembly;
  if (state.phase !== "assembly" || !a0 || a0.result || a0.selected === undefined) return state;
  const s = clone(state);
  const before = { ...s.approval };
  const a = s.assembly as AssemblyState;
  const pautaId = a.selected ?? null;

  if (pautaId) {
    const p = PAUTAS_BY_ID[pautaId];
    const votes: Votes = {};
    for (const id of RESIDENT_IDS) votes[id] = predictVote(s, pautaId, id);
    const yes = Object.values(votes).filter(Boolean).length;
    // Empate 4x4: o síndico desempata com o voto de minerva.
    const minerva = yes === RESIDENT_IDS.length / 2;
    const passed = yes >= MAJORITY || minerva;
    const outcome = passed ? p.yes : p.no;
    const applied = applyEffects(s, outcome.effects);
    if (passed) {
      s.stats.passedPautas += 1;
      if (!p.repeatable) s.usedPautas.push(p.id);
    }
    pushChat(s, "sistema", `🗳️ Assembleia: "${p.title}" ${passed ? "APROVADA" : "REJEITADA"} (${yes} x ${RESIDENT_IDS.length - yes}).`);
    react(s, applied.deltas);
    recordDecision(s, `Assembleia do mês ${a.month}`, `${p.title}: ${passed ? "aprovada" : "rejeitada"}`, applied.deltas, outcome.effects.money ?? 0);
    a.result = { pautaId, votes, passed, minerva, text: outcome.result };
  } else {
    applyEffects(s, { all: 1 });
    a.result = {
      pautaId: null,
      votes: {},
      passed: false,
      minerva: false,
      text: "Assembleia sem pauta. Acabou em 15 minutos. Teve gente que agradeceu.",
    };
  }

  // Se o prédio estiver insatisfeito, alguém pede a destituição do síndico.
  if (averageApproval(s) < REMOVAL_THRESHOLD) {
    const votes: Votes = {};
    for (const id of RESIDENT_IDS) votes[id] = s.approval[id] < REMOVAL_THRESHOLD;
    const count = Object.values(votes).filter(Boolean).length;
    const removed = count >= MAJORITY;
    a.removal = { votes, removed };
    if (removed) {
      endGame(s, {
        kind: "destituido",
        title: "Destituído!",
        text: `${count} de 8 apartamentos votaram pela sua saída. O Dr. Valdemar assumiu a sindicância e já marcou uma auditoria das suas contas.`,
        votes,
      });
    } else {
      pushChat(s, "valdemar", `Pedido de destituição derrotado por pouco (${count} votos). Fica o aviso.`);
    }
  }
  recordFx(s, before);
  return s;
}

export function closeAssembly(state: GameState): GameState {
  if (state.phase !== "assembly" || !state.assembly?.result) return state;
  const s = clone(state);
  s.phase = "week";
  s.assembly = null;
  s.week += 1;
  startWeek(s);
  return s;
}

// ---------- fim de jogo ----------

const DIFFICULTY_MULTIPLIER: Record<DifficultyId, number> = { tranquilo: 0.8, normal: 1, caotico: 1.3 };

export function computeScore(s: GameState) {
  const won = s.ending?.kind === "reeleito";
  const raw =
    averageApproval(s) * 10 +
    Math.max(0, s.money) / 10 +
    s.condition * 5 +
    electionForecast(s) * 60 +
    Math.min(s.week, TOTAL_WEEKS) * 10 +
    (won ? 1000 : 0);
  return Math.round(raw * DIFFICULTY_MULTIPLIER[s.config.difficulty]);
}

export function matchesEnd(s: GameState, kind: Ending["kind"], votes: number, c?: EndCondition) {
  if (!c) return true;
  if (c.kinds && !c.kinds.includes(kind)) return false;
  if (c.flags && !c.flags.every((f) => hasFlag(s, f))) return false;
  if (c.anyFlags && !c.anyFlags.some((f) => hasFlag(s, f))) return false;
  if (c.notFlags && c.notFlags.some((f) => hasFlag(s, f))) return false;
  for (const [id, v] of Object.entries(c.minApproval ?? {})) if (s.approval[id as ResidentId] < (v ?? 0)) return false;
  for (const [id, v] of Object.entries(c.maxApproval ?? {})) if (s.approval[id as ResidentId] > (v ?? 100)) return false;
  if (c.minCondition !== undefined && s.condition < c.minCondition) return false;
  if (c.maxCondition !== undefined && s.condition > c.maxCondition) return false;
  if (c.minUpgrades !== undefined && s.stats.upgrades < c.minUpgrades) return false;
  if (c.minVotes !== undefined && votes < c.minVotes) return false;
  return true;
}

function buildEpilogue(s: GameState, kind: Ending["kind"], votes: number): EpilogueLine[] {
  return EPILOGUE_ORDER.map((who) => {
    const variant = EPILOGUES.find((e) => e.who === who && matchesEnd(s, kind, votes, e.when));
    return { who, text: variant?.text ?? "" };
  }).filter((l) => l.text);
}

function endGame(s: GameState, ending: Omit<Ending, "score" | "achievements" | "endingId" | "epilogue">) {
  s.phase = "ended";
  const votes = Object.values(ending.votes ?? {}).filter(Boolean).length;
  s.ending = { ...ending, endingId: ending.kind, score: 0, achievements: [], epilogue: [] };
  const special = SPECIAL_ENDINGS.find((e) => matchesEnd(s, ending.kind, votes, e.when));
  if (special) {
    s.ending.endingId = special.id;
    s.ending.icon = special.icon;
    s.ending.title = special.title;
    s.ending.text = special.text;
  }
  s.ending.epilogue = buildEpilogue(s, ending.kind, votes);
  s.ending.score = computeScore(s);
  s.ending.achievements = ACHIEVEMENTS.filter((a) => a.check(s)).map((a) => a.id);
}

function finalElection(s: GameState) {
  const votes: Votes = {};
  for (const id of RESIDENT_IDS) votes[id] = s.approval[id] >= REELECTION_THRESHOLD;
  // Subsíndico leal: se o Doutor aceitou o cargo, vota em você.
  if (hasFlag(s, "valdemar_subsindico") && s.approval.valdemar >= 35) votes.valdemar = true;
  let count = Object.values(votes).filter(Boolean).length;
  let tiebreak = "";
  if (count === RESIDENT_IDS.length / 2) {
    const won = rand(s) < 0.5;
    tiebreak = won ? " Empate! Desempate no par ou ímpar... e você ganhou." : " Empate! Desempate no par ou ímpar... e o Doutor ganhou.";
    if (won) count += 1;
  }
  if (count >= MAJORITY) {
    const text =
      count === RESIDENT_IDS.length
        ? "Unanimidade. Até o Dr. Valdemar votou em você (e pediu pra ninguém contar)."
        : `Você foi reeleito com ${count} votos. Mais dois anos de grupo do WhatsApp pela frente.`;
    endGame(s, { kind: "reeleito", title: "Reeleito!", text: text + tiebreak, votes });
  } else {
    endGame(s, {
      kind: "derrotado",
      title: "Fim de mandato",
      text: `Você teve ${Object.values(votes).filter(Boolean).length} votos. O Dr. Valdemar é o novo síndico. Seu primeiro ato: proibir bolo nas áreas comuns.${tiebreak}`,
      votes,
    });
  }
}
