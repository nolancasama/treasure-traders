import { CAST } from "../content/cast";
import { CHAPTERS } from "../content/chapters";
import { NPC_IDS, type ItemId, type NpcId } from "../content/ids";
import { ITEMS, askSentence } from "../content/items";
import { count, has } from "./holdings";
import { missionsDone, remainingTargets, spotActive } from "./solver";
import type { GameState, Indicator, Objective, ObjectiveTarget, Role } from "./types";

const ja = (i: ItemId) => ITEMS[i].ja;
const who = (n: NpcId) => CAST[n].ja;
const npcT = (id: NpcId): ObjectiveTarget => ({ kind: "npc", id });

function holderOf(s: GameState, item: ItemId): NpcId | null {
  return NPC_IDS.find((n) => s.roles[n] && has(s.holdings, n, item)) ?? null;
}

function spotOf(s: GameState, item: ItemId): string | null {
  const spot = s.instance.spots.find((sp) => sp.item === item && sp.kind !== "distractor" && has(s.holdings, `spot:${sp.id}`, item));
  return spot ? spot.id : null;
}

function talkTo(id: string, npc: NpcId, en: string, jaText: string): Objective {
  return {
    id,
    en,
    ja: jaText,
    target: npcT(npc),
    hint1: `${who(npc)}をさがして、話しかけよう！`,
    hint2: `${who(npc)}のところへ行こう！キウイが知っているよ。`,
    hint3: npcT(npc)
  };
}

/** Where to get `item` next, following known wants/needs one step (SPEC §6.7). */
function findGoal(s: GameState, item: ItemId, depth = 0): Objective | null {
  if (has(s.holdings, "player", item)) return null;
  const spot = spotOf(s, item);
  if (spot && spotActive(s.instance, spot, s.flags)) {
    const hidden = s.instance.spots.find((sp) => sp.id === spot)?.kind === "hidden";
    return {
      id: `find:${item}`,
      en: `Find ${ITEMS[item].article} ${ITEMS[item].en}!`,
      ja: `${ja(item)}をさがそう！`,
      target: { kind: "spot", id: spot },
      hint1: hidden ? `${ja(item)}はどこかにかくれているよ。キラキラをさがそう！` : `${ja(item)}がおちているよ。さがしてみよう！`,
      hint2: "キウイについていこう！",
      hint3: { kind: "spot", id: spot }
    };
  }
  const holder = holderOf(s, item);
  if (!holder) return null;
  const role: Role | undefined = s.roles[holder];
  const known = s.journal.facts[holder]?.[item] === true;
  if (depth === 0 && role?.kind === "trader" && role.offer === item && s.journal.wants[holder] === role.want && !has(s.holdings, "player", role.want)) {
    const sub = findGoal(s, role.want, 1);
    if (sub) {
      return {
        ...sub,
        id: `for:${holder}:${role.want}`,
        en: `Find ${ITEMS[role.want].article} ${ITEMS[role.want].en} for ${CAST[holder].name}!`,
        ja: `${who(holder)}は${ja(role.want)}がほしいよ。${ja(role.want)}をさがそう！`,
        sentence: askSentence(role.want),
        hint1: `${who(holder)}は${ja(role.want)}がほしいみたい。持っている人に聞いてみよう！`
      };
    }
  }
  if (depth === 0 && role?.kind === "requester" && "item" in role.reward && role.reward.item === item && s.journal.needs[holder] === role.need && !has(s.holdings, "player", role.need)) {
    const sub = findGoal(s, role.need, 1);
    if (sub) {
      return {
        ...sub,
        id: `for:${holder}:${role.need}`,
        en: `Find ${ITEMS[role.need].article} ${ITEMS[role.need].en} for ${CAST[holder].name}!`,
        ja: `${who(holder)}は${ja(role.need)}がひつよう。${ja(role.need)}をさがそう！`,
        sentence: sub.sentence,
        hint1: `${who(holder)}は${ja(role.need)}がひつようだよ。さがしてみよう！`
      };
    }
  }
  return {
    id: `find:${item}`,
    en: `Find the ${ITEMS[item].en}!`,
    ja: known ? `${who(holder)}が${ja(item)}を持っているよ！` : `${ja(item)}を持っている人をさがそう！`,
    sentence: askSentence(item),
    target: npcT(holder),
    hint1: `「${askSentence(item)}」と、みんなに聞いてみよう！`,
    hint2: `${who(holder)}に聞いてみよう！`,
    hint3: npcT(holder)
  };
}

function depositObjective(): Objective {
  return {
    id: "deposit",
    en: "Bring them to Mayor Pom!",
    ja: "ポム町長のたからばこへとどけよう！",
    target: npcT("pom"),
    hint1: "ポム町長とたからばこのところへもどろう！",
    hint2: "ポム町長に話しかけよう！",
    hint3: npcT("pom")
  };
}

