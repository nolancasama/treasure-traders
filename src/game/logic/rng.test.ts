import { describe, expect, it } from "vitest";
import { makeRng, shuffle } from "./rng";

describe("rng", () => {
  it("repeats for the same seed and differs for another", () => {
    const a = makeRng(42);
    const b = makeRng(42);
    const c = makeRng(43);
    const seqA = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(seqA);
    expect([c(), c(), c()]).not.toEqual(seqA);
  });

  it("shuffles without losing items", () => {
    const items = ["pen", "marker", "ruler", "stapler"];
    const out = shuffle(items, makeRng(7));
    expect([...out].sort()).toEqual([...items].sort());
    expect(items).toEqual(["pen", "marker", "ruler", "stapler"]);
  });
});
