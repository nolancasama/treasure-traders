import type { ItemId, NpcId } from "../content/ids";
import { has } from "./holdings";
import { answer, ask, collect, talk } from "./interact";
import { solve, type AbstractAction, type AbstractState } from "./solver";
import type { GameState, Prompt, Step, Target } from "./types";

/**
 * Concrete steps a player performs, derived from the solver's shortest plan.
 * Unit tests run them through the real interaction API; the e2e hook hands
 * them to Playwright, which performs them through the UI.
 */
export type Intent =
  | { kind: "talk"; target: Target }
  | { kind: "ask"; target: Target; item: ItemId }
  | { kind: "answer"; target: Target }
  | { kind: "collect"; spot: string };

function abstractOf(s: GameState): AbstractState {
  return { holdings: s.holdings, roles: s.roles, flags: s.flags };
}

/** The remaining shortest plan from a live state. */
export function remainingPlan(s: GameState): AbstractAction[] {
  return solve(s.instance, abstractOf(s)).plan;
}

/** Intents for one abstract action (answers are truthful and decided at run time). */
export function intentsFor(s: GameState, a: AbstractAction): Intent[] {
  switch (a.kind) {
    case "collect":
      return [{ kind: "collect", spot: a.spot }];
    case "trade": {
      const r = s.roles[a.npc];
      if (r?.kind !== "trader") return [];
      return [{ kind: "ask", target: a.npc, item: r.offer }, { kind: "answer", target: a.npc }];
    }
    case "gift": {
      const r = s.roles[a.npc];
      return r?.kind === "giver" ? [{ kind: "ask", target: a.npc, item: r.item }] : [];
    }
    case "return": {
      const r = s.roles[a.npc];
      return r?.kind === "student" ? [{ kind: "ask", target: a.npc, item: r.lost }] : [];
    }
    case "lostGiven":
      return [{ kind: "talk", target: a.npc }];
    case "intro":
    case "deliver":
    case "teacherReward":
    case "askGive":
    case "borrow":
      return [{ kind: "talk", target: a.npc }, { kind: "answer", target: a.npc }];
    case "openSeaChest":
      return [{ kind: "talk", target: "seaChest" }, ...(s.instance.seaChest ?? []).map((item) => ({ kind: "ask" as const, target: "seaChest" as const, item }))];
    case "deposit":
      return [{ kind: "talk", target: "pom" }, { kind: "answer", target: "pom" }];
    case "teaser":
      return [{ kind: "talk", target: "pom" }, { kind: "answer", target: "pom" }];
  }
}

/** The truthful answer to a pending answer prompt. */
export function truthfulAnswer(s: GameState, p: Prompt): "yes" | "no" {
  if (!p || p.kind !== "answer") throw new Error("no answer prompt");
  return has(s.holdings, "player", p.item, p.count) ? "yes" : "no";
}

/**
 * Runs one intent through the API. An "answer" intent answers the pending
 * prompt truthfully; a "talk" whose prompt is already open is skipped.
 */
export function runIntent(step: Step, intent: Intent): Step {
  const s = step.state;
  switch (intent.kind) {
    case "collect":
      return collect(s, intent.spot);
    case "talk":
      if (step.prompt?.kind === "answer" && step.prompt.target === intent.target) return step;
      return talk(s, intent.target);
    case "ask":
      return ask(s, intent.target, intent.item);
    case "answer": {
      const p = step.prompt;
      if (!p || p.kind !== "answer") throw new Error(`expected an answer prompt for ${intent.target}`);
      return answer(s, p.target, p.questionId, truthfulAnswer(s, p));
    }
  }
}

/** Plays the whole remaining chapter by the solver's plan; returns every step. */
export function autoplayChapter(state: GameState, maxActions = 60): Step[] {
  const steps: Step[] = [];
  let step: Step = { state, beats: [], prompt: null };
  for (let guard = 0; guard < maxActions && !step.state.chapterComplete; guard++) {
    const plan = remainingPlan(step.state);
    if (!plan.length) throw new Error(`no plan from chapter ${step.state.chapter} state`);
    for (const intent of intentsFor(step.state, plan[0])) {
      const next = runIntent(step, intent);
      // A skipped "talk" (its question is already open) returns the same step.
      if (next !== step) steps.push(next);
      step = next;
    }
  }
  if (!step.state.chapterComplete) throw new Error(`chapter ${state.chapter} did not complete`);
  return steps;
}

export type { NpcId };
