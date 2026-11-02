import * as THREE from "three";
import { PartBuilder } from "../partBuilder";
import type { House, Solid, Tree } from "../../game/world/layout";
import { GRASS_Y } from "./ground";

export const PALETTE = {
  stone: "#efd9b2", darkStone: "#c7ae8a", cream: "#fff4d4", wood: "#bb7d45", darkWood: "#7c5536", leaf: "#6fb35c", teal: "#2c9f96",
  red: "#e8604c", blue: "#4f9ad6", gold: "#ffcc4d", plum: "#9a5fb0", soil: "#6e5a3e", slate: "#54666e", ink: "#4a3a32"
};
export const FLOWERS = ["#ff8fa8", "#ffd64f", "#ffffff", "#c79bff", "#ff7c6b", "#ffb0d0"];

type B = PartBuilder;

/* ---------------------------------------------------------------- plants */

export function addTree(b: B, t: Tree, y = GRASS_Y) {
  const { x, z, s } = t;
  if (t.kind === "pine") {
    b.cyl(0.16 * s, 0.28 * s, 1.5 * s, x, y, z, "#8a6240", 6);
    for (const [r, h, base, color] of [[1.75, 2.1, 1.1, "#3f9570"], [1.4, 1.9, 2.2, "#4fa97f"], [1, 1.7, 3.3, "#62bb8c"]] as const) {
      b.add(new THREE.ConeGeometry(r * s, h * s, 7), color, [x, y + (base + h / 2) * s, z], [0, x, 0], [1, 1, 1], { wind: 0.5 });
    }
    return;
  }
  const blossom = t.kind === "blossom";
  const tones = blossom ? ["#f6b3c8", "#f9c6d6", "#fbd8e3", "#fde6ec"] : ["#68ad55", "#7fc161", "#97cf6c", "#a9da78"];
  b.cyl(0.2 * s, 0.34 * s, 2.2 * s, x, y, z, blossom ? "#8d6450" : "#a0704a", 7);
  b.add(new THREE.IcosahedronGeometry(1.6 * s, 1), tones[0], [x, y + 3.05 * s, z], [x, z, 0], [1, 1.02, 1], { wind: 0.7 });
  b.add(new THREE.IcosahedronGeometry(1.12 * s, 0), tones[1], [x - 0.8 * s, y + 2.75 * s, z + 0.28 * s], [z, x, 0], [1, 0.92, 1], { wind: 0.7 });
  b.add(new THREE.IcosahedronGeometry(1.02 * s, 0), tones[2], [x + 0.88 * s, y + 3.1 * s, z + 0.18 * s], [x, 0, z], [1, 0.92, 1], { wind: 0.8 });
  b.add(new THREE.IcosahedronGeometry(0.82 * s, 1), tones[3], [x + 0.08 * s, y + 4 * s, z + 0.1 * s], [0, z, x], [1, 0.88, 1], { wind: 0.9 });
}

/** Distant trees: a fraction of the triangles, seen through fog. */
export function addFarTree(b: B, x: number, z: number, s: number, pine: boolean) {
  b.cyl(0.2 * s, 0.3 * s, 1.5 * s, x, GRASS_Y, z, "#8a6240", 4);
  if (pine) b.add(new THREE.ConeGeometry(1.6 * s, 4 * s, 6), s % 0.2 > 0.1 ? "#4a9d78" : "#3f9570", [x, GRASS_Y + 3.2 * s, z], [0, x, 0], [1, 1, 1], { flatAo: true });
  else b.add(new THREE.IcosahedronGeometry(1.7 * s, 0), s % 0.2 > 0.1 ? "#7cbf5f" : "#6aae56", [x, GRASS_Y + 2.9 * s, z], [x, z, 0], [1, 1.05, 1], { flatAo: true });
}

/** A few flowers on thin stems; the heads sway. `y` is the soil height. */
export function addFlowers(b: B, x: number, z: number, y: number, count: number, spread: number, rand: () => number, colors = FLOWERS, height = 0.3) {
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2, r = spread * Math.sqrt(rand());
    const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r, h = height * (0.75 + rand() * 0.5);
    b.add(new THREE.ConeGeometry(0.028, h, 3, 1, true), "#5f9f55", [px, y + h / 2, pz], [0, a, 0], [1, 1, 1], { wind: 0.25, flatAo: true });
    b.add(new THREE.OctahedronGeometry(0.1 + rand() * 0.05), colors[Math.floor(rand() * colors.length)], [px, y + h + 0.03, pz], [a, a, 0], [1, 0.72, 1], { wind: 0.4, flatAo: true });
  }
}

