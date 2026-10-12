import { EVENTS, EVENTS_BY_ID } from "./data/events";
import { PAUTAS, PAUTAS_BY_ID } from "./data/pautas";
import { RESIDENTS, RESIDENTS_BY_ID, RESIDENT_IDS } from "./data/residents";
import {
  AssemblyState,
  Effects,
  Ending,
  GameState,
  MonthReport,
  Requirements,
  ResidentId,
  Sender,
  Votes,
} from "./types";

export const WEEKS_PER_MONTH = 4;
export const MONTHS = 6;
export const TOTAL_WEEKS = WEEKS_PER_MONTH * MONTHS;
export const HOURS_PER_WEEK = 3;
export const MAJORITY = 5; // de 8 apartamentos
const MAX_PENDING = 6;
const CONDITION_DECAY = 4;
// Desgaste natural do cargo: todo mês o prédio fica um pouco mais impaciente.
const MONTHLY_WEAR = 3;
const DEFAULT_APPROVAL_THRESHOLD = 20; // abaixo disso o morador para de pagar "em protesto"
const REMOVAL_THRESHOLD = 40;
const REELECTION_THRESHOLD = 50;

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

function hasFlag(s: GameState, flag: string) {
  return s.flags.includes(flag);
}

function pushChat(s: GameState, from: Sender, text: string) {
  s.chat.push({ id: s.chat.length + 1, week: s.week, from, text });
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
  return true;
}

function meets(s: GameState, req?: Requirements) {
  if (!req) return true;
  if (req.flags && !req.flags.every((f) => hasFlag(s, f))) return false;
  if (req.notFlags && req.notFlags.some((f) => hasFlag(s, f))) return false;
  if (req.minWeek !== undefined && s.week < req.minWeek) return false;
  if (req.maxCondition !== undefined && s.condition > req.maxCondition) return false;
  return true;
}

// ---------- efeitos e reações ----------

function applyEffects(s: GameState, eff: Effects): Partial<Record<ResidentId, number>> {
  if (eff.money) s.money += eff.money;
  if (eff.condition) s.condition = clamp(s.condition + eff.condition);
  if (eff.fee) s.fee += eff.fee;
  if (eff.fixedCosts) s.fixedCosts = Math.max(0, s.fixedCosts + eff.fixedCosts);

  const deltas: Partial<Record<ResidentId, number>> = {};
  for (const r of RESIDENTS) {
    let d = (eff.all ?? 0) + (eff.residents?.[r.id] ?? 0);
    for (const [tag, value] of Object.entries(eff.tags ?? {})) {
      d += (r.likes[tag as keyof typeof r.likes] ?? 0) * (value ?? 0);
    }
    d = Math.round(d);
    if (d === 0) continue;
    const before = s.approval[r.id];
    s.approval[r.id] = clamp(before + d);
    const real = s.approval[r.id] - before;
    if (real !== 0) deltas[r.id] = real;
  }

  for (const f of eff.setFlags ?? []) if (!hasFlag(s, f)) s.flags.push(f);
  if (eff.clearFlags) s.flags = s.flags.filter((f) => !eff.clearFlags!.includes(f));
  for (const line of eff.chat ?? []) pushChat(s, line.from, line.text);

  return deltas;
}

// Os moradores mais afetados comentam no grupo.
function react(s: GameState, deltas: Partial<Record<ResidentId, number>>, max = 2) {
  const strongest = (Object.entries(deltas) as [ResidentId, number][])
    .filter(([id, d]) => Math.abs(d) >= 6 && !(id === "neide" && hasFlag(s, "neide_removida")))
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, max);
  for (const [id, d] of strongest) {
    const lines = RESIDENTS_BY_ID[id].reactions[d > 0 ? "good" : "bad"];
    pushChat(s, id, pick(s, lines));
  }
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
    // consequências apareçam logo depois da decisão que as causou.
    const weightOf = (e: (typeof candidates)[number]) => (e.weight ?? 1) * (e.requires?.flags ? 3 : 1);
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
  s.hours = HOURS_PER_WEEK;
  drawEvents(s, 2 + (rand(s) < 0.35 ? 1 : 0));
}

// ---------- API pública ----------

