import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { DISTRICT_IDS } from "../../game/content/ids";
import { CHEST_SCALE, chestPose, SOLIDS } from "../../game/world/layout";
import { CHEST_SLOTS, festivalChestBaseGeometry, festivalChestLidGeometry, festivalChestSlotGeometry } from "../models/festivalChest";
import { QuadWriter } from "../partBuilder";
import { gatePosts, libraryFurniture, libraryGeometry } from "./builders";
import { districtParts } from "./districts";
import { landGeometry, pavingGeometry } from "./ground";
import { auditZFighting, DEPTH_TOLERANCE, type AuditMesh, type AuditRegion } from "./zfightAudit";

// Add regions to this list when later batches repair them. Ungated findings
// remain visible in every npm test run; they are not silently allowlisted away.
const regions: AuditRegion[] = [
  { name: "library-shelves", min: [-25.35, 0.11, -47.25], max: [-15.15, 1.65, -44.98], gated: true },
  { name: "school-gate-ground", min: [-5.1, -0.6, -24], max: [13.5, 0.06, -19], gated: true },
  { name: "bench", min: [-12.5, 0.01, 2.5], max: [-7.5, 1.3, 5.5] },
  { name: "festival-chest", min: [-2, 0, -10], max: [2, 2.3, -6] },
  { name: "northeast-house(20.5,-24.8)", min: [16.5, -0.1, -28.8], max: [24.5, 10, -20.8] },
  { name: "east-harbor-house(27.8,32.4)", min: [23.8, -0.1, 28.4], max: [31.8, 10, 36.4] },
  { name: "pier-end", min: [4.5, -1, 47.5], max: [12.5, 4.5, 50.5] }
];

describe("static scenery z-fighting audit (different-colour triangle pairs)", () => {
  const synthetic: AuditRegion[] = [{ name: "control", min: [-5, -1, -5], max: [5, 1, 5] }];
  const quad = (name: string, x: number, y: number, color: string): AuditMesh => ({ name, geometry: new QuadWriter().rect(x, 0, x + 1, 1, y, color).build() });
  it("flags known-bad overlapping coplanar quads, including their object names", () => {
    const meshes = [quad("red", 0, 0, "red"), quad("blue", 0.25, 0, "blue")];
    const result = auditZFighting(meshes, synthetic).control;
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toMatchObject({ a: "red", b: "blue", separation: 0 });
    meshes.forEach(m => m.geometry.dispose());
  });
  it("accepts known-good quads separated spatially or by resolvable depth", () => {
    for (const [x, y] of [[2, 0], [0, DEPTH_TOLERANCE * 3]]) {
      const meshes = [quad("red", 0, 0, "red"), quad("blue", x, y, "blue")];
      expect(auditZFighting(meshes, synthetic).control).toEqual([]);
      meshes.forEach(m => m.geometry.dispose());
    }
  });
  it("flags nearly coplanar faces inside the real depth budget", () => {
    const meshes = [quad("red", 0, 0, "red"), quad("blue", 0, DEPTH_TOLERANCE / 2, "blue")];
    expect(auditZFighting(meshes, synthetic).control.length).toBeGreaterThan(0);
    meshes.forEach(m => m.geometry.dispose());
  });
  it("builds the actual town headlessly and gates repaired regions", () => {
    // Only sign painting needs a DOM. No audited object depends on text width;
    // textured sign faces lack vertex colours and are outside this audit.
    const context = { measureText: (text: string) => ({ width: text.length * 30 }), beginPath() {}, roundRect() {}, fill() {}, fillText() {} };
    vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
    const meshes: AuditMesh[] = [{ name: "land", geometry: landGeometry() }, { name: "gate-posts/track", geometry: gatePosts() }, { name: "library-furniture/trim", geometry: libraryFurniture(SOLIDS) }];
    for (const district of DISTRICT_IDS) {
      meshes.push({ name: `${district}:paving`, geometry: pavingGeometry(district) });
      const parts = districtParts(district);
      for (const kind of ["low", "tall"] as const) parts[kind].forEach((geometry, i) => meshes.push({ name: `${district}:${kind}:${i}`, geometry }));
      meshes.push({ name: `${district}:signs`, geometry: parts.signs });
    }
    const pose = chestPose(1), scale = new THREE.Vector3().setScalar(CHEST_SCALE);
    const chest = new THREE.Matrix4().compose(new THREE.Vector3(pose.x, pose.y, pose.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), pose.yaw), scale);
    meshes.push({ name: "festival-chest:body", geometry: festivalChestBaseGeometry(), matrix: chest }, { name: "festival-chest:closed-lid", geometry: festivalChestLidGeometry(), matrix: chest.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.9, -0.45)) });
    for (const slot of CHEST_SLOTS) meshes.push({ name: `festival-chest:empty-slot:${slot.item}`, geometry: festivalChestSlotGeometry(slot.item, false), matrix: chest.clone().multiply(new THREE.Matrix4().makeTranslation(slot.pos.x, slot.pos.y, 0.495)) });
    // These variants are mutually exclusive at runtime: never audit them on
    // top of one another. Shelves must be clean with either surrounding shell.
    for (const mask of [-1, 0, 1, 2, 3, 4, 5, 6, 7]) {
      const shell = { name: `library:${mask < 0 ? "exterior" : `cutaway-${mask}`}`, geometry: libraryGeometry(SOLIDS, mask >= 0, Math.max(0, mask)) };
      const checked = mask < 0 ? regions : regions.filter(r => r.name === "library-shelves");
      const result = auditZFighting([...meshes, shell], checked);
      if (mask < 0) console.info(`Z-fight triangle-pair counts (${shell.name}, tolerance=${DEPTH_TOLERANCE.toFixed(7)}m): ${regions.map(r => `${r.name}=${result[r.name].length}`).join(", ")}`);
      for (const region of checked.filter(r => r.gated)) expect(result[region.name].length, `${region.name}: ${JSON.stringify(result[region.name].slice(0, 16))}`).toBe(0);
      shell.geometry.dispose();
    }
    meshes.forEach(m => m.geometry.dispose());
    vi.unstubAllGlobals();
  }, 30_000);
});
