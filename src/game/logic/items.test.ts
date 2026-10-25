import { describe, expect, it } from "vitest";
import { ITEM_IDS } from "../content/ids";
import { ITEMS, askSentence, withArticle } from "../content/items";
import { cloneHoldings, move, sameTotals, totals, isValidHoldings } from "./holdings";
import type { Holdings } from "./types";

describe("items and articles", () => {
  it("uses 'an' only for eraser", () => {
    for (const id of ITEM_IDS) expect(ITEMS[id].article).toBe(id === "eraser" ? "an" : "a");
    expect(withArticle("eraser")).toBe("an eraser");
    expect(withArticle("pencilCase")).toBe("a pencil case");
  });

  it("builds every target question exactly as SPEC §2 lists them", () => {
    expect(ITEM_IDS.map(askSentence)).toEqual([
      "Do you have a pen?",
      "Do you have a marker?",
      "Do you have a ruler?",
      "Do you have a stapler?",
      "Do you have a calendar?",
      "Do you have a notebook?",
      "Do you have an eraser?",
      "Do you have a pencil?",
      "Do you have a pencil case?"
    ]);
  });
});

describe("holdings", () => {
  const start: Holdings = { player: { pen: 1 }, lily: { ruler: 1 }, "spot:library-1": { notebook: 1 } };

  it("moves exactly one item and keeps totals", () => {
    const h = move(start, "pen", "player", "lily");
    expect(h.player?.pen).toBeUndefined();
    expect(h.lily).toEqual({ ruler: 1, pen: 1 });
    expect(sameTotals(start, h)).toBe(true);
    expect(start.player?.pen).toBe(1);
  });

  it("refuses to move what a holder does not have", () => {
    expect(() => move(start, "marker", "player", "lily")).toThrow();
    expect(() => move(start, "pen", "player", "lily", 2)).toThrow();
  });

  it("counts totals across holders and validates shapes", () => {
    expect(totals(start)).toEqual({ pen: 1, ruler: 1, notebook: 1 });
    expect(isValidHoldings(cloneHoldings(start))).toBe(true);
    expect(isValidHoldings({ player: { pen: -1 } })).toBe(false);
    expect(isValidHoldings({ player: { crayon: 1 } })).toBe(false);
  });
});
