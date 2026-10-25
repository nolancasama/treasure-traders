import { CAST } from "../content/cast";
import { CHAPTERS } from "../content/chapters";
import { DISTRICT_IDS, ITEM_IDS, type CharacterId, type ItemId, type NpcId } from "../content/ids";
import { ITEMS, NO_SENTENCE, YES_SENTENCE } from "../content/items";
import { K, L } from "../content/lines";
import type { Line } from "../content/cast";
import { count, has, itemsOf, move } from "./holdings";
import { missionsDone, remainingTargets, spotActive } from "./solver";
import type { Beat, GameEvent, GameState, Gesture, Mood, NpcMemory, Prompt, QuestionKind, Role, Step, Target } from "./types";

/* ------------------------------------------------------------------ helpers */

type Draft = GameState;

function draft(s: GameState): Draft {
  return structuredClone(s);
}

function say(speaker: CharacterId | "seaChest", line: Line, extra: { mood?: Mood; gesture?: Gesture; showItem?: ItemId } = {}): Beat {
  return { kind: "say", speaker, en: line.en, ja: line.ja, ...extra };
}

function kiwiJa(ja: string): Beat {
  return { kind: "say", speaker: "kiwi", en: "", ja, jaOnly: true };
}

function ev(event: GameEvent): Beat {
  return { kind: "event", event };
}

function mem(d: Draft, npc: NpcId): NpcMemory {
  const m = d.memory[npc] ?? { met: false, wantKnown: false, traded: 0, helped: false };
  d.memory[npc] = m;
  return m;
}

/** Applies a transfer exactly once; returns the event (or null if already applied). */
function transfer(d: Draft, onceId: string, item: ItemId, from: Parameters<typeof move>[2], to: Parameters<typeof move>[3], n = 1): GameEvent | null {
  if (d.once[onceId]) return null;
  d.holdings = move(d.holdings, item, from, to, n);
  d.once[onceId] = true;
  return { type: "itemMoved", onceId, item, from, to, count: n };
}

function onceKey(d: Draft, what: string): string {
  return `c${d.chapter}:${d.instance.seed}:${what}`;
}

function setFact(d: Draft, npc: NpcId, item: ItemId, value: boolean, beats: Beat[]) {
  const facts = (d.journal.facts[npc] ??= {});
  if (facts[item] !== value) {
    facts[item] = value;
    beats.push(ev({ type: "journalFact", npc, item, has: value }));
  }
}

/** After a witnessed trade, the journal reflects the swap. */
function witnessTrade(d: Draft, npc: NpcId, gave: ItemId, got: ItemId, beats: Beat[]) {
  setFact(d, npc, gave, false, beats);
  setFact(d, npc, got, true, beats);
  delete d.journal.wants[npc];
}

function playerHas(d: Draft, item: ItemId, n = 1): boolean {
  return has(d.holdings, "player", item, n);
}

function askPrompt(d: Draft, target: Target): Prompt {
  if (d.chapter === 1 && target !== "seaChest") return null;
  const cards = target === "seaChest" ? [...ITEM_IDS] : CHAPTERS[d.chapter].cards;
  return { kind: "ask", target, cards: [...cards] };
}

/** Creates the pending question and its spoken line. */
function question(d: Draft, kind: QuestionKind, target: Target, item: ItemId, countNeeded = 1): { beat: Beat; prompt: Prompt } {
  d.serial += 1;
  const id = `${kind}:${target}:${item}:${d.serial}`;
  const prev = d.question && d.question.kind === kind && d.question.target === target && d.question.item === item ? d.question.contradictions : 0;
  d.question = { id, kind, target, item, count: countNeeded, contradictions: prev };
  const line = kind === "libraryReturn" ? L.askMyNotebooks : L.ask(item);
  const speaker = target === "seaChest" ? "seaChest" : target;
  return {
    beat: say(speaker, line, { gesture: "talk" }),
    prompt: { kind: "answer", target, item, questionId: id, count: countNeeded, questionEn: line.en, questionJa: line.ja }
  };
}

