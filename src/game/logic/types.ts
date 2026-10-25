import type { ChapterId, CharacterId, DistrictId, ItemId, NpcId } from "../content/ids";
import type { StickerId } from "../content/stickers";

/** Who can hold items. Spots are abstract world locations (`spot:library-3`). */
export type HolderId = "player" | NpcId | `spot:${string}` | "chest" | "seaChest" | "spare";
/** Item counts; a missing entry means zero. */
export type Inventory = Partial<Record<ItemId, number>>;
/** Holdings of every populated holder. */
export type Holdings = Partial<Record<HolderId, Inventory>>;

/** A conversation partner: a person or the Captain's talking sea chest. */
export type Target = NpcId | "seaChest";

/** An NPC's role in the current chapter (SPEC §3.4). */
export type Role =
  | { kind: "mayor" }
  /** Holds `offer`, wants `want`; after a swap the two exchange (undoable). */
  | { kind: "trader"; offer: ItemId; want: ItemId }
  /** Gives `item` once when asked about it. */
  | { kind: "giver"; item: ItemId }
  /** Needs `count` of `need`; reward is an item it holds or unlocking the sea chest.
   *  `intro` = asks "Do you have a <need>?" before the task starts (Ms. Page). */
  | { kind: "requester"; need: ItemId; count: number; reward: { item: ItemId } | { seaChest: true }; intro?: boolean }
  | { kind: "bystander" }
  /** Lost & Found student who lost `lost`. */
  | { kind: "student"; lost: ItemId }
  /** Ms. Green: hands out the lost items, then rewards `reward`. */
  | { kind: "teacher"; lost: ItemId[]; reward: ItemId }
  /** Chapter 1 Grandma Ume: asks about `item`; a truthful "No" gets it. */
  | { kind: "askGiver"; item: ItemId }
  /** Chapter 1 Ken: asks about `item`, borrows it and gives it back. */
  | { kind: "borrower"; item: ItemId }
  /** Optional side question; truthful answer earns `sticker`. */
  | { kind: "sticker"; sticker: StickerId };

/** A world location holding an item. */
export interface SpotDef {
  id: string;
  /** collect: visible pickup; hidden: sparkles only nearby; distractor: inspect only (never collected). */
  kind: "collect" | "hidden" | "distractor";
  item: ItemId;
  /** Mission flag that must be set before the spot is active (e.g. "libraryStarted"). */
  requires?: string;
}

/** A generated (or fixed) chapter puzzle. Persisted verbatim in the save. */
export interface ChapterInstance {
  chapter: ChapterId;
  seed: number;
  /** True when every seed attempt failed and the canonical instance was used. */
  fallback: boolean;
  /** People present and interactive in this chapter, with their role. */
  roles: Partial<Record<NpcId, Role>>;
  /** Initial holdings: player start inventory, NPCs, spots and the sea chest. */
  holdings: Holdings;
  targets: ItemId[];
  spots: SpotDef[];
  /** The Captain's sea chest silhouettes (Chapter 4). */
  seaChest: ItemId[] | null;
  /** Shortest number of transactions to the goal (validated band). */
  minTransactions: number;
}

/** A question an NPC (or the sea chest) is waiting for the player to answer. */
export type QuestionKind =
  | "trade"
  | "need"
  | "deposit"
  | "teaser"
  | "askGive"
  | "borrow"
  | "teacher"
  | "libraryIntro"
  | "libraryReturn"
  | "sticker";

export interface Question {
  id: string;
  kind: QuestionKind;
  target: Target;
  item: ItemId;
  /** "Yes" is truthful only when the player holds at least this many. */
  count: number;
  contradictions: number;
}

/** What an NPC remembers across talks (SPEC §4.8). */
export interface NpcMemory {
  met: boolean;
  /** The player has heard this NPC's want/need. */
  wantKnown: boolean;
  traded: number;
  helped: boolean;
}

/** What the student has learned, shown in the journal (SPEC §10). */
export interface Journal {
  facts: Partial<Record<NpcId, Partial<Record<ItemId, boolean>>>>;
  wants: Partial<Record<NpcId, ItemId>>;
  needs: Partial<Record<NpcId, ItemId>>;
  /** Everyone met in the whole campaign (portraits stay in the journal). */
  met: NpcId[];
}

/** Lifetime counters for the results card (no scores, SPEC §1). */
export interface Stats {
  questionsAsked: number;
  answersGiven: number;
  helped: number;
}

