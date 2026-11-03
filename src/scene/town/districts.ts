import * as THREE from "three";
import type { DistrictId } from "../../game/content/ids";
import { GRANDMA_BENCH_YAW, HOUSES, LAMP_POSITIONS, SOLIDS, STAGE, TREES, WALK_AREAS } from "../../game/world/layout";
import { PartBuilder, wirePoint } from "../partBuilder";
import { addAwning, addCottage, addFarTree, addFlowerBox, addFlowers, addHipRoof, addLamp, addPebble, addShrub, addTree, addTuft, addWindow, FLOWERS, PALETTE } from "./builders";
import { GRASS_Y, seeded } from "./ground";
import { SignBatch } from "./signs";

/**
 * What one district adds on top of its paving, as three merged meshes:
 * `low` props that never need seeing through, `tall` scenery that fades around
 * the characters and may sway, and `signs` on the boards that carry them.
 * Every prop inside a walk area sits on a collider from layout's SOLIDS.
 * Low and tall come in map-cell chunks so the view only draws what it can see.
 */
export interface DistrictParts { low: THREE.BufferGeometry[]; tall: THREE.BufferGeometry[]; signs: THREE.BufferGeometry }
type B = PartBuilder;

const solid = (id: string) => {
  const s = SOLIDS.find(entry => entry.id === id);
  if (!s) throw new Error(`No collider named ${id}`);
  return s;
};
const boxOf = (id: string) => {
  if (id === "stage") return STAGE;
  const s = solid(id);
  if (s.kind !== "box") throw new Error(`${id} is not a box`);
  return s;
};

/* ------------------------------------------------------------ scattered life */

const offWalk = (x: number, z: number, margin: number) => !WALK_AREAS.some(a => Math.abs(x - a.x) <= a.hx + margin && Math.abs(z - a.z) <= a.hz + margin);
const clearOfBuildings = (x: number, z: number) =>
  !HOUSES.some(h => Math.abs(x - h.x) < h.w / 2 + 0.9 && Math.abs(z - h.z) < h.d / 2 + 0.9) &&
  !(x > -27 && x < -11 && z > -48 && z < -36) && !(x > -11 && x < 15 && z > -56 && z < -49);
const onLand = (x: number, z: number) => z < 18.5 || (x > -23 && x < 30 && z > 27.6 && z < 39.3);
const SCATTER: Record<DistrictId, { x0: number; x1: number; z0: number; z1: number; flowers: number; tufts: number; shrubs: number; pebbles: number }> = {
  square: { x0: -27, x1: 21, z0: -24, z1: 18.5, flowers: 26, tufts: 26, shrubs: 8, pebbles: 7 },
  market: { x0: 21, x1: 68, z0: -30, z1: 18.5, flowers: 26, tufts: 28, shrubs: 10, pebbles: 7 },
  school: { x0: -32, x1: 32, z0: -64, z1: -24, flowers: 24, tufts: 30, shrubs: 10, pebbles: 7 },
  harbor: { x0: -24, x1: 31, z0: 27.6, z1: 39.3, flowers: 14, tufts: 18, shrubs: 4, pebbles: 10 },
  festival: { x0: -82, x1: -27, z0: -32, z1: 18.5, flowers: 30, tufts: 32, shrubs: 10, pebbles: 7 }
};

function scatter(tall: B, id: DistrictId) {
  const c = SCATTER[id], rand = seeded(id.length * 37 + 5);
  const trees = TREES[id];
  const pick = (margin: number): [number, number] | null => {
    for (let attempt = 0; attempt < 14; attempt++) {
      const x = c.x0 + rand() * (c.x1 - c.x0), z = c.z0 + rand() * (c.z1 - c.z0);
      if (offWalk(x, z, margin) && onLand(x, z) && clearOfBuildings(x, z) && !trees.some(t => Math.hypot(t.x - x, t.z - z) < 1.1)) return [x, z];
    }
    return null;
  };
  for (let i = 0; i < c.flowers; i++) { const p = pick(0.55); if (p) addFlowers(tall, p[0], p[1], GRASS_Y, 3 + Math.floor(rand() * 3), 0.5, rand); }
  for (let i = 0; i < c.tufts; i++) { const p = pick(0.45); if (p) addTuft(tall, p[0], p[1], rand); }
  for (let i = 0; i < c.shrubs; i++) { const p = pick(0.9); if (p) addShrub(tall, p[0], p[1], 0.8 + rand() * 0.6, rand); }
  for (let i = 0; i < c.pebbles; i++) { const p = pick(0.5); if (p) addPebble(tall, p[0], p[1], 0.7 + rand() * 0.8, rand); }
}

function hedge(tall: B, x0: number, z0: number, x1: number, z1: number, rand: () => number, flowers = true) {
  const length = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(length / 1.25));
  for (let i = 0; i <= n; i++) {
    const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n, s = 0.72 + rand() * 0.22;
    tall.add(new THREE.IcosahedronGeometry(0.72 * s, 0), i % 3 ? "#5fa652" : "#6db35a", [x, GRASS_Y + 0.46 * s, z], [x, z, 0], [1.1, 0.82, 0.9], { wind: 0.14 });
    if (flowers && i % 2) addFlowers(tall, x, z, GRASS_Y + 0.72 * s, 2, 0.34, rand, FLOWERS, 0.06);
  }
}

function signpost(tall: B, signs: SignBatch, id: Parameters<SignBatch["add"]>[0], x: number, z: number, height = 0.86, top = 3.3) {
  const width = SignBatch.width(id, height), hw = width / 2 + 0.05;
  for (const dx of [-hw, hw]) {
    tall.cyl(0.08, 0.11, top + 0.1, x + dx, GRASS_Y, z, PALETTE.darkWood, 6);
    tall.sphere(0.11, x + dx, top + 0.12, z, PALETTE.gold, [1, 1, 1], 6);
  }
  tall.box(width + 0.18, height + 0.16, 0.1, x, top - height - 0.08, z, PALETTE.darkWood);
  signs.add(id, x, top - height / 2, z + 0.056, height);
}

/* ------------------------------------------------------------------ square */

