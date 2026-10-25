import { chestAtStart } from "../content/chapters";
import { CHAPTER_IDS, DISTRICT_IDS, NPC_IDS, type ChapterId } from "../content/ids";
import { isItemId } from "../content/items";
import { isStickerId } from "../content/stickers";
import { cloneHoldings, isValidHoldings, sameTotals } from "./holdings";
import type { GameState, Holdings } from "./types";

export const SAVE_KEY = "tt.save.v1";
export const REPLAY_KEY = "tt.replay.v1";
export const SETTINGS_KEY = "tt.settings.v1";
export const BACKUP_KEY = "tt.save.bak";
export const SAVE_VERSION = 1;

/** The subset of Web Storage the game uses (tests pass a Map-backed fake). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type LoadNotice = "corrupt" | "unknownVersion" | null;

export interface LoadResult {
  state: GameState | null;
  notice: LoadNotice;
}

/** Version upgrades: `MIGRATIONS[n]` turns a version-n save into version n+1. */
export const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {};

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isChapter = (v: unknown): v is ChapterId => (CHAPTER_IDS as readonly unknown[]).includes(v);
const isNpc = (v: unknown) => (NPC_IDS as readonly unknown[]).includes(v);

/** Structural and integrity check of a parsed save (SPEC §12). Returns a reason or null. */
export function problemWith(raw: unknown): string | null {
  if (!isObj(raw)) return "not an object";
  if (raw.version !== SAVE_VERSION) return "version";
  if (raw.mode !== "campaign" && raw.mode !== "replay") return "mode";
  if (!isNum(raw.campaignSeed) || !isChapter(raw.chapter)) return "seed/chapter";
  const inst = raw.instance;
  if (!isObj(inst) || inst.chapter !== raw.chapter || !isNum(inst.seed)) return "instance";
  if (!isObj(inst.roles) || !isValidHoldings(inst.holdings) || !Array.isArray(inst.targets) || !Array.isArray(inst.spots)) return "instance shape";
  if (!(inst.targets as unknown[]).every(isItemId)) return "targets";
  if (!isValidHoldings(raw.holdings)) return "holdings";
  if (!isObj(raw.roles) || !Object.keys(raw.roles).every(isNpc)) return "roles";
  if (!isObj(raw.flags) || !isObj(raw.once) || !isObj(raw.memory) || !isObj(raw.askCounts)) return "maps";
  const j = raw.journal;
  if (!isObj(j) || !isObj(j.facts) || !isObj(j.wants) || !isObj(j.needs) || !Array.isArray(j.met)) return "journal";
  if (!Array.isArray(raw.stickers) || !(raw.stickers as unknown[]).every(isStickerId)) return "stickers";
  if (!Array.isArray(raw.unlockedAreas) || !(raw.unlockedAreas as unknown[]).every((a) => (DISTRICT_IDS as readonly unknown[]).includes(a))) return "areas";
  if (!Array.isArray(raw.completedChapters) || !(raw.completedChapters as unknown[]).every(isChapter)) return "completed";
  if (typeof raw.chapterComplete !== "boolean" || typeof raw.finished !== "boolean" || !isNum(raw.serial)) return "flags";
  const st = raw.stats;
  if (!isObj(st) || !isNum(st.questionsAsked) || !isNum(st.answersGiven) || !isNum(st.helped)) return "stats";
  const q = raw.question;
  if (q !== null && (!isObj(q) || typeof q.id !== "string" || !isItemId(q.item) || !isNum(q.count) || !isNum(q.contradictions))) return "question";
  const p = raw.position;
  if (p !== null && (!isObj(p) || !isNum(p.x) || !isNum(p.z) || !isNum(p.yaw))) return "position";
  // Items are never created or destroyed: totals must match the chapter's start.
  const start = cloneHoldings(inst.holdings as Holdings);
  const chest = { ...(start.chest ?? {}) };
  for (const c of chestAtStart(raw.chapter as ChapterId)) chest[c] = (chest[c] ?? 0) + 1;
  start.chest = chest;
  if (!sameTotals(start, raw.holdings as Holdings)) return "item totals";
  return null;
}

