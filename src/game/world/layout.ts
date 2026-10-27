import type { ChapterId, DistrictId, NpcId } from "../content/ids";
import { NPC_IDS } from "../content/ids";
import type { Placement } from "../logic/objectives";
import type { GateId, NpcPlacement, Point, Position } from "./types";

/** Metres; east is +x, north is -z. Shared by collision and visible scenery. */
export interface Area {
  id: string; district: DistrictId; x: number; z: number; hx: number; hz: number; y: number; gate?: GateId;
}
interface SolidBase { id: string; district: DistrictId; x: number; z: number; y: number; height: number }
export type Solid = (SolidBase & { kind: "box"; hx: number; hz: number; yaw: number }) | (SolidBase & { kind: "circle"; r: number });
export const DISTRICTS: Record<DistrictId, Point> = {
  square: { x: 0, z: 0 }, market: { x: 37, z: 0 }, school: { x: 0, z: -36 },
  harbor: { x: 8, z: 34 }, festival: { x: -48, z: 0 }
};
export const GATE_POSITIONS: Record<GateId, Position> = {
  cart: { x: 18, y: 0, z: 0 }, school: { x: 0, y: 0, z: -22 },
  bridge: { x: 0, y: 0.12, z: 24 }, arch: { x: -22, y: 0, z: 0 }
};

/** Lamp trunks sit on land and share their footprint with navigation. */
export const LAMP_POSITIONS: Record<DistrictId, readonly Point[]> = {
  square: [{ x: -12, z: 11 }, { x: 12, z: 11 }],
  market: [{ x: 25, z: 10 }, { x: 49, z: 10 }],
  school: [{ x: -10, z: -27 }, { x: 12, z: -45 }],
  harbor: [{ x: -13, z: 33 }, { x: 21, z: 35 }],
  festival: [{ x: -59, z: 11 }, { x: -36, z: 11 }]
};

export const WALK_AREAS: readonly Area[] = [
  { id: "square", district: "square", x: 0, z: 0, hx: 18, hz: 18, y: 0 },
  { id: "school-approach", district: "square", x: 0, z: -19.5, hx: 4, hz: 3.1, y: 0 },
  { id: "arch-approach", district: "square", x: -19.5, z: 0, hx: 3.1, hz: 4, y: 0 },
  { id: "bridge-approach", district: "square", x: 0, z: 18.5, hx: 2.6, hz: 1.5, y: 0 },
  { id: "market-neck", district: "market", x: 21, z: 0, hx: 5, hz: 4, y: 0, gate: "cart" },
  { id: "market", district: "market", x: 39, z: 0, hx: 17, hz: 12, y: 0, gate: "cart" },
  { id: "school-neck", district: "school", x: 0, z: -22, hx: 4, hz: 6, y: 0, gate: "school" },
  { id: "courtyard", district: "school", x: 0, z: -37, hx: 14, hz: 12, y: 0, gate: "school" },
  { id: "library", district: "school", x: -19, z: -42, hx: 7, hz: 5, y: 0.12, gate: "school" },
  { id: "bridge", district: "harbor", x: 0, z: 24, hx: 2.6, hz: 6.8, y: 0.12, gate: "bridge" },
  { id: "harbor-bank", district: "harbor", x: 3.5, z: 32.5, hx: 20.5, hz: 4.5, y: 0, gate: "bridge" },
  { id: "pier", district: "harbor", x: 8, z: 41, hx: 3, hz: 8, y: 0.12, gate: "bridge" },
  { id: "festival-neck", district: "festival", x: -24, z: 0, hx: 8, hz: 4, y: 0, gate: "arch" },
  { id: "festival", district: "festival", x: -47, z: 0, hx: 19, hz: 18, y: 0, gate: "arch" }
];

const box = (id: string, district: DistrictId, x: number, z: number, hx: number, hz: number, height: number, y = 0): Solid =>
  ({ id, district, kind: "box", x, z, hx, hz, y, height, yaw: 0 });