/* ------------------------------------------------------------ deposits */

const DECORATION_LEVELS = [2, 4, 6, 8, 9];

function deposit(d: Draft, items: ItemId[], beats: Beat[]) {
  const before = itemsOf(d.holdings, "chest").reduce((n, i) => n + count(d.holdings, "chest", i), 0);
  for (const it of items) {
    const e = transfer(d, onceKey(d, `deposit:${it}`), it, "player", "chest");
    if (e) beats.push(ev(e));
  }
  const total = before + items.length;
  beats.push(ev({ type: "chestDeposit", onceId: onceKey(d, `chest:${items.join("+")}`), items, total }));
  for (const lvl of DECORATION_LEVELS) {
    if (before < lvl && total >= lvl) beats.push(ev({ type: "decorationLevel", onceId: onceKey(d, `deco:${lvl}`), count: lvl }));
  }
}

function completeChapter(d: Draft, beats: Beat[]) {
  // Chapter 1's pen carries over: it is Chapter 2's canonical start inventory.
  const leftovers = d.chapter === 1 ? [] : itemsOf(d.holdings, "player");
  if (leftovers.length) {
    beats.push(say("pom", L.mayorSpare, { mood: "happy" }));
    for (const it of leftovers) {
      const n = count(d.holdings, "player", it);
      const e = transfer(d, onceKey(d, `spare:${it}`), it, "player", "spare", n);
      if (e) beats.push(ev(e));
    }
  }
  d.chapterComplete = true;
  if (!d.completedChapters.includes(d.chapter)) d.completedChapters.push(d.chapter);
  d.completedChapters.sort();
  beats.push(ev({ type: "chapterComplete", onceId: onceKey(d, "complete"), chapter: d.chapter }));
  const unlock = CHAPTERS[d.chapter].unlocks;
  if (unlock) {
    if (!d.unlockedAreas.includes(unlock)) d.unlockedAreas.push(unlock);
    beats.push(ev({ type: "areaUnlocked", onceId: onceKey(d, `area:${unlock}`), district: unlock }));
  }
  if (d.chapter === 5) {
    if (d.mode === "campaign") d.finished = true;
    beats.push(ev({ type: "finale", onceId: onceKey(d, "finale") }));
  }
}

/* --------------------------------------------- who asks first (SPEC §4.2) */

interface Opening {
  lead: Beat[];
  question?: { kind: QuestionKind; item: ItemId; count?: number };
}

function studentsAllReturned(d: Draft): boolean {
  return Object.entries(d.roles).every(([n, r]) => r?.kind !== "student" || d.flags[`returned:${n}`]);
}

function stickerItem(d: Draft, npc: NpcId): ItemId {
  const n = (d.askCounts[npc] ?? 0) + 1;
  d.askCounts[npc] = n;
  let h = (d.instance.seed * 31 + npc.length * 17 + n * 101) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
  const held = itemsOf(d.holdings, "player");
  const cards = CHAPTERS[d.chapter].cards;
  const notHeld = cards.filter((i) => !held.includes(i));
  const useHeld = held.length > 0 && (h & 1) === 0;
  const pool = useHeld || notHeld.length === 0 ? held : notHeld;
  return pool[(h >>> 1) % pool.length];
}

