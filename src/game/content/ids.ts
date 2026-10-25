/**
 * Frozen ids shared by every slice (SPEC §2, §8, §9). Changing one needs a
 * DESIGN_DECISIONS.md entry first.
 */

/** Canonical order: backpack slots, journal, festival chest slots. */
export const ITEM_IDS = [
  "pen",
  "marker",
  "ruler",
  "stapler",
  "calendar",
  "notebook",
  "eraser",
  "pencil",
  "pencilCase"
] as const;
export type ItemId = (typeof ITEM_IDS)[number];

export const NPC_IDS = [
  "pom",
  "ume",
  "ken",
  "bruno",
  "lily",
  "max",
  "sara",
  "green",
  "page",
  "yuki",
  "tom",
  "emma",
  "bo",
  "finn",
  "mia",
  "leo",
  "dan",
  "aya"
] as const;
export type NpcId = (typeof NPC_IDS)[number];

export type CharacterId = NpcId | "player" | "kiwi";

/** In chapter order: the district each chapter takes place in. */
export const DISTRICT_IDS = ["square", "market", "school", "harbor", "festival"] as const;
export type DistrictId = (typeof DISTRICT_IDS)[number];

export const CHAPTER_IDS = [1, 2, 3, 4, 5] as const;
export type ChapterId = (typeof CHAPTER_IDS)[number];