export function addTuft(b: B, x: number, z: number, rand: () => number, y = GRASS_Y) {
  for (let i = 0; i < 3; i++) {
    const h = 0.22 + rand() * 0.2;
    b.add(new THREE.ConeGeometry(0.055, h, 3, 1, true), rand() > 0.5 ? "#6fae55" : "#86c264", [x + (rand() - 0.5) * 0.22, y + h / 2, z + (rand() - 0.5) * 0.22], [(rand() - 0.5) * 0.4, rand() * 3, (rand() - 0.5) * 0.4], [1, 1, 1], { wind: 0.35, flatAo: true });
  }
}

export function addShrub(b: B, x: number, z: number, s: number, rand: () => number, y = GRASS_Y, color = rand() > 0.5 ? "#6aae56" : "#5da150") {
  b.add(new THREE.IcosahedronGeometry(0.62 * s, 0), color, [x, y + 0.44 * s, z], [x, z, 0], [1.1, 0.84, 1], { wind: 0.3 });
  b.add(new THREE.IcosahedronGeometry(0.42 * s, 0), "#88c766", [x + 0.34 * s, y + 0.68 * s, z + 0.14 * s], [z, x, 0], [1, 0.9, 1], { wind: 0.4 });
}

export function addPebble(b: B, x: number, z: number, s: number, rand: () => number, y = GRASS_Y) {
  b.add(new THREE.IcosahedronGeometry(0.3 * s, 0), rand() > 0.5 ? "#c9c2ae" : "#b6b19e", [x, y + 0.1 * s, z], [x, rand() * 6, z], [1.25, 0.62, 1], { flatAo: true });
}

/* ------------------------------------------------------------- town parts */

export function addLamp(b: B, x: number, z: number) {
  const iron = "#3f5560";
  b.cyl(0.13, 0.22, 0.36, x, 0, z, iron, 6);
  b.cyl(0.055, 0.09, 2.45, x, 0.3, z, iron, 6);
  b.torus(0.12, 0.022, [x, 2.32, z], [Math.PI / 2, 0, 0], PALETTE.gold);
  b.box(0.54, 0.07, 0.54, x, 2.72, z, iron);
  for (const [dx, dz] of [[-0.23, -0.23], [0.23, -0.23], [-0.23, 0.23], [0.23, 0.23]] as const) b.box(0.05, 0.56, 0.05, x + dx, 2.78, z + dz, iron);
  b.cone(0.46, 0.34, x, 3.34, z, iron, 6);
  b.sphere(0.07, x, 3.74, z, PALETTE.gold, [1, 1, 1], 6);
}

/** Window with a surround, facing +z. `y` is its bottom edge. */
export function addWindow(b: B, x: number, y: number, z: number, w = 1.1, h = 1.1, frame = PALETTE.cream, glass = "#79c4dc") {
  b.box(w + 0.2, h + 0.2, 0.08, x, y - 0.1, z, frame);
  b.box(w, h, 0.1, x, y, z + 0.01, glass);
  b.box(0.06, h, 0.12, x, y, z + 0.02, frame);
  b.box(w, 0.06, 0.12, x, y + h / 2 - 0.03, z + 0.02, frame);
}

/** Flower box hung under a window; `tall` holds the swaying blooms. */
export function addFlowerBox(low: B, sway: B, x: number, y: number, z: number, w: number, rand: () => number, color = PALETTE.wood) {
  low.box(w, 0.2, 0.24, x, y - 0.2, z + 0.1, color);
  for (let i = 0; i < Math.round(w * 4); i++) {
    const px = x - w / 2 + 0.1 + (i + 0.5) / Math.round(w * 4) * (w - 0.2);
    sway.add(new THREE.OctahedronGeometry(0.075), FLOWERS[Math.floor(rand() * FLOWERS.length)], [px, y + 0.03 + rand() * 0.07, z + 0.1 + (rand() - 0.5) * 0.1], [rand(), rand(), 0], [1, 0.85, 1], { wind: 0.14, flatAo: true });
  }
}

