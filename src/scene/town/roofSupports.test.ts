import { expect, it } from "vitest";
import { SOLIDS, WALK_AREAS } from "../../game/world/layout";
import { awningFaces, canopyHeight, canopyPostGeometry, CANOPY_THICKNESS, schoolFencePosts, STALL_IDS, supportedAwning, tentSupports } from "./roofSupports";

for (const id of [...STALL_IDS, "drawing-booth"]) it(`${id}: four corner posts meet the real awning slab over their whole cap`, () => {
  const s = SOLIDS.find(s => s.id === id)!;
  if (s.kind !== "box") throw new Error(id);
  const drawing = id === "drawing-booth", frame = supportedAwning(s, drawing), { roof } = frame;
  expect(frame.posts).toHaveLength(4);
  expect(new Set(frame.posts.map(p => `${p.x},${p.z}`)).size).toBe(4);
  if (!drawing) {
    expect(roof).toEqual({ zLow: s.z - s.hz - 0.35, yLow: 2.95, zHigh: s.z + s.hz + 0.35, yHigh: 3.72 });
    expect(new Set(frame.posts.map(p => p.z))).toEqual(new Set([s.z - s.hz + 0.14, s.z + s.hz - 0.14]));
  }
  for (const p of frame.posts) {
    expect(Math.abs(p.x - s.x) + 0.065).toBeLessThan(frame.halfWidth);
    expect(frame.halfWidth - Math.abs(p.x - s.x)).toBeLessThan(0.4);
    expect(p.z - 0.065).toBeGreaterThan(roof.zLow);
    expect(p.z + 0.065).toBeLessThan(roof.zHigh);
    expect(Math.min(p.z - roof.zLow, roof.zHigh - p.z)).toBeLessThan(0.5);
    for (const dz of [-0.065, 0, 0.065]) {
      const faces = awningFaces(roof, p.z + dz);
      expect(p.top).toBeGreaterThan(faces.underside);
      expect(p.top).toBeLessThan(faces.top);
    }
    if (drawing && p.bottom) {
      expect(p.bottom).toBe(0.82);
      expect(Math.abs(p.x - s.x) + 0.065).toBeLessThan(s.hx);
      expect(Math.abs(p.z - s.z - 0.3) + 0.065).toBeLessThan(s.hz * 0.6);
    }
  }
  // Old front cap yHigh+.02 protruded; old rear cap yLow floated.
  if (!drawing) {
    expect(roof.yHigh + 0.02).toBeGreaterThan(awningFaces(roof, s.z + s.hz - 0.14).top);
    expect(roof.yLow).toBeLessThan(awningFaces(roof, s.z - s.hz + 0.14).underside);
  }
});

it("prize tent's four inscribed poles and picnic pole meet the faceted fabric", () => {
  const rx = 4.1, rz = 3.1, rise = 2.5, posts = tentSupports(3.4, 2.4);
  expect(posts).toHaveLength(4);
  for (const p of posts) {
    expect(Math.abs(p.x)).toBeGreaterThan(rx / 2);
    expect(Math.abs(p.z)).toBeGreaterThan(rz / 2);
    const geometry = canopyPostGeometry(p.x, p.z, rx, rz, rise, 10, 2.75, 0.07), vertices = geometry.getAttribute("position");
    for (let i = 0; i < vertices.count; i++) {
      const cap = vertices.getY(i);
      if (cap < 1) continue;
      const top = 2.75 + canopyHeight(p.x + vertices.getX(i), p.z + vertices.getZ(i), rx, rz, rise, 10);
      expect(top).toBeGreaterThan(2.75);
      expect(cap).toBeGreaterThan(top - CANOPY_THICKNESS);
      expect(cap).toBeLessThan(top);
    }
    geometry.dispose();
  }
  const cap = 3.72 - CANOPY_THICKNESS / 2;
  for (let i = 0; i < 60; i++) {
    const a = i / 60 * Math.PI * 2, top = 3 + canopyHeight(Math.cos(a) * 0.04, Math.sin(a) * 0.04, 1.9, 1.9, 0.72, 8);
    expect(cap).toBeGreaterThan(top - CANOPY_THICKNESS);
    expect(cap).toBeLessThan(top);
  }
});

it("school fence north endpoints stay inside the existing boundary and clear the library", () => {
  // The fences are outside the walk rectangle; no additional collider is needed.
  for (const [x, northEnd] of [[-14.3, -35], [14.3, -47]]) {
    const posts = schoolFencePosts(northEnd);
    expect(posts.filter(z => z === northEnd)).toHaveLength(1);
    expect(WALK_AREAS.some(a => Math.abs(x - a.x) <= a.hx + 0.09 && Math.abs(northEnd - a.z) <= a.hz + 0.09)).toBe(false);
    for (const s of SOLIDS.filter(s => s.id.startsWith("library-") && s.kind === "box")) {
      if (s.kind !== "box") continue;
      expect(Math.abs(x - s.x) > s.hx + 0.09 || Math.abs(northEnd - s.z) > s.hz + 0.09).toBe(true);
    }
  }
});
