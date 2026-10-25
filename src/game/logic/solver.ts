import { CHAPTERS, chestAtStart } from "../content/chapters";
import { ITEM_IDS, NPC_IDS, type ItemId, type NpcId } from "../content/ids";
import { cloneHoldings, count, has, isValidHoldings, move } from "./holdings";
import type { ChapterInstance, Holdings, Role } from "./types";

/**
 * Abstract model of a chapter's material transitions (SPEC §7): who holds
 * what, roles, and mission flags. Conversation details (journal, memory,
 * wording) are irrelevant to solvability and are left out, which keeps the
 * search tiny. Tests check that plans found here also complete through the
 * real interaction API.
 */
export interface AbstractState {
  holdings: Holdings;
  roles: Partial<Record<NpcId, Role>>;
  flags: Record<string, boolean>;
}

/** One material transition. `npc`/`spot` say where the player has to go. */
export type AbstractAction =
  | { kind: "collect"; spot: string }
  | { kind: "trade"; npc: NpcId }
  | { kind: "gift"; npc: NpcId }
  | { kind: "intro"; npc: NpcId }
  | { kind: "deliver"; npc: NpcId }
  | { kind: "lostGiven"; npc: NpcId }
  | { kind: "return"; npc: NpcId }
  | { kind: "teacherReward"; npc: NpcId }
  | { kind: "openSeaChest" }
  | { kind: "askGive"; npc: NpcId }
  | { kind: "borrow"; npc: NpcId }
  | { kind: "deposit"; items: ItemId[] }
  | { kind: "teaser" };

export interface Transition {
  action: AbstractAction;
  next: AbstractState;
}

const npcsWithRoles = (s: AbstractState) => NPC_IDS.filter((n) => s.roles[n]);

/** Targets still missing from the Festival Chest. */
export function remainingTargets(inst: ChapterInstance, h: Holdings): ItemId[] {
  const already = chestAtStart(inst.chapter);
  return inst.targets.filter((t) => count(h, "chest", t) <= already.filter((a) => a === t).length);
}

/** The chapter's non-deposit missions are complete (SPEC §3.4 Mayor rule). */
export function missionsDone(inst: ChapterInstance, flags: Record<string, boolean>, roles: Partial<Record<NpcId, Role>>): boolean {
  for (const npc of NPC_IDS) {
    const r = roles[npc] ?? inst.roles[npc];
    if (!r) continue;
    if (r.kind === "requester" && !flags[`done:${npc}`]) return false;
    if (r.kind === "teacher" && !flags.teacherRewarded) return false;
    if (r.kind === "askGiver" && !flags[`gave:${npc}`]) return false;
    if (r.kind === "borrower" && !flags[`borrowed:${npc}`]) return false;
  }
  return true;
}

export function spotActive(inst: ChapterInstance, spotId: string, flags: Record<string, boolean>): boolean {
  const def = inst.spots.find((s) => s.id === spotId);
  if (!def || def.kind === "distractor") return false;
  return !def.requires || !!flags[def.requires];
}

function studentsAllReturned(s: AbstractState): boolean {
  return npcsWithRoles(s).every((n) => s.roles[n]!.kind !== "student" || s.flags[`returned:${n}`]);
}

