/**
 * Festival stickers (SPEC §6.6): two per chapter from sticker askers in
 * Chapters 2–5, plus the anchor from the Captain's sea chest.
 */
export const STICKER_IDS = ["balloon", "star", "fish", "flower", "bell", "lantern", "kite", "fireworks", "anchor"] as const;
export type StickerId = (typeof STICKER_IDS)[number];

export const STICKERS: Record<StickerId, { en: string; ja: string }> = {
  balloon: { en: "balloon", ja: "ふうせん" },
  star: { en: "star", ja: "ほし" },
  fish: { en: "fish", ja: "さかな" },
  flower: { en: "flower", ja: "花" },
  bell: { en: "bell", ja: "すず" },
  lantern: { en: "lantern", ja: "ちょうちん" },
  kite: { en: "kite", ja: "たこ" },
  fireworks: { en: "fireworks", ja: "花火" },
  anchor: { en: "anchor", ja: "いかり" }
};

/** The two asker stickers of each chapter, in order. */
export const CHAPTER_STICKERS: Record<2 | 3 | 4 | 5, [StickerId, StickerId]> = {
  2: ["balloon", "star"],
  3: ["fish", "flower"],
  4: ["bell", "lantern"],
  5: ["kite", "fireworks"]
};

export function isStickerId(v: unknown): v is StickerId {
  return typeof v === "string" && (STICKER_IDS as readonly string[]).includes(v);
}