/** Render these footprints directly; decorative roofs/awnings may overhang them. */
export const SOLIDS: readonly Solid[] = [
  { id: "fountain", district: "square", kind: "circle", x: 0, z: 0, r: 2.5, y: 0, height: 0.7 },
  box("grandma-bench", "square", -10, 4, 1.8, 0.55, 0.6),
  box("notice-board", "square", 11.5, 6, 0.35, 1.5, 2.1),
  box("flower-bed", "square", -8, -5, 1.6, 1.2, 0.4),
  box("festival-chest-base", "square", 0, -8, 1.5, 0.7, 0.15),
  box("bakery-stall", "market", 30, -7, 3.3, 1.8, 1.1),
  box("flowers-stall", "market", 30, 7, 3.3, 1.8, 1.1),
  box("toys-stall", "market", 45, -7, 3.3, 1.8, 1.1),
  box("fruit-stall", "market", 45, 7, 3.3, 1.8, 1.1),
  box("school-building", "school", 2, -52, 12, 3, 5),
  box("lost-found", "school", 5, -39, 2, 1, 1),
  box("school-flowers-west", "school", -8, -29, 2.5, 0.65, 0.4),
  box("school-flowers-east", "school", 8, -29, 2.5, 0.65, 0.4),
  box("library-west-wall", "school", -26, -42, 0.2, 5.2, 3.5, 0.12),
  box("library-north-wall", "school", -19, -47, 7, 0.2, 3.5, 0.12),
  box("library-south-wall", "school", -19, -37, 7, 0.2, 3.5, 0.12),
  box("library-east-north", "school", -12, -45.3, 0.2, 1.7, 3.5, 0.12),
  box("library-east-south", "school", -12, -38.7, 0.2, 1.7, 3.5, 0.12),
  box("library-shelf-nw", "school", -23.5, -45.7, 1.7, 0.55, 1.4, 0.12),
  box("library-shelf-ne", "school", -17, -45.7, 1.7, 0.55, 1.4, 0.12),
  box("library-table", "school", -20, -42, 1.4, 0.7, 0.9, 0.12),
  box("library-cart", "school", -24, -40, 0.7, 0.5, 0.8, 0.12),
  box("library-sill", "school", -22.5, -38, 1.3, 0.4, 1.05, 0.12),
  box("library-globe", "school", -16.2, -38.2, 0.6, 0.6, 0.95, 0.12),
  box("library-basket", "school", -14, -44.7, 0.55, 0.55, 0.4, 0.12),
  box("harbor-easel", "harbor", -10, 32, 0.65, 0.5, 1.7),
  box("stage", "festival", -62, 0, 3, 6, 0.6),
  box("festival-stall-north", "festival", -43, -12, 3, 1.5, 1.1),
  box("festival-stall-south", "festival", -43, 12, 3, 1.5, 1.1),
  box("grounds-crate", "festival", -54, -10, 0.8, 0.8, 0.7),
  box("grounds-basket", "festival", -33, 10, 0.7, 0.7, 0.5),
  { id: "harbor-barrel", district: "harbor", kind: "circle", x: 20, z: 33, r: 1, y: 0, height: 0.75 },
  ...Object.entries(LAMP_POSITIONS).flatMap(([district, points]) => points.map((p, i): Solid => ({
    id: `lamp-${district}-${i}`, district: district as DistrictId, kind: "circle", ...p, r: 0.21, y: 0, height: 3.8
  })))
];

/** Closed barriers share the exact visual gate centres; the bridge also removes its deck. */
export const GATE_SOLIDS: Record<GateId, Solid> = {
  cart: box("gate-cart", "market", 18, 0, 0.45, 4.2, 1.5),
  school: box("gate-school", "school", 0, -22, 4.2, 0.35, 2.2),
  bridge: box("gate-bridge", "harbor", 0, 24, 2.6, 0.4, 2.8),
  arch: box("gate-arch", "festival", -22, 0, 0.3, 4.2, 1.4)
};