/** Shingled slopes for a roof with its ridge along local x, centred on the frame's origin. */
export function addGableRoof(b: B, w: number, d: number, rise: number, baseY: number, color: string, shade: string) {
  const eave = d / 2 + 0.34, angle = Math.atan2(rise, d / 2), length = eave / Math.cos(angle), courses = 4;
  for (const side of [1, -1]) for (let i = 0; i < courses; i++) {
    const along = (i + 0.5) / courses * length;
    b.boxAt(w + 0.7, 0.14, length / courses + 0.05, [0, baseY + rise - Math.sin(angle) * along, side * Math.cos(angle) * along], [side * angle, 0, 0], i % 2 ? shade : color);
  }
  b.box(w + 0.8, 0.14, 0.26, 0, baseY + rise - 0.08, 0, shade);
}

/** Wall-coloured triangles closing the ends under a gable roof. */
export function addGableEnds(b: B, w: number, d: number, rise: number, baseY: number, color: string) {
  const g = new THREE.BufferGeometry();
  const hx = w / 2, hz = d / 2;
  g.setAttribute("position", new THREE.Float32BufferAttribute([
    hx, 0, -hz, hx, 0, hz, hx, rise, 0,
    -hx, 0, hz, -hx, 0, -hz, -hx, rise, 0
  ], 3));
  g.computeVertexNormals();
  b.add(g, color, [0, baseY, 0]);
}

const HOUSE_STYLES = [
  { wall: "#fff0cf", roof: "#d9603f", shade: "#c44f33", trim: "#8a5a3a", door: "#3f9a8f" },
  { wall: "#fbd9c0", roof: "#3d9a94", shade: "#2f8680", trim: "#6d4a33", door: "#e2694f" },
  { wall: "#d9edf0", roof: "#7c6bb8", shade: "#6a5aa6", trim: "#5d4a44", door: "#f2b134" },
  { wall: "#fff6b8", roof: "#c75a7a", shade: "#b34a6a", trim: "#7a5138", door: "#4c8fc9" }
];

/** A storybook cottage facing the camera (+z). Footprint and height come from layout's HOUSES. */
export function addCottage(b: B, h: House, rand: () => number) {
  const s = HOUSE_STYLES[h.style % HOUSE_STYLES.length];
  b.at(h.x, GRASS_Y, h.z, 0, () => {
    b.box(h.w + 0.24, 0.42, h.d + 0.24, 0, 0, 0, "#b3a28a");
    b.box(h.w, h.h, h.d, 0, 0.3, 0, s.wall);
    const roofBase = h.h + 0.3, rise = h.ridgeAlongX ? 2.1 : 2.3;
    if (h.ridgeAlongX) {
      addGableRoof(b, h.w, h.d, rise, roofBase, s.roof, s.shade);
      addGableEnds(b, h.w, h.d, rise, roofBase, s.wall);
    } else {
      b.at(0, 0, 0, Math.PI / 2, () => {
        addGableRoof(b, h.d, h.w, rise, roofBase, s.roof, s.shade);
        addGableEnds(b, h.d, h.w, rise, roofBase, s.wall);
      });
      // A round attic window in the gable that faces the street.
      b.cylAt(0.42, 0.06, [0, roofBase + 0.72, h.d / 2 + 0.02], [Math.PI / 2, 0, 0], s.trim, 12);
      b.cylAt(0.32, 0.07, [0, roofBase + 0.72, h.d / 2 + 0.03], [Math.PI / 2, 0, 0], "#79c4dc", 12);
    }
    // Timber frame on the street face.
    const z = h.d / 2 + 0.02;
    for (const x of [-h.w / 2 + 0.08, h.w / 2 - 0.08]) b.box(0.18, h.h, 0.08, x, 0.3, z, s.trim);
    b.box(h.w, 0.14, 0.08, 0, 0.3 + h.h - 0.14, z, s.trim);
    b.box(h.w, 0.1, 0.08, 0, 0.3 + h.h * 0.42, z, s.trim);
    // Door with a little awning and a step.
    const doorX = h.w * -0.22;
    b.box(0.92, 1.62, 0.08, doorX, 0.34, z, s.door);
    b.cylAt(0.46, 0.08, [doorX, 1.96, z], [Math.PI / 2, 0, 0], s.door, 10);
    b.sphere(0.05, doorX + 0.3, 1.1, z + 0.06, PALETTE.gold, [1, 1, 1], 6);
    b.box(1.3, 0.14, 0.5, doorX, 0.28, z + 0.2, "#c7bba4");
    b.boxAt(1.3, 0.07, 0.62, [doorX, 2.44, z + 0.27], [0.4, 0, 0], s.roof);
    // Shuttered window with a flower box.
    const winX = h.w * 0.22, winY = 1.28;
    addWindow(b, winX, winY, z, 1.05, 1.0, PALETTE.cream);
    for (const dx of [-0.8, 0.8]) b.box(0.32, 1.1, 0.06, winX + dx, winY - 0.05, z, s.door);
    addFlowerBox(b, b, winX, winY - 0.08, z, 1.3, rand);
    // A chimney and a small upper window when the wall has room.
    b.box(0.5, 1.6, 0.5, h.w * 0.27, roofBase + 0.5, h.ridgeAlongX ? -0.5 : -0.9, "#b98a6c");
    b.box(0.62, 0.12, 0.62, h.w * 0.27, roofBase + 2.1, h.ridgeAlongX ? -0.5 : -0.9, "#8d6a54");
  });
}

