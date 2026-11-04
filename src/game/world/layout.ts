import type { ChapterId, DistrictId, NpcId } from "../content/ids";
import { NPC_IDS } from "../content/ids";
import type { Placement } from "../logic/objectives";
import type { GateId, NpcPlacement, Point, Position } from "./types";
import { SQUARE_CAMERA } from "./followCamera";

export const GRANDMA_BENCH_YAW = Math.atan2(SQUARE_CAMERA.offset.x, SQUARE_CAMERA.offset.z);
const benchPoint = (x: number, z: number) => ({
  x: -10 + Math.cos(GRANDMA_BENCH_YAW) * x + Math.sin(GRANDMA_BENCH_YAW) * z,
  z: 4 - Math.sin(GRANDMA_BENCH_YAW) * x + Math.cos(GRANDMA_BENCH_YAW) * z
});
/** Seated hips in the bench frame; the interaction point is separately walkable. */
export const UME_SEAT = { ...benchPoint(0, 0.35), y: 0.42, yaw: GRANDMA_BENCH_YAW };

/** Metres; east is +x, north is -z. Shared by collision and visible scenery. */
export interface Area {
  id: string; district: DistrictId; x: number; z: number; hx: number; hz: number; y: number; gate?: GateId;
}
interface SolidBase { id: string; district: DistrictId; x: number; z: number; y: number; height: number }
export type Solid = (SolidBase & { kind: "box"; hx: number; hz: number; yaw: number }) | (SolidBase & { kind: "circle"; r: number });
/** Visual platform dimensions; only its edges obstruct walking. */
export const STAGE = { id: "stage", district: "festival", kind: "box", x: -62, z: 0, hx: 3, hz: 6, height: 0.6, y: 0, yaw: 0 } as const;
/** The chest stands in the square, then on the festival stage for Chapter 5 (SPEC §6.5). */
export const CHEST_SCALE = 1.5;
export const chestPose = (chapter: ChapterId) => chapter === 5
  ? { x: -60.7, y: 0.6, z: 0, yaw: Math.PI * 0.3 }
  : { x: 0, y: 0.15, z: -8, yaw: 0 };
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
  { id: "festival", district: "festival", x: -47, z: 0, hx: 19, hz: 18, y: 0, gate: "arch" },
  // The top landing includes the 0.1m join between the last tread and platform.
  { id: "stage-top", district: "festival", x: -61.95, z: 0, hx: 3.05, hz: 6, y: 0.6, gate: "arch" },
  ...[0, 1, 2].map((i): Area => ({ id: `stage-step-${i + 1}`, district: "festival", x: STAGE.x + STAGE.hx + 1.5 - i * 0.55, z: 0, hx: 0.3, hz: 1.7, y: 0.2 * (i + 1), gate: "arch" }))
];

const box = (id: string, district: DistrictId, x: number, z: number, hx: number, hz: number, height: number, y = 0): Extract<Solid, { kind: "box" }> =>
  ({ id, district, kind: "box", x, z, hx, hz, y, height, yaw: 0 });