export type Mode = "campaign" | "replay";

/** The whole persisted game. JSON-only; every public transition returns a new value. */
export interface GameState {
  version: 1;
  mode: Mode;
  campaignSeed: number;
  chapter: ChapterId;
  instance: ChapterInstance;
  holdings: Holdings;
  roles: Partial<Record<NpcId, Role>>;
  /** Mission flags of the current chapter. */
  flags: Record<string, boolean>;
  /** Transaction ids already applied (exactly-once). */
  once: Record<string, true>;
  memory: Partial<Record<NpcId, NpcMemory>>;
  journal: Journal;
  stickers: StickerId[];
  unlockedAreas: DistrictId[];
  completedChapters: ChapterId[];
  /** Set when the chapter's last deposit has happened (the flow then starts the next one). */
  chapterComplete: boolean;
  /** The campaign's ending has played. */
  finished: boolean;
  question: Question | null;
  /** Bumped per question so stale answers are ignored. */
  serial: number;
  /** How many sticker questions each asker has asked (for deterministic item choice). */
  askCounts: Partial<Record<NpcId, number>>;
  stats: Stats;
  /** Player position for Continue; the world relocates invalid positions. */
  position: { x: number; z: number; yaw: number } | null;
}

/** Everything the flow layer animates or records. Transaction events carry a once id. */
export type GameEvent =
  | { type: "itemMoved"; onceId: string; item: ItemId; from: HolderId; to: HolderId; count: number }
  | { type: "pickup"; item: ItemId; spotId: string }
  | { type: "journalFact"; npc: NpcId; item: ItemId; has: boolean }
  | { type: "journalWant"; npc: NpcId; item: ItemId }
  | { type: "journalNeed"; npc: NpcId; item: ItemId }
  | { type: "missionComplete"; onceId: string; id: string }
  | { type: "missionStarted"; id: string }
  | { type: "chestDeposit"; onceId: string; items: ItemId[]; total: number }
  | { type: "decorationLevel"; onceId: string; count: number }
  | { type: "areaUnlocked"; onceId: string; district: DistrictId }
  | { type: "sticker"; onceId: string; id: StickerId }
  | { type: "bagCheck"; item: ItemId; has: boolean }
  | { type: "lockOpened"; onceId: string; index: number; item: ItemId }
  | { type: "seaChestOpened"; onceId: string }
  | { type: "seaChestUnlocked"; onceId: string }
  | { type: "posterDone"; onceId: string }
  | { type: "chapterComplete"; onceId: string; chapter: ChapterId }
  | { type: "finale"; onceId: string };

export type Mood = "neutral" | "happy" | "sad" | "surprised";
export type Gesture = "nod" | "shake" | "cheer" | "give" | "think" | "sad" | "bagCheck" | "talk";

/** One thing to present: a spoken line or an event to animate/record. */
export type Beat =
  | {
      kind: "say";
      speaker: CharacterId | "seaChest";
      en: string;
      ja: string;
      mood?: Mood;
      gesture?: Gesture;
      showItem?: ItemId;
      /** Kiwi Japanese-only coaching (no TTS of the Japanese). */
      jaOnly?: boolean;
    }
  | { kind: "event"; event: GameEvent };

/** Input requested next. Answer prompts carry the question id to answer. */
export type Prompt =
  | { kind: "answer"; target: Target; item: ItemId; questionId: string; count: number; questionEn: string; questionJa: string }
  | { kind: "ask"; target: Target; cards: ItemId[] }
  | null;

/** The result of every public interaction. Save `state` before playing `beats`. */
export interface Step {
  state: GameState;
  beats: Beat[];
  prompt: Prompt;
}

/** Where an objective marker points. */
export type ObjectiveTarget =
  | { kind: "npc"; id: NpcId }
  | { kind: "spot"; id: string }
  | { kind: "area"; id: DistrictId }
  | { kind: "seaChest" };

/** A current goal with graduated hints (SPEC §6.7). Derived from state. */
export interface Objective {
  id: string;
  en: string;
  ja: string;
  /** Target English sentence to show, e.g. "Do you have a ruler?". */
  sentence?: string;
  counter?: { current: number; total: number; item?: ItemId };
  target: ObjectiveTarget | null;
  hint1: string;
  hint2: string;
  hint3: ObjectiveTarget | null;
}

/** World indicator over a person. */
export type Indicator = "ask" | "canAsk" | "sticker" | "done" | null;