function opening(d: Draft, npc: NpcId, role: Role | undefined): Opening {
  const lead: Beat[] = [];
  if (!role) return { lead };
  switch (role.kind) {
    case "mayor": {
      const remaining = remainingTargets(d.instance, d.holdings);
      if (d.chapter === 1) {
        if (remaining.includes("pencil") && playerHas(d, "pencil")) return { lead, question: { kind: "deposit", item: "pencil" } };
        if (!remaining.includes("pencil") && remaining.includes("eraser") && playerHas(d, "eraser")) {
          if (missionsDone(d.instance, d.flags, d.roles)) return { lead, question: { kind: "deposit", item: "eraser" } };
          lead.push(say("pom", L.mayorHelpFirst));
          return { lead };
        }
        if (remaining.length === 0 && !d.flags.teaserDone) return { lead, question: { kind: "teaser", item: "ruler" } };
        return { lead };
      }
      if (remaining.length && remaining.every((t) => playerHas(d, t))) {
        if (missionsDone(d.instance, d.flags, d.roles)) return { lead, question: { kind: "deposit", item: remaining[0] } };
        lead.push(say("pom", L.mayorHelpFirst));
      }
      return { lead };
    }
    case "trader":
      if (mem(d, npc).wantKnown && d.journal.wants[npc] === role.want && has(d.holdings, npc, role.offer))
        return { lead, question: { kind: "trade", item: role.want } };
      return { lead };
    case "requester": {
      if (d.flags[`done:${npc}`]) return { lead };
      if (role.intro) {
        if (!d.flags.libraryStarted) return { lead, question: { kind: "libraryIntro", item: role.need } };
        if (playerHas(d, role.need, role.count)) return { lead, question: { kind: "libraryReturn", item: role.need, count: role.count } };
        lead.push(say(npc, L.pageStillNeed));
        return { lead };
      }
      return { lead, question: { kind: "need", item: role.need } };
    }
    case "teacher":
      if (!d.flags.lostGiven) {
        lead.push(say(npc, L.greenLook, { gesture: "give" }));
        for (const it of role.lost) {
          const e = transfer(d, onceKey(d, `lost:${it}`), it, npc, "player");
          if (e) lead.push(ev(e));
        }
        d.flags.lostGiven = true;
        lead.push(ev({ type: "missionStarted", id: "lostFound" }));
        lead.push(say(npc, L.greenFindOwners));
        lead.push(kiwiJa(K.aLostItem));
        return { lead };
      }
      if (!d.flags.teacherRewarded && studentsAllReturned(d)) return { lead, question: { kind: "teacher", item: role.reward } };
      if (!d.flags.teacherRewarded) lead.push(say(npc, L.greenStill));
      return { lead };
    case "askGiver":
      if (!d.flags[`gave:${npc}`]) return { lead, question: { kind: "askGive", item: role.item } };
      return { lead };
    case "borrower":
      if (!d.flags[`borrowed:${npc}`]) return { lead, question: { kind: "borrow", item: role.item } };
      return { lead };
    case "sticker":
      if (!d.stickers.includes(role.sticker)) return { lead, question: { kind: "sticker", item: stickerItem(d, npc) } };
      return { lead };
    default:
      return { lead };
  }
}

/** A short status/flavour line when nobody asks anything. */
function statusLine(d: Draft, npc: NpcId, role: Role | undefined): Line {
  const info = CAST[npc];
  // Residents without a role this chapter: their own chapter is behind them.
  if (!role) return DISTRICT_IDS.indexOf(info.district) + 1 < d.chapter ? info.done : info.flavor;
  switch (role.kind) {
    case "mayor": {
      if (d.chapterComplete) return info.done;
      const remaining = remainingTargets(d.instance, d.holdings);
      if (d.chapter === 1 || remaining.length === 0) return info.flavor;
      return L.mayorFind(remaining);
    }
    case "trader":
      return mem(d, npc).traded > 0 ? L.thanksFor(role.offer) : info.flavor;
    case "requester":
    case "askGiver":
    case "borrower":
    case "teacher":
      return mem(d, npc).helped ? info.done : info.flavor;
    case "student":
      return d.flags[`returned:${npc}`] ? info.done : info.flavor;
    case "sticker":
      return d.stickers.includes(role.sticker) ? L.stickerThanks : info.flavor;
    default:
      return info.flavor;
  }
}

/* ---------------------------------------------------------------- talk */

