import { CHAPTERS } from "../content/chapters";
import type { ChapterId, ItemId, NpcId } from "../content/ids";
import { CHAPTER_STICKERS, type StickerId } from "../content/stickers";
import { makeRng, shuffle } from "./rng";
import { validate } from "./solver";
import type { ChapterInstance, Holdings, Role, SpotDef } from "./types";

/** Abstract spot ids the world maps to positions (SPEC §7). */
export const LIBRARY_SPOTS = ["library-1", "library-2", "library-3", "library-4", "library-5", "library-6", "library-7", "library-8"];
export const GROUNDS_SPOTS = ["grounds-1", "grounds-2", "grounds-3", "grounds-4", "grounds-5", "grounds-6"];
export const SQUARE_SPOTS = { pencil: "square-pencil", eraser: "square-eraser" } as const;

/** Earlier chapters' people who may come back as sticker askers. */
const EARLIER_CAST: Record<2 | 3 | 4 | 5, NpcId[]> = {
  2: ["ume", "ken"],
  3: ["ume", "ken", "bruno", "lily", "max", "sara"],
  4: ["ume", "ken", "bruno", "lily", "max", "sara", "green", "page", "yuki", "tom", "emma"],
  5: ["bruno", "lily", "max", "sara", "green", "page", "yuki", "tom", "emma", "bo", "finn", "leo"]
};

const inv = (...items: ItemId[]) => {
  const out: Partial<Record<ItemId, number>> = {};
  for (const i of items) out[i] = (out[i] ?? 0) + 1;
  return out;
};

type Draft = Omit<ChapterInstance, "minTransactions" | "fallback">;

function stickerAskers(chapter: 2 | 3 | 4 | 5, roles: Partial<Record<NpcId, Role>>, rand: () => number): NpcId[] {
  const pool = EARLIER_CAST[chapter].filter((n) => !roles[n]);
  const picked = shuffle(pool, rand).slice(0, 2);
  const stickers = shuffle(CHAPTER_STICKERS[chapter], rand) as StickerId[];
  picked.forEach((n, i) => (roles[n] = { kind: "sticker", sticker: stickers[i] }));
  return picked;
}

/** Chapter 1 is fixed (SPEC §6.1). */
export function chapter1(): Draft {
  return {
    chapter: 1,
    seed: 0,
    roles: { pom: { kind: "mayor" }, ume: { kind: "askGiver", item: "pen" }, ken: { kind: "borrower", item: "eraser" } },
    holdings: {
      ume: inv("pen"),
      [`spot:${SQUARE_SPOTS.pencil}`]: inv("pencil"),
      [`spot:${SQUARE_SPOTS.eraser}`]: inv("eraser")
    },
    targets: [...CHAPTERS[1].targets],
    spots: [
      { id: SQUARE_SPOTS.pencil, kind: "collect", item: "pencil" },
      { id: SQUARE_SPOTS.eraser, kind: "collect", item: "eraser" }
    ],
    seaChest: null
  };
}

/** Chapter 2 market: R, M traders, G giver, D bystander (SPEC §6.2). */
export function chapter2(seed: number): Draft {
  const rand = makeRng(seed * 7919 + 2);
  const [r, m, g, d] = shuffle<NpcId>(["bruno", "lily", "max", "sara"], rand);
  const x: ItemId = rand() < 0.5 ? "pencil" : "eraser";
  const y: ItemId = x === "pencil" ? "eraser" : "pencil";
  const penFirst = rand() < 0.5;
  const roles: Partial<Record<NpcId, Role>> = {
    pom: { kind: "mayor" },
    [r]: { kind: "trader", offer: "ruler", want: penFirst ? "pen" : x },
    [m]: { kind: "trader", offer: "marker", want: penFirst ? x : "pen" },
    [g]: { kind: "giver", item: x },
    [d]: { kind: "bystander" }
  };
  stickerAskers(2, roles, rand);
  return {
    chapter: 2,
    seed,
    roles,
    holdings: { player: inv("pen"), [r]: inv("ruler"), [m]: inv("marker"), [g]: inv(x), [d]: inv(y) },
    targets: [...CHAPTERS[2].targets],
    spots: [],
    seaChest: null
  };
}

/** Chapter 3 school: library search and Lost & Found (SPEC §6.3). */
export function chapter3(seed: number): Draft {
  const rand = makeRng(seed * 7919 + 3);
  const lost = shuffle<ItemId>(["pen", "pencil", "eraser", "ruler", "marker"], rand).slice(0, 3);
  const owners = shuffle<NpcId>(["yuki", "tom", "emma"], rand);
  const roles: Partial<Record<NpcId, Role>> = {
    pom: { kind: "mayor" },
    page: { kind: "requester", need: "notebook", count: 3, reward: { item: "notebook" }, intro: true },
    green: { kind: "teacher", lost, reward: "pencilCase" }
  };
  const holdings: Holdings = { page: inv("notebook"), green: inv("pencilCase", ...lost) };
  owners.forEach((n, i) => {
    roles[n] = { kind: "student", lost: lost[i] };
    holdings[n] = inv(...lost.filter((_, j) => j !== i), "notebook");
  });
  const spotIds = shuffle(LIBRARY_SPOTS, rand);
  const distractorItems = shuffle<ItemId>(["pen", "marker", "ruler", "stapler", "calendar", "eraser", "pencil"], rand);
  const spots: SpotDef[] = spotIds.map((id, i) =>
    i < 3
      ? { id, kind: "hidden", item: "notebook", requires: "libraryStarted" }
      : { id, kind: "distractor", item: distractorItems[i - 3] }
  );
  for (const s of spots) if (s.kind === "hidden") holdings[`spot:${s.id}`] = inv("notebook");
  stickerAskers(3, roles, rand);
  return { chapter: 3, seed, roles, holdings, targets: [...CHAPTERS[3].targets], spots, seaChest: null };
}