function square(low: B, tall: B, signs: SignBatch) {
  const rand = seeded(11);
  // The rim's top is the pencil's support surface (SURFACES: y 0.7).
  low.cyl(2.74, 2.92, 0.2, 0, 0, 0, PALETTE.darkStone, 24);
  low.cyl(2.46, 2.56, 0.5, 0, 0.2, 0, "#f3e2c1", 24);
  low.cyl(2.04, 2.04, 0.02, 0, 0.7, 0, "#6dd2dd", 24);
  low.cyl(0.32, 0.62, 1.7, 0, 0.42, 0, PALETTE.stone, 12);
  low.cyl(1.05, 0.66, 0.3, 0, 1.98, 0, "#f3e2c1", 16);
  low.cyl(0.9, 0.9, 0.02, 0, 2.28, 0, "#6dd2dd", 16);
  low.cyl(0.14, 0.24, 0.5, 0, 2.28, 0, PALETTE.stone, 8);
  low.sphere(0.33, 0, 2.92, 0, PALETTE.gold, [1, 1, 1], 10);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    low.cyl(0.14, 0.2, 0.1, Math.cos(a) * 2.8, 0.2, Math.sin(a) * 2.8, PALETTE.gold, 6);
  }
  // Flower bed: the eraser rests on the soil, so blooms stay around the edge.
  const bed = boxOf("flower-bed");
  low.box(bed.hx * 2, 0.34, bed.hz * 2, bed.x, 0, bed.z, PALETTE.darkStone);
  low.box(bed.hx * 2 - 0.2, 0.06, bed.hz * 2 - 0.2, bed.x, 0.34, bed.z, PALETTE.soil);
  for (const [dx, dz, along] of [[-1.25, 0, 1], [1.25, 0, 1], [-0.4, -0.92, 0], [0.4, -0.92, 0], [-0.4, 0.92, 0], [0.4, 0.92, 0]] as const) {
    for (let i = 0; i < 3; i++) addFlowers(tall, bed.x + dx + (along ? 0 : (i - 1) * 0.3), bed.z + dz + (along ? (i - 1) * 0.7 : 0), 0.4, 2, 0.12, rand);
  }
  // Grandma's bench, built to her proportions; its footprint stays the collider.
  const bench = boxOf("grandma-bench"), iron = "#3f4d57", plank = "#c08048", seat = 0.42;
  low.at(bench.x, 0, bench.z, GRANDMA_BENCH_YAW, () => {
    for (const x of [-1.62, 1.62]) {
      low.box(0.1, 0.29, 0.1, x, 0, 0.42, iron);
      low.box(0.1, 1.05, 0.1, x, 0, -0.42, iron);
      // Narrower rails support plank undersides, without sharing leg side faces.
      low.box(0.085, 0.08, 0.92, x, 0.29, 0, iron);
      low.box(0.12, 0.08, 0.62, x, 0.68, 0.08, plank);
      low.box(0.08, 0.26, 0.08, x, seat, 0.38, iron);
    }
    for (let i = 0; i < 4; i++) low.box(3.4, 0.05, 0.2, 0, seat - 0.05, -0.33 + i * 0.22, plank);
    for (const y of [0.62, 0.82]) low.box(3.4, 0.13, 0.05, 0, y, -0.46, plank);
  });
  // The chest's dais: red carpet over stone, inside the same footprint.
  const dais = boxOf("festival-chest-base");
  low.box(dais.hx * 2, 0.11, dais.hz * 2, dais.x, 0, dais.z, PALETTE.darkStone);
  // Inlaid carpet and gold centre have disjoint faces, all supporting the
  // chest at y=.15. The old full carpet continued just beneath the gold.
  const insetRing = (outerX: number, outerZ: number, innerX: number, innerZ: number, color: string) => {
    for (const side of [-1, 1]) {
      low.box((outerX - innerX) / 2, 0.04, outerZ, dais.x + side * (outerX + innerX) / 4, 0.11, dais.z, color);
      low.box(innerX, 0.04, (outerZ - innerZ) / 2, dais.x, 0.11, dais.z + side * (outerZ + innerZ) / 4, color);
    }
  };
  insetRing(dais.hx * 2, dais.hz * 2, dais.hx * 2 - 0.16, dais.hz * 2 - 0.16, PALETTE.darkStone);
  insetRing(dais.hx * 2 - 0.16, dais.hz * 2 - 0.16, dais.hx * 2 - 0.5, dais.hz * 2 - 0.5, "#d9534f");
  low.box(dais.hx * 2 - 0.5, 0.04, dais.hz * 2 - 0.5, dais.x, 0.11, dais.z, PALETTE.gold);
  // Corner planters.
  for (let i = 0; i < 4; i++) {
    const p = solid(`square-planter-${i}`);
    low.cyl(1.15, 0.92, 0.62, p.x, 0, p.z, i % 2 ? "#d98a64" : "#c97a57", 10);
    low.cyl(1.2, 1.2, 0.13, p.x, 0.62, p.z, "#e7a27d", 10);
    low.cyl(1.04, 1.04, 0.02, p.x, 0.75, p.z, PALETTE.soil, 10);
    addShrub(tall, p.x, p.z, 1.15, rand, 0.72);
    addFlowers(tall, p.x, p.z, 0.77, 11, 1, rand, FLOWERS, 0.2);
  }
  // Ken's notice board: a little shingled roof over cork, posters on both faces.
  const board = solid("notice-board");
  for (const z of [4.75, 7.25]) tall.box(0.26, 2.15, 0.2, board.x, 0, z, PALETTE.darkWood);
  tall.box(0.22, 1.5, 3, board.x, 0.75, board.z, PALETTE.darkWood);
  for (const side of [-1, 1]) tall.boxAt(0.36, 0.07, 3.3, [board.x + side * 0.15, 2.3, board.z], [0, 0, -side * 0.5], side < 0 ? PALETTE.red : "#d0523f");
  for (const face of [-1, 1]) {
    tall.box(0.04, 1.28, 2.76, board.x + face * 0.12, 0.86, board.z, "#d7ab6e");
    for (const [z, y, color] of [[5.15, 1.15, "#fff0ba"], [6, 1.38, "#a7dcd6"], [6.85, 1.08, "#f3a899"], [5.95, 0.93, "#d8c7f3"]] as const) {
      tall.box(0.03, 0.52, 0.62, board.x + face * 0.145, y, z, color);
      tall.box(0.04, 0.05, 0.38, board.x + face * 0.15, y + 0.34, z, "#6b5a50");
      tall.box(0.04, 0.05, 0.3, board.x + face * 0.15, y + 0.21, z, "#6b5a50");
      tall.sphere(0.04, board.x + face * 0.16, y + 0.46, z, PALETTE.red, [0.6, 1, 1], 6);
    }
  }
  signpost(tall, signs, "square", -15.5, -19.2, 0.82, 3.1);
  // Hedges frame the square without narrowing it; every exit stays open.
  for (const [x0, z0, x1, z1] of [[-17.6, -19.6, -6.6, -19.6], [6.6, -19.6, 17.6, -19.6], [-19.2, -17, -19.2, -6], [-19.2, 6, -19.2, 17], [19.2, -17, 19.2, -6], [19.2, 6, 19.2, 17]] as const) hedge(tall, x0, z0, x1, z1, rand);
  for (const x of [-16, -12, -8, -5, 5, 8, 12, 16]) addFlowers(tall, x, 18.75, GRASS_Y, 5, 0.6, rand);
}

/* ------------------------------------------------------------------ market */

/** A market stall: the counter fills its collider, the frame and awning stand above it. */
function stall(low: B, tall: B, signs: SignBatch, id: string, sign: Parameters<SignBatch["add"]>[0], a: string, c: string, body: string, trim: string) {
  const s = boxOf(id), { x, z, hx, hz } = s, north = z < 0, top = s.height;
  low.box(hx * 2, top - 0.1, hz * 2, x, 0, z, body);
  // Plank fronts on the two faces people look at.
  for (let i = 0; i < 9; i++) {
    const px = x - hx + (i + 0.5) * hx * 2 / 9;
    for (const face of [-1, 1]) low.box(hx * 2 / 9 - 0.05, top - 0.22, 0.03, px, 0.06, z + face * (hz + 0.012), i % 2 ? trim : body);
  }
  low.box(hx * 2 + 0.2, 0.1, hz * 2 + 0.2, x, top - 0.1, z, trim);
  // Awning: always highest on the camera side, so wares and the shopkeeper stay in view.
  const zLow = north ? z - hz - 0.35 : z - 0.1, yLow = north ? 2.95 : 3.1, zHigh = z + hz + 0.35, yHigh = 3.72;
  for (const dx of [-hx + 0.16, hx - 0.16]) {
    tall.box(0.13, yHigh + 0.02 - top, 0.13, x + dx, top, z + hz - 0.14, PALETTE.wood);
    tall.box(0.13, (north ? yLow : 3.1) - top, 0.13, x + dx, top, north ? z - hz + 0.14 : z - 0.1, PALETTE.wood);
  }
  addAwning(tall, x, hx + 0.2, zLow, yLow, zHigh, yHigh, a, c, 9);
  // The shop sign stands on the awning's high edge, facing the camera.
  const width = SignBatch.width(sign, 0.82);
  tall.box(width + 0.2, 0.98, 0.1, x, yHigh, zHigh - 0.02, PALETTE.darkWood);
  signs.add(sign, x, yHigh + 0.49, zHigh + 0.04, 0.82);
  return { x, z, hx, hz, top, north };
}

function bakery(low: B, tall: B, signs: SignBatch) {
  const { x, z, top } = stall(low, tall, signs, "bakery-stall", "bakery", "#e8604c", "#fff4d4", "#d29a63", "#a86b3c");
  const bread = "#e2a556", crust = "#c98638", rand = seeded(21);
  // A stepped shelf at the back, baskets of rolls in front.
  for (const [dz, h] of [[-1.1, 0.46], [-0.55, 0.24]] as const) low.box(5.8, h, 0.56, x, top, z + dz, "#b67b45");
  for (const dx of [-2.3, -1.15, 0, 1.15, 2.3]) {
    low.add(new THREE.ConeGeometry(0.46, 0.34, 8, 1, true), "#a06a34", [x + dx, top + 0.17, z + 0.55], [Math.PI, 0, 0], [1, 1, 0.85], { flatAo: true });
    low.cyl(0.42, 0.42, 0.03, x + dx, top + 0.31, z + 0.55, "#7d5230", 8);
    for (let i = 0; i < 5; i++) low.add(new THREE.IcosahedronGeometry(0.135, 0), i % 2 ? bread : crust, [x + dx + (i % 3 - 1) * 0.2, top + 0.39 + (i > 2 ? 0.1 : 0), z + 0.55 + (i % 2 ? 0.13 : -0.13)], [i, dx, 0], [1, 0.72, 0.9], { flatAo: true });
  }
  // Long loaves and croissants on the shelves.
  for (let i = 0; i < 6; i++) low.add(new THREE.CapsuleGeometry(0.11, 0.56, 2, 6), i % 2 ? bread : crust, [x - 2.5 + i, top + 0.32, z - 0.55], [Math.PI / 2, 0, (rand() - 0.5) * 0.3], [1, 1, 1], { flatAo: true });
  for (let i = 0; i < 7; i++) low.add(new THREE.TorusGeometry(0.15, 0.075, 5, 8, Math.PI), "#f0b865", [x - 2.6 + i * 0.86, top + 0.56, z - 1.1], [Math.PI / 2 + 0.25, 0, i], [1, 1, 1], { flatAo: true });
  // A big pretzel on the sign, the classic baker's mark.
  for (const side of [-1.72, 1.72]) tall.torus(0.26, 0.07, [x + side, 4.04, z + 1.8 + 0.35], [0, 0, 0], "#d08d3e");
}

