import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { DISTRICT_IDS } from "../../game/content/ids";
import { CHEST_SCALE, chestPose, HOUSES, SOLIDS } from "../../game/world/layout";
import { CHEST_SLOTS, festivalChestBaseGeometry, festivalChestLidGeometry, festivalChestShadowGeometry, festivalChestSlotGeometry, FESTIVAL_CHEST_SHADOW_Y } from "../models/festivalChest";
import { QuadWriter } from "../partBuilder";
import { gatePosts, libraryFurniture, libraryGeometry } from "./builders";
import { districtParts } from "./districts";
import { landGeometry, pavingGeometry, waterGeometry } from "./ground";
import { auditZFighting, DEPTH_TOLERANCE, type AuditMesh, type AuditRegion } from "./zfightAudit";

// Add regions to this list when later batches repair them. Ungated findings
// remain visible in every npm test run; they are not silently allowlisted away.
const regions: AuditRegion[] = [
  { name: "library-shelves", min: [-25.35, 0.11, -47.25], max: [-15.15, 1.65, -44.98], gated: true },
  { name: "school-gate-ground", min: [-5.1, -0.6, -24], max: [13.5, 0.06, -19], gated: true },
  { name: "bench", min: [-13.3, 0.001, 6.2], max: [-11.9, 1.3, 10.2], gated: true },
  { name: "festival-chest", min: [-2, 0, -10], max: [2, 2.3, -6], gated: true },
  { name: "stage-chest", min: [-64.7, 0.59, -2.2], max: [-61.3, 3.6, 2.2], gated: true },
  ...HOUSES.map((h): AuditRegion => ({
    name: `${h.x === 20.5 && h.z === -24.8 ? "northeast-house" : h.x === 27.8 && h.z === 32.4 ? "east-harbor-house" : "house"}(${h.x},${h.z})`,
    min: [h.x - h.w / 2 - 0.65, -0.1, h.z - h.d / 2 - 0.65],
    max: [h.x + h.w / 2 + 0.65, h.h + 3.5, h.z + h.d / 2 + 0.85], gated: true
  })),
  { name: "harbor-easel", min: [-10.66, 0, 31.49], max: [-9.34, 1.8, 32.51], gated: true },
  { name: "prize-sign", min: [-59.5, 0.97, -12.57], max: [-54.5, 1.91, -12.46], gated: true },
  { name: "east-harbor-scenery", min: [18.8, -0.1, 26.8], max: [32, 6.5, 39], gated: true },
  { name: "pier-end", min: [4.5, -1, 44.9], max: [12.5, 4.5, 50.5], gated: true }
];

