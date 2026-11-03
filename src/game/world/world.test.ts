import { describe, expect, it } from "vitest";
import { CHAPTER_IDS, DISTRICT_IDS, NPC_IDS } from "../content/ids";
import type { ChapterId } from "../content/ids";
import { GROUNDS_SPOTS, LIBRARY_SPOTS, SQUARE_SPOTS } from "../logic/generator";
import { placement } from "../logic/objectives";
import { startChapter } from "../logic/state";
import { createWorld, navigationGates, worldStateFromGame } from "../runtime";
import { activateInteraction, approachInteraction, stepController, updateFocus } from "../../scene/WorldController";
import { CLOSED, OPEN, findPath, isWalkable, moveCircle, nearestWalkable, standY } from "./collision";
import { canInteract, interactionFocus } from "./interaction";
import { DISTRICTS, GATE_SOLIDS, NPC_HOMES, SOLIDS, SPOTS, STAGE, SURFACES, npcPosition } from "./layout";
import type { Gates, Interaction, Point } from "./types";

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
    const bridge = GATE_SOLIDS.bridge;
    expect(bridge.kind).toBe("box");
    if (bridge.kind === "box") {
      expect(bridge.z - bridge.hz).toBeCloseTo(17.2);
      expect(bridge.z + bridge.hz).toBeCloseTo(20);
    }
    expect(isWalkable(0, 16.84, CLOSED)).toBe(true);
    expect(isWalkable(0, 16.86, CLOSED)).toBe(false);
    const stopped = moveCircle(0, 16, 0, 35, 0.35, CLOSED);
    expect(stopped.z).toBeGreaterThan(16.7);
    expect(stopped.z).toBeLessThanOrEqual(16.85);
    const crossed = moveCircle(0, 16, 0, 35, 0.35, OPEN);
    expect(crossed.z).toBeCloseTo(35);
    expect(moveCircle(0, 35, 0, 16, 0.35, OPEN).z).toBeCloseTo(16);
    checkRoute(findPath({ x: 0, z: 16 }, { x: 0, z: 35 }, OPEN), OPEN, { x: 0, z: 16 });
    expect(isWalkable(2.1, 24, OPEN)).toBe(false);
    expect(moveCircle(0, 24, 4, 26, 0.35, OPEN).x).toBeLessThanOrEqual(1.98 + 1e-5);
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

  it("keeps the harbor chest solid while preserving access on every side and the pier route", () => {
    const chest = SOLIDS.find(s => s.id === "sea-chest")!;
    expect(chest.x).toBe(10);
    expect(isWalkable(10, 36, OPEN)).toBe(false);
    expect(moveCircle(8, 36, 12, 36, 0.35, OPEN).x).toBeLessThan(9);
    const bo = NPC_HOMES.bo, finn = NPC_HOMES.finn;
    checkRoute(findPath(bo, finn, OPEN), OPEN, bo);
    for (const side of [{ x: 8.9, z: 36 }, { x: 11.1, z: 36 }, { x: 10, z: 35.1 }, { x: 10, z: 36.9 }]) {
      expect(isWalkable(side.x, side.z, OPEN)).toBe(true);
      checkRoute(findPath(bo, side, OPEN), OPEN, bo);
    }
  });

  it("uses the stage steps as the route up and down, with solid edges and stage furniture", () => {
    expect(SOLIDS.some(s => s.id === "stage")).toBe(false);
    expect(STAGE.hx * 2).toBe(6);
    expect(STAGE.hz * 2).toBe(12);
    expect(isWalkable(-62, 1.8, OPEN)).toBe(true);
    expect(isWalkable(-62, 1.8, { ...OPEN, arch: false })).toBe(false);
    expect(standY(-57.5, 0)).toBeCloseTo(0.2);
    expect(standY(-58.05, 0)).toBeCloseTo(0.4);
    expect(standY(-58.6, 0)).toBeCloseTo(0.6);
    expect(standY(-62, 1.8)).toBeCloseTo(0.6);
    expect(standY(-62, 1.8, CLOSED)).toBe(0);
    expect(standY(-58.95, 0)).toBeCloseTo(0.6);
    expect(moveCircle(-57, 3, -62, 3, 0.35, OPEN).x).toBeGreaterThan(-58.6);
    for (const id of ["stage-chest", "stage-drum-1", "stage-curtain--1", "stage-post-1--60.5"]) {
      const prop = SOLIDS.find(s => s.id === id)!;
      expect(prop, id).toBeDefined();
      expect(isWalkable(prop.x, prop.z, OPEN), id).toBe(false);
    }
    const field = { x: -54, z: 4 }, top = { x: -62, z: 1.8 };
    for (const [from, to] of [[field, top], [top, field]]) {
      const path = findPath(from, to, OPEN);
      checkRoute(path, OPEN, from);
      expect(path[path.length - 1]).toEqual(to);
      let previous = from, crossedOpening = false;
      for (const next of path) {
        if ((previous.x + 59) * (next.x + 59) <= 0 && previous.x !== next.x) {
          const z = previous.z + (next.z - previous.z) * (-59 - previous.x) / (next.x - previous.x);
          if (Math.abs(z) < 1.35) crossedOpening = true;
        }
        previous = next;
      }
      expect(crossedOpening).toBe(true);
    }
  });
});

