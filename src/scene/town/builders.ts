import * as THREE from "three";
import { PartBuilder } from "../partBuilder";
import type { DistrictId } from "../../game/content/ids";

export const PALETTE = { stone: "#e6cba0", darkStone: "#c4aa85", cream: "#fff1c9", wood: "#ad7447", darkWood: "#79573e", leaf: "#79aa69", teal: "#47958d", red: "#da7964", blue: "#6e9eba", gold: "#f4c96b" };

export interface GroundShape { id: string; district: DistrictId; x: number; z: number; hx: number; hz: number; y: number; gate?: string }
export interface SolidShape { id: string; district: DistrictId; x: number; z: number; kind: string; hx?: number; hz?: number; r?: number; y: number; height: number; yaw?: number }

/** Thin paved rectangles use the exact bounds used by the walking solver. */
export function groundGeometry(district: DistrictId, areas: readonly GroundShape[]): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  const color = { square: "#e7cfaa", market: "#e8c29c", school: "#d4d9ba", harbor: "#e6cd9f", festival: "#acd28d" }[district];
  for (const a of areas.filter(a => a.district === district && a.id !== "bridge")) {
    b.box(a.hx * 2, 0.26, a.hz * 2, a.x, a.y - 0.26, a.z, color);
    // The paving grid reads at a distance without hundreds of individual meshes.
    if (district !== "festival") {
      for (let x = a.x - a.hx + 2; x < a.x + a.hx; x += 3) {
        b.box(0.035, 0.006, a.hz * 2, x, a.y + 0.002, a.z, "#d3ba99");
      }
      for (let z = a.z - a.hz + 2; z < a.z + a.hz; z += 3) {
        b.box(a.hx * 2, 0.006, 0.035, a.x, a.y + 0.002, z, "#d3ba99");
      }
    }
  }
  return b.build();
}

export function treeGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder();
  b.cyl(0.18, 0.3, 2.3, 0, 0, 0, PALETTE.wood, 7);
  b.sphere(1.4, 0, 3, 0, "#78ad71", [1, 1.1, 1], 8);
  b.sphere(1.05, -0.65, 2.7, 0.2, "#8ebd77", [1, 0.9, 1], 8);
  b.sphere(0.9, 0.8, 3.05, 0.1, "#a1c883", [1, 0.9, 1], 8);
  return b.build();
}

export function lampGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder();
  b.cyl(0.12, 0.21, 0.35, 0, 0, 0, "#53686a", 8);
  b.cyl(0.065, 0.1, 2.7, 0, 0.3, 0, "#53686a", 8);
  b.box(0.5, 0.62, 0.5, 0, 2.9, 0, "#f9df9f");
  b.cone(0.44, 0.34, 0, 3.5, 0, "#53686a", 4);
  b.box(0.6, 0.08, 0.6, 0, 2.86, 0, "#53686a");
  return b.build();
}

function flowerbed(b: PartBuilder, x: number, z: number, w = 2.6, d = 1.3) {
  b.box(w, 0.35, d, x, 0, z, PALETTE.darkStone);
  b.box(w - 0.14, 0.06, d - 0.14, x, 0.35, z, "#7f7453");
  for (let i = 0; i < 7; i++) {
    const px = x - w * 0.4 + (i / 6) * w * 0.8;
    b.sphere(0.2, px, 0.6, z + Math.sin(i * 3) * d * 0.25, i % 2 ? "#f3a7aa" : "#f7d56e", [1, 0.7, 1], 6);
    b.box(0.035, 0.25, 0.035, px, 0.36, z, "#649563");
  }
}