function flowerShop(low: B, tall: B, signs: SignBatch) {
  const { x, z, hz, top } = stall(low, tall, signs, "flowers-stall", "flowers", "#a9e0b4", "#fff7e8", "#f6efe0", "#8fcfa4");
  const rand = seeded(32), tiers = [[0.9, 0.08], [0.2, 0.28], [-0.5, 0.5]] as const;
  for (const [dz, h] of tiers) low.box(6.1, h, 0.72, x, top, z + dz, "#e8e2c9");
  const buckets = ["#7fa9bd", "#d98a64", "#e8e2c9", "#d98a64", "#7fa9bd", "#e7a27d", "#7fa9bd"];
  tiers.forEach(([dz, h], row) => {
    for (let i = 0; i < 7; i++) {
      const px = x - 2.55 + i * 0.85 + (row % 2) * 0.2, y = top + h;
      low.cyl(0.25, 0.18, 0.3, px, y, z + dz, buckets[(i + row) % buckets.length], 6);
      tall.add(new THREE.IcosahedronGeometry(0.27, 0), "#5f9f55", [px, y + 0.42, z + dz], [px, dz, 0], [1, 0.78, 1], { wind: 0.2 });
      addFlowers(tall, px, z + dz, y + 0.44, 4, 0.22, rand, i % 3 === 0 ? ["#ff8fa8", "#ffb0d0"] : i % 3 === 1 ? ["#ffd64f", "#ffffff"] : ["#c79bff", "#ff7c6b"], 0.13);
    }
  });
  // Hanging baskets from a beam, trailing leaves.
  tall.box(6.5, 0.1, 0.1, x, 2.86, z - 0.1, PALETTE.wood);
  for (const dx of [-2.4, -0.8, 0.8, 2.4]) {
    tall.add(new THREE.CylinderGeometry(0.012, 0.012, 0.45, 3), "#8a6a48", [x + dx, 2.64, z - 0.1], [0, 0, 0], [1, 1, 1], { wind: 0.2, hang: true, flatAo: true });
    tall.add(new THREE.ConeGeometry(0.3, 0.3, 7, 1, true), "#c08a58", [x + dx, 2.3, z - 0.1], [Math.PI, 0, 0], [1, 1, 1], { wind: 0.25, hang: true, flatAo: true });
    tall.add(new THREE.IcosahedronGeometry(0.31, 0), "#62ad5c", [x + dx, 2.42, z - 0.1], [dx, 0, 0], [1, 0.72, 1], { wind: 0.3, hang: true });
    addFlowers(tall, x + dx, z - 0.1, 2.55, 4, 0.22, rand, FLOWERS, 0.05);
  }
  void hz;
}

function toyShop(low: B, tall: B, signs: SignBatch) {
  const { x, z, top } = stall(low, tall, signs, "toys-stall", "toys", "#4f9ad6", "#ffe680", "#ffd166", "#3f83c9");
  const colors = ["#e8604c", "#4f9ad6", "#ffcc4d", "#6fb35c", "#c77bd9"];
  // Tall shelf of toy boxes along the back.
  low.box(6, 1.46, 0.5, x, top, z - 1.15, "#3f83c9");
  for (let row = 0; row < 2; row++) {
    low.box(5.9, 0.05, 0.46, x, top + 0.45 + row * 0.5, z - 0.92, PALETTE.cream);
    for (let i = 0; i < 8; i++) {
      low.box(0.5, 0.38 - (i % 3) * 0.05, 0.1, x - 2.6 + i * 0.74, top + 0.05 + row * 0.5, z - 0.86, colors[(i + row) % colors.length]);
      low.box(0.08, 0.34 - (i % 3) * 0.05, 0.12, x - 2.6 + i * 0.74, top + 0.05 + row * 0.5, z - 0.85, "#fff4d4");
    }
  }
  // A pyramid of alphabet blocks.
  const bx = x + 1.2, bz = z + 0.4, s = 0.34;
  for (let row = 0; row < 3; row++) for (let i = 0; i < 3 - row; i++) {
    low.boxAt(s, s, s, [bx + (i - (2 - row) / 2) * (s + 0.02), top + s / 2 + row * s, bz], [0, (i + row) * 0.18, 0], colors[(i * 2 + row) % colors.length]);
  }
  // Teddy bear.
  const tx = x - 1.3, tz = z + 0.3, fur = "#c98a4e";
  low.sphere(0.27, tx, top + 0.27, tz, fur, [1, 1.08, 0.9], 8);
  low.sphere(0.21, tx, top + 0.64, tz + 0.02, fur, [1, 1, 1], 8);
  for (const d of [-1, 1]) {
    low.sphere(0.075, tx + d * 0.17, top + 0.82, tz, fur, [1, 1, 0.7], 6);
    low.sphere(0.1, tx + d * 0.26, top + 0.1, tz + 0.2, fur, [1, 0.9, 1.2], 6);
    low.sphere(0.09, tx + d * 0.28, top + 0.4, tz + 0.1, fur, [0.9, 1.2, 0.9], 6);
    low.sphere(0.03, tx + d * 0.08, top + 0.68, tz + 0.2, "#2b2d42", [1, 1, 0.6], 5);
  }
  low.sphere(0.09, tx, top + 0.6, tz + 0.19, "#ecd3ae", [1.1, 0.8, 0.7], 6);
  low.sphere(0.027, tx, top + 0.62, tz + 0.27, "#2b2d42", [1, 0.8, 0.7], 5);
  // A beach ball and a toy boat at the front of the counter.
  low.sphere(0.2, x - 2.5, top + 0.2, z + 1.15, "#e8604c", [1, 1, 1], 8);
  low.sphere(0.21, x - 2.5, top + 0.2, z + 1.15, "#fff4d4", [1, 0.32, 1.02], 8);
  low.add(new THREE.CylinderGeometry(0.3, 0.16, 0.16, 7), "#4f9ad6", [x - 0.1, top + 0.08, z + 1.2], [0, 0, 0], [1, 1, 1.7]);
  low.cyl(0.02, 0.02, 0.5, x - 0.1, top + 0.16, z + 1.2, PALETTE.wood, 4);
  low.add(new THREE.ConeGeometry(0.18, 0.36, 3), "#fff4d4", [x - 0.02, top + 0.45, z + 1.2], [0, 0, 0], [1, 1, 0.1]);
  // Pinwheels on the front posts.
  for (const dx of [-3.14, 3.14]) for (let i = 0; i < 4; i++) {
    tall.boxAt(0.04, 0.3, 0.015, [x + dx + Math.cos(i * Math.PI / 2) * 0.13, 3.1 + Math.sin(i * Math.PI / 2) * 0.13, z + 1.8], [0, 0, i * Math.PI / 2 + 0.6], colors[i]);
  }
}

function fruitShop(low: B, tall: B, signs: SignBatch) {
  const { x, z, top } = stall(low, tall, signs, "fruit-stall", "fruit", "#ff9d3c", "#7fc161", "#d9a366", "#5fa564");
  const crate = (cx: number, cz: number, fruit: string, r: number, second?: string) => {
    low.box(1.34, 0.26, 0.9, cx, top + 0.02, cz, "#a8743f");
    for (const d of [-0.42, 0.42]) low.box(1.38, 0.08, 0.05, cx, top + 0.22, cz + d, "#c9975f");
    const per = Math.max(3, Math.floor(1.16 / (r * 2)));
    for (let i = 0; i < per; i++) for (let row = 0; row < 3; row++) {
      low.add(new THREE.IcosahedronGeometry(r, 0), second && (i + row) % 2 ? second : fruit, [cx - 0.54 + (i + 0.5) * 1.08 / per, top + 0.3 + r * 0.5 + (row === 1 ? r * 0.25 : 0), cz - 0.28 + row * 0.28], [i, row, 0], [1, 0.95, 1], { flatAo: true });
    }
  };
  crate(x - 2.3, z - 1, "#ff9d3c", 0.13);
  crate(x - 0.75, z - 1, "#e8483f", 0.13, "#d9352f");
  crate(x + 0.8, z - 1, "#a6cf52", 0.13);
  crate(x + 2.35, z - 1, "#ffd64f", 0.11);
  crate(x - 2.3, z + 0.85, "#8e5cc2", 0.09);
  crate(x + 2.35, z + 0.85, "#e8483f", 0.11, "#ff9d3c");
  // Watermelons piled in the middle, one cut open.
  for (const [dx, dz, dy] of [[-0.5, 0.75, 0], [0.5, 0.75, 0], [0, 0.95, 0.3]] as const) {
    low.sphere(0.34, x + dx, top + 0.3 + dy, z + dz, "#3f8f55", [1.15, 0.95, 0.95], 8);
    for (let i = 0; i < 2; i++) low.sphere(0.345, x + dx, top + 0.3 + dy, z + dz, "#6fb35c", [0.32 + i * 0.5, 0.96, 0.96], 8);
  }
  // Bananas hang from the front beam.
  tall.box(6.5, 0.09, 0.09, x, 2.9, z - 0.1, PALETTE.wood);
  for (const dx of [-2.2, 0, 2.2]) for (let i = 0; i < 4; i++) {
    tall.add(new THREE.CapsuleGeometry(0.05, 0.36, 2, 5), "#ffd64f", [x + dx + (i - 1.5) * 0.09, 2.62, z - 0.1 + (i % 2) * 0.06], [0.25, 0, (i - 1.5) * 0.25], [1, 1, 1], { wind: 0.16, hang: true, flatAo: true });
  }
  // The shop's hanging sign, on a bracket off the corner post.
  tall.box(1.6, 0.08, 0.08, x + 3.7, 3.3, z + 1.66, PALETTE.darkWood);
  tall.add(new THREE.BoxGeometry(1.16, 0.62, 0.05), "#ff9d3c", [x + 3.82, 2.8, z + 1.66], [0, 0, 0], [1, 1, 1], { wind: 0.1, hang: true });
  tall.sphere(0.2, x + 3.82, 2.8, z + 1.7, "#ff9d3c", [1, 1, 0.5], 7);
  tall.add(new THREE.ConeGeometry(0.07, 0.14, 4), "#5fa564", [x + 3.86, 3.02, z + 1.72], [0, 0, -0.7], [1, 1, 0.5], { wind: 0.1, hang: true });
}

