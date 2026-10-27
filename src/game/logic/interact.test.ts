import { describe, expect, it } from "vitest";
import { ITEM_IDS, NPC_IDS, type ItemId, type NpcId } from "../content/ids";
import { count, has, sameTotals } from "./holdings";
import { answer, ask, collect, talk } from "./interact";
import { indicators, objectives } from "./objectives";
import { autoplayChapter, runIntent, intentsFor, remainingPlan } from "./plan";
import { makeRng } from "./rng";
import { newCampaign, nextChapter, startChapter, replayChapter } from "./state";
import type { Beat, GameEvent, GameState, Step } from "./types";

const events = (steps: Step[]): GameEvent[] =>
  steps.flatMap((s) => s.beats.filter((b): b is Extract<Beat, { kind: "event" }> => b.kind === "event").map((b) => b.event));

const startTotals = (s: GameState) => structuredClone(s.holdings);

/** The pending question id of an answer prompt. */
function qid(step: Step): string {
  if (step.prompt?.kind !== "answer") throw new Error("expected an answer prompt");
  return step.prompt.questionId;
}

function playCampaign(seed: number) {
  let state = newCampaign(seed);
  const all: Step[] = [];
  for (let ch = 1; ch <= 5; ch++) {
    expect(state.chapter).toBe(ch);
    const before = startTotals(state);
    const steps = autoplayChapter(state);
    all.push(...steps);
    const end = steps[steps.length - 1].state;
    expect(sameTotals(before, end.holdings), `items conserved in chapter ${ch}`).toBe(true);
    expect(end.chapterComplete).toBe(true);
    if (ch < 5) state = nextChapter(end)!;
    else state = end;
  }
  return { state, steps: all };
}

describe("full campaign through the real API", () => {
  it("plays chapters 1-5 to the finale for many campaign seeds", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const { state, steps } = playCampaign(seed * 97);
      expect(state.finished).toBe(true);
      expect(state.completedChapters).toEqual([1, 2, 3, 4, 5]);
      const ev = events(steps);
      const deposits = ev.filter((e) => e.type === "chestDeposit").map((e) => (e as { total: number }).total);
      expect(deposits).toEqual([1, 2, 4, 6, 8, 9]);
      expect(ev.filter((e) => e.type === "decorationLevel").map((e) => (e as { count: number }).count)).toEqual([2, 4, 6, 8, 9]);
      expect(ev.filter((e) => e.type === "areaUnlocked").map((e) => (e as { district: string }).district)).toEqual(["market", "school", "harbor", "festival"]);
      expect(ev.filter((e) => e.type === "finale")).toHaveLength(1);
      expect(state.holdings.chest).toEqual(Object.fromEntries(ITEM_IDS.map((i) => [i, 1])));
    }
  }, 30_000);

  it("gives every reward exactly once, even when saved and reloaded after every step", () => {
    let state = startChapter(3, { mode: "campaign", campaignSeed: 5 });
    let step: Step = { state, beats: [], prompt: null };
    const onceIds: string[] = [];
    while (!step.state.chapterComplete) {
      const plan = remainingPlan(step.state);
      for (const intent of intentsFor(step.state, plan[0])) {
        step = runIntent(step, intent);
        for (const e of events([step])) if ("onceId" in e) onceIds.push(e.onceId);
        // Save and reload between every interaction.
        step = { ...step, state: JSON.parse(JSON.stringify(step.state)) };
      }
    }
    expect(new Set(onceIds).size).toBe(onceIds.length);
  });

  it("ignores a stale or repeated answer", () => {
    const s0 = startChapter(1, { mode: "campaign", campaignSeed: 1 });
    const t = talk(s0, "ume");
    expect(t.prompt?.kind).toBe("answer");
    const id = qid(t);
    const a = answer(t.state, "ume", id, "no");
    expect(count(a.state.holdings, "player", "pen")).toBe(1);
    const again = answer(a.state, "ume", id, "no");
    expect(again.beats).toEqual([]);
    expect(count(again.state.holdings, "player", "pen")).toBe(1);
  });
});

describe("truth (SPEC §3.2)", () => {
  it("NPC answers always match what they hold, across random play", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rand = makeRng(seed);
      const chapter = (2 + (seed % 4)) as 2 | 3 | 4 | 5;
      let step: Step = { state: startChapter(chapter, { mode: "campaign", campaignSeed: seed }), beats: [], prompt: null };
      for (let i = 0; i < 150 && !step.state.chapterComplete; i++) {
        const npcs = NPC_IDS.filter((n) => step.state.roles[n]);
        const npc = npcs[Math.floor(rand() * npcs.length)];
        if (step.prompt?.kind === "answer") {
          const said = rand() < 0.5 ? "yes" : "no";
          const p = step.prompt;
          const truthful = (said === "yes") === has(step.state.holdings, "player", p.item, p.count);
          const next = answer(step.state, p.target, p.questionId, said);
          if (!truthful) {
            expect(events([next]).some((e) => e.type === "itemMoved" || e.type === "sticker"), "a lie is never rewarded").toBe(false);
            expect(next.prompt?.kind).toBe("answer");
          }
          step = next;
          continue;
        }
        if (rand() < 0.3) {
          step = talk(step.state, npc);
          continue;
        }
        const item = ITEM_IDS[Math.floor(rand() * ITEM_IDS.length)];
        const before = step.state;
        const truth = step.state.roles[npc]?.kind === "mayor" ? has(before.holdings, "chest", item) : has(before.holdings, npc, item);
        step = ask(step.state, npc, item);
        expect(step.state.journal.facts[npc]?.[item] !== undefined || truth === false).toBe(true);
        const first = step.beats.find((b) => b.kind === "say");
        expect(first && first.kind === "say" && /^Yes/.test(first.en)).toBe(truth);
      }
    }
  });
});