/** Starting a conversation (SPEC §4.1–4.2). */
export function talk(state: GameState, target: Target): Step {
  const d = draft(state);
  const beats: Beat[] = [];
  if (target === "seaChest") {
    if (!d.flags.seaUnlocked) return { state: d, beats: [kiwiJa(K.askCaptainFirst)], prompt: null };
    if (d.flags.seaOpened) return { state: d, beats: [say("seaChest", L.thankYou)], prompt: null };
    beats.push(kiwiJa(K.chestHint));
    return { state: d, beats, prompt: askPrompt(d, "seaChest") };
  }
  const npc = target;
  const role = d.roles[npc];
  const m = mem(d, npc);
  const firstMeet = !m.met;
  if (firstMeet) {
    m.met = true;
    if (!d.journal.met.includes(npc)) d.journal.met.push(npc);
    beats.push(say(npc, CAST[npc].greet, { mood: "happy", gesture: "talk" }));
    if (d.chapter === 5 && (npc === "ume" || npc === "ken" || npc === "mia")) beats.push(say(npc, L.helperCame));
  }
  const open = opening(d, npc, role);
  beats.push(...open.lead);
  if (open.question) {
    const q = question(d, open.question.kind, npc, open.question.item, open.question.count ?? 1);
    beats.push(q.beat);
    return { state: d, beats, prompt: q.prompt };
  }
  if (!open.lead.length) {
    if (!firstMeet) beats.push(say(npc, L.hiAgain, { gesture: "talk" }));
    beats.push(say(npc, statusLine(d, npc, role)));
  }
  return { state: d, beats, prompt: askPrompt(d, npc) };
}

/* ----------------------------------------------------------------- ask */