function market(low: B, tall: B, signs: SignBatch) {
  const rand = seeded(5);
  bakery(low, tall, signs);
  flowerShop(low, tall, signs);
  toyShop(low, tall, signs);
  fruitShop(low, tall, signs);
  // Fences stand just outside the walkable street, with hanging flower baskets.
  for (const z of [-12.2, 12.2]) for (let x = 24; x <= 54; x += 3.75) {
    tall.box(0.16, 1.18, 0.16, x, GRASS_Y, z, PALETTE.wood);
    tall.sphere(0.1, x, 1.2, z, PALETTE.gold, [1, 1, 1], 6);
    if (x < 53) {
      for (const y of [0.5, 0.92]) tall.box(3.75, 0.12, 0.08, x + 1.875, y, z, PALETTE.cream);
      if (Math.round(x) % 2 === 0) { tall.box(0.9, 0.2, 0.26, x + 1.9, 0.74, z + 0.12, PALETTE.wood); addFlowers(tall, x + 1.9, z + 0.12, 0.92, 5, 0.34, rand, FLOWERS, 0.08); }
    }
  }
  signpost(tall, signs, "market", 20.4, -5.8, 0.82, 3.2);
  hedge(tall, 57, -11, 57, 11, rand);
  hedge(tall, 24, 13.4, 54, 13.4, rand);
  // Barrels of odds and ends just outside the street's end.
  for (const [x, z] of [[57.2, -13], [58.4, -12.1], [57.4, 13.2]] as const) {
    tall.cyl(0.42, 0.42, 0.9, x, GRASS_Y, z, PALETTE.wood, 8);
    tall.torus(0.43, 0.03, [x, 0.2, z], [Math.PI / 2, 0, 0], PALETTE.darkWood);
    tall.torus(0.43, 0.03, [x, 0.62, z], [Math.PI / 2, 0, 0], PALETTE.darkWood);
  }
}

/* ------------------------------------------------------------------ school */

function school(low: B, tall: B, signs: SignBatch) {
  const rand = seeded(17);
  const b = boxOf("school-building"), wall = "#fff0cf", z = b.z + b.hz + 0.02;
  tall.box(b.hx * 2, b.height, b.hz * 2, b.x, 0, b.z, wall);
  tall.box(b.hx * 2 + 0.1, 0.6, b.hz * 2 + 0.1, b.x, 0, b.z, "#c98f68");
  tall.box(b.hx * 2 + 0.1, 0.12, b.hz * 2 + 0.1, b.x, 3.35, b.z, "#f4d9a6");
  addHipRoof(tall, b.x, b.z, b.hx * 2, b.hz * 2, b.height, PALETTE.teal, 2.2);
  // Windows carry paper decorations; flower boxes sit under each.
  for (const x of [-7, -3, 3, 7, 11]) {
    addWindow(tall, x, 1.4, z, 1.6, 1.5);
    addFlowerBox(tall, tall, x, 1.28, z, 1.8, rand);
    for (let i = 0; i < 3; i++) tall.box(0.32, 0.32, 0.12, x - 0.48 + i * 0.48, 2.34, z + 0.03, ["#ff9aa8", "#ffd666", "#88cbe8"][i]);
    // Second row of small windows up under the eaves.
    addWindow(tall, x, 3.65, z, 0.9, 0.86);
  }
  // Double door and canopy; the walkable doormat is painted on the paving.
  tall.box(2.4, 3.1, 0.1, 0, 0.02, z, PALETTE.cream);
  for (const dx of [-0.54, 0.54]) {
    tall.box(1, 2.82, 0.12, dx, 0.04, z + 0.01, PALETTE.teal);
    tall.box(0.62, 0.9, 0.14, dx, 1.65, z + 0.01, "#9edbe6");
    tall.sphere(0.06, dx * 0.2, 1.3, z + 0.09, PALETTE.gold, [1, 1, 1], 6);
  }
  tall.boxAt(3.4, 0.14, 1.4, [0, 3.32, z + 0.58], [0.26, 0, 0], PALETTE.red);
  for (const dx of [-1.6, 1.6]) tall.beam([dx, 2.7, z], [dx, 3.18, z + 1.04], 0.09, PALETTE.darkWood);
  // Name board above the door.
  const width = SignBatch.width("school", 0.8);
  tall.box(width + 0.3, 0.96, 0.1, 0, 3.72, z + 0.03, PALETTE.darkWood);
  signs.add("school", 0, 4.2, z + 0.09, 0.8);
  // Notice boards between the windows.
  for (const x of [-5, 5]) {
    tall.box(1.05, 1.26, 0.07, x, 1.2, z, PALETTE.darkWood);
    tall.box(0.9, 1.1, 0.08, x, 1.28, z + 0.005, "#d7ab6e");
    for (const [dx, y, color] of [[-0.2, 1.75, "#fff0ba"], [0.2, 1.62, "#a7dcd6"], [-0.14, 1.36, "#f3a899"], [0.22, 1.32, "#d8c7f3"]] as const) tall.box(0.33, 0.33, 0.09, x + dx, y, z + 0.008, color);
  }
  // Clock tower.
  tall.box(3.4, 3.7, 3, 0, 5.5, -51, "#f6dfb4");
  tall.box(3.6, 0.2, 3.2, 0, 9.1, -51, PALETTE.darkStone);
  tall.add(new THREE.ConeGeometry(2.9, 2.3, 4), PALETTE.teal, [0, 10.45, -51], [0, Math.PI / 4, 0]);
  tall.cylAt(1.04, 0.1, [0, 7.6, -49.47], [Math.PI / 2, 0, 0], PALETTE.gold, 20);
  tall.cylAt(0.92, 0.15, [0, 7.6, -49.44], [Math.PI / 2, 0, 0], PALETTE.cream, 20);
  tall.box(0.09, 0.7, 0.1, 0, 7.58, -49.33, PALETTE.darkWood);
  tall.box(0.6, 0.09, 0.1, 0, 7.55, -49.31, PALETTE.darkWood);
  tall.cyl(0.04, 0.05, 2.1, 0, 11.5, -51, PALETTE.darkWood, 5);
  tall.add(new THREE.BoxGeometry(1.15, 0.7, 0.03), PALETTE.red, [0.62, 13.18, -51], [0, 0, 0], [1, 1, 1], { wind: 1 });
  // Flower beds use their colliders; the blooms fill the whole soil top.
  for (const id of ["school-flowers-west", "school-flowers-east"]) {
    const bed = boxOf(id);
    low.box(bed.hx * 2, 0.34, bed.hz * 2, bed.x, 0, bed.z, "#c9b28a");
    low.box(bed.hx * 2 - 0.16, 0.06, bed.hz * 2 - 0.16, bed.x, 0.34, bed.z, PALETTE.soil);
    for (let i = 0; i < 8; i++) addFlowers(tall, bed.x - 2.1 + i * 0.6, bed.z, 0.4, 4, 0.26, rand);
  }
  // Lost & Found table: a cloth, a few neutral lost things (never stationery) and its sign.
  const table = boxOf("lost-found");
  low.box(table.hx * 2, 0.86, table.hz * 2, table.x, 0, table.z, "#c9975f");
  low.box(table.hx * 2 + 0.2, 0.14, table.hz * 2 + 0.2, table.x, 0.86, table.z, "#fff4d4");
  for (let i = 0; i < 9; i++) low.box(0.4, 0.5, 0.03, table.x - 1.9 + i * 0.475, 0.5, table.z + table.hz + 0.11, i % 2 ? "#ffcc4d" : "#fff4d4");
  low.box(0.9, 0.5, 0.7, table.x - 1.1, 1, table.z - 0.1, "#c9975f");
  low.box(0.96, 0.05, 0.76, table.x - 1.1, 1.5, table.z - 0.1, "#b98657");
  low.sphere(0.2, table.x + 0.2, 1.2, table.z + 0.2, "#4f9ad6", [1, 1, 1], 8);
  low.sphere(0.21, table.x + 0.2, 1.2, table.z + 0.2, "#fff4d4", [1, 0.3, 1.02], 8);
  low.add(new THREE.SphereGeometry(0.28, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), "#e8604c", [table.x + 1.05, 1, table.z], [0, 0, 0]);
  low.add(new THREE.CylinderGeometry(0.42, 0.42, 0.03, 10, 1, false, 0, Math.PI), "#e8604c", [table.x + 1.05, 1.01, table.z + 0.02], [0, 0, 0]);
  const w = SignBatch.width("lostFound", 0.66);
  for (const dx of [-w / 2, w / 2]) tall.cyl(0.05, 0.05, 1.4, table.x + dx, 1, table.z - table.hz + 0.12, PALETTE.darkWood, 5);
  tall.box(w + 0.14, 0.78, 0.08, table.x, 1.74, table.z - table.hz + 0.12, PALETTE.darkWood);
  signs.add("lostFound", table.x, 2.13, table.z - table.hz + 0.17, 0.66);
  // Fence around the yard, stopping at the library approach.
  for (const x of [-14.3, 14.3]) {
    const northEnd = x < 0 ? -35 : -47;
    for (let z = -26; z > northEnd; z -= 3) { tall.box(0.16, 1.18, 0.16, x, GRASS_Y, z, PALETTE.cream); tall.sphere(0.09, x, 1.18, z, PALETTE.gold, [1, 1, 1], 5); }
    for (const y of [0.42, 0.86]) tall.box(0.08, 0.12, -26 - northEnd, x, y, (-26 + northEnd) / 2, PALETTE.cream);
  }
  // Playground past the east fence, visible across it and never in the way.
  const px = 19.6, pz = -36;
  for (const dz of [-2.4, 2.4]) for (const dx of [-0.7, 0.7]) tall.beam([px + dx, GRASS_Y, pz + dz], [px, 3, pz + dz], 0.13, "#e8604c");
  tall.box(0.14, 0.14, 5, px, 2.98, pz, "#e8604c");
  for (const dz of [-1, 1]) {
    for (const off of [-0.28, 0.28]) tall.beam([px, 2.96, pz + dz + off], [px, 0.62, pz + dz + off], 0.03, "#8a8f98");
    tall.box(0.34, 0.06, 0.7, px, 0.56, pz + dz, "#ffcc4d");
  }
  const sx = 20, sz = -43;
  tall.box(1.1, 2.2, 1.1, sx, GRASS_Y, sz - 1.8, "#4f9ad6");
  tall.boxAt(0.92, 0.1, 4, [sx, 1.02, sz + 0.1], [0.56, 0, 0], "#ffcc4d");
  for (const dx of [-0.48, 0.48]) tall.boxAt(0.08, 0.2, 4, [sx + dx, 1.12, sz + 0.1], [0.56, 0, 0], "#e8604c");
  low.box(3.2, 0.14, 3.2, 24.6, GRASS_Y, -38, "#c9a96e");
  low.box(2.86, 0.02, 2.86, 24.6, 0.08, -38, "#f3e0a6");
  low.sphere(0.34, 24.2, 0.22, -37.6, "#e8c98f", [1.2, 0.5, 1], 6);
  low.cyl(0.13, 0.1, 0.22, 25, 0.1, -38.4, "#e8604c", 7);
}

