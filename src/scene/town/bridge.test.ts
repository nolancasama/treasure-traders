import { afterEach, expect, it, vi } from "vitest";
import * as THREE from "three";
import { SOLIDS } from "../../game/world/layout";
import { PartBuilder, wirePoint } from "../partBuilder";
import { gateGeometry, PALETTE } from "./builders";

afterEach(() => { vi.restoreAllMocks(); });

it("supports every rope endpoint on both rails, including both leaf ends in either pose", () => {
  const boxes = vi.spyOn(PartBuilder.prototype, "box"), wires = vi.spyOn(PartBuilder.prototype, "wire");
  const geometry = gateGeometry("bridge");
  const posts = boxes.mock.calls.filter(call => call[6] === PALETTE.wood);
  const planks = boxes.mock.calls.filter(call => call[1] === 0.05);
  expect(posts).toHaveLength(14);
  expect(wires.mock.calls).toHaveLength(12);
  const plankTop = planks[0][4] + planks[0][1];
  for (const side of [-1, 1]) {
    const rail = posts.filter(post => Math.sign(post[3]) === side).sort((a, b) => a[5] - b[5]);
    const spans = wires.mock.calls.filter(call => Math.sign(call[0][0]) === side);
    expect(rail).toHaveLength(7);
    expect(spans).toHaveLength(6);
    for (const post of rail) expect(post[4]).toBeCloseTo(plankTop);
    for (const post of [rail[0], rail.at(-1)!]) {
      // The entire end-post foot rests on a real deck plank.
      expect(planks.some(plank => post[5] - post[2] / 2 >= plank[5] - plank[2] / 2 - 1e-8
        && post[5] + post[2] / 2 <= plank[5] + plank[2] / 2 + 1e-8)).toBe(true);
    }
    for (const [a, b, sag] of spans) {
      expect(b[2] - a[2]).toBeCloseTo(spans[0][1][2] - spans[0][0][2]);
      expect(wirePoint(a, b, sag, 0.5)[1]).toBeCloseTo(a[1] - 0.14);
      for (const endpoint of [a, b]) {
        const post = rail.find(p => Math.abs(p[5] - endpoint[2]) < 1e-8)!;
        expect(post, `unsupported rope at ${endpoint}`).toBeDefined();
        // Town uses a single rigid leaf at this hinge, raised by 0.5 radians.
        for (const angle of [0, -0.5]) {
          const leaf = new THREE.Matrix4().makeRotationX(angle).setPosition(0, 0.12, 17.2);
          const ropeWorld = new THREE.Vector3(...endpoint).applyMatrix4(leaf);
          const postAttachment = new THREE.Vector3(post[3], endpoint[1], post[5]).applyMatrix4(leaf);
          expect(ropeWorld.distanceTo(postAttachment)).toBeLessThan(1e-8);
          expect(endpoint[1]).toBeGreaterThan(post[4]);
          expect(endpoint[1]).toBeLessThan(post[4] + post[1]);
        }
      }
    }
    // Batch 1's unchanged rail colliders still enclose the lowered posts/rope.
    const collider = SOLIDS.find(s => s.id === `bridge-rail-${side < 0 ? "west" : "east"}`)!;
    expect(collider.kind).toBe("box");
    if (collider.kind !== "box") throw new Error("Expected bridge rail box");
    for (const [w, h, d, x, y, z] of rail) {
      expect(Math.abs(x - collider.x) + w / 2).toBeLessThanOrEqual(collider.hx);
      expect(Math.abs(z + 17.2 - collider.z) + d / 2).toBeLessThanOrEqual(collider.hz);
      expect(y + 0.12).toBeGreaterThanOrEqual(collider.y);
      expect(y + h + 0.12).toBeLessThanOrEqual(collider.y + collider.height);
    }
  }
  geometry.dispose();
});