/** The student asks "Do you have a ___?" (SPEC §4.3). Answers are always truthful. */
export function ask(state: GameState, target: Target, item: ItemId): Step {
  const d = draft(state);
  const beats: Beat[] = [];
  d.stats.questionsAsked += 1;
  d.question = null;

  if (target === "seaChest") {
    const silhouettes = d.instance.seaChest ?? [];
    if (!d.flags.seaUnlocked || d.flags.seaOpened) return { state: d, beats: [kiwiJa(K.askCaptainFirst)], prompt: null };
    const idx = silhouettes.indexOf(item);
    if (idx >= 0 && has(d.holdings, "seaChest", item)) {
      beats.push(say("seaChest", L.yes, { showItem: item }));
      if (!d.flags[`seaLock${idx}`]) {
        d.flags[`seaLock${idx}`] = true;
        beats.push(ev({ type: "lockOpened", onceId: onceKey(d, `lock:${idx}`), index: idx, item }));
      }
      if (silhouettes.every((_, i) => d.flags[`seaLock${i}`])) {
        d.flags.seaOpened = true;
        beats.push(ev({ type: "seaChestOpened", onceId: onceKey(d, "seaChestOpen") }));
        beats.push(say("seaChest", L.chestOpen, { mood: "happy" }));
        const e = transfer(d, onceKey(d, "seaStapler"), "stapler", "seaChest", "player");
        if (e) beats.push(ev(e));
        if (!d.stickers.includes("anchor")) {
          d.stickers.push("anchor");
          beats.push(ev({ type: "sticker", onceId: onceKey(d, "sticker:anchor"), id: "anchor" }));
        }
        beats.push(ev({ type: "missionComplete", onceId: onceKey(d, "mission:seaChest"), id: "seaChest" }));
        return { state: d, beats, prompt: null };
      }
      return { state: d, beats, prompt: askPrompt(d, "seaChest") };
    }
    beats.push(say("seaChest", L.no, { gesture: "shake" }));
    return { state: d, beats, prompt: askPrompt(d, "seaChest") };
  }

  const npc = target;
  const role = d.roles[npc];
  mem(d, npc).met = true;
  if (!d.journal.met.includes(npc)) d.journal.met.push(npc);
  const holds = has(d.holdings, npc, item);
  const yes = () => say(npc, L.yes, { gesture: "nod", showItem: item, mood: "happy" });
  const no = () => say(npc, L.no, { gesture: "shake" });

  // The Mayor answers about the festival chest's contents.
  if (role?.kind === "mayor") {
    const inChest = has(d.holdings, "chest", item);
    setFact(d, npc, item, inChest, beats);
    beats.unshift(inChest ? say("pom", L.mayorChestHas, { gesture: "nod", showItem: item }) : no());
    return { state: d, beats, prompt: askPrompt(d, npc) };
  }

  setFact(d, npc, item, holds, beats);

  if (role?.kind === "student" && item === role.lost && !holds) {
    beats.unshift(say(npc, L.iLostIt, { gesture: "sad", mood: "sad" }));
    if (d.flags.lostGiven && !d.flags[`returned:${npc}`] && playerHas(d, item)) {
      const e = transfer(d, onceKey(d, `return:${npc}`), item, "player", npc);
      if (e) beats.push(ev(e));
      d.flags[`returned:${npc}`] = true;
      mem(d, npc).helped = true;
      d.stats.helped += 1;
      setFact(d, npc, item, true, beats);
      beats.push(say(npc, L.thatsMy(item), { mood: "happy", gesture: "cheer", showItem: item }));
      beats.push(ev({ type: "missionComplete", onceId: onceKey(d, `mission:return:${npc}`), id: `return:${npc}` }));
    }
    return { state: d, beats, prompt: askPrompt(d, npc) };
  }

  if (!holds) {
    beats.unshift(no());
    return { state: d, beats, prompt: askPrompt(d, npc) };
  }

  beats.unshift(yes());
  switch (role?.kind) {
    case "trader":
      if (item === role.offer) {
        const q = question(d, "trade", npc, role.want);
        beats.push(q.beat);
        return { state: d, beats, prompt: q.prompt };
      }
      break;
    case "giver":
      if (item === role.item && !d.flags[`gave:${npc}`]) {
        beats.push(say(npc, L.thisIsForYou, { gesture: "give", mood: "happy" }));
        const e = transfer(d, onceKey(d, `gift:${npc}`), item, npc, "player");
        if (e) beats.push(ev(e));
        d.flags[`gave:${npc}`] = true;
        setFact(d, npc, item, false, beats);
      }
      break;
    case "requester":
      if ("item" in role.reward && item === role.reward.item && !d.flags[`done:${npc}`]) {
        if (role.intro && !d.flags.libraryStarted) {
          const q = question(d, "libraryIntro", npc, role.need);
          beats.push(q.beat);
          return { state: d, beats, prompt: q.prompt };
        }
        if (role.intro && playerHas(d, role.need, role.count)) {
          const q = question(d, "libraryReturn", npc, role.need, role.count);
          beats.push(q.beat);
          return { state: d, beats, prompt: q.prompt };
        }
        if (role.intro) {
          beats.push(say(npc, L.pageStillNeed));
          break;
        }
        beats.push(say(npc, L.butINeed(role.need), { gesture: "think" }));
        const q = question(d, "need", npc, role.need);
        beats.push(q.beat);
        return { state: d, beats, prompt: q.prompt };
      }
      break;
    case "teacher":
      if (item === role.reward && !d.flags.teacherRewarded) {
        if (!studentsAllReturned(d) || !d.flags.lostGiven) {
          beats[0] = say(npc, L.greenHelpFirst, { gesture: "nod", showItem: item });
          break;
        }
        const q = question(d, "teacher", npc, role.reward);
        beats.push(q.beat);
        return { state: d, beats, prompt: q.prompt };
      }
      break;
    case "bystander":
      beats.push(say(npc, L.iNeedIt));
      break;
    default:
      break;
  }
  return { state: d, beats, prompt: askPrompt(d, npc) };
}

/* -------------------------------------------------------------- answer */

const modelSentence = (yes: boolean): Line => ({ en: yes ? YES_SENTENCE : NO_SENTENCE, ja: yes ? "うん、持っているよ。" : "ううん、持っていないよ。" });

