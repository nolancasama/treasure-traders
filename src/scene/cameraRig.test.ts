import { describe, expect, it } from "vitest";
import { NPC_IDS, type NpcId } from "../game/content/ids";
import { CLOSED, OPEN, isWalkable } from "../game/world/collision";
import { HOUSES, NPC_HOMES, SOLIDS, TREES, FINALE_CREW, FINALE_VIEW, npcPosition, STAGE, chestPose, WALK_AREAS } from "../game/world/layout";
import { FOLLOW_CAMERA } from "../game/world/followCamera";
import { DISTRICT_IDS } from "../game/content/ids";
import { blockedHeads, CAMERA_BLOCKERS, conversationShot, followOffset, followYaw, segmentHits, type Blocker } from "./cameraRig";
import { createWorld, worldStateFromGame } from "../game/runtime";
import { startChapter } from "../game/logic/state";

const at = (x: number, y: number, z: number) => ({ x, y, z });

describe("district follow camera", () => {
  it("uses the frozen district angles with smooth six-metre rectangular blends", () => {
    for (const [x, expected] of [[18, 0], [21, -Math.PI / 4], [24, -Math.PI / 2], [45, -Math.PI / 2], [-22, 0], [-25, Math.PI / 4], [-28, Math.PI / 2], [-63, Math.PI / 2]]) {
      expect(followYaw({ x, z: 0 })).toBeCloseTo(expected, 12);
    }
    expect(followYaw({ x: 30, z: 15 })).toBeCloseTo(-Math.PI / 4, 12);
    expect(followYaw({ x: -40, z: 21 })).toBeCloseTo(Math.PI / 4, 12);
    const t = Math.hypot(3, 3) / 6, cornerWeight = 1 - t * t * (3 - 2 * t);
    expect(followYaw({ x: 21, z: 15 })).toBeCloseTo(-Math.PI / 2 * cornerWeight, 12);
    for (const edge of [18, 24, -22, -28]) expect(Math.abs(followYaw({ x: edge - 0.0001, z: 0 }) - followYaw({ x: edge + 0.0001, z: 0 }))).toBeLessThan(1e-7);
  });

  it("keeps the entire square, bridge, school, library and harbor at exactly zero yaw", () => {
    for (const area of WALK_AREAS.filter(a => a.id === "square" || ["school", "harbor"].includes(a.district))) {
      for (let ix = -1; ix <= 1; ix++) for (let iz = -1; iz <= 1; iz++) {
        const p = { x: area.x + ix * area.hx, z: area.z + iz * area.hz };
        expect(followYaw(p), `${area.id}: ${p.x},${p.z}`).toBe(0);
      }
    }
  });

  it("keeps the follow radius and height through both turns", () => {
    for (let x = -34; x <= 30; x += 0.25) for (const z of [0, 11, 15, 18, 21]) {
      const offset = followOffset({ x, z });
      expect(Math.hypot(offset.x, offset.z)).toBeCloseTo(FOLLOW_CAMERA.radius, 12);
      expect(offset.y).toBe(8);
    }
    expect(FOLLOW_CAMERA.targetHeight).toBe(0.8);
  });
});

/** Where a child can actually stand to talk to someone: every side within reach. */
function approaches(target: { x: number; y: number; z: number }) {
  const spots = [];
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    const x = target.x + Math.cos(a) * 1.8, z = target.z + Math.sin(a) * 1.8;
    if (isWalkable(x, z, OPEN)) spots.push({ x, y: target.y, z });
  }
  return spots;
}

