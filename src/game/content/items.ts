import { ITEM_IDS, type ItemId } from "./ids";

/** English, article and Japanese for one stationery item (SPEC §2). */
export interface ItemInfo {
  id: ItemId;
  en: string;
  article: "a" | "an";
  plural: string;
  ja: string;
}

export const ITEMS: Record<ItemId, ItemInfo> = {
  pen: { id: "pen", en: "pen", article: "a", plural: "pens", ja: "ペン" },
  marker: { id: "marker", en: "marker", article: "a", plural: "markers", ja: "マーカー" },
  ruler: { id: "ruler", en: "ruler", article: "a", plural: "rulers", ja: "じょうぎ" },
  stapler: { id: "stapler", en: "stapler", article: "a", plural: "staplers", ja: "ホッチキス" },
  calendar: { id: "calendar", en: "calendar", article: "a", plural: "calendars", ja: "カレンダー" },
  notebook: { id: "notebook", en: "notebook", article: "a", plural: "notebooks", ja: "ノート" },
  eraser: { id: "eraser", en: "eraser", article: "an", plural: "erasers", ja: "けしゴム" },
  pencil: { id: "pencil", en: "pencil", article: "a", plural: "pencils", ja: "えんぴつ" },
  pencilCase: { id: "pencilCase", en: "pencil case", article: "a", plural: "pencil cases", ja: "ふでばこ" }
};

/** "a pen", "an eraser", "a pencil case" — the only place articles are decided. */
export function withArticle(id: ItemId): string {
  const info = ITEMS[id];
  return `${info.article} ${info.en}`;
}

/** "Do you have a pen?" */
export function askSentence(id: ItemId): string {
  return `Do you have ${withArticle(id)}?`;
}

/** Japanese support for the question. */
export function askSentenceJa(id: ItemId): string {
  return `${ITEMS[id].ja}を持っている？`;
}

export const YES_SENTENCE = "Yes, I do.";
export const NO_SENTENCE = "No, I don't.";
export const YES_JA = "うん、持っているよ。";
export const NO_JA = "ううん、持っていないよ。";

/** Items in canonical order (backpack slots, journal, chest). */
export const ALL_ITEMS: readonly ItemId[] = ITEM_IDS;

export function isItemId(v: unknown): v is ItemId {
  return typeof v === "string" && (ITEM_IDS as readonly string[]).includes(v);
}