describe("world interaction", () => {
  it("focuses nearby targets behind the player, rejects distant ones and uses facing only for equal distances", () => {
    const player = { x: 6, y: 0, z: 8, yaw: Math.PI / 2 };
    const behind = { target: { kind: "npc", id: "ken" } as const, position: { x: 4, y: 0, z: 8 } };
    const ahead = { target: { kind: "npc", id: "ume" } as const, position: { x: 8, y: 0, z: 8 } };
    expect(interactionFocus(player, [behind], OPEN)).toEqual(behind.target);
    expect(interactionFocus(player, [behind, ahead], OPEN)).toEqual(ahead.target);
    expect(interactionFocus(player, [{ ...behind, position: { x: 5, y: 0, z: 8 } }, ahead], OPEN)).toEqual(behind.target);
    expect(interactionFocus(player, [{ ...ahead, position: { x: 8.41, y: 0, z: 8 } }], OPEN)).toBeNull();
    expect(interactionFocus({ ...player, x: 0 }, [{ ...ahead, position: { x: 2.4, y: 0, z: 8 } }], OPEN)).toEqual(ahead.target);
  });

  it("blocks item and NPC sight through walls while leaving shelf and fountain items reachable", () => {
    const shelf = { target: { kind: "spot", id: "library-1" } as const, position: SPOTS["library-1"] };
    expect(canInteract({ x: -23.5, y: 0.12, z: -47.8 }, shelf, OPEN)).toBe(false);
    expect(canInteract({ x: -23.5, y: 0.12, z: -43.5 }, shelf, OPEN)).toBe(true);
    const npc = { target: { kind: "npc", id: "page" } as const, position: { x: -21, y: 0.12, z: -45.7 } };
    expect(canInteract({ x: -21, y: 0.12, z: -47.8 }, npc, OPEN)).toBe(false);
    expect(canInteract({ x: 3, y: 0, z: 0 }, { target: { kind: "spot", id: "square-pencil" }, position: SPOTS["square-pencil"] }, OPEN)).toBe(true);
  });

  function interactionWorld() {
    const state = worldStateFromGame(startChapter(4, { mode: "campaign", campaignSeed: 1234, seed: 17 }));
    state.gates = { ...OPEN };
    state.npcs = { ken: { x: 6, y: 0, z: 8, district: "square" } };
    state.items = [];
    state.seaChest = { items: ["pen"], locks: [false], open: false };
    return createWorld(state);
  }

  it("interacts with the solid harbor chest from every reachable side, closed or open", () => {
    for (const open of [false, true]) for (const point of [{ x: 8.7, z: 36 }, { x: 11.3, z: 36 }, { x: 10, z: 34.8 }, { x: 10, z: 37.2 }]) {
      const world = interactionWorld(), received: Interaction[] = [];
      world.runtime.state.seaChest.open = open;
      expect(isWalkable(point.x, point.z, OPEN)).toBe(true);
      world.teleport(point);
      world.onInteract(target => received.push(target));
      updateFocus(world);
      expect(world.runtime.focus).toEqual({ kind: "seaChest" });
      expect(activateInteraction(world, { kind: "seaChest" })).toBe(true);
      expect(received).toEqual([{ kind: "seaChest" }]);
    }
  });

  it("fires an already-in-range tap immediately and suppresses repeated input and locked interactions", () => {
    const world = interactionWorld(), received: Interaction[] = [], target = { kind: "npc", id: "ken" } as const;
    world.teleport({ x: 5, z: 8, yaw: -Math.PI / 2 });
    world.onInteract(entry => received.push(entry));
    approachInteraction(world, target);
    approachInteraction(world, target);
    expect(activateInteraction(world, target)).toBe(false);
    expect(received).toEqual([target]);
    world.runtime.time += 1;
    world.setInputLocked(true);
    approachInteraction(world, target);
    expect(activateInteraction(world, target)).toBe(false);
    updateFocus(world);
    expect(world.runtime.focus).toBeNull();
    expect(received).toEqual([target]);
  });

  it("walks a distant tap into range and fires once without requiring another tap", () => {
    const world = interactionWorld(), received: Interaction[] = [], target = { kind: "npc", id: "ken" } as const;
    world.teleport({ x: 0, z: 8 });
    world.onInteract(entry => received.push(entry));
    expect(activateInteraction(world, target)).toBe(false);
    approachInteraction(world, target);
    expect(world.runtime.pending).toEqual(target);
    expect(received).toEqual([]);
    for (let frame = 0; frame < 100 && !received.length; frame++) stepController(world, 1 / 30);
    expect(received).toEqual([target]);
    expect(Math.hypot(world.runtime.player.x - 6, world.runtime.player.z - 8)).toBeLessThanOrEqual(2.4);
    expect(world.runtime.pending).toBeNull();
    expect(world.runtime.path).toEqual([]);
    stepController(world, 1 / 30);
    expect(received).toEqual([target]);
  });
});

