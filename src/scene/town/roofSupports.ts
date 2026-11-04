import * as THREE from "three";

/** Roof slab measurements are in the builder's local frame, before stall yaw. */
export const AWNING_THICKNESS = 0.07;
export interface AwningLine { zLow: number; yLow: number; zHigh: number; yHigh: number }
export function awningFaces(roof: AwningLine, z: number) {
  const slope = (roof.yHigh - roof.yLow) / (roof.zHigh - roof.zLow);
  const center = roof.yLow + (z - roof.zLow) * slope;
  const half = AWNING_THICKNESS * Math.sqrt(1 + slope * slope) / 2;
  return { underside: center - half, top: center + half };
}
/** Midpoint of the common interior of both slab faces over a square post cap. */
export function awningPostTop(roof: AwningLine, z: number, width = 0.13) {
  const ends = [awningFaces(roof, z - width / 2), awningFaces(roof, z + width / 2)];
  const lower = Math.max(...ends.map(p => p.underside)), upper = Math.min(...ends.map(p => p.top));
  if (lower >= upper) throw new Error("Post footprint is too wide for a flat cap inside this roof");
  return (lower + upper) / 2;
}
export const STALL_IDS = ["bakery-stall", "toys-stall", "flowers-stall", "fruit-stall", "festival-stall-north", "festival-stall-south"] as const;
export function supportedAwning(s: { x: number; z: number; hx: number; hz: number }, drawing = false) {
  const { x, z, hx, hz } = s;
  const roof: AwningLine = drawing
    ? { zLow: z - hz - 0.2, yLow: 3.1, zHigh: z + 0.4, yHigh: 3.5 }
    : { zLow: z - hz - 0.35, yLow: 2.95, zHigh: z + hz + 0.35, yHigh: 3.72 };
  const posts = [-1, 1].flatMap(side => [-1, 1].map(end => {
    const pz = drawing ? (end < 0 ? z - hz + 0.1 : z + 0.3) : z + end * (hz - 0.14);
    return { x: x + side * (hx - (drawing ? 0.1 : 0.16)), z: pz, top: awningPostTop(roof, pz), bottom: drawing && end > 0 ? 0.82 : 0 };
  }));
  return { roof, posts, halfWidth: hx + 0.2 };
}

/** Same polygon and panel angles as stripedTop; thickness is vertical. */
export function canopyHeight(x: number, z: number, rx: number, rz: number, rise: number, panels: number) {
  let gauge = -Infinity;
  for (let i = 0; i < panels; i++) {
    const angle = (i + 1) / panels * Math.PI * 2;
    gauge = Math.max(gauge, (Math.cos(angle) * x / rx + Math.sin(angle) * z / rz) / Math.cos(Math.PI / panels));
  }
  return rise * (1 - gauge);
}
export const CANOPY_THICKNESS = 0.07;
export function tentSupports(hx: number, hz: number) {
  // The roof is polygonal, not rectangular: the old collider-corner poles
  // actually stood outside the fabric. These four corners are inscribed.
  return [-1, 1].flatMap(sx => [-1, 1].map(sz => ({ x: sx * hx * 0.7, z: sz * hz * 0.7 })));
}

/** Cap follows the actual panel plane, embedded halfway through the fabric. */
export function canopyPostGeometry(x: number, z: number, rx: number, rz: number, rise: number, panels: number, base: number, radius: number) {
  const roofY = (dx: number, dz: number) => base + canopyHeight(dx, dz, rx, rz, rise, panels);
  const height = roofY(x, z) - CANOPY_THICKNESS / 2;
  const geometry = new THREE.CylinderGeometry(radius, radius, height, 6), vertices = geometry.getAttribute("position");
  for (let i = 0; i < vertices.count; i++) if (vertices.getY(i) > 0) {
    vertices.setY(i, roofY(x + vertices.getX(i), z + vertices.getZ(i)) - CANOPY_THICKNESS / 2 - height / 2);
  }
  geometry.translate(0, height / 2, 0);
  geometry.computeVertexNormals();
  return geometry;
}

export function schoolFencePosts(northEnd: number) {
  const positions: number[] = [];
  for (let z = -26; z >= northEnd; z -= 3) positions.push(z);
  return positions;
}
