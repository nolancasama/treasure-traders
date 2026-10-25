import { areasAtStart, chestAtStart } from "../content/chapters";
import type { ChapterId, NpcId } from "../content/ids";
import { generateChapter } from "./generator";
import { cloneHoldings } from "./holdings";
import type { GameState, Mode, NpcMemory } from "./types";

/** Deterministic per-chapter seed from the campaign seed. */
export function chapterSeed(campaignSeed: number, chapter: ChapterId): number {
  let h = (campaignSeed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (chapter * 0x85ebca6b), 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h % 1_000_000;
}

/** A fresh random seed for a new campaign or a replay. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000);
}

export interface StartOptions {
  mode: Mode;
  campaignSeed: number;
  /** Overrides the derived chapter seed (?seed=N, replays). */
  seed?: number;
  /** The campaign state of the chapter just cleared (keeps memory, stickers, stats). */
  previous?: GameState;
}

/**
 * The canonical start state of a chapter (SPEC §3.6): the generated instance,
 * its start inventory, the chest's earlier deposits and the open areas.
 * Anything the player still carried goes to the spare box by construction.
 */
export function startChapter(chapter: ChapterId, opts: StartOptions): GameState {
  const seed = opts.seed ?? chapterSeed(opts.campaignSeed, chapter);
  const { instance } = generateChapter(chapter, seed);
  const holdings = cloneHoldings(instance.holdings);
  const chest = chestAtStart(chapter);
  if (chest.length) {
    const inv = { ...(holdings.chest ?? {}) };
    for (const c of chest) inv[c] = (inv[c] ?? 0) + 1;
    holdings.chest = inv;
  }
  const prev = opts.previous;
  const memory: Partial<Record<NpcId, NpcMemory>> = {};
  if (prev) {
    for (const [npc, m] of Object.entries(prev.memory)) {
      if (m) memory[npc as NpcId] = { met: m.met, wantKnown: false, traded: 0, helped: false };
    }
  }
  return {
    version: 1,
    mode: opts.mode,
    campaignSeed: opts.campaignSeed,
    chapter,
    instance,
    holdings,
    roles: { ...instance.roles },
    flags: {},
    once: {},
    memory,
    journal: { facts: {}, wants: {}, needs: {}, met: prev ? [...prev.journal.met] : [] },
    stickers: prev ? [...prev.stickers] : [],
    unlockedAreas: areasAtStart(chapter),
    completedChapters: prev ? [...prev.completedChapters] : [],
    chapterComplete: false,
    finished: prev?.finished ?? false,
    question: null,
    serial: prev?.serial ?? 0,
    askCounts: {},
    stats: prev ? { ...prev.stats } : { questionsAsked: 0, answersGiven: 0, helped: 0 },
    position: null
  };
}

/** A new campaign at Chapter 1. */
export function newCampaign(campaignSeed = randomSeed()): GameState {
  return startChapter(1, { mode: "campaign", campaignSeed });
}

/** After `chapterComplete`, the next chapter's start state (campaign or replay end). */
export function nextChapter(state: GameState): GameState | null {
  if (!state.chapterComplete || state.chapter === 5 || state.mode === "replay") return null;
  return startChapter((state.chapter + 1) as ChapterId, { mode: "campaign", campaignSeed: state.campaignSeed, previous: state });
}

/** A replay of a cleared chapter with a new puzzle (SPEC §12). */
export function replayChapter(chapter: ChapterId, seed: number): GameState {
  return startChapter(chapter, { mode: "replay", campaignSeed: seed, seed });
}