/** The student answers "Yes, I do." / "No, I don't." (SPEC §3.2, §4.6). */
export function answer(state: GameState, target: Target, questionId: string, said: "yes" | "no"): Step {
  const q = state.question;
  if (!q || q.id !== questionId || q.target !== target) return { state, beats: [], prompt: null };
  const d = draft(state);
  const beats: Beat[] = [];
  const truthYes = playerHas(d, q.item, q.count);
  const truthful = (said === "yes") === truthYes;
  const speaker = target === "seaChest" ? "seaChest" : target;

  if (!truthful) {
    const contradictions = q.contradictions + 1;
    beats.push(say(speaker, L.hmmLetsLook, { gesture: "bagCheck", mood: "surprised" }));
    beats.push(ev({ type: "bagCheck", item: q.item, has: truthYes }));
    beats.push(kiwiJa(truthYes ? K.has(q.item) : K.hasNot(q.item)));
    if (contradictions >= 2) {
      const model = modelSentence(truthYes);
      beats.push({ kind: "say", speaker: "kiwi", en: model.en, ja: `${K.sayIt}${model.ja}` });
    }
    const again = question(d, q.kind, q.target, q.item, q.count);
    d.question!.contradictions = contradictions;
    beats.push(again.beat);
    return { state: d, beats, prompt: again.prompt };
  }

  d.question = null;
  d.stats.answersGiven += 1;
  const npc = target === "seaChest" ? null : target;
  const role = npc ? d.roles[npc] : undefined;

  switch (q.kind) {
    case "trade": {
      if (!npc || role?.kind !== "trader") break;
      if (said === "yes") {
        beats.push(say(npc, L.letsTrade, { gesture: "give", mood: "happy" }));
        const give = transfer(d, onceKey(d, `trade:${npc}:${d.serial}:give`), role.want, "player", npc);
        const get = transfer(d, onceKey(d, `trade:${npc}:${d.serial}:get`), role.offer, npc, "player");
        if (give) beats.push(ev(give));
        if (get) beats.push(ev(get));
        witnessTrade(d, npc, role.offer, role.want, beats);
        d.roles[npc] = { kind: "trader", offer: role.want, want: role.offer };
        const m = mem(d, npc);
        m.traded += 1;
        m.wantKnown = false;
        beats.push(say(npc, L.thankYou, { mood: "happy", gesture: "cheer" }));
      } else {
        mem(d, npc).wantKnown = true;
        d.journal.wants[npc] = role.want;
        beats.push(ev({ type: "journalWant", npc, item: role.want }));
        beats.push(say(npc, L.bringMe(role.want), { gesture: "think" }));
      }
      break;
    }
    case "need": {
      if (!npc || role?.kind !== "requester") break;
      if (said === "yes") {
        const e = transfer(d, onceKey(d, `need:${npc}`), role.need, "player", npc, role.count);
        if (e) beats.push(ev(e));
        d.flags[`done:${npc}`] = true;
        delete d.journal.needs[npc];
        mem(d, npc).helped = true;
        d.stats.helped += 1;
        beats.push(say(npc, L.thankYou, { mood: "happy", gesture: "cheer" }));
        if ("item" in role.reward) {
          beats.push(say(npc, L.thisIsForYou, { gesture: "give", showItem: role.reward.item }));
          const r = transfer(d, onceKey(d, `reward:${npc}`), role.reward.item, npc, "player");
          if (r) beats.push(ev(r));
          setFact(d, npc, role.reward.item, has(d.holdings, npc, role.reward.item), beats);
        } else {
          d.flags.seaUnlocked = true;
          beats.push(say(npc, L.boOpenChest, { gesture: "cheer" }));
          beats.push(ev({ type: "seaChestUnlocked", onceId: onceKey(d, "seaUnlock") }));
        }
        beats.push(ev({ type: "missionComplete", onceId: onceKey(d, `mission:need:${npc}`), id: `need:${npc}` }));
      } else {
        mem(d, npc).wantKnown = true;
        d.journal.needs[npc] = role.need;
        beats.push(ev({ type: "journalNeed", npc, item: role.need }));
        beats.push(say(npc, L.pleaseFind(role.need), { gesture: "think" }));
        if (npc === "bo") beats.push(say(npc, L.boNeedFor));
      }
      break;
    }
    case "deposit": {
      if (said !== "yes") break;
      if (d.chapter === 1) {
        beats.push(say("pom", L.mayorIntoChest, { mood: "happy", gesture: "cheer" }));
        deposit(d, [q.item], beats);
        if (q.item === "eraser") {
          const t = question(d, "teaser", "pom", "ruler");
          beats.push(t.beat);
          return { state: d, beats, prompt: t.prompt };
        }
        break;
      }
      const remaining = remainingTargets(d.instance, d.holdings).filter((t) => playerHas(d, t));
      beats.push(say("pom", L.mayorIntoChest, { mood: "happy", gesture: "cheer" }));
      for (const other of remaining.filter((t) => t !== q.item)) beats.push(say("pom", L.mayorAlso(other), { mood: "happy" }));
      deposit(d, remaining, beats);
      if (remainingTargets(d.instance, d.holdings).length === 0) {
        if (d.chapter === 5) {
          beats.push(say("pom", L.mayorOpen, { mood: "happy", gesture: "cheer" }));
          beats.push(say("pom", L.mayorThanks, { mood: "happy" }));
        }
        completeChapter(d, beats);
      }
      break;
    }
    case "teaser": {
      if (said !== "no") break;
      d.flags.teaserDone = true;
      beats.push(say("pom", L.mayorRulerFlew, { gesture: "think" }));
      beats.push(say("pom", L.mayorKeepPen, { mood: "happy" }));
      completeChapter(d, beats);
      break;
    }
    case "askGive": {
      if (!npc || role?.kind !== "askGiver") break;
      if (said === "no") {
        beats.push(say(npc, L.umeThisIsForYou, { gesture: "give", mood: "happy", showItem: role.item }));
        const e = transfer(d, onceKey(d, `askGive:${npc}`), role.item, npc, "player");
        if (e) beats.push(ev(e));
        beats.push(say(npc, L.umeFound));
      } else beats.push(say(npc, L.umeYouHaveOne, { mood: "happy" }));
      d.flags[`gave:${npc}`] = true;
      mem(d, npc).helped = true;
      beats.push(ev({ type: "missionComplete", onceId: onceKey(d, `mission:askGive:${npc}`), id: `askGive:${npc}` }));
      break;
    }
    case "borrow": {
      if (!npc || role?.kind !== "borrower") break;
      if (said === "yes") {
        beats.push(say(npc, L.kenThanks, { mood: "happy" }));
        const lend = transfer(d, onceKey(d, `borrow:${npc}`), role.item, "player", npc);
        if (lend) beats.push(ev(lend));
        beats.push(ev({ type: "posterDone", onceId: onceKey(d, "poster") }));
        const back = transfer(d, onceKey(d, `borrowBack:${npc}`), role.item, npc, "player");
        if (back) beats.push(ev(back));
        beats.push(say(npc, L.kenDone, { gesture: "give", mood: "happy", showItem: role.item }));
        beats.push(say(npc, L.kenPoster, { gesture: "cheer" }));
        d.flags[`borrowed:${npc}`] = true;
        mem(d, npc).helped = true;
        d.stats.helped += 1;
        beats.push(ev({ type: "missionComplete", onceId: onceKey(d, `mission:borrow:${npc}`), id: `borrow:${npc}` }));
      } else beats.push(say(npc, L.kenNoEraser, { mood: "sad" }));
      break;
    }
    case "teacher": {
      if (!npc || role?.kind !== "teacher") break;
      if (said === "no") {
        beats.push(say(npc, L.greenForFestival, { gesture: "give", mood: "happy", showItem: role.reward }));
        const e = transfer(d, onceKey(d, "teacherReward"), role.reward, npc, "player");
        if (e) beats.push(ev(e));
        d.flags.teacherRewarded = true;
        mem(d, npc).helped = true;
        setFact(d, npc, role.reward, false, beats);
        beats.push(ev({ type: "missionComplete", onceId: onceKey(d, "mission:lostFound"), id: "lostFound" }));
      } else beats.push(say(npc, L.great, { mood: "happy" }));
      break;
    }
    case "libraryIntro": {
      if (!npc) break;
      if (said === "no") {
        d.flags.libraryStarted = true;
        beats.push(say(npc, L.pageOhNo, { mood: "sad", gesture: "sad" }));
        beats.push(say(npc, L.pageFindThree));
        beats.push(ev({ type: "missionStarted", id: "library" }));
      }
      break;
    }
    case "libraryReturn": {
      if (!npc || role?.kind !== "requester" || said !== "yes") break;
      const e = transfer(d, onceKey(d, `need:${npc}`), role.need, "player", npc, role.count);
      if (e) beats.push(ev(e));
      d.flags[`done:${npc}`] = true;
      mem(d, npc).helped = true;
      d.stats.helped += 1;
      beats.push(say(npc, L.pageThanks, { gesture: "give", mood: "happy", showItem: role.need }));
      if ("item" in role.reward) {
        const r = transfer(d, onceKey(d, `reward:${npc}`), role.reward.item, npc, "player");
        if (r) beats.push(ev(r));
      }
      beats.push(ev({ type: "missionComplete", onceId: onceKey(d, "mission:library"), id: "library" }));
      break;
    }
    case "sticker": {
      if (!npc || role?.kind !== "sticker") break;
      if (!d.stickers.includes(role.sticker)) {
        d.stickers.push(role.sticker);
        beats.push(say(npc, L.hereSticker, { mood: "happy", gesture: "give" }));
        beats.push(ev({ type: "sticker", onceId: onceKey(d, `sticker:${role.sticker}`), id: role.sticker }));
      }
      break;
    }
  }
  return { state: d, beats, prompt: npc && !d.chapterComplete ? askPrompt(d, npc) : null };
}