describe("contradictions (SPEC §4.6)", () => {
  it("bag-checks, re-asks, then Kiwi models the sentence; nothing is given for a lie", () => {
    const s0 = startChapter(1, { mode: "campaign", campaignSeed: 1 });
    const t = talk(s0, "ume");
    const lie1 = answer(t.state, "ume", qid(t), "yes");
    const ev1 = events([lie1]);
    expect(ev1.find((e) => e.type === "bagCheck")).toEqual({ type: "bagCheck", item: "pen", has: false });
    expect(ev1.some((e) => e.type === "itemMoved")).toBe(false);
    expect(lie1.beats.some((b) => b.kind === "say" && b.speaker === "kiwi" && b.en === "No, I don't.")).toBe(false);
    const lie2 = answer(lie1.state, "ume", qid(lie1), "yes");
    expect(lie2.beats.some((b) => b.kind === "say" && b.speaker === "kiwi" && b.en === "No, I don't.")).toBe(true);
    const ok = answer(lie2.state, "ume", qid(lie2), "no");
    expect(count(ok.state.holdings, "player", "pen")).toBe(1);
  });
});

describe("trading (SPEC §3.4)", () => {
  it("swaps exactly one item each way and can be undone with the same person", () => {
    const s0 = startChapter(2, { mode: "campaign", campaignSeed: 11 });
    const [penTrader] = NPC_IDS.filter((n) => s0.roles[n]?.kind === "trader" && (s0.roles[n] as { want: ItemId }).want === "pen");
    const offer = (s0.roles[penTrader] as { offer: ItemId }).offer;
    const a = ask(s0, penTrader, offer);
    expect(a.prompt?.kind).toBe("answer");
    const traded = answer(a.state, penTrader, (a.prompt as { questionId: string }).questionId, "yes");
    expect(count(traded.state.holdings, "player", "pen")).toBe(0);
    expect(count(traded.state.holdings, "player", offer)).toBe(1);
    expect(count(traded.state.holdings, penTrader, "pen")).toBe(1);
    expect(traded.state.roles[penTrader]).toEqual({ kind: "trader", offer: "pen", want: offer });
    // Undo: ask about the pen, answer yes to "Do you have a <offer>?".
    const b = ask(traded.state, penTrader, "pen");
    const back = answer(b.state, penTrader, (b.prompt as { questionId: string }).questionId, "yes");
    expect(count(back.state.holdings, "player", "pen")).toBe(1);
    expect(count(back.state.holdings, "player", offer)).toBe(0);
    expect(sameTotals(s0.holdings, back.state.holdings)).toBe(true);
  });

  it("a truthful 'No' to a trade records the want and the trader asks again later", () => {
    const s0 = startChapter(2, { mode: "campaign", campaignSeed: 11 });
    const [other] = NPC_IDS.filter((n) => s0.roles[n]?.kind === "trader" && (s0.roles[n] as { want: ItemId }).want !== "pen");
    const r = s0.roles[other] as { offer: ItemId; want: ItemId };
    const a = ask(s0, other, r.offer);
    const no = answer(a.state, other, (a.prompt as { questionId: string }).questionId, "no");
    expect(no.state.journal.wants[other]).toBe(r.want);
    const t = talk(no.state, other);
    expect(t.prompt).toMatchObject({ kind: "answer", item: r.want });
  });
});

