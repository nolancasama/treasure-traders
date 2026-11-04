import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { OPEN, findPath, isWalkable } from "../../game/world/collision";
import { canInteract, INTERACTION_RANGE } from "../../game/world/interaction";
import { NPC_HOMES, npcPosition, SOLIDS } from "../../game/world/layout";
import { createWorld, worldStateFromGame } from "../../game/runtime";
import { startChapter } from "../../game/logic/state";
import { buildCharacter } from "./people";
import { equipPainter, painterFacesPlayer } from "./painter";

describe("painters reach their fixed artwork", () => {
  for (const id of ["ken", "leo"] as const) {
    it(`${id}'s actual brush clears the surface over the complete blended cycle`, () => {
      const rig = buildCharacter(id), brush = equipPainter(rig), home = NPC_HOMES[id];
      rig.group.position.set(home.x, home.y, home.z);
      rig.group.rotation.y = home.yaw!;
      const vertex = new THREE.Vector3(), tip = new THREE.Vector3();
      let closest = Infinity, closestArt = Infinity;
      const gap = (p: THREE.Vector3) => id === "ken" ? 11.34 - p.x : p.x - (-10 + 0.201 - (p.y - 0.76) * 0.31 / 1.7);
      // 40 seconds covers both periodic idle envelopes and the slower breathing
      // channels. Warm-up allows the normal animation blend to settle first.
      for (let frame = 0; frame < 5040; frame++) {
        rig.update(1 / 120); rig.group.updateMatrixWorld(true);
        if (frame < 240) continue;
        const positions = brush.geometry.getAttribute("position");
        for (let i = 0; i < positions.count; i++) {
          vertex.fromBufferAttribute(positions, i).applyMatrix4(brush.matrixWorld);
          closest = Math.min(closest, gap(vertex));
        }
        tip.set(0, 0.245, 0).applyMatrix4(brush.matrixWorld);
        if (rig.paintingMoment === "painting" && tip.y >= (id === "ken" ? 1.18 : 0.9) && tip.y <= (id === "ken" ? 1.7 : 1.3)) closestArt = Math.min(closestArt, gap(tip));
      }
      expect(closest).toBeGreaterThan(0.04);
      expect(closestArt).toBeGreaterThan(0.04);
      expect(closestArt).toBeLessThan(0.12);
      const solid = SOLIDS.find(s => s.id === (id === "ken" ? "notice-board" : "harbor-easel"))!;
      expect(solid.kind).toBe("box");
      if (solid.kind === "box") expect(Math.abs(home.x - solid.x) - solid.hx - rig.radius).toBeGreaterThan(0.05);
      rig.dispose(); rig.mesh.skeleton.dispose();
    });

    it(`${id} stays reachable from the open side and returns to painting after Bye`, () => {
      const home = NPC_HOMES[id], side = id === "ken" ? -1 : 1;
      const approach = { x: home.x + side * 1.8, y: home.y, z: home.z };
      expect(INTERACTION_RANGE).toBe(2.4);
      expect(isWalkable(home.x, home.z, OPEN)).toBe(true);
      expect(isWalkable(approach.x, approach.z, OPEN)).toBe(true);
      expect(findPath(approach, home, OPEN).length).toBeGreaterThan(0);
      expect(canInteract(approach, { target: { kind: "npc", id }, position: home }, OPEN)).toBe(true);
      expect(painterFacesPlayer(id, true, { mode: "conversation", target: home }, home)).toBe(true);
      expect(painterFacesPlayer(id, true, { mode: "follow" }, home)).toBe(false);
      expect(painterFacesPlayer(id, false, { mode: "follow" }, home)).toBe(true);
      for (const chapter of [1, 2, 3, 4, 5] as const) {
        expect(npcPosition(chapter, id, "home")).toEqual(home);
        const state = startChapter(chapter, { mode: "campaign", campaignSeed: 19, seed: 19 }), snapshot = worldStateFromGame(state);
        const world = createWorld(snapshot);
        expect(world.positionOf({ kind: "npc", id })).toEqual(snapshot.npcs[id]);
        expect(JSON.stringify(state)).not.toContain('"yaw"');
      }
    });
  }
});
