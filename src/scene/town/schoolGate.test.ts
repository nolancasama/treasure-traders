import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { TREES } from "../../game/world/layout";
import { PartBuilder } from "../partBuilder";
import { addTree, gateGeometry, schoolGateWheelGeometry } from "./builders";
import { advanceSchoolGate, SCHOOL_GATE_SECONDS, SCHOOL_GATE_SLOT, SCHOOL_GATE_TRACK_TOP, SCHOOL_GATE_TRAVEL, SCHOOL_GATE_WHEEL_RADIUS, SCHOOL_GATE_WHEEL_Y } from "./schoolGate";

describe("school gate travel", () => {
  it("eases over three seconds, settles exactly, and supports reversal and restoration", () => {
    const animation = { target: 0, from: 0, elapsed: 0 };
    let progress = 0, previous = 0;
    for (let frame = 1; frame <= 180; frame++) {
      progress = advanceSchoolGate(progress, 1, 1 / 60, animation);
      expect(progress).toBeGreaterThan(previous);
      if (frame < 180) expect(progress).toBeLessThan(1);
      if (frame === 60) expect(progress).toBeCloseTo(7 / 27);
      previous = progress;
    }
    expect(progress).toBe(1);
    expect(advanceSchoolGate(progress, 1, 5, animation)).toBe(1);
    progress = advanceSchoolGate(progress, 0, 0.5, animation);
    expect(progress).toBeLessThan(1);
    expect(advanceSchoolGate(progress, 0, SCHOOL_GATE_SECONDS, animation)).toBe(0);
    // Continue can replace progress with its settled pose during an animation.
    expect(advanceSchoolGate(1, 1, 0, animation)).toBe(1);
  });

  it("fits the real panel and rollers through the portal and keeps the parked end captured", () => {
    const panel = gateGeometry("school"), roller = schoolGateWheelGeometry();
    panel.computeBoundingBox(); roller.computeBoundingBox();
    const panelBox = panel.boundingBox!, wheelBox = roller.boundingBox!.clone().translate(new THREE.Vector3(0, SCHOOL_GATE_WHEEL_Y, 0.18));
    for (const bounds of [panelBox, wheelBox]) {
      expect(bounds.min.z).toBeGreaterThan(SCHOOL_GATE_SLOT.north);
      expect(bounds.max.z).toBeLessThan(SCHOOL_GATE_SLOT.south);
      expect(bounds.max.y).toBeLessThan(SCHOOL_GATE_SLOT.top);
      expect(bounds.min.y).toBeGreaterThanOrEqual(SCHOOL_GATE_TRACK_TOP - 1e-7);
    }
    expect(SCHOOL_GATE_WHEEL_Y - SCHOOL_GATE_WHEEL_RADIUS).toBeCloseTo(SCHOOL_GATE_TRACK_TOP);
    const parkedWest = panelBox.min.x + SCHOOL_GATE_TRAVEL;
    expect(parkedWest).toBeGreaterThan(3.57);
    expect(parkedWest).toBeLessThan(4.43);
    // Both roller centres stay on the fixed runner throughout the sweep.
    for (const x of [-3.2, 3.2]) {
      expect(x).toBeGreaterThan(-4.5);
      expect(x + SCHOOL_GATE_TRAVEL).toBeLessThan(13.2);
    }
    panel.dispose(); roller.dispose();
  });

  it("clears the unchanged nearby tree across the entire travel", () => {
    const tree = TREES.square.find(t => t.x === 12 && t.z === -20.2)!;
    expect(tree).toBeDefined();
    const builder = new PartBuilder(0);
    addTree(builder, tree);
    const geometry = builder.build(), positions = geometry.getAttribute("position");
    const panel = gateGeometry("school"), roller = schoolGateWheelGeometry();
    panel.computeBoundingBox(); roller.computeBoundingBox();
    const swept = [panel.boundingBox!.clone().translate(new THREE.Vector3(0, 0, -22))];
    for (const x of [-3.2, 3.2]) swept.push(roller.boundingBox!.clone().translate(new THREE.Vector3(x, SCHOOL_GATE_WHEEL_Y, -21.82)));
    for (const box of swept) box.max.x += SCHOOL_GATE_TRAVEL;
    // Triangle bounding boxes conservatively prove separation even before
    // considering the gate's gaps, so no scenery needs moving.
    for (let i = 0; i < positions.count; i += 3) {
      const bounds = new THREE.Box3().setFromPoints([0, 1, 2].map(offset => new THREE.Vector3().fromBufferAttribute(positions, i + offset)));
      // Include the scenery shader's maximum wind displacement as well.
      bounds.expandByVector(new THREE.Vector3(0.09, 0, 0.06));
      for (const box of swept) expect(bounds.intersectsBox(box), `tree triangle ${i / 3}`).toBe(false);
    }
    geometry.dispose(); panel.dispose(); roller.dispose();
  });
});
