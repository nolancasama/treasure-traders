import { describe, expect, it } from "vitest";
import { CHAPTER_IDS, DISTRICT_IDS, NPC_IDS } from "../content/ids";
import type { ChapterId } from "../content/ids";
import { GROUNDS_SPOTS, LIBRARY_SPOTS, SQUARE_SPOTS } from "../logic/generator";
import { placement } from "../logic/objectives";
import { startChapter } from "../logic/state";
import { CLOSED, OPEN, findPath, isWalkable, moveCircle, nearestWalkable, standY } from "./collision";
import { DISTRICTS, NPC_HOMES, SOLIDS, SPOTS, SURFACES, npcPosition } from "./layout";
import type { Gates, Point } from "./types";

const gatesFor = (chapter: ChapterId): Gates => ({ cart: chapter >= 2, school: chapter >= 3, bridge: chapter >= 4, arch: chapter >= 5 });
const spawn = { x: 0, z: 7 };
function checkRoute(route: Point[], gates: Gates, from = spawn) {
  expect(route.length).toBeGreaterThan(0);
  let a = from;
  for (const b of route) {
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.12));
    for (let i = 1; i <= steps; i++) {
      expect(isWalkable(a.x + (b.x - a.x) * i / steps, a.z + (b.z - a.z) * i / steps, gates)).toBe(true);
    }
    a = b;
  }
}

describe("world collision", () => {
  it("blocks visible solid footprints and keeps every closed district inaccessible", () => {
    expect(isWalkable(0, 0, OPEN)).toBe(false);
    for (const solid of SOLIDS) expect(isWalkable(solid.x, solid.z, OPEN), solid.id).toBe(false);
    for (const id of DISTRICT_IDS.slice(1)) expect(isWalkable(DISTRICTS[id].x, DISTRICTS[id].z, CLOSED), id).toBe(false);
    for (const id of DISTRICT_IDS.slice(1)) expect(isWalkable(DISTRICTS[id].x, DISTRICTS[id].z, OPEN), id).toBe(true);
  });

  it("keeps water closed and opens only the lowered drawbridge crossing", () => {
    expect(isWalkable(0, 24, CLOSED)).toBe(false);
    expect(isWalkable(0, 24, OPEN)).toBe(true);
    expect(isWalkable(8, 24, OPEN)).toBe(false);
    expect(isWalkable(18, 43, OPEN)).toBe(false);
    const stopped = moveCircle(0, 17, 0, 35, 0.35, CLOSED);
    expect(stopped.z).toBeLessThan(20);
    const crossed = moveCircle(0, 17, 0, 35, 0.35, OPEN);
    expect(crossed.z).toBeCloseTo(35);
  });

  it("slides along land edges while preserving movement along the edge", () => {
    const moved = moveCircle(17, 8, 22, 12, 0.35, CLOSED);
    expect(moved.x).toBeLessThanOrEqual(17.65 + 1e-5);
    expect(moved.z).toBeCloseTo(12);
    expect(isWalkable(moved.x, moved.z, CLOSED)).toBe(true);
  });

  it("substeps stop a long frame crossing a thin board, library wall or gate", () => {
    const board = moveCircle(8, 6, 16, 6, 0.35, OPEN);
    expect(board.x).toBeLessThan(10.81);
    const wall = moveCircle(-20, -39, -30, -39, 0.35, OPEN);
    expect(wall.x).toBeGreaterThan(-25.46);
    const gate = moveCircle(0, -18, 0, -38, 0.35, CLOSED);
    expect(gate.z).toBeGreaterThan(-21.31);
  });

  it("relocates corrupt saves, water, scenery and newly closed districts onto open land", () => {
    for (const p of [{ x: NaN, z: Infinity }, { x: 0, z: 0 }, { x: 40, z: 0 }, { x: -19, z: -42 }, { x: 20, z: 48 }, { x: 999, z: -999 }]) {
      const safe = nearestWalkable(p.x, p.z, CLOSED);
      expect(Number.isFinite(safe.x) && Number.isFinite(safe.z)).toBe(true);
      expect(isWalkable(safe.x, safe.z, CLOSED)).toBe(true);
    }
    expect(nearestWalkable(3, 7, CLOSED)).toEqual({ x: 3, z: 7 });
    expect(standY(0, 24)).toBe(0.12);
    expect(standY(8, 47)).toBe(0.12);
    expect(standY(-19, -42)).toBe(0.12);
    expect(standY(6, 8)).toBe(0);
  });

  it("routes around the fountain and enters the library through its doorway", () => {
    checkRoute(findPath({ x: -7, z: 0 }, { x: 7, z: 0 }, OPEN), OPEN, { x: -7, z: 0 });
    checkRoute(findPath(spawn, SPOTS["library-1"], OPEN), OPEN);
    checkRoute(findPath(spawn, SPOTS["grounds-1"], OPEN), OPEN);
  });
});

describe("world content contract", () => {
  it("maps every core spot to a visible horizontal support surface", () => {
    const ids = [...Object.values(SQUARE_SPOTS), ...LIBRARY_SPOTS, ...GROUNDS_SPOTS];
    expect(Object.keys(SPOTS).sort()).toEqual(ids.sort());
    for (const id of ids) {
      const p = SPOTS[id];
      expect(SURFACES.some((s) => Math.abs(s.x - p.x) <= s.hx && Math.abs(s.z - p.z) <= s.hz && Math.abs(s.y - p.y) < 1e-6), id).toBe(true);
      const standing = nearestWalkable(p.x, p.z, OPEN);
      expect(Math.hypot(standing.x - p.x, standing.z - p.z), id).toBeLessThan(1.9);
    }
  });

  for (const chapter of CHAPTER_IDS) it(`reaches all chapter ${chapter} spots and role placements with its canonical gates`, () => {
    const gates = gatesFor(chapter);
    const state = startChapter(chapter, { mode: "campaign", campaignSeed: 1234, seed: 17 });
    for (const spot of state.instance.spots) {
      const target = SPOTS[spot.id];
      expect(target, spot.id).toBeDefined();
      const route = findPath(spawn, target, gates);
      checkRoute(route, gates);
      const end = route[route.length - 1];
      expect(Math.hypot(end.x - target.x, end.z - target.z), spot.id).toBeLessThan(1.9);
    }
    for (const npc of NPC_IDS.filter((id) => !!state.roles[id])) {
      const target = npcPosition(chapter, npc, placement(state, npc));
      expect(isWalkable(target.x, target.z, gates), npc).toBe(true);
      checkRoute(findPath(spawn, target, gates), gates);
    }
    // Earlier districts remain usable after each new gate opens.
    for (const district of state.unlockedAreas) {
      const target = district === "square" ? spawn : DISTRICTS[district];
      checkRoute(findPath(spawn, target, gates), gates);
    }
  });

  it("has walkable home feet and distinct placements for all returning characters", () => {
    for (const npc of NPC_IDS) {
      const p = NPC_HOMES[npc];
      expect(isWalkable(p.x, p.z, OPEN), npc).toBe(true);
      expect(p.y, npc).toBeCloseTo(standY(p.x, p.z));
      const festival = npcPosition(5, npc, "festival");
      expect(isWalkable(festival.x, festival.z, OPEN), npc).toBe(true);
    }
    expect(npcPosition(3, "ume", "asker1")).not.toEqual(npcPosition(3, "ken", "asker2"));
  });
});