/** Render these footprints directly; decorative roofs/awnings may overhang them. */
export const SOLIDS: readonly Solid[] = [
  { id: "fountain", district: "square", kind: "circle", x: 0, z: 0, r: 2.5, y: 0, height: 0.7 },
  { ...box("grandma-bench", "square", -10, 4, 1.8, 0.55, 0.6), yaw: GRANDMA_BENCH_YAW },
  box("notice-board", "square", 11.5, 6, 0.35, 1.5, 2.1),
  box("flower-bed", "square", -8, -5, 1.6, 1.2, 0.4),
  box("festival-chest-base", "square", 0, -8, 1.5, 0.7, 0.15),
  // Corner planters keep the middle of the square open for walking and tapping.
  ...([[-15.5, -15.5], [15.5, -15.5], [-15.5, 15.5], [15.5, 15.5]] as const).map(([x, z], i): Solid => ({ id: `square-planter-${i}`, district: "square", kind: "circle", x, z, r: 1.15, y: 0, height: 0.75 })),
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
  // A single 1.8m-wide entrance centered at z=-42, with masonry to each jamb.
  box("library-east-north", "school", -12, -44.95, 0.2, 2.05, 3.5, 0.12),
  box("library-east-south", "school", -12, -39.05, 0.2, 2.05, 3.5, 0.12),
  box("library-shelf-nw", "school", -23.5, -45.7, 1.7, 0.55, 1.4, 0.12),
  box("library-shelf-ne", "school", -17, -45.7, 1.7, 0.55, 1.4, 0.12),
  box("library-table", "school", -20, -42, 1.4, 0.7, 0.9, 0.12),
  box("library-cart", "school", -24, -40, 0.7, 0.5, 0.8, 0.12),
  box("library-sill", "school", -22.5, -38, 1.3, 0.4, 1.05, 0.12),
  box("library-globe", "school", -16.2, -38.2, 0.6, 0.6, 0.95, 0.12),
  box("library-basket", "school", -14, -44.7, 0.55, 0.55, 0.4, 0.12),
  box("harbor-easel", "harbor", -10, 32, 0.65, 0.5, 1.7),
  // SeaChest body, lid trim, handles and locks at scale 1.3. Static through opening.
  box("sea-chest", "harbor", 10, 36.02, 0.66, 0.43, 0.75, 0.12),
  // Bridge rope/post footprint: the player stays inside the visible 4.9m rails.
  box("bridge-rail-west", "harbor", -2.45, 24, 0.12, 6.8, 1.2, 0.12),
  box("bridge-rail-east", "harbor", 2.45, 24, 0.12, 6.8, 1.2, 0.12),
  box("stage-back-edge", "festival", -65, 0, 0.175, 6.3, 5.4),
  box("stage-north-edge", "festival", -62, -6, 3, 0.08, 0.6),
  box("stage-south-edge", "festival", -62, 6, 3, 0.08, 0.6),
  ...[-1, 1].flatMap((side) => [
    box(`stage-front-${side}`, "festival", -59, side * 3.85, 0.08, 2.15, 0.6),
    box(`stage-step-side-${side}`, "festival", -58.05, side * 1.74, 0.95, 0.04, 0.6),
    box(`stage-curtain-${side}`, "festival", -64.58, side * 4.3, 0.34, 1.34, 4.4, 0.6),
    box(`stage-drum-${side}`, "festival", -63, side * 3.4, 0.45, 0.5, 1.24, 0.6),
    ...[-60.5, -64.4].map((x) => box(`stage-post-${side}-${x}`, "festival", x, side * 5.2, 0.35, 0.35, 5.1))
  ]),
  { ...box("stage-chest", "festival", chestPose(5).x, chestPose(5).z, 0.84 * CHEST_SCALE, 0.5 * CHEST_SCALE, 1.2 * CHEST_SCALE, 0.6), yaw: chestPose(5).yaw },
  box("festival-stall-north", "festival", -43, -12, 3, 1.5, 1.1),
  box("festival-stall-south", "festival", -43, 12, 3, 1.5, 1.1),
  box("grounds-crate", "festival", -54, -10, 0.8, 0.8, 0.7),
  box("grounds-basket", "festival", -33, 10, 0.7, 0.7, 0.5),
  // Festival Grounds furniture keeps to the edges so the field stays a gathering space.
  box("prize-tent", "festival", -57, -15, 3.4, 2.4, 2.6),
  box("drawing-booth", "festival", -35.5, -15, 3, 2, 1.1),
  box("picnic-west", "festival", -52, 14.5, 2.2, 1.25, 0.8),
  box("picnic-east", "festival", -34, 15, 2.2, 1.25, 0.8),
  { id: "festival-maypole", district: "festival", kind: "circle", x: -47, z: 0, r: 0.4, y: 0, height: 7 },
  { id: "stage-planter-north", district: "festival", kind: "circle", x: -58.2, z: -5, r: 0.7, y: 0, height: 0.7 },
  { id: "stage-planter-south", district: "festival", kind: "circle", x: -58.2, z: 5, r: 0.7, y: 0, height: 0.7 },
  { id: "harbor-barrel", district: "harbor", kind: "circle", x: 20, z: 33, r: 1, y: 0, height: 0.75 },
  ...Object.entries(LAMP_POSITIONS).flatMap(([district, points]) => points.map((p, i): Solid => ({
    id: `lamp-${district}-${i}`, district: district as DistrictId, kind: "circle", ...p, r: 0.21, y: 0, height: 3.8
  })))
];