describe("chapter rules", () => {
  it("Chapter 1: the Mayor waits for the eraser until Grandma and Ken are helped", () => {
    let s = startChapter(1, { mode: "campaign", campaignSeed: 1 });
    s = collect(s, "square-pencil").state;
    const t = talk(s, "pom");
    s = answer(t.state, "pom", (t.prompt as { questionId: string }).questionId, "yes").state;
    expect(count(s.holdings, "chest", "pencil")).toBe(1);
    s = collect(s, "square-eraser").state;
    const early = talk(s, "pom");
    expect(early.prompt?.kind).not.toBe("answer");
    expect(objectives(s)[0].id).toBe("ume");
  });

  it("Chapter 2 starts with the pen and the first two deposits", () => {
    const s = startChapter(2, { mode: "campaign", campaignSeed: 3 });
    expect(s.holdings.player).toEqual({ pen: 1 });
    expect(s.holdings.chest).toEqual({ pencil: 1, eraser: 1 });
    expect(s.unlockedAreas).toEqual(["square", "market"]);
  });

  it("Chapter 3: each student says No only to the item they lost", () => {
    for (let seed = 1; seed <= 20; seed++) {
      let s = startChapter(3, { mode: "campaign", campaignSeed: seed });
      s = talk(s, "green").state;
      const students = NPC_IDS.filter((n) => s.roles[n]?.kind === "student");
      const lost = students.map((n) => (s.roles[n] as { lost: ItemId }).lost);
      for (const n of students) {
        for (const item of lost) {
          const r = ask(s, n, item);
          const first = r.beats.find((b) => b.kind === "say")!;
          const mine = (s.roles[n] as { lost: ItemId }).lost === item;
          expect(first.kind === "say" && first.en.startsWith(mine ? "No" : "Yes")).toBe(true);
        }
      }
    }
  });

  it("Chapter 3: the Mayor never takes the library notebooks before Ms. Page has them", () => {
    let s = startChapter(3, { mode: "campaign", campaignSeed: 2 });
    const intro = talk(s, "page");
    s = answer(intro.state, "page", (intro.prompt as { questionId: string }).questionId, "no").state;
    for (const sp of s.instance.spots.filter((x) => x.kind === "hidden")) s = collect(s, sp.id).state;
    expect(count(s.holdings, "player", "notebook")).toBe(3);
    expect(talk(s, "pom").prompt?.kind).not.toBe("answer");
  });

  it("Chapter 4: the sea chest opens only after the Captain, answers truthfully, and gives the stapler once", () => {
    let s = startChapter(4, { mode: "campaign", campaignSeed: 9 });
    expect(talk(s, "seaChest").prompt).toBeNull();
    const bo = s.roles.bo as { need: ItemId };
    const t = talk(s, "bo");
    s = answer(t.state, "bo", (t.prompt as { questionId: string }).questionId, "yes").state;
    expect(s.flags.seaUnlocked).toBe(true);
    expect(count(s.holdings, "bo", bo.need)).toBe(1);
    const wrong = ITEM_IDS.find((i) => !s.instance.seaChest!.includes(i))!;
    const w = ask(s, "seaChest", wrong);
    expect(w.beats[0].kind === "say" && w.beats[0].en).toBe("No, I don't.");
    for (const it of s.instance.seaChest!) s = ask(s, "seaChest", it).state;
    expect(count(s.holdings, "player", "stapler")).toBe(1);
    expect(s.stickers).toContain("anchor");
    s = ask(s, "seaChest", "stapler").state;
    expect(count(s.holdings, "player", "stapler")).toBe(1);
  });

  it("sticker askers reward a truthful answer once and never a lie", () => {
    const s0 = startChapter(2, { mode: "campaign", campaignSeed: 4 });
    const asker = NPC_IDS.find((n) => s0.roles[n]?.kind === "sticker")!;
    expect(indicators(s0)[asker]).toBe("sticker");
    const t = talk(s0, asker);
    const p = t.prompt as { item: ItemId; questionId: string; count: number };
    const truth = has(t.state.holdings, "player", p.item) ? "yes" : "no";
    const lie = answer(t.state, asker, p.questionId, truth === "yes" ? "no" : "yes");
    expect(lie.state.stickers).toEqual([]);
    const lp = lie.prompt as { questionId: string };
    const ok = answer(lie.state, asker, lp.questionId, truth);
    expect(ok.state.stickers).toHaveLength(1);
    expect(talk(ok.state, asker).prompt?.kind).not.toBe("answer");
    expect(indicators(ok.state)[asker]).toBeNull();
  });

  it("objectives always point at something reachable until the chapter is clear", () => {
    for (const ch of [1, 2, 3, 4, 5] as const) {
      const steps = autoplayChapter(startChapter(ch, { mode: "campaign", campaignSeed: 21 }));
      for (const st of steps) {
        if (st.state.chapterComplete) continue;
        const obj = objectives(st.state);
        expect(obj.length, `chapter ${ch}`).toBeGreaterThan(0);
        for (const o of obj) {
          expect(o.hint1.length).toBeGreaterThan(0);
          if (o.target?.kind === "npc") expect(st.state.roles[o.target.id as NpcId], `${o.id}`).toBeDefined();
        }
      }
    }
  });

  it("replays start from the canonical chapter state with their own seed", () => {
    const a = replayChapter(4, 1234);
    const b = replayChapter(4, 4321);
    expect(a.mode).toBe("replay");
    expect(a.holdings.chest).toEqual({ pencil: 1, eraser: 1, ruler: 1, marker: 1, notebook: 1, pencilCase: 1 });
    expect(a.instance).not.toEqual(b.instance);
    const steps = autoplayChapter(a);
    const end = steps[steps.length - 1].state;
    expect(end.chapterComplete).toBe(true);
    expect(nextChapter(end)).toBeNull();
  });
});
