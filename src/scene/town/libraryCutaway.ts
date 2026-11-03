import type { Position } from "../../game/world/types";
import { SOLIDS, WALK_AREAS } from "../../game/world/layout";
import { segmentHits } from "../cameraRig";

const room = WALK_AREAS.find(a => a.id === "library")!;
export const insideLibrary = (p: { x: number; z: number }) => Math.abs(p.x - room.x) < room.hx && Math.abs(p.z - room.z) < room.hz;

/** Test the actual eased camera, including the exterior-to-interior transition.
 * A doorway frame cuts with its adjoining wall, so it never floats on a cut wall.
 * North/west and the far east section stay standing unless sightlines need it. */
export function libraryEastCutMask(camera: Position, player: Position): number {
  let mask = 0;
  for (const [id, bit] of [["library-east-north", 1], ["library-east-south", 2]] as const) {
    const s = SOLIDS.find(s => s.id === id)!;
    if (s.kind !== "box") continue;
    if ([0.6, 1.6].some(y => segmentHits(camera, { x: player.x, y: player.y + y, z: player.z }, { x: s.x, z: s.z, hx: s.hx + 0.16, hz: s.hz, y0: s.y + 0.5, y1: s.y + s.height }))) mask |= bit;
  }
  const lintel = { x: -11.85, z: -42, hx: 0.35, hz: 1.8, y0: 2.72, y1: 3.62 };
  if (mask || [0.6, 1.6].some(y => segmentHits(camera, { x: player.x, y: player.y + y, z: player.z }, lintel))) mask |= 4;
  return mask;
}