/** Closed barriers match the visuals; the bridge blocks its hinge and removes its deck. */
export const GATE_SOLIDS: Record<GateId, Solid> = {
  cart: box("gate-cart", "market", 18, 0, 0.45, 4.2, 1.5),
  school: box("gate-school", "school", 0, -22, 4.2, 0.35, 2.2),
  bridge: box("gate-bridge", "harbor", 0, 18.6, 2.6, 1.4, 2.8),
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

// +z faces the follow camera, which always looks north; faces read from a distance.
const home = (district: DistrictId, x: number, z: number, y = 0, yaw = 0): NpcPlacement => ({ district, x, y, z, yaw });
export const NPC_HOMES: Record<NpcId, NpcPlacement> = {
  pom: home("square", 2.6, -8), ume: home("square", benchPoint(0, 1.15).x, benchPoint(0, 1.15).z, 0, GRANDMA_BENCH_YAW), ken: home("square", 9, 6, 0, Math.PI / 2),
  bruno: home("market", 30, -4), lily: home("market", 30, 4), max: home("market", 45, -4), sara: home("market", 45, 4),
  green: home("school", 5, -36), page: home("school", -14.4, -40.5, 0.12), yuki: home("school", -4, -35),
  tom: home("school", 9, -30), emma: home("school", 9, -44), bo: home("harbor", 5, 33, 0.12), finn: home("harbor", 8, 47, 0.12, -Math.PI / 2),
  mia: home("harbor", 19, 34), leo: home("harbor", -8, 32, 0, -Math.PI / 2), dan: home("festival", -52, -4, 0, 0.6), aya: home("festival", -44, 8)
};

/** The ending's framing: from the open east of the field, with the sky over the stage. */
export const FINALE_VIEW = { position: { x: -33.5, y: 3.3, z: 3.8 }, target: { x: -56, y: 7, z: -0.8 } };
/** The cast in a crescent before the stage, facing it and the view; clear of the maypole and the lens. */
export const FINALE_CREW: Partial<Record<NpcId, { x: number; z: number; yaw: number }>> = {
  pom: { x: -56.4, z: -1.9, yaw: 1.2 },
  ...Object.fromEntries(NPC_IDS.filter(id => id !== "pom").map((id, index, all) => {
    const a = -0.98 + index / (all.length - 1) * 1.96, r = index % 2 ? 10.2 : 7.6;
    return [id, { x: -59 + Math.cos(a) * r, z: 0.4 + Math.sin(a) * r, yaw: a * 0.35 + (index % 2 ? 1.1 : 1.5) }];
  }))
};

export type TreeKind = "round" | "pine" | "blossom";
export interface Tree { x: number; z: number; s: number; kind: TreeKind }
const tree = (x: number, z: number, s = 1, kind: TreeKind = "round"): Tree => ({ x, z, s, kind });
/** Decorative: none has a collider, so all stand outside WALK_AREAS. South of a play area stays low. */
export const TREES: Record<DistrictId, readonly Tree[]> = {
  square: [tree(-20, -13.5), tree(-20.2, 11, 1.05, "blossom"), tree(20, -14.5, 1.05), tree(20.4, 12.5, 0.95, "blossom"), tree(-12, -20.2, 0.95), tree(12, -20.2)],
  market: [tree(25, -15.5), tree(33.5, -16.5, 1.1, "pine"), tree(40.5, -15.5, 1.05), tree(50, -16.5, 1.15, "pine"), tree(58.5, -14.5), tree(60.5, -4, 1.2, "pine"), tree(60, 7, 0.95)],
  school: [tree(-15.8, -29.5, 0.9), tree(-29, -33, 1.05), tree(-30, -46), tree(-15, -58, 1.1, "pine"), tree(5, -60.5, 1.2, "pine"), tree(19, -57), tree(27, -45, 1.05), tree(28, -33, 1.1, "blossom")],
  harbor: [tree(-21, 31, 1, "pine"), tree(-20, 36.5, 0.85), tree(28.5, 36.5, 0.9, "pine")],
  festival: [tree(-69, -14), tree(-70, 11, 1.05), tree(-71.5, -1, 1.2, "pine"), tree(-65, -20.5, 1.05, "blossom"), tree(-46, -20.6, 0.95), tree(-30, -20, 1.05, "blossom"), tree(-26, -9.5, 0.85), tree(-26, 13, 0.8)]
};

export interface House { x: number; z: number; w: number; d: number; h: number; style: number; ridgeAlongX: boolean; district: DistrictId }
const house = (x: number, z: number, w: number, d: number, h: number, style: number, ridgeAlongX: boolean, district: DistrictId): House => ({ x, z, w, d, h, style, ridgeAlongX, district });
/** Backdrop cottages north of the play areas: the camera looks at them, never through them. */
export const HOUSES: readonly House[] = [
  house(-21, -25.4, 7, 5, 3.2, 0, true, "square"), house(-31, -24.6, 6.4, 5.2, 3.5, 1, false, "square"),
  house(-41, -25.2, 7, 5, 3.2, 2, true, "festival"), house(-50.5, -24.6, 6.2, 5.4, 3.6, 3, false, "festival"),
  house(-60, -25.4, 7, 5, 3.2, 1, true, "festival"), house(-70, -24.5, 6.2, 5.2, 3.4, 0, false, "festival"),
  house(20.5, -24.8, 6.4, 5, 3.3, 2, false, "market"), house(29.5, -23.6, 7, 5, 3.2, 3, true, "market"),
  house(38.5, -24.2, 6.2, 5.2, 3.6, 0, false, "market"), house(47.5, -23.4, 7, 5, 3.2, 1, true, "market"),
  house(56.5, -24.2, 6.4, 5.2, 3.4, 2, false, "market"),
  house(27.8, 32.4, 5.2, 4.6, 2.8, 1, true, "harbor")
];

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
