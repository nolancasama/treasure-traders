import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { OPEN, findPath, isWalkable, moveCircle } from "../../game/world/collision";
import { SOLIDS } from "../../game/world/layout";
import { libraryGeometry } from "./builders";
import { insideLibrary, libraryEastCutMask } from "./libraryCutaway";

describe("library doorway and camera cutaway", () => {
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  function blocked(geometry: THREE.BufferGeometry, from: THREE.Vector3, to: THREE.Vector3) {
    const distance = from.distanceTo(to), mesh = new THREE.Mesh(geometry, material);
    mesh.updateMatrixWorld(true);
    return new THREE.Raycaster(from, to.clone().sub(from).normalize(), 0, distance - 0.01).intersectObject(mesh).length > 0;
  }
  it("has one centered clear doorway, no side gaps, and a continuous lintel", () => {
    const geometry = libraryGeometry(SOLIDS, false);
    for (const z of [-42.75, -42, -41.25]) for (const y of [0.7, 1.7, 2.6])
      expect(blocked(geometry, new THREE.Vector3(-10.8, y, z), new THREE.Vector3(-13, y, z)), `opening y=${y},z=${z}`).toBe(false);
    expect(blocked(geometry, new THREE.Vector3(-10.8, 3, -42), new THREE.Vector3(-13, 3, -42))).toBe(true);
    for (const z of [-43.59, -40.41]) for (const y of [0.7, 1.7])
      expect(blocked(geometry, new THREE.Vector3(-10.8, y, z), new THREE.Vector3(-13, y, z)), `wall z=${z}`).toBe(true);
    geometry.dispose();
  });
  it("walks through the one doorway, and is stopped by the walls and the open door leaf", () => {
    expect(moveCircle(-9, -42, -15, -42, undefined, OPEN).x).toBeCloseTo(-15, 5);
    expect(moveCircle(-15, -42, -9, -42, undefined, OPEN).x).toBeCloseTo(-9, 5);
    for (const z of [-44.5, -39.5]) expect(moveCircle(-9, z, -15, z, undefined, OPEN).x, `wall z=${z}`).toBeGreaterThan(-12);
    expect(moveCircle(-10.9, -41.5, -10.9, -45, undefined, OPEN).z, "door leaf").toBeGreaterThan(-43);
    expect(isWalkable(-12, -42, OPEN)).toBe(true);
    const route = findPath({ x: -5, z: -42 }, { x: -18, z: -40 }, OPEN);
    expect(route.length).toBeGreaterThan(0);
    expect(route.at(-1)).toEqual({ x: -18, z: -40 });
  });
  it("switches at the real doorway boundary, retaining the far entrance wall", () => {
    expect(insideLibrary({ x: -11.75, z: -42 })).toBe(false);
    expect(insideLibrary({ x: -12.25, z: -42 })).toBe(true);
    const player = { x: -18, y: 0.12, z: -40 };
    expect(libraryEastCutMask({ x: -17, y: 6.32, z: -33 }, player)).toBe(0);
  });
  it("keeps both head sightlines clear across the doorway camera transition", () => {
    // Start with the exterior follow camera, then sample its actual exponential
    // approach to the indoor +1,+6.2,+7 offset as the player walks west.
    const camera = new THREE.Vector3(-7.75, 8.12, -31);
    for (let frame = 0; frame < 120; frame++) {
      const player = { x: -11.75 - frame / 60, y: 0.12, z: -42 };
      const indoors = insideLibrary(player), offset = indoors ? [1, 6.2, 7] : [4, 8, 11];
      camera.lerp(new THREE.Vector3(player.x + offset[0], player.y + offset[1], player.z + offset[2]), 1 - Math.exp(-6 / 60));
      const mask = libraryEastCutMask(camera, player), geometry = libraryGeometry(SOLIDS, indoors, mask);
      for (const y of [0.6, 1.6]) expect(blocked(geometry, camera, new THREE.Vector3(player.x, player.y + y, player.z)), `frame ${frame},mask ${mask}`).toBe(false);
      geometry.dispose();
    }
  });
});