/** Chapter 4 harbor: calendar chain with a decoy, Captain + sea chest (SPEC §6.4). */
export function chapter4(seed: number): Draft {
  const rand = makeRng(seed * 7919 + 4);
  const [t1, t2, t3] = shuffle<NpcId>(["finn", "mia", "leo"], rand);
  const [a, b, c, d] = shuffle<ItemId>(["pen", "pencil", "eraser", "ruler", "marker", "notebook", "pencilCase"], rand);
  const decoyWant = rand() < 0.5 ? b : c;
  const others = shuffle<ItemId>(["pen", "marker", "ruler", "calendar", "notebook", "eraser", "pencil", "pencilCase"], rand);
  const silhouettes = shuffle<ItemId>(["stapler", others[0], others[1]], rand);
  const roles: Partial<Record<NpcId, Role>> = {
    pom: { kind: "mayor" },
    bo: { kind: "requester", need: c, count: 1, reward: { seaChest: true } },
    [t1]: { kind: "trader", offer: "calendar", want: a },
    [t2]: { kind: "trader", offer: a, want: b },
    [t3]: { kind: "trader", offer: d, want: decoyWant }
  };
  stickerAskers(4, roles, rand);
  return {
    chapter: 4,
    seed,
    roles,
    holdings: {
      player: inv(b, c),
      [t1]: inv("calendar"),
      [t2]: inv(a),
      [t3]: inv(d),
      seaChest: inv(...silhouettes)
    },
    targets: [...CHAPTERS[4].targets],
    spots: [],
    seaChest: silhouettes
  };
}

/** Chapter 5 festival: P trader, H requester holding W, hidden R (SPEC §6.5). */
export function chapter5(seed: number): Draft {
  const rand = makeRng(seed * 7919 + 5);
  const [p, hh, b1, b2, b3] = shuffle<NpcId>(["dan", "aya", "ume", "ken", "mia"], rand);
  const pool = shuffle<ItemId>(["marker", "ruler", "stapler", "calendar", "notebook", "eraser", "pencil", "pencilCase"], rand);
  const [w, r, ...rest] = pool;
  const spotId = GROUNDS_SPOTS[Math.floor(rand() * GROUNDS_SPOTS.length)];
  const roles: Partial<Record<NpcId, Role>> = {
    pom: { kind: "mayor" },
    [p]: { kind: "trader", offer: "pen", want: w },
    [hh]: { kind: "requester", need: r, count: 1, reward: { item: w } },
    [b1]: { kind: "bystander" },
    [b2]: { kind: "bystander" },
    [b3]: { kind: "bystander" }
  };
  stickerAskers(5, roles, rand);
  return {
    chapter: 5,
    seed,
    roles,
    holdings: {
      [p]: inv("pen"),
      [hh]: inv(w),
      [b1]: inv(rest[0]),
      [b2]: inv(rest[1]),
      [b3]: inv(rest[2]),
      [`spot:${spotId}`]: inv(r)
    },
    targets: [...CHAPTERS[5].targets],
    spots: [{ id: spotId, kind: "hidden", item: r }],
    seaChest: null
  };
}

const TEMPLATES: Record<ChapterId, (seed: number) => Draft> = {
  1: () => chapter1(),
  2: chapter2,
  3: chapter3,
  4: chapter4,
  5: chapter5
};

/** Hand-checked instances used when 50 seeds in a row fail (never expected). */
const CANONICAL_SEEDS: Record<ChapterId, number> = { 1: 0, 2: 1, 3: 1, 4: 1, 5: 1 };

export interface GenerateResult {
  instance: ChapterInstance;
  attempts: number;
}

/** Generates and validates a chapter; tries seed+1 … up to 50, then the canonical instance. */
export function generateChapter(chapter: ChapterId, seed: number): GenerateResult {
  for (let i = 0; i < 50; i++) {
    const draft = TEMPLATES[chapter](seed + i);
    const v = validate({ ...draft, fallback: false, minTransactions: 0 });
    if (v.ok) return { instance: { ...draft, fallback: false, minTransactions: v.minTransactions }, attempts: i + 1 };
    if (chapter === 1) break;
  }
  const draft = TEMPLATES[chapter](CANONICAL_SEEDS[chapter]);
  const v = validate({ ...draft, fallback: true, minTransactions: 0 });
  return { instance: { ...draft, fallback: true, minTransactions: v.minTransactions }, attempts: 51 };
}
