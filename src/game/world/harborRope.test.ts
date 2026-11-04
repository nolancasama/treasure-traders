import { describe, expect, it } from "vitest";
import { findPath, isWalkable, moveCircle, OPEN, PLAYER_R } from "./collision";
import { SOLIDS } from "./layout";
import type { Point } from "./types";

function checkPath(from: Point, to: Point) {
  const route = findPath(from, to, OPEN);
  expect(route.length).toBeGreaterThan(1);
  let previous = from;
  for (const next of route) {
    const steps = Math.ceil(Math.hypot(next.x - previous.x, next.z - previous.z) / 0.05);
    for (let i = 0; i <= steps; i++) {
      const t = steps ? i / steps : 0;
      expect(isWalkable(previous.x + (next.x - previous.x) * t, previous.z + (next.z - previous.z) * t, OPEN)).toBe(true);
    }
    previous = next;
  }
  expect(previous).toEqual(to);
  return route;
}

describe("harbor bank pier rope", () => {
  it("matches only the visible bank-crossing span and its two posts", () => {
    const solids = SOLIDS.filter(s => s.id.startsWith("harbor-rope-"));
    expect(solids.map(s => s.id)).toEqual(["harbor-rope-span-34", "harbor-rope-post-34", "harbor-rope-post-37"]);
    for (const solid of solids) {
      expect(solid.kind).toBe("box");
      expect(solid.x).toBe(11.15);
      if (solid.kind === "box") expect(solid.hx).toBe(solid.id.includes("span") ? 0.025 : 0.18);
    }
  });

  it("blocks the thin rope from either side without closing the north opening or west pier edge", () => {
    for (const z of [34, 34.6, 35.1]) {
      // Stay north of the chest when approaching from the pier side.
      const left = moveCircle(10.5, z, 12, z, PLAYER_R, OPEN);
      const right = moveCircle(12, z, 10.5, z, PLAYER_R, OPEN);
      expect(left.x).toBeLessThan(11.15 - 0.025 - PLAYER_R + 1e-5);
      expect(right.x).toBeGreaterThan(11.15 + 0.025 + PLAYER_R - 1e-5);
    }
    expect(moveCircle(10.5, 33, 12, 33, PLAYER_R, OPEN).x).toBeCloseTo(12);
    expect(moveCircle(12, 33, 10.5, 33, PLAYER_R, OPEN).x).toBeCloseTo(10.5);
    expect(moveCircle(4, 35, 6, 35, PLAYER_R, OPEN).x).toBeCloseTo(6);
  });

  it("routes either side around the north post and leaves chest and pier access", () => {
    for (const [from, to] of [[{ x: 10.2, z: 35 }, { x: 12, z: 35 }], [{ x: 12, z: 35 }, { x: 10.2, z: 35 }]]) {
      const route = checkPath(from, to);
      expect(route.some(p => p.z < 34 - 0.18 - PLAYER_R)).toBe(true);
    }
    for (const goal of [{ x: 10, z: 34.8 }, { x: 10, z: 37.2 }, { x: 8, z: 47 }]) {
      const path = findPath({ x: 12, z: 35 }, goal, OPEN);
      expect(path.length).toBeGreaterThan(0);
      expect(path.at(-1)).toEqual(goal);
    }
  });
});