/** Every material transition available from `s`. */
export function transitions(inst: ChapterInstance, s: AbstractState): Transition[] {
  const out: Transition[] = [];
  const h = s.holdings;
  const push = (action: AbstractAction, holdings: Holdings, roles = s.roles, flags = s.flags) =>
    out.push({ action, next: { holdings, roles, flags } });
  const withFlag = (k: string) => ({ ...s.flags, [k]: true });

  for (const spot of inst.spots) {
    if (!spotActive(inst, spot.id, s.flags)) continue;
    const holder = `spot:${spot.id}` as const;
    if (has(h, holder, spot.item)) push({ kind: "collect", spot: spot.id }, move(h, spot.item, holder, "player"));
  }

  for (const npc of npcsWithRoles(s)) {
    const r = s.roles[npc]!;
    switch (r.kind) {
      case "trader":
        if (has(h, "player", r.want) && has(h, npc, r.offer)) {
          const h2 = move(move(h, r.want, "player", npc), r.offer, npc, "player");
          push({ kind: "trade", npc }, h2, { ...s.roles, [npc]: { kind: "trader", offer: r.want, want: r.offer } });
        }
        break;
      case "giver":
        if (!s.flags[`gave:${npc}`] && has(h, npc, r.item))
          push({ kind: "gift", npc }, move(h, r.item, npc, "player"), s.roles, withFlag(`gave:${npc}`));
        break;
      case "requester": {
        if (r.intro && !s.flags.libraryStarted) {
          if (!has(h, "player", r.need)) push({ kind: "intro", npc }, h, s.roles, withFlag("libraryStarted"));
          break;
        }
        if (s.flags[`done:${npc}`] || !has(h, "player", r.need, r.count)) break;
        let h2 = move(h, r.need, "player", npc, r.count);
        let flags = withFlag(`done:${npc}`);
        if ("item" in r.reward) {
          if (!has(h2, npc, r.reward.item)) break;
          h2 = move(h2, r.reward.item, npc, "player");
        } else flags = { ...flags, seaUnlocked: true };
        push({ kind: "deliver", npc }, h2, s.roles, flags);
        break;
      }
      case "teacher":
        if (!s.flags.lostGiven) {
          let h2 = h;
          for (const it of r.lost) h2 = move(h2, it, npc, "player");
          push({ kind: "lostGiven", npc }, h2, s.roles, withFlag("lostGiven"));
        } else if (!s.flags.teacherRewarded && studentsAllReturned(s) && has(h, npc, r.reward) && !has(h, "player", r.reward)) {
          push({ kind: "teacherReward", npc }, move(h, r.reward, npc, "player"), s.roles, withFlag("teacherRewarded"));
        }
        break;
      case "student":
        if (s.flags.lostGiven && !s.flags[`returned:${npc}`] && has(h, "player", r.lost))
          push({ kind: "return", npc }, move(h, r.lost, "player", npc), s.roles, withFlag(`returned:${npc}`));
        break;
      case "askGiver":
        if (!s.flags[`gave:${npc}`] && has(h, npc, r.item) && !has(h, "player", r.item))
          push({ kind: "askGive", npc }, move(h, r.item, npc, "player"), s.roles, withFlag(`gave:${npc}`));
        break;
      case "borrower":
        if (!s.flags[`borrowed:${npc}`] && has(h, "player", r.item)) push({ kind: "borrow", npc }, h, s.roles, withFlag(`borrowed:${npc}`));
        break;
      default:
        break;
    }
  }

  if (inst.seaChest && s.flags.seaUnlocked && !s.flags.seaOpened && has(h, "seaChest", "stapler"))
    push({ kind: "openSeaChest" }, move(h, "stapler", "seaChest", "player"), s.roles, { ...s.flags, seaOpened: true });

  // Deposits at the Mayor.
  const remaining = remainingTargets(inst, h);
  if (inst.chapter === 1) {
    if (remaining.includes("pencil") && has(h, "player", "pencil"))
      push({ kind: "deposit", items: ["pencil"] }, move(h, "pencil", "player", "chest"));
    else if (!remaining.includes("pencil") && remaining.includes("eraser") && has(h, "player", "eraser") && missionsDone(inst, s.flags, s.roles))
      push({ kind: "deposit", items: ["eraser"] }, move(h, "eraser", "player", "chest"));
    else if (remaining.length === 0 && !s.flags.teaserDone) push({ kind: "teaser" }, h, s.roles, withFlag("teaserDone"));
  } else if (remaining.length > 0 && remaining.every((t) => has(h, "player", t)) && missionsDone(inst, s.flags, s.roles)) {
    let h2 = h;
    for (const t of remaining) h2 = move(h2, t, "player", "chest");
    push({ kind: "deposit", items: remaining }, h2);
  }
  return out;
}

export function isGoal(inst: ChapterInstance, s: AbstractState): boolean {
  if (remainingTargets(inst, s.holdings).length > 0) return false;
  return inst.chapter !== 1 || !!s.flags.teaserDone;
}

