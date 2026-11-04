import { HOUSES, LAMP_POSITIONS, SOLIDS, STALL_YAWS, stallPoint, TREES, WALK_AREAS, type Solid } from "../game/world/layout";
import { FOLLOW_CAMERA } from "../game/world/followCamera";
import { DISTRICT_IDS } from "../game/content/ids";
import type { Point, Position } from "../game/world/types";

const market = WALK_AREAS.find(a => a.id === "market")!;
const festival = WALK_AREAS.find(a => a.id === "festival")!;

function districtWeight(p: Point, minX: number, maxX: number, z: number, hz: number): number {
  const distance = Math.hypot(Math.max(minX - p.x, 0, p.x - maxX), Math.max(Math.abs(p.z - z) - hz, 0));
  const t = Math.min(1, distance / FOLLOW_CAMERA.blendDistance);
  return 1 - t * t * (3 - 2 * t);
}

/** Rectangular distance gives a stable turn through each neck, including its corners. */
export function followYaw(p: Point): number {
  return FOLLOW_CAMERA.yaw.default
    + districtWeight(p, 24, Infinity, market.z, market.hz) * FOLLOW_CAMERA.yaw.market
    + districtWeight(p, -Infinity, festival.x + festival.hx, festival.z, festival.hz) * FOLLOW_CAMERA.yaw.festival;
}

export function followOffset(p: Point): Position {
  const yaw = followYaw(p);
  return { x: Math.sin(yaw) * FOLLOW_CAMERA.radius, y: FOLLOW_CAMERA.height, z: Math.cos(yaw) * FOLLOW_CAMERA.radius };
}

/** An axis-aligned box the camera should not sit in or look through. */
export interface Blocker { x: number; z: number; hx: number; hz: number; y0: number; y1: number; id?: string }

const STALLS = [["bakery-stall", 30, -7], ["flowers-stall", 30, 7], ["toys-stall", 45, -7], ["fruit-stall", 45, 7]] as const;
const rotatedExtent = (hx: number, hz: number, yaw: number) => ({ hx: Math.abs(Math.cos(yaw)) * hx + Math.abs(Math.sin(yaw)) * hz, hz: Math.abs(Math.sin(yaw)) * hx + Math.abs(Math.cos(yaw)) * hz });

/** Scenery tall enough to hide a head: collision solids plus overhead and decorative parts. */
export const CAMERA_BLOCKERS: readonly Blocker[] = [
  ...SOLIDS.filter((s: Solid) => s.height >= 1.4).map((s): Blocker => s.kind === "box"
    ? { x: s.x, z: s.z, ...rotatedExtent(s.hx, s.hz, s.yaw), y0: s.y, y1: s.y + s.height, id: s.id }
    : { x: s.x, z: s.z, hx: s.r, hz: s.r, y0: s.y, y1: s.y + s.height, id: s.id }),
  ...DISTRICT_IDS.flatMap(id => TREES[id].flatMap((t): Blocker[] => [
    { x: t.x, z: t.z, hx: 0.3, hz: 0.3, y0: 0, y1: 2.2 * t.s },
    { x: t.x, z: t.z, hx: 1.7 * t.s, hz: 1.7 * t.s, y0: 1.9 * t.s, y1: 5 * t.s }
  ])),
  ...HOUSES.map((h): Blocker => ({ x: h.x, z: h.z, hx: h.w / 2 + 0.4, hz: h.d / 2 + 0.4, y0: 0, y1: h.h + 2.4 })),
  ...DISTRICT_IDS.flatMap(id => LAMP_POSITIONS[id].map((p): Blocker => ({ x: p.x, z: p.z, hx: 0.3, hz: 0.3, y0: 2.6, y1: 3.9 }))),
  ...STALLS.flatMap(([id, x, z]): Blocker[] => {
    const yaw = STALL_YAWS[id] ?? 0;
    return [
      { ...stallPoint(x, z, yaw, 0, z < 0 ? 0 : 1), ...rotatedExtent(3.1, z < 0 ? 2.3 : 1.4, yaw), y0: 2.8, y1: 4.7 },
      ...[-2.9, 2.9].flatMap(dx => [-1.7, 1.7].map((dz): Blocker => ({ ...stallPoint(x, z, yaw, dx, dz), ...rotatedExtent(0.12, 0.12, yaw), y0: 1, y1: 3.8 })))
    ];
  }),
  // The arch, school gate and festival stage have parts above their low colliders.
  ...[-4, 4].map((z): Blocker => ({ x: -22, z, hx: 0.5, hz: 0.5, y0: 0, y1: 6.4 })),
  { x: -22, z: 0, hx: 0.55, hz: 5.3, y0: 4.5, y1: 6.4 },
  ...[-4, 4].map((x): Blocker => ({ x, z: -22, hx: 0.5, hz: 0.5, y0: 0, y1: 4.6 })),
  { x: 0, z: -22, hx: 4.4, hz: 0.25, y0: 3.3, y1: 4.5 },
  { x: -62.5, z: 0, hx: 3, hz: 6, y0: 5, y1: 7.4 },
  { x: -65, z: 0, hx: 0.3, hz: 6, y0: 0, y1: 5.4 },
  ...[-5, 5].map((z): Blocker => ({ x: -60.5, z, hx: 0.35, hz: 0.35, y0: 0, y1: 5.2 }))
];