/* ------------------------------------------------------------------ harbor */

function barrel(b: B, x: number, y: number, z: number, r = 0.42, h = 0.9) {
  b.cyl(r * 0.88, r * 0.88, h, x, y, z, PALETTE.wood, 9);
  b.cyl(r, r, h * 0.56, x, y + h * 0.22, z, "#c58a50", 9);
  for (const k of [0.16, 0.84]) b.torus(r * 0.9, 0.025, [x, y + h * k, z], [Math.PI / 2, 0, 0], PALETTE.slate);
}

function crate(b: B, x: number, y: number, z: number, s = 0.8, yaw = 0, color = PALETTE.wood) {
  b.box(s, s, s, x, y, z, color, yaw);
  for (const dy of [0.05, s - 0.05]) b.box(s + 0.03, 0.09, s + 0.03, x, y + dy - 0.045, z, PALETTE.darkWood, yaw);
}

function ropeCoil(b: B, x: number, y: number, z: number, r = 0.34) {
  for (let i = 0; i < 3; i++) b.torus(r - i * 0.05, 0.05, [x, y + 0.05 + i * 0.075, z], [Math.PI / 2, 0, 0], "#e4c58f");
}

/** Continuous rope sides meet at shared rings rather than overlapping bars. */
function harborRope(b: B, from: [number, number, number], to: [number, number, number], sag: number) {
  class RopeCurve extends THREE.Curve<THREE.Vector3> {
    constructor() { super(); }
    getPoint(t: number, target = new THREE.Vector3()) { return target.set(...wirePoint(from, to, sag, t)); }
  }
  b.add(new THREE.TubeGeometry(new RopeCurve(), 8, 0.025, 4, false), "#e4c58f", [0, 0, 0]);
}

function harbor(low: B, tall: B, signs: SignBatch) {
  const rand = seeded(9);
  const easel = boxOf("harbor-easel");
  low.at(easel.x, 0, easel.z, Math.PI / 2, () => {
    // Horizontal-cut feet and joints: all three soles rest exactly on paving.
    const leg = (x0: number, z0: number, x1: number, z1: number, top: number) => {
      const g = new THREE.BoxGeometry(0.08, top, 0.08), p = g.getAttribute("position");
      for (let i = 0; i < p.count; i++) {
        const t = (p.getY(i) + top / 2) / top;
        p.setXYZ(i, p.getX(i) + x0 + (x1 - x0) * t, t * top, p.getZ(i) + z0 + (z1 - z0) * t);
      }
      g.computeVertexNormals();
      low.add(g, PALETTE.wood, [0, 0, 0]);
    };
    for (const side of [-1, 1]) leg(side * 0.43, 0.28, side * 0.18, -0.03, 1.7);
    leg(0, -0.52, 0, -0.12, 1.52);
    // Canvas leans back along the frame; its sole sits on the ledge at 0.76.
    low.box(1, 0.09, 0.24, 0, 0.67, 0.17, PALETTE.darkWood);
    const canvas = (w: number, h: number, y: number, front: number, color: string) => {
      const g = new THREE.BoxGeometry(w, h, 0.018), p = g.getAttribute("position");
      for (let i = 0; i < p.count; i++) {
        const py = y + p.getY(i) + h / 2;
        p.setXYZ(i, p.getX(i), py, p.getZ(i) + 0.17 - (py - 0.76) * (0.31 / 1.7) + front);
      }
      g.computeVertexNormals();
      low.add(g, color, [0, 0, 0]);
    };
    canvas(0.88, 0.68, 0.76, 0, "#fbf7ee");
    canvas(0.76, 0.22, 0.82, 0.022, "#2f8cc7");
    canvas(0.76, 0.25, 1.04, 0.022, "#8fd3f4");
    canvas(0.76, 0.08, 1.29, 0.022, "#cdeaa5");
  });
  // Pier stands on pilings, with a rope rail on the east side only so the rest stays open.
  for (let z = 34; z <= 49; z += 3) {
    for (const x of [5.05, 10.95]) low.cyl(0.2, 0.24, 1.15, x, -0.95, z, PALETTE.darkWood, 8);
    tall.cyl(0.16, 0.18, 1.25, 11.15, -0.1, z, PALETTE.wood, 7);
    tall.sphere(0.14, 11.15, 1.16, z, PALETTE.gold, [1, 1, 1], 6);
    if (z < 49) harborRope(tall, [11.15, 0.92, z], [11.15, 0.92, z + 3], 0.16);
  }
  low.box(6.2, 0.1, 0.18, 8, 0.02, 49.09, PALETTE.darkWood);
  // Life ring and a lantern post at the pier's end.
  tall.torus(0.28, 0.08, [11.05, 0.72, 45.5], [0, Math.PI / 2, 0], "#e8604c");
  // A short projecting bracket carries the lamp rather than leaving it over water.
  low.box(0.65, 0.16, 0.65, 11.2, -0.16, 49.15, PALETTE.darkWood);
  addLamp(low, 11.2, 49.15);
  // Harbor fence on the lip of the bank; the bridge's landing stays open.
  for (let x = -16; x < 24; x += 3) {
    if (Math.abs(x) < 4) continue;
    tall.cyl(0.11, 0.15, 1.05, x, GRASS_Y, 27.82, PALETTE.wood, 7);
    tall.sphere(0.12, x, 1, 27.82, PALETTE.gold, [1, 1, 1], 6);
    if (Math.abs(x + 3) >= 4 || x + 3 < -3.5) harborRope(tall, [x, 0.82, 27.82], [x + 3, 0.82, 27.82], 0.14);
  }
  signpost(tall, signs, "harbor", -9.4, 27.7, 0.8, 3.1);
  // The barrel is its collider; a net and a coil of rope make it a working dock.
  const big = solid("harbor-barrel");
  barrel(low, big.x, 0, big.z, 1, big.height);
  ropeCoil(low, big.x, big.height, big.z);
  // Crates, barrels and nets line the bank's south lip, low so they never block the view.
  for (const [x, z, s, yaw, color] of [[-13.6, 38.1, 0.9, 0.2, PALETTE.wood], [-12.4, 38.3, 0.7, -0.3, "#c9975f"], [-13, 38.2, 0.56, 0.5, "#d9a36a"], [14, 38, 0.82, 0.4, PALETTE.wood], [15.2, 38.3, 0.66, 0, "#c9975f"]] as const) crate(low, x, GRASS_Y, z, s, yaw, color);
  crate(low, -13.1, GRASS_Y + 0.72, 38.2, 0.5, 0.5, "#d9a36a");
  barrel(low, -9.4, GRASS_Y, 38.2);
  barrel(low, -8.3, GRASS_Y, 38.5, 0.36, 0.76);
  ropeCoil(low, -6.6, GRASS_Y, 38.3, 0.42);
  ropeCoil(low, 17.4, GRASS_Y, 38.3, 0.38);
  // Fishing nets drying on a low frame.
  for (const x of [-3.6, -0.2, 3.2]) tall.cyl(0.05, 0.06, 1.25, x, GRASS_Y, 38.5, PALETTE.darkWood, 5);
  tall.box(6.9, 0.05, 0.05, -0.2, 1.17, 38.5, PALETTE.darkWood);
  for (let i = 0; i < 12; i++) tall.add(new THREE.BoxGeometry(0.46, 0.74, 0.02), i % 2 ? "#cfc7a9" : "#bfb596", [-3.3 + i * 0.56, 0.76, 38.5], [0, 0, 0], [1, 1, 1], { wind: 0.14, hang: true, flatAo: true });
  for (let i = 0; i < 5; i++) tall.sphere(0.07, -2.6 + i * 1.2, 0.5, 38.48, "#e8604c", [1, 1, 1], 5);
  // Buoys off the pier.
  for (const [x, z] of [[1, 38], [-3, 44], [15.5, 46]] as const) {
    low.sphere(0.34, x, -0.2, z, "#e8604c", [1, 0.8, 1], 7);
    low.sphere(0.35, x, -0.18, z, "#fff4d4", [1, 0.24, 1], 7);
  }
  // Fish-drying racks on a little pole beside the hut.
  for (const dx of [-1.2, 1.2]) tall.cyl(0.05, 0.05, 1.6, 25 + dx, GRASS_Y, 36.3, PALETTE.darkWood, 5);
  tall.box(2.5, 0.05, 0.05, 25, 1.5, 36.3, PALETTE.darkWood);
  for (let i = 0; i < 5; i++) tall.add(new THREE.SphereGeometry(0.13, 5, 4), "#f3a15c", [24 + i * 0.5, 1.24, 36.3], [0, 0, 0], [0.45, 1.4, 0.3], { wind: 0.2, hang: true });
  // Flower tubs by the landing, a bit of the square across the river.
  for (const [x, z] of [[-3.7, 37.6], [-17.6, 29], [24.6, 28.8]] as const) {
    low.cyl(0.4, 0.3, 0.34, x, GRASS_Y, z, "#d98a64", 8);
    addFlowers(tall, x, z, 0.28, 8, 0.32, rand, FLOWERS, 0.15);
  }
}

