/**
 * The pure game model (SPEC §3–§7, §12). No React, three.js or DOM.
 *
 * Usage: every interaction returns a Step `{ state, beats, prompt }`. Save the
 * state, play the beats (lines, gestures, events), then show the prompt (an
 * Ask or an Answer prompt) and feed the child's verdict back in.
 */
export type * from "./types";
export { talk, ask, answer, collect, inspect, leave, playerHolds } from "./interact";
export { objectives, askCards, indicators, unasked, placement, type Placement } from "./objectives";
export { startChapter, newCampaign, nextChapter, replayChapter, chapterSeed, randomSeed, type StartOptions } from "./state";
export { generateChapter, LIBRARY_SPOTS, GROUNDS_SPOTS, SQUARE_SPOTS } from "./generator";
export { validate, solve, consistencyProblems, remainingTargets, missionsDone, spotActive, BANDS, type AbstractAction } from "./solver";
export { count, has, itemsOf, totals } from "./holdings";
export {
  SAVE_KEY,
  REPLAY_KEY,
  SETTINGS_KEY,
  BACKUP_KEY,
  loadSlot,
  saveSlot,
  clearSlot,
  serialize,
  problemWith,
  loadSettings,
  saveSettings,
  memoryStorage,
  DEFAULT_SETTINGS,
  type Settings,
  type StorageLike,
  type LoadNotice
} from "./save";
export { judgeAsk, judgeAskLive, judgeAnswer, judgeAnswerLive, type AskJudgement, type AnswerJudgement } from "./speechJudge";