/** Horizontal surfaces for item placement; y is the top, not mesh centre. */
export const SURFACES: readonly Area[] = [
  { id: "fountain-rim", district: "square", x: 2.25, z: 0, hx: 0.3, hz: 0.5, y: 0.7 },
  ...SOLIDS.filter((s) => s.id === "flower-bed" || s.id.startsWith("library-") && !s.id.includes("wall") && !s.id.includes("east-") || s.id.startsWith("grounds-")).map((s) => ({
    id: s.id, district: s.district, x: s.x, z: s.z, hx: s.kind === "box" ? s.hx : s.r,
    hz: s.kind === "box" ? s.hz : s.r, y: s.y + s.height
  })),
  { id: "library-reading-mat", district: "school", x: -16, z: -42, hx: 0.7, hz: 0.7, y: 0.12 },
  { id: "grounds-grass-north", district: "festival", x: -33, z: -10, hx: 0.8, hz: 0.8, y: 0 },
  { id: "grounds-grass-west", district: "festival", x: -55, z: 10, hx: 0.8, hz: 0.8, y: 0 },
  { id: "grounds-grass-east", district: "festival", x: -35, z: 3, hx: 0.8, hz: 0.8, y: 0 },
  { id: "grounds-grass-center", district: "festival", x: -49, z: -3, hx: 0.8, hz: 0.8, y: 0 }
];
export const SPOTS: Record<string, Position> = {
  "square-pencil": { x: 2.25, y: 0.7, z: 0 }, "square-eraser": { x: -8, y: 0.4, z: -5 },
  "library-1": { x: -23.5, y: 1.52, z: -45.7 }, "library-2": { x: -17, y: 1.52, z: -45.7 },
  "library-3": { x: -20, y: 1.02, z: -42 }, "library-4": { x: -24, y: 0.92, z: -40 },
  "library-5": { x: -22.5, y: 1.17, z: -38 }, "library-6": { x: -16.2, y: 1.07, z: -38.2 },
  "library-7": { x: -14, y: 0.52, z: -44.7 }, "library-8": { x: -16, y: 0.12, z: -42 },
  "grounds-1": { x: -54, y: 0.7, z: -10 }, "grounds-2": { x: -33, y: 0.5, z: 10 },
  "grounds-3": { x: -33, y: 0, z: -10 }, "grounds-4": { x: -55, y: 0, z: 10 },
  "grounds-5": { x: -35, y: 0, z: 3 }, "grounds-6": { x: -49, y: 0, z: -3 }
};

const home = (district: DistrictId, x: number, z: number, y = 0, yaw = Math.PI): NpcPlacement => ({ district, x, y, z, yaw });
export const NPC_HOMES: Record<NpcId, NpcPlacement> = {
  pom: home("square", 2.6, -8), ume: home("square", -10, 5), ken: home("square", 9, 6),
  bruno: home("market", 30, -4), lily: home("market", 30, 4), max: home("market", 45, -4), sara: home("market", 45, 4),
  green: home("school", 5, -36), page: home("school", -14.4, -40.5, 0.12), yuki: home("school", -4, -35),
  tom: home("school", 9, -30), emma: home("school", 9, -44), bo: home("harbor", 5, 33, 0.12), finn: home("harbor", 8, 47, 0.12),
  mia: home("harbor", 19, 34), leo: home("harbor", -8, 32), dan: home("festival", -52, -4), aya: home("festival", -44, 8)
};

/** Maps the core's abstract placements without changing chapter behavior. */
export function npcPosition(chapter: ChapterId, npc: NpcId, placement: Placement): NpcPlacement {
  if (placement === "home") return { ...NPC_HOMES[npc] };
  if (placement === "festival") {
    const index = NPC_IDS.indexOf(npc);
    return home("festival", -56 + (index % 3) * 2.2, -7 + Math.floor(index / 3) * 2.5);
  }
  const side = placement === "asker1" ? -1 : 1;
  // Returning characters are easy to find in the square beside the active exit.
  if (chapter === 5) return home("festival", -35, side * 5);
  return home("square", side * 6, chapter === 3 ? -12 : chapter === 4 ? 12 : 8);
}
