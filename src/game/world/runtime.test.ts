import { describe, expect, it } from "vitest";
import { startChapter } from "../logic";
import { createWorld, worldStateFromGame } from "../runtime";
import { stepController } from "../../scene/WorldController";
import { TapTracker } from "../../input/tap";
import { isWalkable } from "./collision";
import { followYaw } from "../../scene/cameraRig";

const make = () => createWorld(worldStateFromGame(startChapter(1, { mode: "replay", campaignSeed: 1 })));
describe("frozen world integration surface", () => {
  it("copies state inputs, relocates invalid saves preserving yaw and freezes commands", () => {
    const world = make();
    expect(Object.isFrozen(world)).toBe(true);
    const state = worldStateFromGame(startChapter(2, { mode: "replay", campaignSeed: 2 }));
    world.setState(state); state.gates.cart = false;
    expect(world.runtime.state.gates.cart).toBe(true);
    const safe = world.relocate({ x: 0, z: 24, yaw: 1.4 });
    expect(isWalkable(safe.x, safe.z, world.runtime.state.gates)).toBe(true);
    expect(safe.yaw).toBe(1.4);
  });
  it("adapts the core sea chest flags without applying model transitions", () => {
    const game = startChapter(4, { mode: "replay", campaignSeed: 2 });
    game.flags.seaLock0 = true; game.flags.seaOpened = true;
    expect(worldStateFromGame(game).seaChest).toMatchObject({ locks: [true, false, false], open: true });
  });
  it("normalizes diagonal movement and clamps long frames", () => {
    const world = make();
    const p = { ...world.runtime.player };
    stepController(world, 2, { x: 1, y: 1 });
    expect(Math.hypot(world.runtime.player.x - p.x, world.runtime.player.z - p.z)).toBeCloseTo(0.45);
  });
  it("locks movement, cancels a walk and resumes safely", () => {
    const world = make();
    expect(world.walkTo({ x: 6, z: 8 })).toBe(true);
    world.setInputLocked(true);
    stepController(world, 0.1, { x: 1, y: 0 });
    expect(world.runtime.player.x).toBe(0);
    expect(world.runtime.path).toEqual([]);
    expect(world.walkTo({ x: 6, z: 8 })).toBe(false);
    world.setInputLocked(false); stepController(world, 0.1, { x: 1, y: 0 });
    expect(world.runtime.player.x).toBeCloseTo(0.45);
  });
  it("holds a manual heading through each camera turn, then uses the new frame on a fresh press", () => {
    for (const side of [1, -1]) {
      const world = createWorld(worldStateFromGame(startChapter(5, { mode: "replay", campaignSeed: 1 })));
      world.teleport({ x: side > 0 ? 18 : -22, z: 0 });
      const rt = world.runtime, start = { ...rt.player };
      for (let frame = 0; frame < 17; frame++) {
        rt.cameraYaw = followYaw(rt.player);
        stepController(world, 0.1, { x: side, y: 0 });
        expect(rt.player.z).toBeCloseTo(start.z, 12);
        expect(rt.player.x).toBeCloseTo(start.x + side * (frame + 1) * 0.45, 10);
        expect(rt.manualInputYaw).toBe(0);
      }
      rt.cameraYaw = followYaw(rt.player);
      expect(rt.cameraYaw).toBeCloseTo(-side * Math.PI / 2);
      stepController(world, 0.1, { x: 0, y: 0, held: true });
      expect(rt.manualInputYaw).toBe(0);
      stepController(world, 0.1);
      expect(rt.manualInputYaw).toBeNull();
      const before = { ...rt.player };
      stepController(world, 0.1, { x: 0, y: 1 });
      expect(rt.player.x).toBeCloseTo(before.x + side * 0.45);
      expect(rt.player.z).toBeCloseTo(before.z);
      world.setInputLocked(true);
      expect(rt.manualInputYaw).toBeNull();
      rt.cameraYaw = 0;
      world.setInputLocked(false);
      stepController(world, 0.1, { x: 0, y: 1 });
      expect(rt.player.z).toBeCloseTo(before.z - 0.45);
      expect(rt.manualInputYaw).toBe(0);
    }
  });
  it("keeps a tapped approach when an already-unlocked world is unlocked again", () => {
    const world = make(), calls: string[] = [];
    world.onInteract(t => calls.push(t.kind));
    const p = world.positionOf({ kind: "npc", id: "ken" })!;
    expect(world.walkTo(p, { kind: "npc", id: "ken" })).toBe(true);
    stepController(world, 0.05);
    world.setInputLocked(false);
    expect(world.runtime.pending).toEqual({ kind: "npc", id: "ken" });
    for (let i = 0; i < 200; i++) stepController(world, 0.05);
    expect(calls).toEqual(["npc"]);
  });
  it("walks to an NPC, fires once, and supports event unsubscription", () => {
    const world = make(), calls: string[] = [];
    const off = world.onInteract(t => calls.push(t.kind));
    const p = world.positionOf({ kind: "npc", id: "ken" })!;
    expect(world.walkTo(p, { kind: "npc", id: "ken" })).toBe(true);
    for (let i = 0; i < 200; i++) stepController(world, 0.05);
    expect(calls).toEqual(["npc"]);
    off(); world.runtime.emitInteract({ kind: "npc", id: "ken" });
    expect(calls).toHaveLength(1);
  });
});

describe("tap vs drag", () => {
  it("rejects a drag even after returning to the origin", () => {
    const tap = new TapTracker(); tap.down(1, 0, 0); tap.move(1, 30, 0);
    expect(tap.up(1, 0, 0)).toBe(false);
    tap.down(1, 0, 0); expect(tap.up(1, 4, 3)).toBe(true);
  });
  it("rejects cancellation and multiple pointers", () => {
    const tap = new TapTracker(); tap.down(1, 0, 0); tap.down(2, 0, 0);
    expect(tap.up(2, 0, 0)).toBe(false); expect(tap.up(1, 0, 0)).toBe(false);
    tap.down(1, 0, 0); tap.cancel(); expect(tap.up(1, 0, 0)).toBe(false);
  });
});