/* ---------------------------------------------------------------- festival */

function stripedTop(b: B, x: number, y: number, z: number, rx: number, rz: number, rise: number, panels: number, a: string, c: string) {
  for (let i = 0; i < panels; i++) {
    const a0 = (i + 0.5) / panels * Math.PI * 2, a1 = (i + 1.5) / panels * Math.PI * 2;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([0, rise, 0, Math.cos(a1) * rx, 0, Math.sin(a1) * rz, Math.cos(a0) * rx, 0, Math.sin(a0) * rz], 3));
    b.add(g, i % 2 ? c : a, [x, y, z]);
    // Scalloped hem under each panel.
    const hem = new THREE.BufferGeometry();
    const mx = (Math.cos(a0) + Math.cos(a1)) / 2, mz = (Math.sin(a0) + Math.sin(a1)) / 2;
    hem.setAttribute("position", new THREE.Float32BufferAttribute([Math.cos(a1) * rx, 0, Math.sin(a1) * rz, mx * rx, -0.4, mz * rz, Math.cos(a0) * rx, 0, Math.sin(a0) * rz], 3));
    b.add(hem, i % 2 ? a : c, [x, y, z], [0, 0, 0], [1, 1, 1], { wind: 0.14, hang: true });
  }
}

const PENNANTS = ["#e8604c", "#ffcc4d", "#4f9ad6", "#6fb35c", "#c77bd9", "#ff8fa8"];
/** Pennants along a wire: part of the scenery for the Chapter 5 set-up, already swaying. */
function pennantLine(b: B, from: [number, number, number], to: [number, number, number], sag: number, count: number) {
  b.wire(from, to, sag, 6, "#8a6a48", 0.032);
  const yaw = Math.atan2(to[0] - from[0], to[2] - from[2]);
  for (let i = 1; i < count; i++) {
    const p = wirePoint(from, to, sag, i / count);
    b.add(new THREE.ConeGeometry(0.28, 0.58, 3), PENNANTS[i % PENNANTS.length], [p[0], p[1] - 0.3, p[2]], [Math.PI, yaw + Math.PI / 2, 0], [1, 1, 0.12], { wind: 1, hang: true });
  }
}

export const MAYPOLE_TOP: [number, number, number] = [-47, 6.6, 0];
/**
 * Tall poles just outside the lawn. Wires only run north from the maypole and
 * along the two long edges: anything strung south of the player hangs between
 * them and the camera, right across the middle of the screen.
 */
export const NORTH_POLES: [number, number, number][] = [[-60, 5.6, -18.7], [-47, 5.6, -18.7], [-34, 5.6, -18.7]];
export const SOUTH_POLES: [number, number, number][] = [[-60, 5.6, 18.7], [-47, 5.6, 18.7], [-34, 5.6, 18.7]];

function stage(low: B, tall: B, signs: SignBatch) {
  const s = boxOf("stage"), front = s.x + s.hx;
  low.box(s.hx * 2, s.height - 0.02, s.hz * 2, s.x, 0, s.z, "#b4743f");
  for (let i = 0; i < 12; i++) low.box(s.hx * 2, 0.02, 0.96, s.x, s.height - 0.02, s.z - s.hz + (i + 0.5), ["#c58a50", "#bb7d45", "#cf9558"][i % 3]);
  low.box(0.08, 0.5, s.hz * 2, front + 0.03, 0.04, s.z, PALETTE.teal);
  low.box(0.1, 0.07, s.hz * 2 + 0.06, front + 0.04, 0.52, s.z, PALETTE.gold);
  for (let i = 0; i < 13; i++) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([0, 0.5, 0.4, 0, 0.5, -0.4, 0, 0.1, 0], 3));
    low.add(g, i % 2 ? PALETTE.gold : PALETTE.red, [front + 0.09, 0, -5.54 + i * 0.92]);
  }
  // Exterior faces of the union of the three 0.6m treads. Their original
  // 0.05m overlap must not leave coplanar side faces of different colours.
  for (let i = 0; i < 3; i++) {
    const east = front + 1.8 - i * 0.55, west = i === 2 ? east - 0.6 : east - 0.55;
    const height = 0.2 * (i + 1), previous = 0.2 * i, positions: number[] = [];
    const quad = (a: number[], b: number[], c: number[], d: number[]) => positions.push(...a, ...b, ...d, ...b, ...c, ...d);
    quad([west, height, -1.7], [west, height, 1.7], [east, height, 1.7], [east, height, -1.7]);
    quad([west, 0, -1.7], [west, height, -1.7], [east, height, -1.7], [east, 0, -1.7]);
    quad([east, 0, 1.7], [east, height, 1.7], [west, height, 1.7], [west, 0, 1.7]);
    quad([east, previous, -1.7], [east, height, -1.7], [east, height, 1.7], [east, previous, 1.7]);
    if (i === 2) quad([west, 0, 1.7], [west, height, 1.7], [west, height, -1.7], [west, 0, -1.7]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    low.add(geometry, i % 2 ? "#cf9558" : "#bb7d45", [0, 0, 0]);
  }
  // Back wall with a golden sun, gathered curtains and a proscenium.
  tall.box(0.35, 5.4, s.hz * 2 + 0.6, s.x - s.hx, 0, s.z, "#b84a52");
  tall.cylAt(2, 0.1, [s.x - s.hx + 0.22, 3.1, 0], [0, 0, Math.PI / 2], PALETTE.gold, 18);
  tall.cylAt(1.5, 0.11, [s.x - s.hx + 0.23, 3.1, 0], [0, 0, Math.PI / 2], "#ffdf80", 18);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    tall.boxAt(0.08, 0.34, 0.2, [s.x - s.hx + 0.25, 3.1 + Math.sin(a) * 2.28, Math.cos(a) * 2.28], [a + Math.PI / 2, 0, 0], PALETTE.gold);
  }
  for (const z of [-4.3, 4.3]) for (let i = 0; i < 5; i++) {
    tall.cyl(0.27, 0.34, 4.4, s.x - s.hx + 0.42, 0.6, z - 1 + i * 0.5, i % 2 ? "#a83d48" : "#d05a60", 7);
  }
  for (const z of [-5.2, 5.2]) {
    tall.cyl(0.24, 0.3, 5.1, s.x + 1.5, 0, z, PALETTE.wood, 8);
    tall.cyl(0.2, 0.26, 5.1, s.x - 2.4, 0, z, PALETTE.wood, 8);
    tall.box(0.7, 0.14, 0.7, s.x + 1.5, 0.55, z, PALETTE.gold);
  }
  // Roof: a gold-and-red striped canopy with a scalloped front.
  for (let i = 0; i < 8; i++) {
    const z = -5.95 + (i + 0.5) * 1.49;
    tall.boxAt(5.8, 0.14, 1.5, [s.x - 0.25, 5.42, z], [0, 0, 0.1], i % 2 ? PALETTE.gold : "#e8604c");
    tall.add(new THREE.CylinderGeometry(0.74, 0.74, 0.05, 8, 1, false, Math.PI, Math.PI), i % 2 ? PALETTE.gold : "#e8604c", [s.x + 2.62, 5.14, z], [0, 0, Math.PI / 2], [1, 1, 1], { wind: 0.1 });
  }
  // The header board, facing the field.
  const width = SignBatch.width("stage", 0.86);
  tall.box(0.1, 1.04, width + 0.3, s.x + 2.72, 4.1, 0, PALETTE.darkWood);
  signs.add("stage", s.x + 2.79, 4.62, 0, 0.86, Math.PI / 2);
  // Taiko drums.
  for (const z of [-3.4, 3.4]) {
    low.box(0.9, 0.36, 0.9, s.x - 1, s.height, z, PALETTE.darkWood);
    low.cylAt(0.5, 0.74, [s.x - 1, s.height + 0.74, z], [0, 0, Math.PI / 2], "#a8543c", 12);
    low.cylAt(0.44, 0.76, [s.x - 1, s.height + 0.74, z], [0, 0, Math.PI / 2], "#fff4d4", 12);
  }
  // Planters flank the steps.
  const rand = seeded(29);
  for (const id of ["stage-planter-north", "stage-planter-south"]) {
    const p = solid(id);
    low.cyl(0.7, 0.54, 0.6, p.x, 0, p.z, "#d98a64", 9);
    low.cyl(0.74, 0.74, 0.1, p.x, 0.6, p.z, "#e7a27d", 9);
    low.cyl(0.6, 0.6, 0.02, p.x, 0.7, p.z, PALETTE.soil, 9);
    addShrub(tall, p.x, p.z, 0.8, rand, 0.68);
    addFlowers(tall, p.x, p.z, 0.72, 9, 0.56, rand);
  }
}