export function createGame(seed: number): GameState {
  const s: GameState = {
    rng: seed >>> 0,
    week: 1,
    hours: HOURS_PER_WEEK,
    money: 4000,
    condition: 60,
    fee: 600,
    fixedCosts: 3600,
    approval: Object.fromEntries(RESIDENTS.map((r) => [r.id, r.startApproval])) as Record<ResidentId, number>,
    flags: [],
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
  };
  pushChat(s, "sistema", "Você foi eleito síndico do Edifício Primavera por 1 voto. O antigo síndico se mudou sem avisar ninguém.");
  pushChat(s, "neide", "Sejam bem-vindos ao novo síndico!!! 🌸🌸 Qualquer coisa estamos aqui 😊");
  pushChat(s, "valdemar", "Recontagem de votos solicitada. Até lá, boa sorte.");
  pushChat(s, "marcao", "🤘");
  // Primeira semana fixa, funciona como tutorial: um pedido simpático e um problema.
  addEvent(s, "bolo_cida");
  addEvent(s, "bateria_23h");
  return s;
}

export function chooseOption(state: GameState, uid: number, choiceIndex: number): GameState {
  if (state.phase !== "week") return state;
  const pending = state.pending.find((p) => p.uid === uid);
  if (!pending) return state;
  const ev = EVENTS_BY_ID[pending.eventId];
  const choice = ev.choices[choiceIndex];
  if (!choice || choice.hours > state.hours) return state;

  const s = clone(state);
  s.hours -= choice.hours;
  s.pending = s.pending.filter((p) => p.uid !== uid);
  const moneyBefore = s.money;
  const conditionBefore = s.condition;
  const deltas = applyEffects(s, choice.effects);
  pushChat(s, "sistema", `✅ ${ev.title}: ${choice.result}`);
  react(s, deltas);
  s.lastOutcome = {
    title: ev.title,
    result: choice.result,
    money: s.money - moneyBefore,
    condition: s.condition - conditionBefore,
    deltas,
  };
  return s;
}

export function dismissOutcome(state: GameState): GameState {
  return { ...state, lastOutcome: null };
}

export function endWeek(state: GameState): GameState {
  if (state.phase !== "week") return state;
  const s = clone(state);
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
    const deltas = applyEffects(s, ev.expire.effects);
    pushChat(s, "sistema", `⏰ ${ev.title}: ${ev.expire.result}`);
    react(s, deltas, 1);
  }
  s.pending = stillPending;

  // A Neide é a dona do grupo: o humor dela contamina todo mundo um pouquinho.
  if (!hasFlag(s, "neide_removida")) {
    const shift = Math.round((s.approval.neide - 50) * 0.06);
    if (shift !== 0) {
      for (const id of RESIDENT_IDS) if (id !== "neide") s.approval[id] = clamp(s.approval[id] + shift);
      if (Math.abs(shift) >= 2) {
        pushChat(s, "neide", shift > 0 ? "Gente, sinceramente, esse síndico tá de parabéns 👏" : "Gente... vocês também tão achando estranho esse síndico? 👀");
      }
    }
  }

  if (weekOfMonth(s) === WEEKS_PER_MONTH) {
    const report = closeMonth(s);
    if (s.phase === "ended") return s;
    if (currentMonth(s) >= MONTHS) {
      finalElection(s);
      return s;
    }
    s.phase = "assembly";
    s.assembly = { month: currentMonth(s), offered: offerPautas(s), report };
    return s;
  }

  s.week += 1;
  startWeek(s);
  return s;
}

function closeMonth(s: GameState): MonthReport {
  const payers = RESIDENT_IDS.filter((id) => isPaying(s, id));
  const defaulters = RESIDENT_IDS.filter((id) => !payers.includes(id));
  const income = payers.length * s.fee;
  const costs = s.fixedCosts;
  s.money += income - costs;
  s.condition = clamp(s.condition - CONDITION_DECAY);
  for (const id of RESIDENT_IDS) s.approval[id] = clamp(s.approval[id] - MONTHLY_WEAR);

  pushChat(
    s,
    "sistema",
    `📊 Fechamento do mês ${currentMonth(s)}: entrou R$ ${income.toLocaleString("pt-BR")}, saiu R$ ${costs.toLocaleString("pt-BR")}. Caixa: R$ ${s.money.toLocaleString("pt-BR")}.`,
  );

  if (s.condition < 40) {
    for (const id of RESIDENT_IDS) s.approval[id] = clamp(s.approval[id] - 2);
    pushChat(s, "valdemar", "O prédio está caindo aos pedaços. Fica registrado.");
  }

  s.negativeMonths = s.money < 0 ? s.negativeMonths + 1 : 0;
  if (s.negativeMonths >= 2) {
    s.phase = "ended";
    s.ending = {
      kind: "falido",
      title: "Condomínio falido",
      text: "Dois meses seguidos no vermelho. A administradora assumiu, o banco bloqueou a conta e você foi afastado. O Dr. Valdemar assumiu 'em caráter emergencial'.",
    };
  }

  return { month: currentMonth(s), income, costs, payers: payers.length, defaulters, conditionLoss: CONDITION_DECAY };
}

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

