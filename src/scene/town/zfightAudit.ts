import * as THREE from "three";

export interface AuditMesh { name: string; geometry: THREE.BufferGeometry; matrix?: THREE.Matrix4 }
export interface AuditRegion { name: string; min: [number, number, number]; max: [number, number, number]; gated?: boolean }
interface Triangle { points: THREE.Vector3[]; normal: THREE.Vector3; plane: number; color: number[]; object: string; index: number; bounds: THREE.Box3 }
export interface Fight { a: string; b: string; triangleA: number; triangleB: number; separation: number; at: number[] }

/** App.tsx uses near=.1, far=420. At 40m (fog begins here; normal follow
 * distance is 14m, library 9.4m), two 24-bit depth steps span 1.91mm.
 * Allowing two steps also covers rounding/interpolation across a triangle.
 * This is a world-space plane tolerance, never a renderer depth adjustment. */
export const DEPTH_TOLERANCE = 2 * 40 ** 2 * (420 - 0.1) / (420 * 0.1 * (2 ** 24 - 1));

type P2 = [number, number];
const cross = (a: P2, b: P2, c: P2) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

/** Positive-area intersection only: touching edges/points cannot flicker. */
function overlap(a: Triangle, b: Triangle, region: THREE.Box3): number[] | null {
  const n = a.normal, drop = Math.abs(n.x) > Math.abs(n.y) ? (Math.abs(n.x) > Math.abs(n.z) ? 0 : 2) : (Math.abs(n.y) > Math.abs(n.z) ? 1 : 2);
  const project = (v: THREE.Vector3): P2 => drop === 0 ? [v.y, v.z] : drop === 1 ? [v.x, v.z] : [v.x, v.y];
  const unproject = (p: P2): number[] => drop === 0 ? [(a.plane - n.y * p[0] - n.z * p[1]) / n.x, p[0], p[1]] : drop === 1 ? [p[0], (a.plane - n.x * p[0] - n.z * p[1]) / n.y, p[1]] : [p[0], p[1], (a.plane - n.x * p[0] - n.y * p[1]) / n.z];
  let polygon = a.points.map(project);
  const clip = b.points.map(project), sign = Math.sign(cross(clip[0], clip[1], clip[2]));
  for (let i = 0; i < 3 && polygon.length; i++) {
    const u = clip[i], v = clip[(i + 1) % 3], output: P2[] = [];
    for (let j = 0; j < polygon.length; j++) {
      const p = polygon[j], q = polygon[(j + 1) % polygon.length];
      const dp = sign * cross(u, v, p), dq = sign * cross(u, v, q);
      if (dp >= 0) output.push(p);
      if ((dp >= 0) !== (dq >= 0)) {
        const t = dp / (dp - dq);
        output.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
    polygon = output;
  }
  // Restrict the actual intersection to the named region, rather than merely
  // counting triangles whose bounding boxes happen to cross its boundary.
  for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
    const edge = (sign > 0 ? region.min : region.max).getComponent(axis), output: P2[] = [];
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i], q = polygon[(i + 1) % polygon.length];
      const dp = sign * (unproject(p)[axis] - edge), dq = sign * (unproject(q)[axis] - edge);
      if (dp >= 0) output.push(p);
      if ((dp >= 0) !== (dq >= 0)) {
        const t = dp / (dp - dq);
        output.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
    polygon = output;
  }
  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length];
    area += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(area) > 2e-7 ? unproject(polygon.reduce<P2>((sum, p) => [sum[0] + p[0] / polygon.length, sum[1] + p[1] / polygon.length], [0, 0])) : null;
}

export function auditZFighting(meshes: readonly AuditMesh[], regions: readonly AuditRegion[], tolerance = DEPTH_TOLERANCE): Record<string, Fight[]> {
  const triangles: Triangle[] = [];
  for (const mesh of meshes) {
    const pos = mesh.geometry.getAttribute("position"), colors = mesh.geometry.getAttribute("color"), indices = mesh.geometry.index;
    if (!pos || !colors) continue;
    for (let i = 0; i < (indices?.count ?? pos.count); i += 3) {
      const ids = [0, 1, 2].map(j => indices ? indices.getX(i + j) : i + j);
      const points = ids.map(j => new THREE.Vector3().fromBufferAttribute(pos, j).applyMatrix4(mesh.matrix ?? identity));
      const normal = points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0]));
      if (normal.lengthSq() < 1e-14) continue;
      normal.normalize();
      triangles.push({ points, normal, plane: normal.dot(points[0]), color: [0, 1, 2].map(c => ids.reduce((sum, j) => sum + colors.getComponent(j, c), 0) / 3), object: mesh.name, index: i / 3, bounds: new THREE.Box3().setFromPoints(points) });
    }
  }
  return Object.fromEntries(regions.map(region => {
    const bounds = new THREE.Box3(new THREE.Vector3(...region.min), new THREE.Vector3(...region.max));
    const local = triangles.filter(t => t.bounds.intersectsBox(bounds)).sort((a, b) => a.bounds.min.x - b.bounds.min.x);
    const fights: Fight[] = [];
    for (let i = 0; i < local.length; i++) for (let j = i + 1; j < local.length; j++) {
      const a = local[i], b = local[j];
      if (b.bounds.min.x > a.bounds.max.x + tolerance) break;
      if (a.bounds.min.y > b.bounds.max.y + tolerance || b.bounds.min.y > a.bounds.max.y + tolerance || a.bounds.min.z > b.bounds.max.z + tolerance || b.bounds.min.z > a.bounds.max.z + tolerance) continue;
      if (a.normal.dot(b.normal) < 1 - 1e-8 || !a.color.some((c, k) => Math.abs(c - b.color[k]) > 1e-4)) continue;
      const separation = Math.max(...b.points.map(p => Math.abs(a.normal.dot(p) - a.plane)), ...a.points.map(p => Math.abs(b.normal.dot(p) - b.plane)));
      if (separation > tolerance) continue;
      const at = overlap(a, b, bounds);
      if (!at) continue;
      fights.push({ a: a.object, b: b.object, triangleA: a.index, triangleB: b.index, separation, at });
    }
    return [region.name, fights];
  }));
}
const identity = new THREE.Matrix4();
