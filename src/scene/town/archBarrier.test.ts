import { afterEach, expect, it, vi } from "vitest";
import * as THREE from "three";
import { PartBuilder } from "../partBuilder";
import { ARCH_BARRIER, gateGeometry } from "./builders";
import { SignBatch } from "./signs";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("hangs the east-facing measured sign between two ropes attached to its upper corners", () => {
  // Canvas measurement determines the real sign quad and backing together.
  const context = { measureText: (text: string) => ({ width: text.length * 32 }), beginPath() {}, roundRect() {}, fill() {}, fillText() {} };
  vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
  const wires = vi.spyOn(PartBuilder.prototype, "wire");
  const barrier = gateGeometry("arch"), p = barrier.getAttribute("position");
  const board = new THREE.Box3().setFromPoints(Array.from({ length: 36 }, (_, i) => new THREE.Vector3().fromBufferAttribute(p, i)));
  const label = new SignBatch().add("soon", ARCH_BARRIER.textOffset, ARCH_BARRIER.centerY, 0, ARCH_BARRIER.textHeight, ARCH_BARRIER.yaw).build();
  const text = new THREE.Box3().setFromBufferAttribute(label.getAttribute("position") as THREE.BufferAttribute);
  expect(text.min.z - board.min.z).toBeCloseTo(0.08);
  expect(board.max.z - text.max.z).toBeCloseTo(0.08);
  expect(text.min.y).toBeGreaterThan(board.min.y);
  expect(text.max.y).toBeLessThan(board.max.y);
  expect(text.min.x).toBeGreaterThan(board.max.x);
  expect(label.getAttribute("normal").getX(0)).toBeCloseTo(1);
  expect(wires.mock.calls).toHaveLength(2);
  for (const [post, corner, sag, , , thickness = 0.035] of wires.mock.calls) {
    expect(post[0]).toBe(0);
    expect(Math.abs(post[2])).toBe(4);
    expect(post[1]).toBeLessThan(1.4);
    expect(post[1]).toBeGreaterThan(board.max.y);
    expect(corner[0]).toBe(0);
    expect(corner[1]).toBeCloseTo(board.max.y);
    expect(Math.abs(corner[2])).toBeCloseTo(board.max.z);
    expect(post[2] * corner[2]).toBeGreaterThan(0);
    // The whole span stays beyond the painted inset, even at rope thickness.
    expect(Math.abs(corner[2]) - thickness / 2).toBeGreaterThan(text.max.z);
    expect(sag).toBeLessThan(post[1] - board.max.y);
  }
  barrier.dispose(); label.dispose();
});