const CUTAWAY_WALLS = new Set(["library-south-wall", "library-east-north", "library-east-south"]);
const inLibrary = (p: { x: number; z: number }) => p.x > -26 && p.x < -12 && p.z > -47 && p.z < -37;

/** Slab test: does the segment from a to b pass through the box? */
export function segmentHits(a: Position, b: Position, box: Blocker): boolean {
  let t0 = 0, t1 = 1;
  for (const [origin, end, min, max] of [
    [a.x, b.x, box.x - box.hx, box.x + box.hx],
    [a.y, b.y, box.y0, box.y1],
    [a.z, b.z, box.z - box.hz, box.z + box.hz]
  ] as const) {
    const d = end - origin;
    if (Math.abs(d) < 1e-6) {
      if (origin < min || origin > max) return false;
      continue;
    }
    const near = Math.min((min - origin) / d, (max - origin) / d), far = Math.max((min - origin) / d, (max - origin) / d);
    t0 = Math.max(t0, near); t1 = Math.min(t1, far);
    if (t0 > t1) return false;
  }
  return true;
}

export interface Shot { position: Position; target: Position }

/** Eye points the shot has to keep in view. Targets are at feet level, like NPC placements. */
export const headOf = (p: Position, tall = 1.25): Position => ({ x: p.x, y: p.y + tall, z: p.z });

/** Would this camera see both heads? Counted, so a tie can fall to framing. */
export function blockedHeads(camera: Position, player: Position, target: Position, blockers: readonly Blocker[] = CAMERA_BLOCKERS): number {
  const open = inLibrary(player);
  const usable = blockers.filter(b => !(open && b.id && CUTAWAY_WALLS.has(b.id)));
  return [headOf(player), headOf(target)].filter(head => usable.some(b => segmentHits(camera, head, b))).length;
}

const SIDES = [1, -1];
const BACK = [2.6, 1.4, 3.6, 0.4];
const OUT = [4.8, 3.8];
const UP = [2.5, 3.4];

/**
 * A three-quarter shot of the player and their partner. Tries both sides at a
 * few distances and takes the first that sees both faces, preferring the south
 * side so the framing stays close to the follow view (SPEC §10). Pure, so the
 * choice can be unit tested against the same blocker list the renderer uses.
 */
export function conversationShot(player: Position, target: Position, others: readonly Position[] = [], blockers: readonly Blocker[] = CAMERA_BLOCKERS): Shot {
  const dx = target.x - player.x, dz = target.z - player.z;
  const distance = Math.max(0.01, Math.hypot(dx, dz));
  const ux = dx / distance, uz = dz / distance;
  const middle = { x: (player.x + target.x) / 2, y: Math.max(player.y, target.y) + 0.95, z: (player.z + target.z) / 2 };
  const stretch = Math.max(0, distance - 2.4) * 0.45;
  let best: Shot | null = null, bestScore = Infinity;
  for (const side of SIDES) for (const back of BACK) for (const out of OUT) for (const up of UP) {
    // Perpendicular offset picks the side; `back` slides toward the player's shoulder.
    const position = { x: middle.x - uz * side * (out + stretch) - ux * back, y: middle.y + up, z: middle.z + ux * side * (out + stretch) - uz * back };
    let score = blockedHeads(position, player, target, blockers) * 100;
    if (blockers.some(b => position.x > b.x - b.hx && position.x < b.x + b.hx && position.z > b.z - b.hz && position.z < b.z + b.hz && position.y > b.y0 && position.y < b.y1)) score += 300;
    for (const other of others) {
      const near = Math.hypot(other.x - position.x, other.z - position.z);
      if (near < 2.6) score += 60;
      if (segmentHits(position, headOf(player), { x: other.x, z: other.z, hx: 0.42, hz: 0.42, y0: other.y, y1: other.y + 2 })) score += 40;
      if (segmentHits(position, headOf(target), { x: other.x, z: other.z, hx: 0.42, hz: 0.42, y0: other.y, y1: other.y + 2 })) score += 40;
    }
    // Small framing preferences break ties: closer to the follow view, then the wider two-shot.
    score += (position.z < middle.z ? 12 : 0) + (middle.z + 4 - position.z) * 0.8 + Math.abs(back - 2.6) * 0.5 + (4.8 - out) * 0.6 + (up - 2.5) * 0.4;
    if (score < bestScore) { bestScore = score; best = { position, target: { x: middle.x, y: middle.y - 0.1, z: middle.z } }; }
  }
  return best!;
}