/** Original hip roof: explicit eave corners keep the long school roof inside its footprint. */
export function addHipRoof(b: B, x: number, z: number, w: number, d: number, y: number, color: string, rise = 2.1) {
  const hx = (w + 0.7) / 2, hz = (d + 0.7) / 2, ridge = Math.max(0, hx - hz);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([
    -hx, 0, -hz, hx, 0, -hz, hx, 0, hz, -hx, 0, hz,
    -ridge, rise, 0, ridge, rise, 0
  ], 3));
  g.setIndex([0, 4, 5, 0, 5, 1, 1, 5, 2, 2, 5, 4, 2, 4, 3, 3, 4, 0, 0, 1, 2, 0, 2, 3]);
  b.add(g, color, [x, y + 0.25, z]);
  b.box(w + 0.7, 0.25, d + 0.7, x, y, z, color);
}

/** A striped, sloped canopy. Runs over x; rises from (zLow, yLow) to (zHigh, yHigh) with a scalloped edge there. */
export function addAwning(b: B, cx: number, halfWidth: number, zLow: number, yLow: number, zHigh: number, yHigh: number, a: string, c: string, stripes = 7) {
  const angle = Math.atan2(yHigh - yLow, zHigh - zLow), length = Math.hypot(yHigh - yLow, zHigh - zLow);
  const width = halfWidth * 2 / stripes;
  for (let i = 0; i < stripes; i++) {
    const x = cx - halfWidth + (i + 0.5) * width, color = i % 2 ? c : a;
    b.boxAt(width + 0.005, 0.07, length, [x, (yLow + yHigh) / 2, (zLow + zHigh) / 2], [-angle, 0, 0], color);
    // Scallops hang from whichever edge faces the camera.
    b.add(new THREE.CylinderGeometry(width * 0.5, width * 0.5, 0.04, 7, 1, false, Math.PI / 2, Math.PI), color, [x, yHigh - 0.02, zHigh + 0.015], [Math.PI / 2, 0, 0], [1, 1, 1], { wind: 0.12 });
  }
}

/* ------------------------------------------------------------- the school */

