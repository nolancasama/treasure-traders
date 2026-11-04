import { expect, it, vi } from "vitest";
import { districtParts } from "./districts";
import { auditEntrances } from "./entranceAudit";
import { landGeometry, pavingGeometry } from "./ground";
import type { AuditMesh } from "./zfightAudit";

it("has disjoint entrance ground, stones and flowers on grass in the built town", () => {
  const context = { measureText: (text: string) => ({ width: text.length * 30 }), beginPath() {}, roundRect() {}, fill() {}, fillText() {} };
  vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
  const meshes: AuditMesh[] = [{ name: "land", geometry: landGeometry() }];
  for (const id of ["square", "market", "festival"] as const) {
    meshes.push({ name: `${id}:paving`, geometry: pavingGeometry(id) });
    const parts = districtParts(id);
    for (const kind of ["low", "tall"] as const) parts[kind].forEach((geometry, i) => meshes.push({ name: `${id}:${kind}:${i}`, geometry }));
    parts.signs.dispose();
  }
  try {
    const result = auditEntrances(meshes);
    console.info("Entrance geometry counts:", Object.fromEntries(Object.entries(result).map(([name, r]) => [name, { faces: r.faces.length, stonePairs: r.stonePairs.length, flowersOnPaving: r.flowersOnPaving.length }])));
    for (const [name, r] of Object.entries(result)) {
      expect(r.faces, name).toEqual([]);
      expect(r.stonePairs, name).toEqual([]);
      expect(r.flowersOnPaving, name).toEqual([]);
    }
  } finally {
    meshes.forEach(m => m.geometry.dispose());
    vi.unstubAllGlobals();
  }
}, 30_000);
