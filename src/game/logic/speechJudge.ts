import type { ItemId } from "../content/ids";
import { ITEMS } from "../content/items";
import { createMatcher, levenshtein, normalizeAlternatives, type Alternatives, type Result } from "../../audio/vendor";

/**
 * Speech judges (SPEC §5) built on the vendored esl-stt. They decide only what
 * was said; whether an answer is true is decided afterwards by game logic.
 *
 * Probed esl-stt v1.0.0 behaviour that this wrapper corrects:
 * - "pencil case" / "pen case" resolve to pencil / pen (the single word wins
 *   the tie), so phrases are joined into one token before matching.
 * - A live interim "do you have a pen" can be the start of "pencil", so live
 *   acceptance of pen/pencil waits until the item word is not the last token.
 * - There is no yes/no profile; the answer judge uses esl-stt's normalisation
 *   with game rules ("I do" = yes, "don't"/"not" = no, both = unclear).
 */

/** Game aliases extending esl-stt's defaults (recognition aids, not targets). */
export const ITEM_ALIASES: Record<string, string[]> = {
  marker: ["maker", "marca", "marka", "makar"],
  ruler: ["roller", "rula", "rular", "ruller", "lula", "rooler"],
  eraser: ["razor", "laser", "racer", "erasor", "iraser", "eraza"],
  stapler: ["staple", "stapla", "stable", "steppler", "stepler"],
  calendar: ["calender", "karenda", "calenda", "kalender"],
  notebook: ["note", "notebooks"],
  pencil: ["pensil", "pencel", "pensiru"],
  pen: ["penn", "pens"],
  pencilcase: ["pencilcases", "pencase", "pencases"]
};

const ITEM_VOCAB = (Object.keys(ITEMS) as ItemId[]).map((id) => ({
  id,
  words: id === "pencilCase" ? ["pencilcase"] : id === "notebook" ? ["notebook", "note book"] : [ITEMS[id].en]
}));

/** Joins pencil-case phrases (incl. the Japanese-English "pen case") into one token. */
export function prepass(text: string): string {
  return text
    .toLowerCase()
    .replace(/\bpen(?:cil)?[\s-]*(?:case|kase|keys|cases)\b/g, "pencilcase")
    .replace(/\bpan ?cakes?\b/g, "pencilcase");
}

function prepared(alternatives: Alternatives): string[] {
  return normalizeAlternatives(alternatives).map((a) => prepass(a.normalized));
}

const askMatcher = createMatcher({
  profile: "controlledAnswer",
  vocabulary: ITEM_VOCAB,
  frame: ["do", "you", "have"],
  minFrame: 1,
  aliases: ITEM_ALIASES
});

export type AskJudgement =
  | { kind: "item"; item: ItemId; heard: string; result: Result }
  /** The item without the question frame ("ruler"): say the whole question. */
  | { kind: "incomplete"; item: ItemId | null; heard: string; result: Result }
  /** Close to an item word (coach material). */
  | { kind: "nearMiss"; item: ItemId; heard: string; result: Result }
  | { kind: "different"; heard: string; result: Result }
  | { kind: "none"; heard: string; result: Result };

function nearestItem(text: string): ItemId {
  const tokens = text.split(/\s+/).filter(Boolean);
  let best: ItemId = "pen";
  let bestScore = Infinity;
  for (const v of ITEM_VOCAB) {
    for (const w of v.words) {
      for (const t of tokens) {
        const s = levenshtein(t, w.replace(" ", "")) / Math.max(w.length, 1);
        if (s < bestScore) {
          bestScore = s;
          best = v.id;
        }
      }
    }
  }
  return best;
}

/** Judges a finished recognition attempt for "Do you have a ___?". */
export function judgeAsk(alternatives: Alternatives): AskJudgement {
  const alts = prepared(alternatives);
  const heard = alts[0] ?? "";
  const result = askMatcher.match(alts);
  const value = result.value as ItemId | null;
  switch (result.outcome) {
    case "correct":
      return value ? { kind: "item", item: value, heard, result } : { kind: "none", heard, result };
    case "incomplete":
      return { kind: "incomplete", item: value, heard, result };
    case "near-miss":
      return { kind: "nearMiss", item: nearestItem(heard), heard, result };
    case "different-answer":
      return { kind: "different", heard, result };
    default:
      return { kind: "none", heard, result };
  }
}

/** Success-only live judging of interim results: an item, or null (keep listening). */
export function judgeAskLive(alternatives: Alternatives): ItemId | null {
  const alts = prepared(alternatives);
  const live = askMatcher.matchLive(alts);
  if (live.outcome !== "correct" || !live.value) return null;
  const item = live.value as ItemId;
  if (item === "pen" || item === "pencil") {
    // "pen…" may become "pencil", "pencil…" may become "pencil case".
    const tokens = (alts[0] ?? "").split(/\s+/).filter(Boolean);
    const last = tokens[tokens.length - 1] ?? "";
    if (/^pen/.test(last)) return null;
  }
  return item;
}

/* ------------------------------------------------------------ yes / no */

const YES_WORDS = new Set(["yes", "yeah", "yep", "yea", "yah", "ya", "yess", "yes's", "yesh", "jes", "iesu", "yus"]);
const NO_WORDS = new Set(["no", "nope", "nah", "know", "noh", "nou", "nó"]);
const NEGATION = new Set(["dont", "don", "not", "donut", "doesnt"]);

export type AnswerJudgement = "yes" | "no" | "unclear" | "none";

function judgeTokens(text: string): AnswerJudgement {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (!tokens.length) return "none";
  const hasYes = tokens.some((t) => YES_WORDS.has(t));
  const hasNo = tokens.some((t) => NO_WORDS.has(t)) || tokens.some((t) => NEGATION.has(t));
  if (hasYes && hasNo) return "unclear";
  if (hasYes) return "yes";
  if (hasNo) return "no";
  for (let i = 0; i + 1 < tokens.length; i++) if (tokens[i] === "i" && tokens[i + 1] === "do") return "yes";
  return "none";
}

/**
 * Judges "Yes, I do." / "No, I don't.". Only the top hypothesis decides; a
 * later one may only rescue an attempt in which nothing was recognised.
 */
export function judgeAnswer(alternatives: Alternatives): AnswerJudgement {
  const alts = normalizeAlternatives(alternatives).map((a) => a.normalized);
  if (!alts.length) return "none";
  const top = judgeTokens(alts[0]);
  if (top !== "none") return top;
  for (const alt of alts.slice(1)) {
    const j = judgeTokens(alt);
    if (j === "yes" || j === "no") return j;
  }
  return "none";
}

/** Live: accept only a clear yes/no word ("I do…" could still become "I don't"). */
export function judgeAnswerLive(alternatives: Alternatives): "yes" | "no" | null {
  const alts = normalizeAlternatives(alternatives).map((a) => a.normalized);
  if (!alts.length) return null;
  const tokens = alts[0].split(/\s+/).filter(Boolean);
  const hasYes = tokens.some((t) => YES_WORDS.has(t));
  const hasNo = tokens.some((t) => NO_WORDS.has(t) || NEGATION.has(t));
  if (hasYes && !hasNo) return "yes";
  if (hasNo && !hasYes) return "no";
  return null;
}