/** A south wall for the library's roofed look, or a low cut wall in the cutaway. */
export function libraryGeometry(solids: readonly Solid[], cutaway: boolean): THREE.BufferGeometry {
  const b = new PartBuilder(0.7, true), walls = "#f7e3b9", cap = "#a9694a", base = "#c98f68";
  for (const s of solids.filter(s => s.kind === "box" && s.id.includes("library") && (s.id.includes("wall") || s.id.includes("east-")))) {
    if (s.kind !== "box") continue;
    const cutFace = s.id.includes("south") || s.id.includes("east");
    if (cutaway && cutFace) {
      // Cut walls stay as a low outline, so the open room still reads as a room.
      b.box(s.hx * 2, 0.5, s.hz * 2, s.x, s.y, s.z, walls);
      b.box(s.hx * 2 + 0.04, 0.05, s.hz * 2 + 0.04, s.x, s.y + 0.5, s.z, cap);
      continue;
    }
    b.box(s.hx * 2, s.height, s.hz * 2, s.x, s.y, s.z, walls);
    b.box(s.hx * 2 + 0.04, 0.55, s.hz * 2 + 0.04, s.x, s.y, s.z, base);
    if (cutaway) b.box(s.hx * 2 + 0.04, 0.05, s.hz * 2 + 0.04, s.x, s.y + s.height, s.z, cap);
  }
  if (!cutaway) {
    const y = 3.62, z = -42, width = 14;
    // The east gable faces the courtyard door; its ridge runs east to west.
    b.at(-19, 0, z, 0, () => {
      addGableRoof(b, width, 10, 2.5, y, "#d9603f", "#c44f33");
      addGableEnds(b, width, 10, 2.5, y, walls);
    });
    b.box(0.7, 2, 0.7, -23, y + 1.2, -44, "#b98a6c");
    b.box(0.86, 0.14, 0.86, -23, y + 3.2, -44, "#8d6a54");
    // Tall windows and timber on the south face the camera sees.
    for (const x of [-23.6, -19.2, -14.8]) {
      addWindow(b, x, 1.1, -36.8, 1.3, 1.5, PALETTE.cream);
      b.box(1.6, 0.1, 0.3, x, 0.95, -36.64, PALETTE.wood);
    }
    for (const x of [-25.92, -21.4, -17, -12.08]) b.box(0.2, 3.5, 0.08, x, 0.12, -36.76, "#8a5a3a");
    b.box(14, 0.16, 0.08, -19, 3.4, -36.76, "#8a5a3a");
  }
  return b.build();
}

