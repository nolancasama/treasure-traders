import { GATE_SOLIDS, SOLIDS, type Solid } from "./layout";
import type { Gates, Interaction, Position } from "./types";

export const INTERACTION_RANGE = 2.4;
export interface InteractionPoint { target: Interaction; position: Position }

function local(solid: Solid, p: Position): Position {
  const dx = p.x - solid.x, dz = p.z - solid.z;
  if (solid.kind === "circle") return { x: dx, y: p.y - solid.y, z: dz };
  const c = Math.cos(solid.yaw), s = Math.sin(solid.yaw);
  return { x: c * dx - s * dz, y: p.y - solid.y, z: s * dx + c * dz };
}

function contains(solid: Solid, p: Position): boolean {
  const q = local(solid, p);
  return solid.kind === "circle" ? Math.hypot(q.x, q.z) <= solid.r + 0.01 : Math.abs(q.x) <= solid.hx + 0.01 && Math.abs(q.z) <= solid.hz + 0.01;
}

/** Straight sight ray, rather than a collision move which can slide around a wall. */
export function hasInteractionSight(from: Position, candidate: InteractionPoint, gates: Gates): boolean {
  const { target, position } = candidate;
  const a = { ...from, y: from.y + 1.0 }, b = { ...position, y: position.y + (target.kind === "npc" ? 1.0 : 0.15) };
  const solids = [...SOLIDS, ...Object.entries(GATE_SOLIDS).filter(([gate]) => !gates[gate as keyof Gates]).map(([, solid]) => solid)];
  for (const solid of solids) {
    // A reachable item rests on its own furniture; the furniture is not a wall
    // between the child and that item. Tall walls never qualify as supports.
    if (contains(solid, position) && (target.kind === "seaChest" && solid.id === "sea-chest" || target.kind === "spot" && Math.abs(position.y - solid.y - solid.height) < 0.21)) continue;
    const start = local(solid, a), end = local(solid, b);
    let lo = 0, hi = 1;
    const slab = (origin: number, delta: number, min: number, max: number) => {
      if (Math.abs(delta) < 1e-8) return origin >= min && origin <= max;
      const t1 = (min - origin) / delta, t2 = (max - origin) / delta;
      lo = Math.max(lo, Math.min(t1, t2)); hi = Math.min(hi, Math.max(t1, t2));
      return lo <= hi;
    };
    if (!slab(start.y, end.y - start.y, 0, solid.height)) continue;
    if (solid.kind === "box") {
      if (slab(start.x, end.x - start.x, -solid.hx, solid.hx) && slab(start.z, end.z - start.z, -solid.hz, solid.hz)) return false;
    } else {
      const dx = end.x - start.x, dz = end.z - start.z, length2 = dx * dx + dz * dz;
      const t = Math.max(lo, Math.min(hi, length2 ? -(start.x * dx + start.z * dz) / length2 : 0));
      if (Math.hypot(start.x + t * dx, start.z + t * dz) <= solid.r) return false;
    }
  }
  return true;
}

export function canInteract(from: Position, candidate: InteractionPoint, gates: Gates): boolean {
  return Math.hypot(candidate.position.x - from.x, candidate.position.z - from.z) <= INTERACTION_RANGE && hasInteractionSight(from, candidate, gates);
}

/** Distance chooses the target; facing breaks ties only. */
export function interactionFocus(player: Position & { yaw: number }, candidates: InteractionPoint[], gates: Gates): Interaction | null {
  let focus: Interaction | null = null, nearest = Infinity, facing = -Infinity;
  for (const candidate of candidates) {
    if (!canInteract(player, candidate, gates)) continue;
    const dx = candidate.position.x - player.x, dz = candidate.position.z - player.z, distance = Math.hypot(dx, dz);
    const alignment = distance ? (dx * Math.sin(player.yaw) + dz * Math.cos(player.yaw)) / distance : 1;
    if (distance < nearest - 1e-6 || Math.abs(distance - nearest) <= 1e-6 && alignment > facing) {
      focus = candidate.target; nearest = distance; facing = alignment;
    }
  }
  return focus;
}