function key(s: AbstractState): string {
  const holders = Object.keys(s.holdings).sort();
  const hs = holders
    .map((k) => {
      const inv = s.holdings[k as keyof Holdings]!;
      const items = ITEM_IDS.filter((i) => (inv[i] ?? 0) > 0).map((i) => `${i}${inv[i]}`);
      return items.length ? `${k}:${items.join(",")}` : "";
    })
    .filter(Boolean)
    .join("|");
  const rs = NPC_IDS.filter((n) => s.roles[n]?.kind === "trader")
    .map((n) => {
      const r = s.roles[n] as { offer: ItemId; want: ItemId };
      return `${n}>${r.offer}/${r.want}`;
    })
    .join("|");
  const fs = Object.keys(s.flags).filter((k) => s.flags[k]).sort().join(",");
  return `${hs}#${rs}#${fs}`;
}

export function initialAbstract(inst: ChapterInstance): AbstractState {
  const holdings = cloneHoldings(inst.holdings);
  const chest = chestAtStart(inst.chapter);
  if (chest.length) {
    const inv = { ...(holdings.chest ?? {}) };
    for (const c of chest) inv[c] = (inv[c] ?? 0) + 1;
    holdings.chest = inv;
  }
  return { holdings, roles: { ...inst.roles }, flags: {} };
}

export interface SolveResult {
  solvable: boolean;
  /** Shortest action sequence from start to goal. */
  plan: AbstractAction[];
  reachable: number;
  /** Reachable states from which the goal can no longer be reached. */
  deadEnds: number;
}

/** Breadth-first search over every reachable abstract state. */
export function solve(inst: ChapterInstance, start: AbstractState = initialAbstract(inst), limit = 20000): SolveResult {
  const states = new Map<string, AbstractState>();
  const parent = new Map<string, { from: string; action: AbstractAction } | null>();
  const edges = new Map<string, string[]>();
  const k0 = key(start);
  states.set(k0, start);
  parent.set(k0, null);
  const queue = [k0];
  const goals: string[] = [];
  while (queue.length) {
    const k = queue.shift()!;
    const s = states.get(k)!;
    if (isGoal(inst, s)) {
      goals.push(k);
      edges.set(k, []);
      continue;
    }
    const outs: string[] = [];
    for (const t of transitions(inst, s)) {
      const nk = key(t.next);
      outs.push(nk);
      if (!states.has(nk)) {
        if (states.size >= limit) throw new Error(`state limit exceeded for chapter ${inst.chapter}`);
        states.set(nk, t.next);
        parent.set(nk, { from: k, action: t.action });
        queue.push(nk);
      }
    }
    edges.set(k, outs);
  }

  // Backward reachability from goals.
  const reverse = new Map<string, string[]>();
  for (const [from, outs] of edges) for (const to of outs) (reverse.get(to) ?? reverse.set(to, []).get(to)!).push(from);
  const canFinish = new Set(goals);
  const stack = [...goals];
  while (stack.length) {
    const k = stack.pop()!;
    for (const p of reverse.get(k) ?? []) if (!canFinish.has(p)) {
      canFinish.add(p);
      stack.push(p);
    }
  }
  const deadEnds = [...states.keys()].filter((k) => !canFinish.has(k)).length;

  const plan: AbstractAction[] = [];
  if (goals.length) {
    // BFS order: the first goal found is a shortest one.
    let k: string | undefined = goals[0];
    while (k) {
      const p = parent.get(k);
      if (!p) break;
      plan.unshift(p.action);
      k = p.from;
    }
  }
  return { solvable: goals.length > 0, plan, reachable: states.size, deadEnds };
}

export interface Validation {
  ok: boolean;
  reasons: string[];
  minTransactions: number;
}

/** Expected shortest-plan length per chapter (SPEC §6 bands). */
export const BANDS: Record<number, number> = { 1: 7, 2: 4, 3: 11, 4: 5, 5: 4 };