/** Shelves, reading table and the other supports for the eight hidden-item spots. */
export function libraryFurniture(solids: readonly Solid[]): THREE.BufferGeometry {
  const b = new PartBuilder(0.3);
  for (const s of solids.filter(s => s.kind === "box" && s.id.startsWith("library-") && !s.id.includes("wall") && !s.id.includes("east-"))) {
    if (s.kind !== "box") continue;
    const w = s.hx * 2, d = s.hz * 2;
    const top = s.y + s.height;
    if (s.id.includes("shelf")) {
      b.box(w, s.height, 0.12, s.x, s.y, s.z - d / 2 + 0.06, PALETTE.darkWood);
      for (const dx of [-w / 2 + 0.07, w / 2 - 0.07]) b.box(0.14, s.height, d, s.x + dx, s.y, s.z, PALETTE.wood);
      for (const y of [s.y, s.y + 0.68, top - 0.1]) b.box(w, 0.1, d, s.x, y, s.z, PALETTE.wood);
      for (const y of [0.1, 0.78]) for (let k = 0; k < 8; k++) {
        b.box(0.25, 0.43 + (k % 2) * 0.09, 0.65, s.x - w * 0.4 + k * w * 0.115, s.y + y, s.z + 0.07, [PALETTE.red, PALETTE.teal, PALETTE.blue, PALETTE.gold, PALETTE.plum][k % 5]);
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
      // A low window seat replaces a floating wall section in the cut-away room.
      const wallZ = s.z + 0.7;
      b.box(w + 0.28, top - s.y - 0.14, 0.42, s.x, s.y, wallZ, "#f7e3b9");
      b.box(w, 0.14, 1.4, s.x, top - 0.14, s.z + 0.3, PALETTE.cream);
      for (const dx of [-w * 0.33, w * 0.33]) b.box(0.13, top - s.y - 0.14, d * 0.7, s.x + dx, s.y, s.z, PALETTE.wood);
      b.box(0.5, 0.16, 0.5, s.x - 0.55, top, s.z + 0.5, "#e58f7a");
      b.box(0.5, 0.16, 0.5, s.x + 0.6, top, s.z + 0.5, "#7fb7c9");
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
  b.box(1.6, 0.004, 1.6, -16, 0.1205, -42, "#d9796a");
  b.box(1.32, 0.004, 1.32, -16, 0.1215, -42, "#f2c777");
  for (let k = 0; k < 7; k++) for (const dz of [-0.85, 0.85]) b.box(0.06, 0.004, 0.16, -16.6 + k * 0.2, 0.1205, -42 + dz, PALETTE.cream);
  // Room dressing on the two walls that stay up: panelling, windows and pictures.
  const panel = "#b98657";
  b.box(13.6, 1, 0.06, -19, 0.12, -46.77, panel);
  b.box(0.06, 1, 9.6, -25.77, 0.12, -42, panel);
  b.box(13.6, 0.08, 0.1, -19, 1.1, -46.76, PALETTE.darkWood);
  b.box(0.1, 0.08, 9.6, -25.76, 1.1, -42, PALETTE.darkWood);
  for (const x of [-20.4, -13.2]) {
    b.box(1.4, 1.4, 0.05, x, 1.7, -46.77, PALETTE.cream);
    b.box(1.2, 1.2, 0.06, x, 1.8, -46.76, "#9edbe6");
    b.box(0.05, 1.2, 0.07, x, 1.8, -46.75, PALETTE.cream);
  }
  for (const [z, color] of [[-44.2, "#e58f7a"], [-41.4, "#7fb7c9"], [-38.8, "#f2c777"]] as const) {
    b.box(0.05, 1, 1.3, -25.76, 1.65, z, PALETTE.darkWood);
    b.box(0.06, 0.82, 1.12, -25.75, 1.74, z, color);
  }
  return b.build();
}

/* ----------------------------------------------------------- gates and boats */

export function gateGeometry(kind: "cart" | "school" | "bridge" | "arch"): THREE.BufferGeometry {
  const b = new PartBuilder(kind === "bridge" ? 0 : 0.5, true);
  if (kind === "bridge") {
    b.box(5.2, 0.22, 13.6, 0, -0.25, 6.8, PALETTE.darkWood);
    for (let z = 0; z < 13.55; z += 0.68) b.box(5.2, 0.05, 0.62, 0, -0.04, z + 0.34, ["#c9975f", "#bf8d55", "#d3a36d"][Math.round(z * 3) % 3]);
    for (const x of [-2.45, 2.45]) {
      for (let z = 0; z <= 13.6; z += 2.27) { b.box(0.17, 1.05, 0.17, x, -0.04, z, PALETTE.wood); b.sphere(0.11, x, 1.05, z, PALETTE.gold, [1, 1, 1], 6); }
      // A rope rail, sagging between posts.
      for (let z = 0; z < 13.5; z += 2.27) b.wire([x, 0.86, z], [x, 0.86, z + 2.27], 0.14, 4, "#e4c58f", 0.05);
    }
  } else if (kind === "cart") {
    // The supply cart, tipped across the street with its load piled high. Stays within its collider.
    b.box(1.3, 0.14, 8, 0, 0.42, 0, PALETTE.wood);
    for (const x of [-0.62, 0.62]) b.box(0.08, 0.52, 8, x, 0.5, 0, "#a56c3c");
    for (const z of [-3.96, 3.96]) b.box(1.3, 0.56, 0.1, 0, 0.5, z, PALETTE.darkWood);
    for (const z of [-3.1, 3.1]) {
      b.cylAt(0.6, 0.14, [0.74, 0.6, z], [0, 0, Math.PI / 2], PALETTE.darkWood, 12);
      b.cylAt(0.44, 0.15, [0.74, 0.6, z], [0, 0, Math.PI / 2], "#c58a50", 12);
      b.cylAt(0.13, 0.2, [0.74, 0.6, z], [0, 0, Math.PI / 2], PALETTE.gold, 8);
    }
    const load = [PALETTE.gold, PALETTE.red, PALETTE.blue, PALETTE.leaf, "#c77bd9"];
    for (let i = 0; i < 9; i++) {
      b.boxAt(0.86, 0.66, 0.78, [0, 0.9, -3.3 + i * 0.825], [0, (i % 3 - 1) * 0.09, 0], load[i % load.length]);
      b.boxAt(0.88, 0.06, 0.8, [0, 1.06, -3.3 + i * 0.825], [0, (i % 3 - 1) * 0.09, 0], PALETTE.cream);
    }
    for (let i = 0; i < 5; i++) b.boxAt(0.74, 0.54, 0.7, [0.02, 1.48, -2.4 + i * 1.2], [0, i * 0.4, i % 2 ? 0.08 : -0.06], load[(i + 2) % load.length]);
    // A rolled poster and a parcel that made it to the top of the heap.
    b.cylAt(0.11, 1.1, [-0.05, 1.86, -1.1], [Math.PI / 2, 0.3, 0], PALETTE.cream, 7);
    b.boxAt(0.46, 0.34, 0.46, [0, 1.92, 1.4], [0, 0.5, 0], "#ff8fa8");
  } else if (kind === "school") {
    // Sliding gate, with rollers mounted on its lower rail.
    for (const x of [-3.15, 3.15]) {
      b.cylAt(0.23, 0.12, [x, 0.19, 0], [Math.PI / 2, 0, 0], PALETTE.darkWood, 10);
      b.cylAt(0.08, 0.13, [x, 0.19, 0], [Math.PI / 2, 0, 0], PALETTE.gold, 8);
    }
    for (let x = -3.9; x <= 3.9; x += 0.6) { b.box(0.1, 1.9, 0.1, x, 0, 0, PALETTE.teal); b.cone(0.09, 0.18, x, 1.9, 0, PALETTE.gold, 5); }
    for (const y of [0.4, 1.5]) b.box(8.4, 0.12, 0.15, 0, y, 0, PALETTE.teal);
  } else {
    // Roped off: the board hangs from the rope, its lettering added by the caller.
    b.wire([0, 1.25, -4.2], [0, 1.25, 4.2], 0.3, 10, "#e8604c", 0.09);
    for (const z of [-4, 4]) b.cyl(0.13, 0.17, 1.4, 0, 0, z, PALETTE.darkWood, 6);
  }
  return b.build();
}

export function gatePosts(): THREE.BufferGeometry {
  const b = new PartBuilder(0.5, true);
  // School gate: stone posts and a crossbar that carries the school's sign.
  for (const x of [-4, 4]) {
    b.box(0.86, 3.5, 0.86, x, 0, -22, PALETTE.stone);
    b.box(1.06, 0.3, 1.06, x, 0, -22, PALETTE.darkStone);
    b.box(1.04, 0.16, 1.04, x, 3.5, -22, PALETTE.darkStone);
    b.sphere(0.42, x, 4.06, -22, PALETTE.gold, [1, 1, 1], 8);
  }
  b.box(7.2, 0.16, 0.24, 0, 3.28, -22, PALETTE.darkWood);
  // Festival arch, torii-like: bold posts and a board that carries FESTIVAL.
  for (const z of [-4.1, 4.1]) {
    b.cyl(0.32, 0.38, 5.3, -22, 0, z, PALETTE.red, 8);
    b.box(1.04, 0.32, 1.04, -22, 0, z, PALETTE.darkStone);
  }
  b.box(0.42, 0.22, 11, -22, 4.14, 0, PALETTE.red);
  b.box(0.82, 0.3, 12.2, -22, 5.3, 0, PALETTE.red);
  b.box(1, 0.14, 12.6, -22, 5.6, 0, PALETTE.gold);
  b.box(0.3, 1.04, 7.6, -22, 4.34, 0, "#fff4d4");
  b.box(0.34, 0.1, 7.8, -22, 5.3 - 0.06, 0, PALETTE.gold);
  // The bridge gantry on the square's bank: outside the walkway, clear of the hinge.
  for (const x of [-3.5, 3.5]) {
    b.box(0.5, 2.8, 0.5, x, -0.06, 19.1, PALETTE.wood);
    b.cone(0.42, 0.5, x, 2.74, 19.1, PALETTE.red, 4);
  }
  for (const z of [-4.5, 4.5]) b.cyl(0.15, 0.23, 1.5, 18, -0.06, z, PALETTE.wood, 7);
  return b.build();
}

export function boatGeometry(sail: string, hull: string): THREE.BufferGeometry {
  const b = new PartBuilder(0, true);
  b.add(new THREE.CylinderGeometry(1.2, 0.72, 0.85, 10, 1), hull, [0, 0.12, 0], [0, 0, 0], [1, 1, 2.3]);
  b.add(new THREE.CylinderGeometry(1.22, 1.2, 0.14, 10, 1), PALETTE.cream, [0, 0.58, 0], [0, 0, 0], [1, 1, 2.3]);
  b.box(1.5, 0.03, 3.8, 0, 0.64, 0, "#c9975f");
  b.box(1.42, 1.02, 1.5, 0, 0.66, 0.5, "#fff0cf");
  b.box(1.7, 0.1, 1.86, 0, 1.68, 0.5, PALETTE.red);
  addWindow(b, 0, 0.98, 1.25, 0.72, 0.44, PALETTE.cream);
  b.cyl(0.05, 0.07, 3.3, 0, 0.64, -0.85, PALETTE.wood, 6);
  // A small pennant at the masthead, plus a rope down to the bow.
  b.add(new THREE.ConeGeometry(0.26, 0.9, 3), sail, [0.44, 3.72, -0.85], [0, 0, -Math.PI / 2], [1, 1, 0.1], { wind: 1 });
  b.beam([0, 3.6, -0.85], [0, 0.72, 2.2], 0.025, "#e4c58f");
  b.torus(0.26, 0.05, [1.17, 0.74, -0.7], [0, Math.PI / 2, 0], "#f4f4f4");
  return b.build();
}

export function rowboatGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0, true);
  b.add(new THREE.CylinderGeometry(0.72, 0.42, 0.42, 8, 1), "#d9603f", [0, 0.1, 0], [0, 0, 0], [1, 1, 2.1]);
  b.add(new THREE.CylinderGeometry(0.74, 0.72, 0.08, 8, 1), PALETTE.cream, [0, 0.33, 0], [0, 0, 0], [1, 1, 2.1]);
  for (const z of [-0.5, 0.45]) b.box(1.26, 0.06, 0.26, 0, 0.3, z, "#c9975f");
  b.beam([0.72, 0.45, 0.2], [1.5, 0.02, 0.9], 0.05, PALETTE.wood);
  return b.build();
}

export function birdGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  b.sphere(0.13, 0, 0.14, 0, "#a4aabb", [0.8, 0.95, 1.35], 7);
  b.sphere(0.085, 0, 0.27, 0.11, "#7d859a", [1, 1, 1], 6);
  b.cone(0.03, 0.09, 0, 0.23, 0.2, PALETTE.gold, 4);
  b.boxAt(0.05, 0.06, 0.2, [0, 0.12, -0.2], [0.4, 0, 0], "#7d859a");
  for (const x of [-0.04, 0.04]) b.box(0.02, 0.09, 0.02, x, 0, 0.02, "#e8964f");
  return b.build();
}

