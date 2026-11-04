import * as THREE from "three";
import { expect, it } from "vitest";
import { pavingGeometry } from "./ground";

it("covers the square's ring-stone gaps with continuous grout at y=0.004", () => {
  const paving = pavingGeometry("square"), positions = paving.getAttribute("position"), colors = paving.getAttribute("color");
  const mortar: number[] = [], grout = new THREE.Color("#c9b48e");
  for (let i = 0; i < positions.count; i += 3) {
    if (![i, i + 1, i + 2].every(v => Math.abs(positions.getY(v) - 0.004) < 1e-8)) continue;
    for (let v = i; v < i + 3; v++) {
      mortar.push(positions.getX(v), positions.getY(v), positions.getZ(v));
      expect(colors.getX(v)).toBeCloseTo(grout.r, 6);
      expect(colors.getY(v)).toBeCloseTo(grout.g, 6);
      expect(colors.getZ(v)).toBeCloseTo(grout.b, 6);
    }
  }
  expect(mortar.length).toBeGreaterThan(0);
  const geometry = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(mortar, 3));
  const material = new THREE.MeshBasicMaterial(), mesh = new THREE.Mesh(geometry, material);
  const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
  const covered = (r: number, a: number) => {
    ray.set(new THREE.Vector3(Math.cos(a) * r, 1, Math.sin(a) * r), down);
    const hits = ray.intersectObject(mesh);
    expect(hits.length, `mortar at r=${r}, angle=${a}`).toBeGreaterThan(0);
    expect(hits[0].point.y).toBeCloseTo(0.004, 7);
  };
  try {
    for (let radius = 0; radius <= 39; radius++) for (let angle = 0; angle < 192; angle++) {
      covered(2.8 + radius / 39 * (8.65 - 2.8), (angle + 0.37) / 192 * Math.PI * 2);
    }
    // The authored angular gaps fall between the 0.97 and 1.03 stone endpoints.
    for (let band = 0; band < 7; band++) {
      const r = 2.75 + band * 0.85, n = Math.max(8, Math.round(Math.PI * 2 * r / 1.25));
      for (let i = 0; i < n; i++) covered(r + 0.42, (i + band * 0.5) / n * Math.PI * 2);
    }
  } finally {
    paving.dispose(); geometry.dispose(); material.dispose();
  }
});
