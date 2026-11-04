import { describe, expect, it } from "vitest";
import { NPC_IDS, type NpcId } from "../game/content/ids";
import { CLOSED, OPEN, isWalkable } from "../game/world/collision";
import { HOUSES, NPC_HOMES, TREES, FINALE_CREW, FINALE_VIEW, npcPosition, STAGE, chestPose } from "../game/world/layout";
import { DISTRICT_IDS } from "../game/content/ids";
import { blockedHeads, CAMERA_BLOCKERS, conversationShot, followOffset, segmentHits, squareViewWeight, type Blocker } from "./cameraRig";
import { FOLLOW_CAMERA, SQUARE_CAMERA } from "../game/world/followCamera";

const at = (x: number, y: number, z: number) => ({ x, y, z });

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

describe("Village Square follow view", () => {
  it("looks straight along the bridge everywhere in the square and on the deck", () => {
    for (const p of [{ x: 0, z: 0 }, { x: -18, z: -18 }, { x: 18, z: 18 }, { x: -10, z: 8 }, { x: 0, z: 18.5 }, { x: 0, z: 24 }, { x: 2.1, z: 30.5 }]) {
      expect(followOffset(p), JSON.stringify(p)).toEqual(SQUARE_CAMERA.offset);
    }
  });
  it("leaves the other districts on the normal follow view", () => {
    for (const p of [{ x: 39, z: 0 }, { x: 0, z: -37 }, { x: -19, z: -42 }, { x: -47, z: 0 }, { x: 8, z: 41 }, { x: 20, z: 33 }]) {
      expect(followOffset(p), JSON.stringify(p)).toEqual(FOLLOW_CAMERA.offset);
    }
  });
  it("eases across every district boundary with no jump", () => {
    const routes = [[{ x: 10, z: 0 }, { x: 39, z: 0 }], [{ x: -10, z: 0 }, { x: -47, z: 0 }], [{ x: 0, z: -10 }, { x: 0, z: -37 }], [{ x: 0, z: 25 }, { x: 0, z: 45 }]];
    for (const [a, b] of routes) {
      let last = squareViewWeight(a);
      for (let i = 1; i <= 500; i++) {
        const weight = squareViewWeight({ x: a.x + (b.x - a.x) * i / 500, z: a.z + (b.z - a.z) * i / 500 });
        expect(Math.abs(weight - last)).toBeLessThan(0.05);
        expect(weight).toBeLessThanOrEqual(last);
        last = weight;
      }
      expect(last).toBe(0);
    }
  });
});
