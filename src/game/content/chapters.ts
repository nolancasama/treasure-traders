import type { ChapterId, DistrictId, ItemId } from "./ids";
import { DISTRICT_IDS } from "./ids";
import type { Line } from "./cast";

export interface ChapterInfo {
  id: ChapterId;
  district: DistrictId;
  title: Line;
  /** Items deposited into the Festival Chest this chapter (SPEC §6). */
  targets: ItemId[];
  /** Ask-prompt cards (cumulative, SPEC §2). Chapter 1 has no Ask prompt. */
  cards: ItemId[];
  /** Area that opens when this chapter is cleared. */
  unlocks: DistrictId | null;
}

export const CHAPTERS: Record<ChapterId, ChapterInfo> = {
  1: {
    id: 1, district: "square",
    title: { en: "The Big Wind", ja: "大きな風" },
    targets: ["pencil", "eraser"],
    cards: [],
    unlocks: "market"
  },
  2: {
    id: 2, district: "market",
    title: { en: "Market Trades", ja: "市場でこうかん" },
    targets: ["ruler", "marker"],
    cards: ["pen", "pencil", "eraser", "ruler", "marker"],
    unlocks: "school"
  },
  3: {
    id: 3, district: "school",
    title: { en: "Lost and Found", ja: "落とし物さがし" },
    targets: ["notebook", "pencilCase"],
    cards: ["pen", "pencil", "eraser", "ruler", "marker", "notebook", "pencilCase"],
    unlocks: "harbor"
  },
  4: {
    id: 4, district: "harbor",
    title: { en: "Harbor Deliveries", ja: "港のおとどけもの" },
    targets: ["calendar", "stapler"],
    cards: ["pen", "marker", "ruler", "stapler", "calendar", "notebook", "eraser", "pencil", "pencilCase"],
    unlocks: "festival"
  },
  5: {
    id: 5, district: "festival",
    title: { en: "Festival Day!", ja: "おまつりの日！" },
    targets: ["pen"],
    cards: ["pen", "marker", "ruler", "stapler", "calendar", "notebook", "eraser", "pencil", "pencilCase"],
    unlocks: null
  }
};

/** Items already in the Festival Chest when a chapter starts (canonical, SPEC §3.6). */
export function chestAtStart(chapter: ChapterId): ItemId[] {
  const out: ItemId[] = [];
  for (let c = 1; c < chapter; c++) out.push(...CHAPTERS[c as ChapterId].targets);
  return out;
}

/** Districts open when a chapter starts. */
export function areasAtStart(chapter: ChapterId): DistrictId[] {
  return DISTRICT_IDS.slice(0, chapter) as DistrictId[];
}

export const DISTRICT_NAMES: Record<DistrictId, Line> = {
  square: { en: "Village Square", ja: "村の広場" },
  market: { en: "Stationery Market", ja: "文ぼう具の市場" },
  school: { en: "Schoolhouse", ja: "学校" },
  harbor: { en: "Riverside & Harbor", ja: "川と港" },
  festival: { en: "Festival Grounds", ja: "おまつり会場" }
};