function chestMeshes(chapter: 1 | 5, filled = false, lidAngle = 0): AuditMesh[] {
  const pose = chestPose(chapter), name = chapter === 5 ? "stage-chest" : "festival-chest";
  const root = new THREE.Matrix4().compose(new THREE.Vector3(pose.x, pose.y, pose.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), pose.yaw), new THREE.Vector3(1, 1, 1));
  const chest = root.clone().scale(new THREE.Vector3().setScalar(CHEST_SCALE));
  const lid = chest.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.9, -0.45)).multiply(new THREE.Matrix4().makeRotationX(-lidAngle));
  return [
    { name: `${name}:body`, geometry: festivalChestBaseGeometry(), matrix: chest },
    { name: `${name}:lid`, geometry: festivalChestLidGeometry(), matrix: lid },
    { name: `${name}:shadow`, geometry: festivalChestShadowGeometry(CHEST_SCALE), materialColor: "#42303e", matrix: root.clone().multiply(new THREE.Matrix4().makeTranslation(0, FESTIVAL_CHEST_SHADOW_Y, 0)) },
    ...CHEST_SLOTS.map((slot): AuditMesh => ({ name: `${name}:${filled ? "filled" : "empty"}-slot:${slot.item}`, geometry: festivalChestSlotGeometry(slot.item, filled), matrix: chest.clone().multiply(new THREE.Matrix4().makeTranslation(slot.pos.x, slot.pos.y, 0.495)) }))
  ];
}

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
  it("includes uniform-colour shadow planes in the contact audit", () => {
    const shadow: AuditMesh = { name: "shadow", geometry: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0.5, 0, 0.5), materialColor: "black" };
    const support = quad("platform", 0, 0, "red");
    expect(auditZFighting([support, shadow], synthetic).control.length).toBeGreaterThan(0);
    shadow.matrix = new THREE.Matrix4().makeTranslation(0, DEPTH_TOLERANCE * 3, 0);
    expect(auditZFighting([support, shadow], synthetic).control).toEqual([]);
    support.geometry.dispose(); shadow.geometry.dispose();
  });
  it("builds the actual town headlessly and gates repaired regions", () => {
    // Only sign painting needs a DOM. No audited object depends on text width;
    // textured sign faces lack vertex colours and are outside this audit.
    const context = { measureText: (text: string) => ({ width: text.length * 30 }), beginPath() {}, roundRect() {}, fill() {}, fillText() {} };
    vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
    const meshes: AuditMesh[] = [{ name: "water", geometry: waterGeometry(), materialColor: "#3ea6c7" }, { name: "land", geometry: landGeometry() }, { name: "gate-posts/track", geometry: gatePosts() }, { name: "library-furniture/trim", geometry: libraryFurniture(SOLIDS) }];
    for (const district of DISTRICT_IDS) {
      meshes.push({ name: `${district}:paving`, geometry: pavingGeometry(district) });
      const parts = districtParts(district);
      for (const kind of ["low", "tall"] as const) parts[kind].forEach((geometry, i) => meshes.push({ name: `${district}:${kind}:${i}`, geometry }));
      meshes.push({ name: `${district}:signs`, geometry: parts.signs });
    }
    const chests = [...chestMeshes(1), ...chestMeshes(5)];
    // These variants are mutually exclusive at runtime: never audit them on
    // top of one another. Shelves must be clean with either surrounding shell.
    for (const mask of [-1, 0, 1, 2, 3, 4, 5, 6, 7]) {
      const shell = { name: `library:${mask < 0 ? "exterior" : `cutaway-${mask}`}`, geometry: libraryGeometry(SOLIDS, mask >= 0, Math.max(0, mask)) };
      const checked = mask < 0 ? regions : regions.filter(r => r.name === "library-shelves");
      const result = auditZFighting([...meshes, ...chests, shell], checked);
      if (mask < 0) console.info(`Z-fight triangle-pair counts (${shell.name}, tolerance=${DEPTH_TOLERANCE.toFixed(7)}m): ${regions.map(r => `${r.name}=${result[r.name].length}`).join(", ")}`);
      const failures = checked.filter(r => r.gated && result[r.name].length).map(r => ({ region: r.name, count: result[r.name].length, examples: result[r.name].slice(0, 12) }));
      expect(failures).toEqual([]);
      shell.geometry.dispose();
    }
    // Check the repaired assembly on both supports during/after lid motion.
    // Retain the existing empty-slot scope: coloured stationery plaques reuse
    // the full item models, which this batch explicitly preserves.
    const chestRegions = regions.filter(r => r.name === "festival-chest" || r.name === "stage-chest");
    for (const angle of [0, 0.95, 1.9]) {
      const variants = [...chestMeshes(1, false, angle), ...chestMeshes(5, false, angle)];
      const result = auditZFighting([...meshes, ...variants], chestRegions);
      for (const region of chestRegions) expect(result[region.name], `${region.name}, lid=${angle}`).toEqual([]);
      variants.forEach(m => m.geometry.dispose());
    }
    // Additional inspection found inherited item-model/medallion overlaps in
    // filled slots. Report them explicitly; repairing stationery itself would
    // exceed the chest-base task and alter the item slots requested unchanged.
    const filled = [...chestMeshes(1, true), ...chestMeshes(5, true)];
    const filledResult = auditZFighting([...meshes, ...filled], chestRegions);
    console.info(`Preserved filled-stationery plaque findings (outside chest-base gate): ${chestRegions.map(r => `${r.name}=${filledResult[r.name].length}`).join(", ")}`);
    filled.forEach(m => m.geometry.dispose());
    [...meshes, ...chests].forEach(m => m.geometry.dispose());
    vi.unstubAllGlobals();
  }, 30_000);
});