/** JSON for storage. */
export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

function migrate(raw: unknown): unknown {
  if (!isObj(raw) || !isNum(raw.version)) return raw;
  let cur: Record<string, unknown> = raw;
  while (isNum(cur.version) && cur.version < SAVE_VERSION && MIGRATIONS[cur.version]) cur = MIGRATIONS[cur.version](cur);
  return cur;
}

/**
 * Loads a slot. A corrupt or unknown save is copied raw to the backup key,
 * removed, and reported so the game can start fresh with a friendly notice.
 * `relocate` moves an invalid saved position to the nearest walkable spot.
 */
export function loadSlot(
  storage: StorageLike,
  key: string,
  relocate?: (p: { x: number; z: number; yaw: number }) => { x: number; z: number; yaw: number }
): LoadResult {
  let text: string | null = null;
  try {
    text = storage.getItem(key);
  } catch {
    return { state: null, notice: null };
  }
  if (text === null) return { state: null, notice: null };
  let parsed: unknown;
  try {
    parsed = migrate(JSON.parse(text));
  } catch {
    parsed = undefined;
  }
  const problem = problemWith(parsed);
  if (problem) {
    try {
      storage.setItem(BACKUP_KEY, text);
      storage.removeItem(key);
    } catch {
      /* storage may be unavailable; the game still starts fresh */
    }
    const versioned = isObj(parsed) && isNum(parsed.version) && parsed.version !== SAVE_VERSION;
    return { state: null, notice: versioned ? "unknownVersion" : "corrupt" };
  }
  const state = parsed as GameState;
  if (state.position && relocate) state.position = relocate(state.position);
  return { state, notice: null };
}

/** Writes a slot; storage failures are swallowed (private windows, quotas). */
export function saveSlot(storage: StorageLike, key: string, state: GameState): boolean {
  try {
    storage.setItem(key, serialize(state));
    return true;
  } catch {
    return false;
  }
}

export function clearSlot(storage: StorageLike, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/* --------------------------------------------------------------- settings */

export interface Settings {
  music: number;
  effects: number;
  voice: number;
  voiceSpeed: "normal" | "slow";
  japanese: boolean;
  micFree: boolean;
  /** First-time tips already shown. */
  seenTips: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  music: 0.6,
  effects: 0.8,
  voice: 1,
  voiceSpeed: "normal",
  japanese: true,
  micFree: false,
  seenTips: []
};

const unit = (v: unknown, d: number) => (isNum(v) ? Math.min(1, Math.max(0, v)) : d);

/** Settings with every field validated and defaulted. */
export function loadSettings(storage: StorageLike): Settings {
  let raw: unknown = null;
  try {
    const t = storage.getItem(SETTINGS_KEY);
    raw = t ? JSON.parse(t) : null;
  } catch {
    raw = null;
  }
  if (!isObj(raw)) return { ...DEFAULT_SETTINGS, seenTips: [] };
  return {
    music: unit(raw.music, DEFAULT_SETTINGS.music),
    effects: unit(raw.effects, DEFAULT_SETTINGS.effects),
    voice: unit(raw.voice, DEFAULT_SETTINGS.voice),
    voiceSpeed: raw.voiceSpeed === "slow" ? "slow" : "normal",
    japanese: typeof raw.japanese === "boolean" ? raw.japanese : true,
    micFree: typeof raw.micFree === "boolean" ? raw.micFree : false,
    seenTips: Array.isArray(raw.seenTips) ? raw.seenTips.filter((t): t is string => typeof t === "string") : []
  };
}

export function saveSettings(storage: StorageLike, s: Settings): void {
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** A Map-backed storage for tests and for browsers without localStorage. */
export function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k)
  };
}