/* ------------------------------------------------- world spots and leave */

/** Picking up an item at a world spot. */
export function collect(state: GameState, spotId: string): Step {
  if (!spotActive(state.instance, spotId, state.flags)) return { state, beats: [], prompt: null };
  const def = state.instance.spots.find((s) => s.id === spotId)!;
  const holder = `spot:${spotId}` as const;
  if (!has(state.holdings, holder, def.item)) return { state, beats: [], prompt: null };
  const d = draft(state);
  const beats: Beat[] = [ev({ type: "pickup", item: def.item, spotId })];
  const e = transfer(d, onceKey(d, `collect:${spotId}`), def.item, holder, "player");
  if (e) beats.push(ev(e));
  if (def.requires === "libraryStarted") {
    const found = count(d.holdings, "player", "notebook");
    beats.push(kiwiJa(K.notebookFound(Math.min(found, 3))));
  }
  return { state: d, beats, prompt: null };
}

/** Looking at a library distractor: Kiwi names it. */
export function inspect(state: GameState, spotId: string): Step {
  const def = state.instance.spots.find((s) => s.id === spotId);
  if (!def || def.kind !== "distractor") return { state, beats: [], prompt: null };
  const line = K.thatsA(def.item);
  return { state, beats: [{ kind: "say", speaker: "kiwi", en: line.en, ja: line.ja, showItem: def.item }], prompt: null };
}

/** Ending a conversation; an unanswered question is asked again next time. */
export function leave(state: GameState): GameState {
  if (!state.question) return state;
  return { ...state, question: null };
}

/** True when an item counts as the player's (used by the bag-check UI). */
export function playerHolds(state: GameState, item: ItemId): number {
  return count(state.holdings, "player", item);
}

export { ITEMS };