describe("conversation camera", () => {
  it("segmentHits sees a wall in the way and not one beside the line", () => {
    const wall: Blocker = { x: 0, z: 0, hx: 1, hz: 0.2, y0: 0, y1: 3 };
    expect(segmentHits(at(0, 1, -3), at(0, 1, 3), wall)).toBe(true);
    expect(segmentHits(at(5, 1, -3), at(5, 1, 3), wall)).toBe(false);
    expect(segmentHits(at(0, 4, -3), at(0, 4, 3), wall)).toBe(false);
  });

  it("the old fixed framing fails this check, so a pass below means something", () => {
    // The previous camera: always the same side at the same offset.
    let blocked = 0, total = 0;
    for (const id of NPC_IDS) {
      const home = NPC_HOMES[id], target = at(home.x, home.y, home.z);
      for (const player of approaches(target)) {
        const dx = target.x - player.x, dz = target.z - player.z, d = Math.hypot(dx, dz);
        const middle = at((player.x + target.x) / 2, Math.max(player.y, target.y) + 1, (player.z + target.z) / 2);
        const old = at(middle.x - dx / d * 4 + dz / d * 3, middle.y + 2.4, middle.z - dz / d * 4 - dx / d * 3);
        total++;
        if (blockedHeads(old, player, target) > 0) blocked++;
      }
    }
    // Measured 9 of 174 when this was written; the shot chooser below must reach zero.
    expect(total).toBeGreaterThan(100);
    expect(blocked).toBeGreaterThanOrEqual(5);
  });

  it("sees both faces from every place a child can stand beside every resident", () => {
    const failures: string[] = [];
    for (const id of NPC_IDS) {
      const home = NPC_HOMES[id], target = at(home.x, home.y, home.z);
      for (const player of approaches(target)) {
        const shot = conversationShot(player, target);
        if (blockedHeads(shot.position, player, target) > 0) failures.push(`${id} from ${player.x.toFixed(1)},${player.z.toFixed(1)}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("keeps the camera out of tall scenery", () => {
    for (const id of NPC_IDS) {
      const home = NPC_HOMES[id], target = at(home.x, home.y, home.z);
      for (const player of approaches(target)) {
        const { position: p } = conversationShot(player, target);
        const inside = CAMERA_BLOCKERS.filter(b => p.x > b.x - b.hx && p.x < b.x + b.hx && p.z > b.z - b.hz && p.z < b.z + b.hz && p.y > b.y0 && p.y < b.y1);
        expect(inside, `${id} camera at ${p.x},${p.z}`).toEqual([]);
      }
    }
  });
});

describe("decorative scenery stays out of the way", () => {
  it("no tree or cottage stands where anyone can walk", () => {
    for (const id of DISTRICT_IDS) for (const t of TREES[id]) expect(isWalkable(t.x, t.z, OPEN, 0), `${id} tree ${t.x},${t.z}`).toBe(false);
    for (const h of HOUSES) for (const [dx, dz] of [[0, 0], [-h.w / 2, -h.d / 2], [h.w / 2, -h.d / 2], [-h.w / 2, h.d / 2], [h.w / 2, h.d / 2]]) {
      expect(isWalkable(h.x + dx, h.z + dz, OPEN, 0), `house ${h.x},${h.z}`).toBe(false);
    }
  });

  it("nothing tall stands directly south of a play area, where it would block the view", () => {
    // The follow camera looks north, so it looks through whatever is south of the player.
    for (const h of HOUSES) if (h.z < 0) expect(h.z, `house ${h.x}`).toBeLessThan(-18);
    for (const t of TREES.market) expect(t.z, `market tree ${t.x}`).toBeLessThan(12);
  });
});

describe("finale staging", () => {
  it("frames the moved chest straight from +x, beneath the stage header and clear of drums", () => {
    const world = createWorld(worldStateFromGame(startChapter(5, { mode: "campaign", campaignSeed: 101 })));
    world.playCutscene("finale");
    const shot = world.runtime.camera, pose = chestPose(5);
    expect(shot.mode).toBe("path");
    if (shot.mode !== "path") throw new Error("Missing finale path");
    const blockers: Blocker[] = SOLIDS.filter(s => s.id.startsWith("stage-drum-") || s.id === "stage-back-edge").map(s => {
      if (s.kind !== "box") throw new Error("Missing stage furniture");
      return { x: s.x, z: s.z, hx: s.hx, hz: s.hz, y0: s.y, y1: s.y + s.height };
    });
    blockers.push({ x: -59.28, z: 0, hx: 0.15, hz: 4.5, y0: 4.1, y1: 5.14 });
    for (const key of shot.keys) {
      expect(key.position.x).toBeGreaterThan(pose.x);
      expect(key.target.x).toBe(pose.x);
      expect(key.target.z).toBe(pose.z);
      expect(key.position.z).toBe(pose.z);
      for (const blocker of blockers) expect(segmentHits(key.position, key.target, blocker)).toBe(false);
    }
    expect(segmentHits({ x: pose.x + 9, y: 3.8, z: pose.z }, { x: pose.x, y: 2.8, z: pose.z }, blockers.at(-1)!)).toBe(false);
  });

  it("every gathered character stands on open ground, clear of the camera and of each other", () => {
    const crew = Object.entries(FINALE_CREW) as [NpcId, { x: number; z: number }][];
    expect(crew.map(([id]) => id).sort()).toEqual([...NPC_IDS].sort());
    for (const [id, p] of crew) {
      expect(isWalkable(p.x, p.z, OPEN, 0.2), id).toBe(true);
      expect(Math.hypot(p.x - FINALE_VIEW.position.x, p.z - FINALE_VIEW.position.z), `${id} is too near the lens`).toBeGreaterThan(9);
      for (const [other, q] of crew) if (other !== id) expect(Math.hypot(p.x - q.x, p.z - q.z), `${id} and ${other}`).toBeGreaterThan(0.75);
    }
  });

  it("the chest stands on the stage, so nobody can walk through it", () => {
    const pose = chestPose(5);
    expect(pose.y).toBeCloseTo(STAGE.height);
    expect(isWalkable(pose.x, pose.z, OPEN)).toBe(false);
    expect(isWalkable(chestPose(1).x, chestPose(1).z, CLOSED)).toBe(false);
  });

  it("chapter 5 people are not placed inside the new festival furniture", () => {
    for (const id of NPC_IDS) {
      const p = npcPosition(5, id, "festival");
      expect(isWalkable(p.x, p.z, OPEN), id).toBe(true);
    }
  });
});