function chapter1(s: GameState): Objective[] {
  const inChest = (i: ItemId) => has(s.holdings, "chest", i);
  if (!inChest("pencil")) {
    if (!has(s.holdings, "player", "pencil"))
      return [{
        id: "findPencil", en: "Find the pencil!", ja: "えんぴつをさがそう！",
        target: { kind: "spot", id: "square-pencil" },
        hint1: "ふんすいのまわりを見てみよう！", hint2: "キラキラ光っているよ！", hint3: { kind: "spot", id: "square-pencil" }
      }];
    return [talkTo("mayorPencil", "pom", "Talk to Mayor Pom!", "ポム町長に話しかけよう！")];
  }
  if (!inChest("eraser")) {
    if (!has(s.holdings, "player", "eraser"))
      return [{
        id: "findEraser", en: "Find the eraser!", ja: "けしゴムをさがそう！",
        target: { kind: "spot", id: "square-eraser" },
        hint1: "ベンチのそばの花だんを見てみよう！", hint2: "キラキラ光っているよ！", hint3: { kind: "spot", id: "square-eraser" }
      }];
    if (!s.flags["gave:ume"]) return [talkTo("ume", "ume", "Talk to Grandma Ume!", "ウメおばあちゃんに話しかけよう！")];
    if (!s.flags["borrowed:ken"]) return [talkTo("ken", "ken", "Talk to Ken!", "ケンに話しかけよう！")];
    return [talkTo("mayorEraser", "pom", "Talk to Mayor Pom!", "ポム町長にけしゴムをとどけよう！")];
  }
  if (!s.flags.teaserDone) return [talkTo("mayorTeaser", "pom", "Talk to Mayor Pom!", "ポム町長に話しかけよう！")];
  return [];
}

function chapter3(s: GameState): Objective[] {
  const out: Objective[] = [];
  if (!s.flags["done:page"]) {
    if (!s.flags.libraryStarted) out.push(talkTo("page", "page", "Help Ms. Page!", "図書室のページ先生に話しかけよう！"));
    else {
      const n = Math.min(count(s.holdings, "player", "notebook"), 3);
      if (n < 3) {
        const next = s.instance.spots.find((sp) => sp.kind === "hidden" && has(s.holdings, `spot:${sp.id}`, "notebook"));
        const t: ObjectiveTarget | null = next ? { kind: "spot", id: next.id } : null;
        out.push({
          id: "notebooks", en: "Find three notebooks!", ja: "図書室でノートを三さつさがそう！",
          counter: { current: n, total: 3, item: "notebook" }, target: t,
          hint1: "たなや、つくえのまわりを見てみよう。キラキラしているよ！",
          hint2: "ほかのものをしらべると、キウイが名前を教えてくれるよ。", hint3: t
        });
      } else out.push(talkTo("returnPage", "page", "Bring them to Ms. Page!", "ページ先生にノートをとどけよう！"));
    }
  }
  if (!s.flags.teacherRewarded) {
    if (!s.flags.lostGiven) out.push(talkTo("green", "green", "Talk to Ms. Green!", "グリーン先生に話しかけよう！"));
    else {
      const students = NPC_IDS.filter((n) => s.roles[n]?.kind === "student");
      const left = students.filter((n) => !s.flags[`returned:${n}`]);
      if (left.length) {
        const owner = left[0];
        const lost = (s.roles[owner] as { lost: ItemId }).lost;
        out.push({
          id: "owners", en: "Find the owners!", ja: "落とし物の持ち主をさがそう！",
          sentence: askSentence(lost),
          counter: { current: students.length - left.length, total: students.length },
          target: npcT(owner),
          hint1: "「Do you have a ___?」と聞いて、「No, I don't.」と答えた人が持ち主だよ！",
          hint2: `${who(owner)}に「${askSentence(lost)}」と聞いてみよう！`,
          hint3: npcT(owner)
        });
      } else out.push(talkTo("greenReward", "green", "Talk to Ms. Green!", "グリーン先生に話しかけよう！"));
    }
  }
  if (!out.length) out.push(depositObjective());
  return out;
}