function prizeTent(low: B, tall: B, signs: SignBatch) {
  const s = boxOf("prize-tent"), { x, z, hx, hz } = s;
  const colors = ["#e8604c", "#4f9ad6", "#ffcc4d", "#6fb35c", "#c77bd9"];
  low.box(hx * 2, 0.86, 0.5, x, 0, z + hz - 0.25, "#fff4d4");
  for (let i = 0; i < 14; i++) low.box(hx * 2 / 14 - 0.03, 0.8, 0.03, x - hx + (i + 0.5) * hx * 2 / 14, 0.04, z + hz + 0.01, i % 2 ? "#ffcc4d" : "#fff4d4");
  low.box(hx * 2 + 0.12, 0.1, 0.62, x, 0.86, z + hz - 0.25, PALETTE.wood);
  tall.box(hx * 2, 2.65, 0.1, x, 0, z - hz + 0.05, "#fff4d4");
  for (const dx of [-hx, hx]) tall.box(0.1, 2.65, hz * 2, x + dx, 0, z, "#ffe6a8");
  // Prize shelves behind the counter: wrapped boxes and a golden cup.
  for (let row = 0; row < 3; row++) {
    tall.box(hx * 2 - 0.3, 0.07, 0.56, x, 0.95 + row * 0.56, z - hz + 0.4, PALETTE.wood);
    for (let i = 0; i < 7; i++) {
      const px = x - hx + 0.62 + i * 0.92, size = 0.36 + ((i + row) % 3) * 0.05;
      tall.box(size, size, size, px, 1.02 + row * 0.56, z - hz + 0.4, colors[(i + row * 2) % colors.length]);
      tall.box(size + 0.02, 0.05, size + 0.02, px, 1.02 + row * 0.56 + size * 0.5, z - hz + 0.4, "#fff4d4");
    }
  }
  tall.cyl(0.05, 0.09, 0.2, x, 0.96, z + hz - 0.26, PALETTE.gold, 6);
  tall.add(new THREE.CylinderGeometry(0.2, 0.08, 0.3, 8), PALETTE.gold, [x, 1.3, z + hz - 0.26]);
  for (const dx of [-hx + 0.08, hx - 0.08]) for (const dz of [-hz + 0.08, hz - 0.08]) tall.cyl(0.07, 0.07, 2.75, x + dx, 0, z + dz, PALETTE.darkWood, 6);
  stripedTop(tall, x, 2.75, z, hx + 0.7, hz + 0.7, 2.5, 10, "#ffcc4d", "#fff4d4");
  tall.cyl(0.04, 0.04, 1, x, 5.2, z, PALETTE.darkWood, 5);
  tall.add(new THREE.ConeGeometry(0.28, 0.76, 3), "#e8604c", [x + 0.38, 5.98, z], [0, 0, -Math.PI / 2], [1, 1, 0.08], { wind: 1 });
  const width = SignBatch.width("prizes", 0.78);
  // Counter-front board stays below the scalloped hem, including in perspective.
  low.box(width + 0.2, 0.92, 0.08, x, 0.98, z + hz + 0.08, PALETTE.darkWood);
  for (const dx of [-width / 2 + 0.08, width / 2 - 0.08]) low.box(0.08, 0.98, 0.08, x + dx, 0, z + hz + 0.08, PALETTE.darkWood);
  signs.add("prizes", x, 1.44, z + hz + 0.126, 0.78);
}

function drawingBooth(low: B, tall: B, signs: SignBatch) {
  const s = boxOf("drawing-booth"), { x, z, hx, hz } = s, rand = seeded(44);
  // Table with paper, stools in front stay within the collider.
  low.box(hx * 2, 0.7, hz * 1.2, x, 0, z + 0.3, "#d9a36a");
  low.box(hx * 2 + 0.1, 0.12, hz * 1.2 + 0.1, x, 0.7, z + 0.3, "#fff4d4");
  for (let i = 0; i < 5; i++) {
    const px = x - 2.2 + i * 1.1;
    low.boxAt(0.62, 0.012, 0.44, [px, 0.83, z + 0.56], [0, (rand() - 0.5) * 0.4, 0], "#ffffff");
    low.box(0.3, 0.006, 0.05, px - 0.05, 0.834, z + 0.5, ["#e8604c", "#4f9ad6", "#6fb35c"][i % 3]);
    low.cyl(0.11, 0.09, 0.22, px + 0.42, 0.82, z + 0.05, ["#4f9ad6", "#e8604c", "#ffcc4d"][i % 3], 7);
    for (let k = 0; k < 3; k++) low.beam([px + 0.42 + (k - 1) * 0.04, 0.9, z + 0.05], [px + 0.42 + (k - 1) * 0.08, 1.22, z + 0.05 + (k - 1) * 0.03], 0.024, PENNANTS[(i + k) % PENNANTS.length]);
  }
  // Board of the children's pictures.
  for (const dx of [-hx + 0.1, hx - 0.1]) tall.box(0.13, 3.05, 0.13, x + dx, 0, z - hz + 0.1, PALETTE.wood);
  tall.box(hx * 2 - 0.1, 2.2, 0.08, x, 0.8, z - hz + 0.1, "#d7ab6e");
  for (let row = 0; row < 2; row++) for (let i = 0; i < 6; i++) {
    const px = x - 2.35 + i * 0.94, py = 1.14 + row * 1;
    tall.box(0.76, 0.8, 0.03, px, py, z - hz + 0.16, "#fffaf0");
    if ((i + row) % 3 === 0) tall.cylAt(0.2, 0.02, [px, py + 0.42, z - hz + 0.18], [Math.PI / 2, 0, 0], "#ffcc4d", 10);
    else if ((i + row) % 3 === 1) { tall.box(0.46, 0.2, 0.02, px, py + 0.14, z - hz + 0.18, "#6fb35c"); tall.box(0.3, 0.3, 0.02, px, py + 0.34, z - hz + 0.18, "#e8604c"); }
    else for (let k = 0; k < 3; k++) tall.box(0.6, 0.1, 0.02, px, py + 0.2 + k * 0.14, z - hz + 0.18, PENNANTS[k]);
  }
  addAwning(tall, x, hx + 0.2, z - hz - 0.2, 3.1, z + 0.4, 3.5, "#4f9ad6", "#ffe680", 9);
  const width = SignBatch.width("draw", 0.78);
  tall.box(width + 0.2, 0.9, 0.08, x, 3.5, z + 0.42, PALETTE.darkWood);
  signs.add("draw", x, 3.95, z + 0.47, 0.78);
}