function roof(b: PartBuilder, x: number, z: number, w: number, d: number, y: number, color: string) {
  // Explicit eave corners avoid rotating an already stretched cone, which sent
  // the long school roof's corners far beyond the building footprint.
  const hx = (w + 0.7) / 2, hz = (d + 0.7) / 2, ridge = Math.max(0, hx - hz);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([
    -hx, 0, -hz, hx, 0, -hz, hx, 0, hz, -hx, 0, hz,
    -ridge, 2.1, 0, ridge, 2.1, 0
  ], 3));
  g.setIndex([0, 4, 5, 0, 5, 1, 1, 5, 2, 2, 5, 4, 2, 4, 3, 3, 4, 0, 0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  b.add(g, color, [x, y + 0.25, z]);
  b.box(w + 0.7, 0.25, d + 0.7, x, y, z, color);
}

function window(b: PartBuilder, x: number, z: number, y = 1.7, wide = 1.6) {
  b.box(wide + 0.25, 1.6, 0.14, x, y, z, PALETTE.cream);
  b.box(wide, 1.3, 0.16, x, y + 0.15, z + 0.03, "#75b6cd");
  b.box(0.07, 1.35, 0.18, x, y + 0.13, z + 0.05, PALETTE.cream);
  b.box(wide, 0.07, 0.18, x, y + 0.75, z + 0.05, PALETTE.cream);
}

export function districtDetails(district: DistrictId): THREE.BufferGeometry {
  const b = new PartBuilder();
  if (district === "square") {
    // Fountain is a circular collision primitive; its rim is also an item surface.
    b.cyl(2.5, 2.7, 0.2, 0, 0, 0, PALETTE.darkStone, 20);
    b.cyl(2.25, 2.45, 0.5, 0, 0.2, 0, "#eddbb7", 20);
    b.cyl(2.0, 2.0, 0.05, 0, 0.68, 0, "#7bc9d5", 24);
    b.cyl(0.3, 0.6, 1.8, 0, 0.45, 0, PALETTE.stone, 12);
    b.cyl(1, 0.65, 0.3, 0, 1.9, 0, PALETTE.stone, 16);
    b.sphere(0.38, 0, 2.4, 0, PALETTE.gold, [1, 1, 1], 10);
    flowerbed(b, -8, -5, 3.2, 2.4);
    // Ken's cork board faces the square, with a leg at each end.
    for (const z of [4.75, 7.25]) b.box(0.28, 1.1, 0.2, 11.5, 0, z, PALETTE.darkWood);
    b.box(0.38, 1.35, 3, 11.5, 0.75, 6, PALETTE.darkWood);
    for (const face of [-1, 1]) {
      b.box(0.04, 1.1, 2.72, 11.5 + face * 0.21, 0.88, 6, "#c69b61");
      for (const [z, y, color] of [[5.2, 1.12, "#fff0ba"], [6.0, 1.27, "#a7cfce"], [6.8, 1.03, "#eaa597"]] as const) {
        b.box(0.045, 0.55, 0.58, 11.5 + face * 0.25, y, z, color);
        b.sphere(0.055, 11.5 + face * 0.3, y + 0.47, z, PALETTE.red, [0.5, 1, 1], 6);
        for (const dy of [0.17, 0.28]) b.box(0.05, 0.025, 0.36, 11.5 + face * 0.28, y + dy, z, "#997d65");
      }
    }
    for (const x of [-19, 19]) for (const z of [-15, 15]) {
      b.cyl(0.4, 0.7, 0.7, x, 0, z, PALETTE.red, 8);
      b.sphere(0.8, x, 1, z, PALETTE.leaf, [1, 0.7, 1], 8);
    }
  }
  if (district === "market") {
    // Counters themselves come from SOLIDS. Awnings and wares live above them.
    const positions = [[30, -7], [30, 7], [45, -7], [45, 7]];
    positions.forEach(([x, z], i) => {
      const c = [PALETTE.red, PALETTE.leaf, PALETTE.blue, PALETTE.gold][i];
      for (const dx of [-2.6, 2.6]) for (const dz of [-1.8, 1.8]) b.cyl(0.07, 0.07, 3.3, x + dx, 0, z + dz, PALETTE.wood, 6);
      b.box(5.8, 0.14, 4.4, x, 3.2, z, c);
      for (let stripe = 0; stripe < 5; stripe++) {
        b.box(0.55, 0.04, 4.4, x - 2.2 + stripe * 1.1, 3.35, z, PALETTE.cream);
        b.box(0.55, 0.4, 0.08, x - 2.2 + stripe * 1.1, 2.9, z + (z < 0 ? 2.2 : -2.2), PALETTE.cream);
      }
      for (let k = 0; k < 8; k++) {
        const px = x - 1.8 + (k % 4) * 1.15, pz = z - 0.6 + Math.floor(k / 4) * 1.1;
        if (i === 0) b.sphere(0.3, px, 1.18, pz, "#e6b36f", [1, 0.6, 0.8], 7);
        else if (i === 1) { b.cyl(0.25, 0.16, 0.35, px, 1, pz, "#b76e50", 6); b.sphere(0.3, px, 1.53, pz, k % 2 ? "#ed9cba" : "#f9dc70", [1, 0.8, 1], 6); }
        else if (i === 2) b.box(0.45, 0.45, 0.45, px, 1, pz, k % 2 ? "#6da6c9" : "#e98873");
        else b.sphere(0.24, px, 1.2, pz, k % 2 ? "#e39a43" : "#a9be61", [1, 1, 1], 7);
      }
    });
    for (const z of [-11.3, 11.3]) for (let x = 24; x <= 54; x += 3.5) {
      b.box(3.2, 0.22, 0.22, x, 0.9, z, PALETTE.cream);
      b.box(0.18, 1.25, 0.18, x, 0, z, PALETTE.wood);
    }
  }
  if (district === "school") {
    for (const x of [-7, -3, 3, 7, 11]) window(b, x, -48.92, 1.5);
    b.box(2, 3.3, 0.16, 0, 0.05, -48.8, PALETTE.teal);
    b.box(0.08, 3.3, 0.2, 0, 0.05, -48.7, PALETTE.cream);
    b.box(5, 1, 0.28, 0, 4.1, -48.7, PALETTE.cream);
    b.box(5.5, 0.22, 0.5, 0, 5.1, -48.7, PALETTE.gold);
    b.box(3.4, 3.7, 3, 0, 5.5, -51, "#efd6a0");
    b.cone(2.9, 2.2, 0, 9.2, -51, PALETTE.teal, 4);
    b.cylAt(0.95, 0.15, [0, 7.6, -49.42], [Math.PI / 2, 0, 0], PALETTE.cream, 20);
    b.box(0.09, 0.7, 0.1, 0, 7.58, -49.29, PALETTE.darkWood);
    b.box(0.6, 0.09, 0.1, 0, 7.55, -49.27, PALETTE.darkWood);
    flowerbed(b, -8, -29, 5, 1.3);
    flowerbed(b, 8, -29, 5, 1.3);
    for (const x of [-14.2, 14.2]) {
      const northEnd = x < 0 ? -35 : -47;
      for (let z = -26; z > northEnd; z -= 3) { b.box(0.16, 1.1, 0.16, x, 0, z, PALETTE.cream); }
      b.box(0.14, 0.15, -26 - northEnd, x, 0.7, (-26 + northEnd) / 2, PALETTE.cream);
    }
    // Painted hopscotch in the courtyard.
    for (let i = 0; i < 7; i++) {
      const x = i % 3 === 0 ? 4.5 : 6;
      b.box(1.3, 0.008, 0.06, x, 0.017, -33 - i * 1.3, "#fbefd8");
      b.box(0.06, 0.008, 1.3, x - 0.65, 0.017, -33 - i * 1.3 - 0.6, "#fbefd8");
    }
  }
  if (district === "harbor") {
    // Pier rails leave its west side and landward entrance accessible.
    for (let z = 34; z <= 49; z += 3) b.cyl(0.19, 0.22, 1.2, 10.8, -0.1, z, PALETTE.wood, 8);
    b.box(0.12, 0.14, 15, 10.8, 0.75, 41.5, PALETTE.wood);
    for (let z = 34; z < 49; z += 1) b.box(6, 0.018, 0.035, 8, 0.126, z, "#b68b61");
    for (let x = -15; x < 23; x += 3) {
      if (Math.abs(x) < 4) continue;
      b.cyl(0.12, 0.15, 1, x, 0, 28.4, PALETTE.wood, 7);
      b.box(2.7, 0.12, 0.12, x + 1.35, 0.7, 28.4, PALETTE.wood);
    }
    b.cyl(0.8, 1, 0.75, 20, 0, 33, PALETTE.wood, 10);
    b.torus(0.85, 0.05, [20, 0.25, 33], [Math.PI / 2, 0, 0], PALETTE.darkWood);
    b.torus(0.85, 0.05, [20, 0.58, 33], [Math.PI / 2, 0, 0], PALETTE.darkWood);
  }
  if (district === "festival") {
    // The broad back wall and shallow platform come from the same solids as navigation.
    b.box(0.35, 5.4, 10, -65, 0, 0, PALETTE.red);
    for (const z of [-5, 5]) {
      b.cyl(0.24, 0.3, 5, -60.5, 0, z, PALETTE.wood, 8);
      b.box(5, 0.35, 0.35, -62.5, 5, z, PALETTE.wood);
    }
    b.box(5.5, 0.28, 11.5, -62.6, 5.2, 0, PALETTE.gold);
    b.cylAt(1.35, 0.12, [-64.7, 2.7, 0], [0, 0, Math.PI / 2], PALETTE.gold, 16);
    // Gathered curtain wings and front valance distinguish the stage from a crate.
    for (const z of [-4.3, 4.3]) for (let i = 0; i < 4; i++) {
      b.cyl(0.27, 0.36, 4.2, -64.6, 0.6, z - 0.75 + i * 0.5, i % 2 ? "#b95e63" : "#db7e80", 6);
    }
    b.box(0.2, 0.42, 10.8, -58.94, 0.16, 0, PALETTE.teal);
    for (let i = 0; i < 9; i++) {
      const pennant = new THREE.BufferGeometry();
      pennant.setAttribute("position", new THREE.Float32BufferAttribute([0, 0.57, -0.28, 0, 0.57, 0.28, 0, 0.18, 0], 3));
      pennant.computeVertexNormals();
      b.add(pennant, i % 2 ? PALETTE.gold : PALETTE.red, [-58.78, 0, -4.4 + i * 1.1]);
    }
    for (let i = 0; i < 3; i++) b.box(0.6, 0.2 * (i + 1), 3.2, -57.5 - i * 0.55, 0, 0, PALETTE.wood);
    for (const z of [-12, 12]) for (const x of [-43]) {
      b.box(5.5, 0.2, 2.2, x, 0.95, z, PALETTE.wood);
      for (const dx of [-2, 2]) b.box(0.13, 0.95, 0.13, x + dx, 0, z, PALETTE.darkWood);
      b.box(6, 0.2, 3.1, x, 3.25, z, z > 0 ? PALETTE.red : PALETTE.teal);
      for (let stripe = 0; stripe < 6; stripe++) {
        b.box(0.5, 0.025, 3.1, x - 2.5 + stripe, 3.455, z, PALETTE.cream);
        b.box(0.5, 0.35, 0.08, x - 2.5 + stripe, 2.92, z + (z < 0 ? 1.55 : -1.55), PALETTE.cream);
      }
      for (const dx of [-2.5, 2.5]) b.box(0.13, 3.3, 0.13, x + dx, 0, z + (z < 0 ? -0.7 : 0.7), PALETTE.wood);
    }
    for (const z of [-16, 16]) for (const x of [-62, -50, -38]) b.cyl(0.1, 0.15, 5.2, x, 0, z, PALETTE.wood, 6);
    flowerbed(b, -28, -20, 2, 3);
    flowerbed(b, -28, 20, 2, 3);
  }
  return b.build();
}

/** Collision shapes have one authoritative source; no invisible building boxes. */
export function solidGeometry(district: DistrictId, solids: readonly SolidShape[]): THREE.BufferGeometry {
  const b = new PartBuilder();
  for (const s of solids.filter(s => s.district === district)) {
    if (s.id.includes("fountain") || s.id.includes("library") || s.id === "flower-bed" || s.id.includes("lamp") || s.id === "harbor-barrel" || s.id === "notice-board") continue;
    if (s.kind === "circle") {
      b.cyl(s.r ?? 1, s.r ?? 1, s.height, s.x, s.y, s.z, s.id.includes("flower") ? PALETTE.leaf : PALETTE.stone, 14);
    } else {
      const w = (s.hx ?? 1) * 2, d = (s.hz ?? 1) * 2;
      if (s.id === "grandma-bench" || s.id === "harbor-easel") {
        b.box(w, 0.035, d, s.x, s.y, s.z, PALETTE.darkStone);
        continue;
      }
      const building = s.id.includes("building") || s.id.includes("schoolhouse");
      b.box(w, s.height, d, s.x, s.y, s.z, building ? "#f2d8aa" : PALETTE.wood, s.yaw ?? 0);
      if (building) roof(b, s.x, s.z, w, d, s.y + s.height, PALETTE.teal);
    }
  }
  return b.build();
}

export function libraryGeometry(solids: readonly SolidShape[], cutaway: boolean): THREE.BufferGeometry {
  const b = new PartBuilder();
  for (const s of solids.filter(s => s.id.includes("library") && (s.id.includes("wall") || s.id.includes("east-")))) {
    if (cutaway && (s.id.includes("south") || s.id.includes("east"))) continue;
    b.box((s.hx ?? 1) * 2, s.height, (s.hz ?? 1) * 2, s.x, s.y, s.z, "#f4dfb5");
  }
  if (!cutaway) {
    b.box(14.5, 0.4, 10.7, -19, 4.1, -42, PALETTE.red);
    b.box(12.8, 0.4, 9.2, -19, 4.5, -42, "#e5977a");
  }
  return b.build();
}

export function libraryFurniture(solids: readonly SolidShape[]): THREE.BufferGeometry {
  const b = new PartBuilder();
  for (const s of solids.filter(s => s.id.startsWith("library-") && !s.id.includes("wall") && !s.id.includes("east-"))) {
    const w = (s.hx ?? 0.5) * 2, d = (s.hz ?? 0.5) * 2;
    const top = s.y + s.height;
    if (s.id.includes("shelf")) {
      b.box(w, s.height, 0.12, s.x, s.y, s.z - d / 2 + 0.06, PALETTE.darkWood);
      for (const dx of [-w / 2 + 0.07, w / 2 - 0.07]) b.box(0.14, s.height, d, s.x + dx, s.y, s.z, PALETTE.wood);
      for (const y of [s.y, s.y + 0.68, top - 0.1]) b.box(w, 0.1, d, s.x, y, s.z, PALETTE.wood);
      for (const y of [0.1, 0.78]) for (let k = 0; k < 8; k++) {
        b.box(0.25, 0.43 + (k % 2) * 0.09, 0.65, s.x - w * 0.4 + k * w * 0.115, s.y + y, s.z + 0.07, [PALETTE.red, PALETTE.teal, PALETTE.blue, PALETTE.gold][k % 4]);
      }
    } else if (s.id.includes("table")) {
      b.box(w, 0.14, d, s.x, top - 0.14, s.z, PALETTE.wood);
      for (const dx of [-w * 0.4, w * 0.4]) for (const dz of [-d * 0.34, d * 0.34]) b.box(0.13, s.height - 0.14, 0.13, s.x + dx, s.y, s.z + dz, PALETTE.darkWood);
      for (const dz of [-1.05, 1.05]) {
        b.box(0.7, 0.1, 0.62, s.x, s.y + 0.42, s.z + dz, PALETTE.teal);
        for (const dx of [-0.25, 0.25]) for (const cz of [-0.22, 0.22]) b.box(0.08, 0.42, 0.08, s.x + dx, s.y, s.z + dz + cz, PALETTE.darkWood);
        b.box(0.7, 0.5, 0.1, s.x, s.y + 0.5, s.z + dz + Math.sign(dz) * 0.27, PALETTE.teal);
      }
    } else if (s.id.includes("cart")) {
      for (const dx of [-w * 0.34, w * 0.34]) for (const dz of [-d * 0.32, d * 0.32]) {
        b.cylAt(0.13, 0.09, [s.x + dx, s.y + 0.13, s.z + dz], [Math.PI / 2, 0, 0], "#52676b", 8);
        b.box(0.07, s.height - 0.2, 0.07, s.x + dx, s.y + 0.2, s.z + dz, PALETTE.teal);
      }
      for (const y of [s.y + 0.24, top - 0.1]) b.box(w, 0.1, d, s.x, y, s.z, PALETTE.teal);
      for (let k = 0; k < 5; k++) b.box(0.17, 0.36 + (k % 2) * 0.06, 0.55, s.x - 0.42 + k * 0.21, s.y + 0.34, s.z, [PALETTE.gold, PALETTE.red, PALETTE.blue][k % 3]);
      b.box(0.08, 0.24, d, s.x - w / 2 + 0.04, top - 0.24, s.z, PALETTE.teal);
    } else if (s.id.includes("sill")) {
      // Retain a south-wall section and its window in the cutaway. The ledge
      // extends inward to SPOTS, with its top still at the declared height.
      const wallZ = s.z + 1, windowHeight = 0.9;
      b.box(w + 0.28, top - s.y - 0.14, 0.4, s.x, s.y, wallZ, "#f4dfb5");
      for (const dx of [-w / 2 - 0.07, w / 2 + 0.07]) b.box(0.14, windowHeight + 0.28, 0.4, s.x + dx, top - 0.14, wallZ, "#f4dfb5");
      b.box(w + 0.28, 0.14, 0.4, s.x, top + windowHeight, wallZ, "#f4dfb5");
      b.box(w, 0.14, 1.4, s.x, top - 0.14, s.z + 0.3, PALETTE.cream);
      // Separate surround bars leave blue glazing visible on both wall faces.
      b.box(w - 0.12, windowHeight - 0.12, 0.14, s.x, top + 0.06, wallZ, "#9dd5dc");
      for (const dx of [-w / 2 + 0.03, 0, w / 2 - 0.03]) b.box(0.07, windowHeight, 0.22, s.x + dx, top, wallZ, PALETTE.cream);
      for (const dy of [0, windowHeight / 2, windowHeight - 0.06]) b.box(w, 0.06, 0.22, s.x, top + dy, wallZ, PALETTE.cream);
      for (const dx of [-w * 0.33, w * 0.33]) b.box(0.13, 0.35, d * 0.6, s.x + dx, top - 0.49, s.z, PALETTE.wood);
    } else if (s.id.includes("globe")) {
      b.cyl(0.4, 0.48, 0.12, s.x, s.y, s.z, PALETTE.darkWood, 10);
      b.cyl(0.07, 0.1, 0.38, s.x, s.y + 0.12, s.z, PALETTE.gold, 8);
      b.sphere(0.32, s.x, top - 0.35, s.z, "#83bdc3", [1, 1, 1], 10);
      b.sphere(0.14, s.x - 0.12, top - 0.22, s.z + 0.23, PALETTE.leaf, [1.2, 1.2, 0.35], 6);
      b.sphere(0.12, s.x + 0.15, top - 0.4, s.z + 0.24, "#a8c681", [1, 1.3, 0.4], 6);
      // A small flat polar cap supports the distractor at the declared height.
      b.cyl(0.13, 0.13, 0.04, s.x, top - 0.04, s.z, PALETTE.gold, 8);
    } else if (s.id.includes("basket")) {
      b.box(w, 0.07, d, s.x, s.y, s.z, "#a97b4c");
      // Folded lining fills the basket to its rim, supporting the candidate item.
      b.box(w - 0.16, s.height - 0.07, d - 0.16, s.x, s.y + 0.07, s.z, "#d5b987");
      for (let row = 0; row < 4; row++) {
        const y = s.y + row * s.height / 4;
        for (const dz of [-d / 2 + 0.04, d / 2 - 0.04]) b.box(w, 0.07, 0.08, s.x, y, s.z + dz, "#bd915c");
        for (const dx of [-w / 2 + 0.04, w / 2 - 0.04]) b.box(0.08, 0.07, d, s.x + dx, y, s.z, "#bd915c");
      }
      for (const dz of [-d / 2 + 0.04, d / 2 - 0.04]) b.box(w, 0.06, 0.08, s.x, top - 0.06, s.z + dz, PALETTE.wood);
      for (const dz of [-d / 2 + 0.04, d / 2 - 0.04]) b.torus(0.18, 0.035, [s.x, top + 0.03, s.z + dz], [0, 0, 0], PALETTE.wood);
    }
  }
  // Eighth spot: a fringed reading mat, with its upper face at floor height.
  b.box(1.6, 0.015, 1.6, -16, 0.105, -42, "#c0cda8");
  for (const dz of [-0.65, 0.65]) b.box(1.4, 0.004, 0.08, -16, 0.116, -42 + dz, PALETTE.cream);
  for (let k = 0; k < 7; k++) for (const dz of [-0.85, 0.85]) b.box(0.06, 0.01, 0.16, -16.6 + k * 0.2, 0.11, -42 + dz, PALETTE.cream);
  return b.build();
}

export function gateGeometry(kind: "cart" | "school" | "bridge" | "arch"): THREE.BufferGeometry {
  const b = new PartBuilder();
  if (kind === "bridge") {
    b.box(5.2, 0.25, 13.6, 0, -0.25, 6.8, PALETTE.wood);
    for (let z = 0; z <= 13.6; z += 0.65) b.box(5.2, 0.02, 0.06, 0, 0, z, PALETTE.darkWood);
    for (const x of [-2.45, 2.45]) {
      b.box(0.12, 0.14, 13.6, x, 0.85, 6.8, PALETTE.cream);
      for (let z = 0; z <= 13.6; z += 2) b.box(0.14, 0.95, 0.14, x, 0, z, PALETTE.cream);
    }
  } else if (kind === "cart") {
    b.box(0.9, 0.4, 8.4, 0, 0.5, 0, PALETTE.wood);
    for (const z of [-4.1, 4.1]) b.box(0.9, 0.9, 0.16, 0, 0.9, z, PALETTE.wood);
    for (const z of [-2.9, 2.9]) b.cylAt(0.65, 0.22, [0.5, 0.65, z], [0, 0, Math.PI / 2], PALETTE.darkWood, 10);
    for (let i = 0; i < 7; i++) b.box(0.7, 0.55, 0.7, (i % 2) * 0.4 - 0.2, 0.9, -2.5 + i * 0.8, i % 2 ? PALETTE.gold : PALETTE.red);
  } else if (kind === "school") {
    for (const x of [-4.2, 4.2]) b.box(0.3, 2.2, 0.3, x, 0, 0, PALETTE.teal);
    for (let x = -3.9; x <= 3.9; x += 0.6) b.box(0.1, 1.9, 0.1, x, 0, 0, PALETTE.teal);
    for (const y of [0.4, 1.5]) b.box(8.4, 0.12, 0.15, 0, y, 0, PALETTE.teal);
  } else {
    b.box(0.16, 0.12, 8.4, 0, 1, 0, PALETTE.red);
    b.box(0.15, 0.7, 2.4, 0, 1.2, 0, PALETTE.cream);
  }
  return b.build();
}

export function gatePosts(): THREE.BufferGeometry {
  const b = new PartBuilder();
  for (const x of [-4, 4]) { b.box(0.8, 2.6, 0.8, x, 0, -22, PALETTE.stone); b.sphere(0.52, x, 2.8, -22, PALETTE.gold, [1, 1, 1], 8); }
  for (const z of [-4, 4]) { b.box(0.65, 5.3, 0.65, -22, 0, z, PALETTE.red); b.box(1.1, 0.28, 1.1, -22, 5.3, z, PALETTE.gold); }
  b.box(0.8, 0.6, 9.7, -22, 4.7, 0, PALETTE.red);
  b.box(0.9, 0.18, 10.5, -22, 5.3, 0, PALETTE.gold);
  for (const z of [-3.2, 3.2]) { b.cyl(0.15, 0.23, 1.5, 18, 0, z, PALETTE.wood, 7); }
  return b.build();
}

export function boatGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder();
  b.sphere(1, 0, 0.12, 0, PALETTE.blue, [1.4, 0.5, 2.8], 10);
  b.box(2.3, 0.15, 4.3, 0, 0.4, 0, PALETTE.cream);
  b.box(1.5, 1.2, 1.8, 0, 0.55, 0.2, "#eddbb5");
  b.box(1.8, 0.12, 2.1, 0, 1.75, 0.2, PALETTE.red);
  b.box(0.9, 0.6, 0.06, 0, 0.95, 1.15, "#6fb7ca");
  b.cyl(0.05, 0.05, 3.5, 0, 0.4, -1.5, PALETTE.wood, 6);
  b.box(0.9, 0.5, 0.03, 0.4, 3.3, -1.5, PALETTE.gold);
  return b.build();
}

export function birdGeometry(gull = false): THREE.BufferGeometry {
  const b = new PartBuilder();
  b.sphere(0.2, 0, 0.2, 0, gull ? "#f5efe1" : "#a4aabb", [0.8, 1, 1.4], 7);
  b.sphere(0.13, 0, 0.4, 0.13, gull ? "#f5efe1" : "#72798d", [1, 1, 1], 6);
  b.cone(0.06, 0.18, 0, 0.35, 0.25, PALETTE.gold, 4);
  if (gull) { b.boxAt(0.75, 0.045, 0.2, [-0.4, 0.3, 0], [0, 0, -0.15], "#e8e9df"); b.boxAt(0.75, 0.045, 0.2, [0.4, 0.3, 0], [0, 0, 0.15], "#e8e9df"); }
  return b.build();
}

export function fishGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder();
  b.sphere(0.25, 0, 0, 0, "#e9c58b", [1.5, 0.7, 0.65], 7);
  b.boxAt(0.3, 0.3, 0.08, [-0.4, 0, 0], [0, 0, Math.PI / 4], "#e29870");
  return b.build();
}