// Voto de cada morador numa pauta: interesse pessoal + confiança no síndico.
export function predictVote(s: GameState, pautaId: string, id: ResidentId): boolean {
  const p = PAUTAS_BY_ID[pautaId];
  const r = RESIDENTS_BY_ID[id];
  let score = (s.approval[id] - 50) / 12;
  for (const [tag, value] of Object.entries(p.leaning)) {
    score += (r.likes[tag as keyof typeof r.likes] ?? 0) * (value ?? 0);
  }
  return score > 0;
}

export function holdAssembly(state: GameState, pautaId: string | null): GameState {
  if (state.phase !== "assembly" || !state.assembly || state.assembly.result) return state;
  const s = clone(state);
  const a = s.assembly as AssemblyState;

  if (pautaId) {
    const p = PAUTAS_BY_ID[pautaId];
    const votes: Votes = {};
    for (const id of RESIDENT_IDS) votes[id] = predictVote(s, pautaId, id);
    const yes = Object.values(votes).filter(Boolean).length;
    // Empate 4x4: o síndico desempata com o voto de minerva.
    const minerva = yes === RESIDENT_IDS.length / 2;
    const passed = yes >= MAJORITY || minerva;
    const outcome = passed ? p.yes : p.no;
    const deltas = applyEffects(s, outcome.effects);
    if (passed && !p.repeatable) s.usedPautas.push(p.id);
    pushChat(s, "sistema", `🗳️ Assembleia: "${p.title}" ${passed ? "APROVADA" : "REJEITADA"} (${yes} x ${RESIDENT_IDS.length - yes}).`);
    react(s, deltas);
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
      s.phase = "ended";
      s.ending = {
        kind: "destituido",
        title: "Destituído!",
        text: `${count} de 8 apartamentos votaram pela sua saída. O Dr. Valdemar assumiu a sindicância e já marcou uma auditoria das suas contas.`,
        votes,
      };
    } else {
      pushChat(s, "valdemar", `Pedido de destituição derrotado por pouco (${count} votos). Fica o aviso.`);
    }
  }
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

function finalElection(s: GameState) {
  const votes: Votes = {};
  for (const id of RESIDENT_IDS) votes[id] = s.approval[id] >= REELECTION_THRESHOLD;
  let count = Object.values(votes).filter(Boolean).length;
  let tiebreak = "";
  if (count === RESIDENT_IDS.length / 2) {
    const won = rand(s) < 0.5;
    tiebreak = won ? " Empate! Desempate no par ou ímpar... e você ganhou." : " Empate! Desempate no par ou ímpar... e o Doutor ganhou.";
    if (won) count += 1;
  }
  const won = count >= MAJORITY;
  let ending: Ending;
  if (won) {
    const text =
      count === RESIDENT_IDS.length
        ? "Unanimidade. Até o Dr. Valdemar votou em você (e pediu pra ninguém contar)."
        : `Você foi reeleito com ${count} votos. Mais dois anos de grupo do WhatsApp pela frente.`;
    ending = { kind: "reeleito", title: "Reeleito!", text: text + tiebreak, votes };
  } else {
    ending = {
      kind: "derrotado",
      title: "Fim de mandato",
      text: `Você teve ${Object.values(votes).filter(Boolean).length} votos. O Dr. Valdemar é o novo síndico. Seu primeiro ato: proibir bolo nas áreas comuns.${tiebreak}`,
      votes,
    };
  }
  s.phase = "ended";
  s.ending = ending;
}