describe("rendered gate timing", () => {
  function bridgeWorld() {
    const state = worldStateFromGame(startChapter(4, { mode: "campaign", campaignSeed: 1234 }));
    state.gates = { ...OPEN };
    const world = createWorld(state);
    world.teleport({ x: 0, z: 16 });
    return world;
  }

  it("treats gates as settled without a renderer and keeps restored gates at their final pose", () => {
    const world = bridgeWorld();
    expect(world.runtime.gateProgress).toBeNull();
    expect(navigationGates(world.runtime)).toEqual(OPEN);
    world.runtime.gateProgress = { cart: 0, school: 0.25, bridge: 0.5, arch: 0.75 };
    world.setState(world.runtime.state, { settleGates: true });
    expect(world.runtime.gateProgress).toEqual({ cart: 1, school: 1, bridge: 1, arch: 1 });
    world.teleport({ x: 8, z: 47 });
    expect(world.runtime.player.z).toBe(47);
  });

  it("blocks keyboard crossing until the last rendered increment and closes immediately", () => {
    const world = bridgeWorld(), rt = world.runtime;
    rt.gateProgress = { cart: 1, school: 1, bridge: 0.999, arch: 1 };
    expect(navigationGates(rt).bridge).toBe(false);
    for (let frame = 0; frame < 30; frame++) stepController(world, 0.1, { x: 0, y: -1 });
    expect(rt.player.z).toBeLessThanOrEqual(16.85);
    rt.gateProgress.bridge = 1;
    expect(navigationGates(rt).bridge).toBe(true);
    for (let frame = 0; frame < 30; frame++) stepController(world, 0.1, { x: 0, y: -1 });
    expect(rt.player.z).toBeGreaterThan(29);
    rt.state.gates.bridge = false;
    expect(navigationGates(rt).bridge).toBe(false);
    expect(isWalkable(0, 24, navigationGates(rt))).toBe(false);
  });

  it("retains a walk requested just after unlock and starts it only once rendered open", () => {
    const world = bridgeWorld(), rt = world.runtime;
    rt.gateProgress = { cart: 1, school: 1, bridge: 0.5, arch: 1 };
    expect(world.walkTo({ x: 0, z: 35 })).toBe(true);
    expect(rt.deferredWalk?.point).toEqual({ x: 0, z: 35 });
    stepController(world, 0.1);
    expect(rt.player.z).toBe(16);
    expect(rt.path).toEqual([]);
    rt.gateProgress.bridge = 1;
    for (let frame = 0; frame < 100; frame++) stepController(world, 0.1);
    expect(rt.deferredWalk).toBeNull();
    expect(Math.abs(rt.player.z - 35)).toBeLessThan(0.15);
    expect(rt.path).toEqual([]);
    world.teleport({ x: 0, z: 16 });
    rt.gateProgress.bridge = 0.5;
    world.walkTo({ x: 0, z: 35 });
    world.setInputLocked(true);
    expect(rt.deferredWalk).toBeNull();
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
