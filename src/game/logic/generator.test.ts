import { describe, expect, it } from "vitest";
import type { ChapterId, NpcId } from "../content/ids";
import { generateChapter } from "./generator";
import { BANDS, solve, validate } from "./solver";

const SEEDS = 2000;

describe("generated chapters (SPEC §7)", () => {
  it("Chapter 1 is fixed and valid", () => {
    const { instance } = generateChapter(1, 12345);
    expect(instance.fallback).toBe(false);
    expect(validate(instance).ok).toBe(true);
    expect(instance.minTransactions).toBe(BANDS[1]);
  });

  for (const chapter of [2, 3, 4, 5] as ChapterId[]) {
    it(`Chapter ${chapter}: ${SEEDS} seeds are valid, solvable, in band, without dead ends or fallbacks`, () => {
      const roleSignatures = new Set<string>();
      let retries = 0;
      for (let seed = 0; seed < SEEDS; seed++) {
        // generateChapter only returns a non-fallback instance that passed validate().
        const { instance, attempts } = generateChapter(chapter, seed);
        retries += attempts - 1;
        expect(instance.fallback, `seed ${seed}`).toBe(false);
        expect(instance.minTransactions).toBe(BANDS[chapter]);
        if (seed % 100 === 0) expect(validate(instance).reasons, `seed ${seed}`).toEqual([]);
        roleSignatures.add(
          Object.entries(instance.roles)
            .map(([n, r]) => `${n}:${r!.kind}:${JSON.stringify(r)}`)
            .sort()
            .join("|")
        );
      }
      // Controlled variation: many distinct role/item assignments (SPEC §11).
      expect(roleSignatures.size).toBeGreaterThan(chapter === 2 ? 40 : 200);
      expect(retries).toBe(0);
    }, 120_000);
  }

  it("varies which merchant holds the ruler in Chapter 2", () => {
    const holders = new Set<NpcId>();
    for (let seed = 0; seed < 200; seed++) {
      const { instance } = generateChapter(2, seed);
      const r = Object.entries(instance.roles).find(([, role]) => role?.kind === "trader" && role.offer === "ruler");
      holders.add(r![0] as NpcId);
    }
    expect([...holders].sort()).toEqual(["bruno", "lily", "max", "sara"]);
  });

  it("is deterministic per seed", () => {
    expect(generateChapter(4, 77).instance).toEqual(generateChapter(4, 77).instance);
    expect(generateChapter(4, 77).instance).not.toEqual(generateChapter(4, 78).instance);
  });

  it("detects a circular, unsolvable trade setup", () => {
    const { instance } = generateChapter(4, 3);
    const broken = structuredClone(instance);
    // The calendar trader now wants the calendar itself back: impossible.
    for (const [npc, r] of Object.entries(broken.roles)) {
      if (r?.kind === "trader" && r.offer === "calendar") broken.roles[npc as NpcId] = { kind: "trader", offer: "calendar", want: "stapler" };
    }
    const v = validate(broken);
    expect(v.ok).toBe(false);
    expect(solve(broken).solvable).toBe(false);
  });

  it("generates and validates a chapter quickly", () => {
    const t0 = performance.now();
    for (let seed = 0; seed < 50; seed++) generateChapter(3, seed);
    expect((performance.now() - t0) / 50).toBeLessThan(50);
  });
});