function picnic(low: B, tall: B, id: string, parasol: boolean) {
  const s = boxOf(id), { x, z, hx, hz } = s;
  low.box(hx * 2 - 0.2, 0.06, 1.1, x, 0.72, z, "#c58a50");
  for (const dx of [-hx + 0.3, hx - 0.3]) low.box(0.12, 0.72, 0.9, x + dx, 0, z, PALETTE.darkWood);
  // Checked cloth down the middle, set for lunch.
  for (let i = 0; i < 10; i++) for (let k = 0; k < 2; k++) low.box((hx * 2 - 0.3) / 10, 0.01, 0.34, x - hx + 0.24 + (i + 0.5) * (hx * 2 - 0.3) / 10, 0.78, z - 0.17 + k * 0.34, (i + k) % 2 ? "#e8604c" : "#fff4d4");
  for (const dz of [-hz + 0.2, hz - 0.2]) {
    low.box(hx * 2 - 0.3, 0.06, 0.32, x, 0.4, z + dz, "#c58a50");
    for (const dx of [-hx + 0.4, hx - 0.4]) low.box(0.1, 0.4, 0.26, x + dx, 0, z + dz, PALETTE.darkWood);
  }
  for (const dx of [-1.2, 0, 1.2]) for (const dz of [-0.28, 0.28]) {
    low.cyl(0.16, 0.14, 0.03, x + dx, 0.79, z + dz, "#fffaf0", 8);
    low.sphere(0.08, x + dx, 0.85, z + dz, ["#ff9d3c", "#e8483f", "#a6cf52"][Math.abs(Math.round(dx))], [1, 0.85, 1], 6);
  }
  if (parasol) {
    tall.cyl(0.04, 0.05, 2.3, x, 0.78, z, PALETTE.cream, 5);
    stripedTop(tall, x, 3, z, 1.9, 1.9, 0.72, 8, "#4f9ad6", "#fffaf0");
  }
}

function festival(low: B, tall: B, signs: SignBatch) {
  const rand = seeded(23);
  stage(low, tall, signs);
  prizeTent(low, tall, signs);
  drawingBooth(low, tall, signs);
  picnic(low, tall, "picnic-west", false);
  picnic(low, tall, "picnic-east", true);
  // Festival stalls, using the same frame as the market.
  const a = stall(low, tall, signs, "festival-stall-north", "snacks", "#2c9f96", "#fff4d4", "#e8b07a", "#a86b3c");
  for (let i = 0; i < 6; i++) {
    low.cyl(0.26, 0.22, 0.14, a.x - 2.3 + i * 0.92, a.top, a.z + 0.5, "#fffaf0", 8);
    for (let k = 0; k < 5; k++) low.sphere(0.08, a.x - 2.3 + i * 0.92 + (k % 3 - 1) * 0.1, a.top + 0.17, a.z + 0.5 + (k % 2 ? 0.08 : -0.08), "#d9863f", [1, 0.9, 1], 5);
    low.cyl(0.13, 0.1, 0.34, a.x - 2.3 + i * 0.92, a.top, a.z - 0.5, PENNANTS[i], 7);
  }
  const b = stall(low, tall, signs, "festival-stall-south", "games", "#e8604c", "#fff4d4", "#e8b07a", "#a86b3c");
  // Ring toss: pegs in a board with coloured hoops, prizes along the back.
  low.box(4.6, 0.06, 1.5, b.x, b.top, b.z, "#7fc161");
  for (let i = 0; i < 9; i++) {
    const px = b.x - 1.6 + (i % 3) * 1.6, pz = b.z - 0.45 + Math.floor(i / 3) * 0.45;
    low.cyl(0.035, 0.05, 0.36, px, b.top + 0.05, pz, PALETTE.gold, 5);
    if (i % 2) low.torus(0.16, 0.035, [px, b.top + 0.1, pz], [Math.PI / 2, 0, 0], PENNANTS[i % PENNANTS.length]);
  }
  // Goods: the crate and basket are hidden-item supports, flat on top at their declared height.
  const c = boxOf("grounds-crate");
  crate(low, c.x, 0, c.z, c.hx * 2);
  const d = boxOf("grounds-basket");
  low.box(d.hx * 2, d.height - 0.02, d.hz * 2, d.x, 0, d.z, "#c58a50");
  for (let k = 0; k < 4; k++) low.box(d.hx * 2 + 0.05, 0.05, d.hz * 2 + 0.05, d.x, k * 0.12 + 0.03, d.z, "#a56c3c");
  low.box(d.hx * 2 - 0.1, 0.02, d.hz * 2 - 0.1, d.x, d.height - 0.02, d.z, "#d5b987");
  // The maypole marks the middle of the gathering circle.
  const pole = solid("festival-maypole");
  low.cyl(0.42, 0.56, 0.2, pole.x, 0, pole.z, PALETTE.darkStone, 8);
  tall.cyl(0.11, 0.17, 6.9, pole.x, 0.1, pole.z, "#fff4d4", 8);
  for (let y = 0.6; y < 6.8; y += 0.56) tall.cyl(0.175, 0.175, 0.14, pole.x, y, pole.z, PENNANTS[Math.round(y * 2) % PENNANTS.length], 8);
  tall.sphere(0.28, pole.x, 7.1, pole.z, PALETTE.gold, [1, 1, 1], 8);
  tall.torus(0.62, 0.05, [pole.x, 6.5, pole.z], [Math.PI / 2, 0, 0], PALETTE.gold);
  for (let i = 0; i < 8; i++) {
    const r = i / 8 * Math.PI * 2;
    tall.beam([pole.x + Math.cos(r) * 0.6, 6.5, pole.z + Math.sin(r) * 0.6], [pole.x + Math.cos(r) * 1.25, 2.5, pole.z + Math.sin(r) * 1.25], 0.09, PENNANTS[i % PENNANTS.length], { wind: 0.3 });
  }
  // Poles and pennant lines over the field, all ending outside the walkable lawn.
  for (const p of [...NORTH_POLES, ...SOUTH_POLES]) {
    tall.cyl(0.08, 0.13, p[1] + 0.06, p[0], GRASS_Y, p[2], PALETTE.wood, 6);
    tall.sphere(0.13, p[0], p[1] + 0.06, p[2], PALETTE.gold, [1, 1, 1], 6);
  }
  for (const p of NORTH_POLES) pennantLine(tall, MAYPOLE_TOP, p, 0.75, 9);
  pennantLine(tall, SOUTH_POLES[0], SOUTH_POLES[1], 0.8, 8);
  pennantLine(tall, SOUTH_POLES[1], SOUTH_POLES[2], 0.8, 8);
  // Tall banners along the back of the grounds.
  for (const [x, z, color] of [[-66.6, -9, "#e8604c"], [-66.6, 9, "#4f9ad6"], [-52.5, -18.7, "#ffcc4d"], [-41, -18.7, "#c77bd9"], [-29.5, -18.7, "#6fb35c"]] as const) {
    tall.cyl(0.05, 0.08, 5, x, GRASS_Y, z, PALETTE.darkWood, 5);
    tall.sphere(0.09, x, 5, z, PALETTE.gold, [1, 1, 1], 5);
    for (let i = 0; i < 3; i++) tall.add(new THREE.BoxGeometry(0.72, 0.84, 0.03), i % 2 ? "#fff4d4" : color, [x + 0.42, 4.5 - i * 0.82, z], [0, 0, 0], [1, 1, 1], { wind: 0.18 + i * 0.12, hang: true });
  }
  signpost(tall, signs, "festival", -26.4, -5.3, 0.86, 3.5);
  // Flower borders keep the lawn soft along its edges and the arch path.
  hedge(tall, -66.4, -17.6, -66.4, 17.6, rand);
  hedge(tall, -65, -19.4, -33, -19.4, rand);
  hedge(tall, -65, 18.8, -30, 18.8, rand);
  for (let x = -36.5; x < -29; x += 1.4) for (const z of [-2.75, 2.75]) addFlowers(tall, x, z, 0, 4, 0.26, rand, FLOWERS, 0.16);
}

/* -------------------------------------------------------------------- all */

export function districtParts(id: DistrictId): DistrictParts {
  const low = new PartBuilder(0.5), tall = new PartBuilder(0.5, true), signs = new SignBatch();
  const rand = seeded(id.length * 53 + 1);
  ({ square, market, school, harbor, festival })[id](low, tall, signs);
  for (const t of TREES[id]) addTree(tall, t);
  for (const p of LAMP_POSITIONS[id]) addLamp(tall, p.x, p.z);
  for (const h of HOUSES) if (h.district === id) addCottage(tall, h, rand);
  scatter(tall, id);
  return { low: low.buildChunks(44), tall: tall.buildChunks(34), signs: signs.build() };
}

/** The forest around the valley: one low-detail mesh past the fog line. */
export function forestGeometry(): THREE.BufferGeometry[] {
  const b = new PartBuilder(0), rand = seeded(77);
  const place = (x0: number, x1: number, z0: number, z1: number, count: number) => {
    for (let i = 0; i < count; i++) addFarTree(b, x0 + rand() * (x1 - x0), z0 + rand() * (z1 - z0), 1 + rand() * 1.1, rand() > 0.55);
  };
  place(-100, 100, -88, -62, 58);
  place(-100, -78, -62, 16, 18);
  place(70, 100, -62, 16, 18);
  place(-80, -44, -44, -31, 10);
  place(36, 68, -44, -31, 10);
  return b.buildChunks(60);
}