/** Wings carry uv.x so the flyer's shader can flap them; the body stays still. */
export function flyerGeometry(): THREE.BufferGeometry {
  const body = new PartBuilder(0, true);
  body.sphere(0.13, 0, 0, 0, "#ffffff", [0.8, 0.9, 1.5], 6);
  body.sphere(0.08, 0, 0.07, 0.17, "#ffffff", [1, 1, 1], 6);
  body.cone(0.028, 0.09, 0, 0.03, 0.25, PALETTE.gold, 4);
  for (const side of [-1, 1]) body.add(new THREE.BoxGeometry(0.55, 0.025, 0.2), "#eef0f4", [side * 0.32, 0.04, 0], [0, 0, 0], [1, 1, 1], { wind: 0 });
  const g = body.build();
  const position = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < position.count; i++) uv.setX(i, Math.max(0, Math.abs(position.getX(i)) - 0.06));
  return g;
}

export function fishGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  b.sphere(0.24, 0, 0, 0, "#f3a15c", [1.5, 0.72, 0.6], 7);
  b.boxAt(0.24, 0.3, 0.05, [-0.4, 0, 0], [0, 0, Math.PI / 4], "#e9775c");
  b.boxAt(0.16, 0.14, 0.04, [0.02, 0.17, 0], [0, 0, 0.4], "#e9775c");
  return b.build();
}