function stapler(s: GameState): Objective | null {
  if (has(s.holdings, "player", "stapler") || has(s.holdings, "chest", "stapler")) return null;
  if (!s.flags.seaUnlocked) {
    const bo = s.roles.bo;
    if (bo?.kind === "requester" && s.journal.needs.bo === bo.need && !has(s.holdings, "player", bo.need)) {
      const sub = findGoal(s, bo.need, 1);
      if (sub)
        return { ...sub, id: `for:bo:${bo.need}`, en: `Find ${ITEMS[bo.need].article} ${ITEMS[bo.need].en} for Captain Bo!`, ja: `ボー船長は${ja(bo.need)}がひつよう！` };
    }
    return talkTo("bo", "bo", "Help Captain Bo!", "ボー船長に話しかけよう！");
  }
  return {
    id: "seaChest", en: "Open the sea chest!", ja: "ふたの絵を見て、たからばこに聞いてみよう！",
    sentence: askSentence("stapler"), target: { kind: "seaChest" },
    hint1: "ふたの三つの絵は何かな？「Do you have a ___?」と聞こう！",
    hint2: "ホッチキスの絵があるよ。「Do you have a stapler?」", hint3: { kind: "seaChest" }
  };
}

/** Current objectives (first is the main one), derived from state only. */
export function objectives(s: GameState): Objective[] {
  if (s.chapterComplete) return [];
  if (s.chapter === 1) return chapter1(s);
  if (s.chapter === 3) return chapter3(s);
  const remaining = remainingTargets(s.instance, s.holdings);
  const out: Objective[] = [];
  for (const t of remaining) {
    const g = t === "stapler" && s.chapter === 4 ? stapler(s) : findGoal(s, t);
    if (g) out.push(g);
  }
  if (!out.length && remaining.length && missionsDone(s.instance, s.flags, s.roles)) out.push(depositObjective());
  return out;
}

/** Ask-prompt cards for a chapter (SPEC §2). */
export function askCards(chapter: GameState["chapter"]): ItemId[] {
  return [...CHAPTERS[chapter].cards];
}

/** Whether talking to `npc` would make them ask the player something. */
function wouldAsk(s: GameState, npc: NpcId): boolean {
  const r = s.roles[npc];
  if (!r) return false;
  switch (r.kind) {
    case "mayor": {
      const remaining = remainingTargets(s.instance, s.holdings);
      if (s.chapter === 1) {
        if (remaining.includes("pencil")) return has(s.holdings, "player", "pencil");
        if (remaining.includes("eraser")) return has(s.holdings, "player", "eraser") && missionsDone(s.instance, s.flags, s.roles);
        return !s.flags.teaserDone;
      }
      return remaining.length > 0 && remaining.every((t) => has(s.holdings, "player", t)) && missionsDone(s.instance, s.flags, s.roles);
    }
    case "trader":
      return !!s.memory[npc]?.wantKnown && s.journal.wants[npc] === r.want && has(s.holdings, "player", r.want);
    case "requester":
      if (s.flags[`done:${npc}`]) return false;
      if (r.intro) return !s.flags.libraryStarted || has(s.holdings, "player", r.need, r.count);
      return true;
    case "teacher":
      return !s.flags.lostGiven || (!s.flags.teacherRewarded && NPC_IDS.every((n) => s.roles[n]?.kind !== "student" || s.flags[`returned:${n}`]));
    case "askGiver":
      return !s.flags[`gave:${npc}`];
    case "borrower":
      return !s.flags[`borrowed:${npc}`] && has(s.holdings, "player", r.item);
    default:
      return false;
  }
}

/** Indicators over people: "!" wants to ask, sticker bubble (SPEC §10). */
export function indicators(s: GameState): Partial<Record<NpcId, Indicator>> {
  const out: Partial<Record<NpcId, Indicator>> = {};
  for (const n of NPC_IDS) {
    const r = s.roles[n];
    if (!r) continue;
    if (r.kind === "sticker") out[n] = s.stickers.includes(r.sticker) ? null : "sticker";
    else if (wouldAsk(s, n)) out[n] = "ask";
  }
  return out;
}

/** People with a role this chapter whom the student has not asked anything yet (hint level 1 "?"). */
export function unasked(s: GameState): NpcId[] {
  return NPC_IDS.filter((n) => {
    const r = s.roles[n];
    if (!r || r.kind === "mayor" || r.kind === "sticker") return false;
    return Object.keys(s.journal.facts[n] ?? {}).length === 0;
  });
}

/** Where a person stands this chapter; the world maps these to positions. */
export type Placement = "home" | "festival" | "asker1" | "asker2";

export function placement(s: GameState, npc: NpcId): Placement {
  const r = s.roles[npc];
  if (r?.kind === "sticker") {
    const askers = NPC_IDS.filter((n) => s.roles[n]?.kind === "sticker");
    return askers.indexOf(npc) === 0 ? "asker1" : "asker2";
  }
  // Chapter 5: helpers and the Mayor (with the chest) gather at the festival stage.
  if (s.chapter === 5 && r && CAST[npc].district !== "festival") return "festival";
  return "home";
}
