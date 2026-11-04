import * as THREE from "three";
import { auditZFighting, type AuditMesh, type AuditRegion } from "./zfightAudit";

export const ENTRANCE_REGIONS: AuditRegion[] = [
  { name: "market-entrance", min: [16, -0.7, -6], max: [26, 0.4, 6], gated: true },
  { name: "festival-entrance", min: [-32, -0.7, -6], max: [-16, 0.4, 6], gated: true }
];

const stoneColors = ["#f2dfbb", "#edd6ae", "#f6e6c8", "#e9cfa6", "#fbf0d8", "#f8ebcf", "#fdf4e0", "#f0bf99", "#e9b18a", "#f4cca9", "#e4a680", "#f8d8ba", "#f6d1b0", "#fbe0c4", "#f3d7ab", "#eccc9c", "#f7e0ba", "#e7c491"].map(c => new THREE.Color(c));
const stemColor = new THREE.Color("#5f9f55");
const inside = (r: AuditRegion, x: number, z: number) => x >= r.min[0] && x <= r.max[0] && z >= r.min[2] && z <= r.max[2];

/** Read actual merged paving quads and flower stems, rather than a second map
 * of intended placements. Stone pairs include equal colours and raised paths. */
export function auditEntrances(meshes: readonly AuditMesh[]) {
  const stones: { x0: number; z0: number; x1: number; z1: number }[] = [], flowers: { x: number; z: number }[] = [];
  for (const mesh of meshes) {
    const p = mesh.geometry.getAttribute("position"), c = mesh.geometry.getAttribute("color");
    if (!p || !c) continue;
    if (mesh.name.endsWith(":paving")) for (let i = 0; i + 5 < p.count; i += 6) {
      if (p.getY(i) < -0.001 || p.getY(i) > 0.01 || !stoneColors.some(color => Math.abs(c.getX(i) - color.r) < 1e-5 && Math.abs(c.getY(i) - color.g) < 1e-5 && Math.abs(c.getZ(i) - color.b) < 1e-5)) continue;
      const xs = Array.from({ length: 6 }, (_, k) => p.getX(i + k)), zs = Array.from({ length: 6 }, (_, k) => p.getZ(i + k));
      stones.push({ x0: Math.min(...xs), z0: Math.min(...zs), x1: Math.max(...xs), z1: Math.max(...zs) });
    }
    if (mesh.name.includes(":tall:")) for (let i = 0; i + 8 < p.count; i++) {
      if (Math.abs(c.getX(i) / c.getY(i) - stemColor.r / stemColor.g) > 1e-5 || Math.abs(c.getZ(i) / c.getY(i) - stemColor.b / stemColor.g) > 1e-5) continue;
      const ids = Array.from({ length: 9 }, (_, k) => i + k), low = Math.min(...ids.map(j => p.getY(j)));
      if (low <= 0.001) {
        const tip = ids.reduce((a, b) => p.getY(a) > p.getY(b) ? a : b);
        flowers.push({ x: p.getX(tip), z: p.getZ(tip) });
      }
      i += 8;
    }
  }
  const fights = auditZFighting(meshes, ENTRANCE_REGIONS);
  return Object.fromEntries(ENTRANCE_REGIONS.map(r => {
    const stonePairs: number[][] = [];
    for (let i = 0; i < stones.length; i++) for (let j = i + 1; j < stones.length; j++) {
      const a = stones[i], b = stones[j], x0 = Math.max(a.x0, b.x0, r.min[0]), x1 = Math.min(a.x1, b.x1, r.max[0]), z0 = Math.max(a.z0, b.z0, r.min[2]), z1 = Math.min(a.z1, b.z1, r.max[2]);
      if (x1 - x0 > 1e-5 && z1 - z0 > 1e-5) stonePairs.push([i, j]);
    }
    // Include the grout between running-bond stones: it is paving too.
    const flowersOnPaving = flowers.filter(f => inside(r, f.x, f.z) && stones.some(s => f.x > s.x0 - 0.045 && f.x < s.x1 + 0.045 && f.z > s.z0 - 0.045 && f.z < s.z1 + 0.045));
    return [r.name, { faces: fights[r.name], stonePairs, flowersOnPaving }];
  }));
}