/** Consistency rules of SPEC §7.1. */
export function consistencyProblems(inst: ChapterInstance): string[] {
  const p: string[] = [];
  const h = inst.holdings;
  if (!isValidHoldings(h)) p.push("invalid holdings");
  const cards = new Set<ItemId>([...CHAPTERS[inst.chapter].cards, ...CHAPTERS[inst.chapter].targets]);
  if (inst.chapter === 1) ["pencil", "eraser", "pen"].forEach((i) => cards.add(i as ItemId));
  const targets = new Set(inst.targets);
  for (const t of inst.targets) if (has(h, "player", t)) p.push(`player starts with target ${t}`);
  for (const npc of NPC_IDS) {
    const r = inst.roles[npc];
    if (!r) continue;
    const need = (it: ItemId, why: string) => {
      if (!cards.has(it)) p.push(`${npc} ${why} ${it} outside chapter vocabulary`);
    };
    switch (r.kind) {
      case "trader":
        if (!has(h, npc, r.offer)) p.push(`${npc} does not hold its offer ${r.offer}`);
        if (has(h, npc, r.want)) p.push(`${npc} holds what it wants (${r.want})`);
        if (r.offer === r.want) p.push(`${npc} wants its own offer`);
        if (targets.has(r.want)) p.push(`${npc} wants a chapter target (${r.want})`);
        need(r.offer, "offers");
        need(r.want, "wants");
        break;
      case "giver":
        if (!has(h, npc, r.item)) p.push(`${npc} does not hold its gift ${r.item}`);
        break;
      case "requester":
        if ("item" in r.reward && !has(h, npc, r.reward.item)) p.push(`${npc} does not hold its reward`);
        if (targets.has(r.need)) {
          if (!(r.intro && r.need === "notebook")) p.push(`${npc} needs a chapter target (${r.need})`);
        }
        if (!("item" in r.reward) && !inst.seaChest) p.push(`${npc} unlocks a sea chest that does not exist`);
        need(r.need, "needs");
        break;
      case "teacher":
        for (const it of r.lost) if (!has(h, npc, it)) p.push(`${npc} does not hold lost ${it}`);
        if (!has(h, npc, r.reward)) p.push(`${npc} does not hold its reward`);
        if (r.lost.some((i) => targets.has(i))) p.push("a lost item is a chapter target");
        if (new Set(r.lost).size !== r.lost.length) p.push("lost items repeat");
        break;
      case "student": {
        if (has(h, npc, r.lost)) p.push(`${npc} holds the item it lost`);
        const teacher = NPC_IDS.map((n) => inst.roles[n]).find((x) => x?.kind === "teacher") as { lost: ItemId[] } | undefined;
        if (teacher) for (const it of teacher.lost) if (it !== r.lost && !has(h, npc, it)) p.push(`${npc} should hold ${it}`);
        break;
      }
      default:
        break;
    }
  }
  const students = NPC_IDS.filter((n) => inst.roles[n]?.kind === "student");
  if (students.length) {
    const lostSet = new Set(students.map((n) => (inst.roles[n] as { lost: ItemId }).lost));
    if (lostSet.size !== students.length) p.push("two students lost the same item");
  }
  for (const spot of inst.spots) {
    const holder = `spot:${spot.id}` as const;
    if (spot.kind === "distractor") {
      if (Object.keys(h[holder] ?? {}).length) p.push(`distractor ${spot.id} holds items`);
    } else if (!has(h, holder, spot.item)) p.push(`spot ${spot.id} is empty`);
  }
  if (inst.seaChest) {
    if (!inst.seaChest.includes("stapler")) p.push("sea chest has no stapler");
    if (new Set(inst.seaChest).size !== 3) p.push("sea chest silhouettes repeat");
    for (const it of inst.seaChest) if (!has(h, "seaChest", it)) p.push(`sea chest lacks ${it}`);
  }
  return p;
}

/** Full validation (SPEC §7): consistency, solvable, band, no dead ends. */
export function validate(inst: ChapterInstance): Validation {
  const reasons = consistencyProblems(inst);
  let minTransactions = 0;
  try {
    const r = solve(inst);
    if (!r.solvable) reasons.push("unsolvable");
    if (r.deadEnds > 0) reasons.push(`${r.deadEnds} dead-end states`);
    minTransactions = r.plan.length;
    if (r.solvable && minTransactions !== BANDS[inst.chapter])
      reasons.push(`shortest plan ${minTransactions} outside band ${BANDS[inst.chapter]}`);
  } catch (e) {
    reasons.push(String(e));
  }
  return { ok: reasons.length === 0, reasons, minTransactions };
}
