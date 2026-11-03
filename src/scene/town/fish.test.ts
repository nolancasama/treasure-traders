import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { FISH_JUMP_DISTANCE, FISH_SPOTS, FISH_WATER_MARGIN, fishJumpTransform } from "./ambient";
import { fishGeometry } from "./builders";
import { HARBOR_BOATS, isOpenWater, landGeometry, WATER_Y } from "./ground";

describe("harbor fish trajectories", () => {
  it("keeps takeoff, every rotated body vertex, and landing beyond the shoreline and boats", () => {
    const geometry = fishGeometry(), positions = geometry.getAttribute("position");
    const matrix = new THREE.Matrix4(), vertex = new THREE.Vector3();
    let radius = 0;
    for (let i = 0; i < positions.count; i++) radius = Math.max(radius, vertex.fromBufferAttribute(positions, i).length());
    expect(FISH_WATER_MARGIN).toBeGreaterThan(radius);
    for (const spot of FISH_SPOTS) {
      for (let step = 0; step <= 200; step++) {
        const jump = step / 200;
        fishJumpTransform(spot, jump, matrix);
        expect(isOpenWater(spot[0] + jump * FISH_JUMP_DISTANCE, spot[1], FISH_WATER_MARGIN), `${spot}, phase ${jump}`).toBe(true);
        for (let i = 0; i < positions.count; i++) {
          vertex.fromBufferAttribute(positions, i).applyMatrix4(matrix);
          expect(isOpenWater(vertex.x, vertex.z, 0.15), `${spot}, phase ${jump}, vertex ${i}`).toBe(true);
        }
      }
    }
    geometry.dispose();
  });

  it("rejects the old western spawn and proves it was on the actual grassy mesh", () => {
    expect(isOpenWater(-11, 39)).toBe(false);
    const geometry = landGeometry(), material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.updateMatrixWorld();
    const hits = new THREE.Raycaster(new THREE.Vector3(-11, 5, 39), new THREE.Vector3(0, -1, 0)).intersectObject(mesh);
    expect(hits.some(hit => hit.point.y > WATER_Y + 0.15)).toBe(true);
    // The other old western spawn also intersected the moored yacht's footprint.
    expect(isOpenWater(-3, 41, FISH_WATER_MARGIN)).toBe(false);
    geometry.dispose(); material.dispose();
  });

  it("excludes sand lips, the pier and all three shared boat placements", () => {
    expect(isOpenWater(0, 20)).toBe(false);
    expect(isOpenWater(-11, 40)).toBe(false);
    expect(isOpenWater(8, 48)).toBe(false);
    for (const boat of Object.values(HARBOR_BOATS)) expect(isOpenWater(boat.x, boat.z)).toBe(false);
  });

  it("collapses resting fish so no lowered ground can reveal the idle instances", () => {
    const geometry = fishGeometry(), positions = geometry.getAttribute("position"), point = new THREE.Vector3();
    for (const spot of FISH_SPOTS) {
      const matrix = fishJumpTransform(spot, -1);
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(matrix);
        expect(point.toArray()).toEqual([spot[0], WATER_Y - 2, spot[1]]);
      }
    }
    geometry.dispose();
  });
});
