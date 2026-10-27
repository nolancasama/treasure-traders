import { GATE_SOLIDS, SOLIDS, WALK_AREAS, type Solid } from "./layout";
import type { GateId, Gates, Point } from "./types";

export const PLAYER_R = 0.35;
export const CLOSED: Gates = { cart: false, school: false, bridge: false, arch: false };
export const OPEN: Gates = { cart: true, school: true, bridge: true, arch: true };
const EPS = 1e-6;

function blockedBy(x: number, z: number, r: number, solid: Solid): boolean {
  if (solid.kind === "circle") return Math.hypot(x - solid.x, z - solid.z) < solid.r + r - EPS;
  const dx = x - solid.x, dz = z - solid.z;
  const c = Math.cos(solid.yaw), s = Math.sin(solid.yaw);
  const lx = c * dx - s * dz, lz = s * dx + c * dz;
  const ox = Math.max(Math.abs(lx) - solid.hx, 0), oz = Math.max(Math.abs(lz) - solid.hz, 0);
  return Math.hypot(ox, oz) < r - EPS || (Math.abs(lx) < solid.hx && Math.abs(lz) < solid.hz);
}

/** Circle fits an open surface and does not overlap visible scenery. */
export function isWalkable(x: number, z: number, gates: Gates = CLOSED, r = PLAYER_R): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(r) || r < 0) return false;
  const land = WALK_AREAS.some((a) => (!a.gate || gates[a.gate]) &&
    Math.abs(x - a.x) <= a.hx - r + EPS && Math.abs(z - a.z) <= a.hz - r + EPS);
  return land && !SOLIDS.some((s) => blockedBy(x, z, r, s)) &&
    !(Object.keys(GATE_SOLIDS) as GateId[]).some((id) => !gates[id] && blockedBy(x, z, r, GATE_SOLIDS[id]));
}

function project(x: number, z: number, r: number): Point {
  for (const solid of SOLIDS) {
    if (!blockedBy(x, z, r, solid)) continue;
    if (solid.kind === "circle") {
      const dx = x - solid.x, dz = z - solid.z, d = Math.hypot(dx, dz);
      x = solid.x + (d > EPS ? dx / d : 1) * (solid.r + r + EPS);
      z = solid.z + (d > EPS ? dz / d : 0) * (solid.r + r + EPS);
      continue;
    }
    const c = Math.cos(solid.yaw), s = Math.sin(solid.yaw);
    const dx = x - solid.x, dz = z - solid.z;
    let lx = c * dx - s * dz, lz = s * dx + c * dz;
    const qx = Math.max(-solid.hx, Math.min(solid.hx, lx));
    const qz = Math.max(-solid.hz, Math.min(solid.hz, lz));
    const ox = lx - qx, oz = lz - qz, d = Math.hypot(ox, oz);
    if (d > EPS) { lx = qx + ox / d * (r + EPS); lz = qz + oz / d * (r + EPS); }
    else if (solid.hx - Math.abs(lx) < solid.hz - Math.abs(lz)) lx = (lx < 0 ? -1 : 1) * (solid.hx + r + EPS);
    else lz = (lz < 0 ? -1 : 1) * (solid.hz + r + EPS);
    x = solid.x + c * lx + s * lz; z = solid.z - s * lx + c * lz;
  }
  return { x, z };
}

/** Substeps prevent tunnelling through thin walls; projection and axis retries slide. */
export function moveCircle(x0: number, z0: number, x1: number, z1: number, r = PLAYER_R, gates: Gates = CLOSED): Point {
  if (![x0, z0, x1, z1].every(Number.isFinite)) return nearestWalkable(x0, z0, gates, r);
  let { x, z } = isWalkable(x0, z0, gates, r) ? { x: x0, z: z0 } : nearestWalkable(x0, z0, gates, r);
  const count = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.14));
  const dx = (x1 - x0) / count, dz = (z1 - z0) / count;
  for (let step = 0; step < count; step++) {
    for (let attempt = 0; attempt < 3; attempt++) {
      let p = { x: x + (attempt === 2 ? 0 : dx), z: z + (attempt === 1 ? 0 : dz) };
      for (let pass = 0; pass < 2; pass++) p = project(p.x, p.z, r);
      if (isWalkable(p.x, p.z, gates, r)) { x = p.x; z = p.z; break; }
    }
  }
  return { x, z };
}

/** Deterministic save relocation. Closed districts and water always relocate onto open land. */
export function nearestWalkable(x: number, z: number, gates: Gates = CLOSED, r = PLAYER_R): Point {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return { x: 0, z: 7 };
  if (isWalkable(x, z, gates, r)) return { x, z };
  let best = { x: 0, z: 7 }, distance = Infinity;
  const consider = (px: number, pz: number) => {
    const d = Math.hypot(px - x, pz - z);
    if (d < distance && isWalkable(px, pz, gates, r)) { best = { x: px, z: pz }; distance = d; }
  };
  for (const area of WALK_AREAS) {
    if (area.gate && !gates[area.gate]) continue;
    const px = Math.max(area.x - area.hx + r + EPS, Math.min(area.x + area.hx - r - EPS, x));
    const pz = Math.max(area.z - area.hz + r + EPS, Math.min(area.z + area.hz - r - EPS, z));
    consider(px, pz);
    const pushed = project(px, pz, r); consider(pushed.x, pushed.z);
    // A clamped point may be enclosed by a table or a corner of the library.
    for (let ring = 1; ring <= 20; ring++) {
      const radius = ring * 0.35;
      if (radius - Math.hypot(px - x, pz - z) > distance) break;
      for (let i = 0; i < 32; i++) {
        const angle = i / 32 * Math.PI * 2;
        consider(px + Math.cos(angle) * radius, pz + Math.sin(angle) * radius);
      }
    }
  }
  return best;
}

/** Walker height; item support heights are separately listed in SURFACES. */
export function standY(x: number, z: number): number {
  let y = 0;
  for (const a of WALK_AREAS) if (Math.abs(x - a.x) <= a.hx && Math.abs(z - a.z) <= a.hz) y = Math.max(y, a.y);
  return y;
}

function clearSegment(a: Point, b: Point, gates: Gates, r: number): boolean {
  const count = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.2);
  for (let i = 0; i <= count; i++) {
    const t = count ? i / count : 0;
    if (!isWalkable(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, gates, r)) return false;
  }
  return true;
}

interface Node extends Point { key: string; score: number; cost: number; parent?: Node }
/** A* on a 1m grid, with checked diagonals and line-of-sight smoothing. No route returns []. */
export function findPath(from: Point, to: Point, gates: Gates = CLOSED, r = PLAYER_R): Point[] {
  const start = nearestWalkable(from.x, from.z, gates, r), goal = nearestWalkable(to.x, to.z, gates, r);
  if (clearSegment(start, goal, gates, r)) return [goal];
  const gridPoint = (p: Point): Point | undefined => {
    let best: Point | undefined, dist = Infinity;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      const q = { x: Math.round(p.x) + dx, z: Math.round(p.z) + dz }, d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d < dist && clearSegment(p, q, gates, r)) { best = q; dist = d; }
    }
    return best;
  };
  const s = gridPoint(start), g = gridPoint(goal);
  if (!s || !g) return [];
  const key = (p: Point) => `${p.x},${p.z}`;
  const heap: Node[] = [], costs = new Map<string, number>();
  const push = (n: Node) => {
    heap.push(n); let i = heap.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (heap[p].score <= n.score) break; heap[i] = heap[p]; i = p; }
    heap[i] = n;
  };
  const pop = (): Node => {
    const first = heap[0], last = heap.pop()!;
    if (heap.length) {
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let child = i * 2 + 1;
        if (child + 1 < heap.length && heap[child + 1].score < heap[child].score) child++;
        if (heap[child].score >= last.score) break;
        heap[i] = heap[child]; i = child;
      }
      heap[i] = last;
    }
    return first;
  };
  const walkCache = new Map<string, boolean>();
  const valid = (p: Point) => {
    const k = key(p);
    let v = walkCache.get(k);
    if (v === undefined) { v = isWalkable(p.x, p.z, gates, r); walkCache.set(k, v); }
    return v;
  };
  const initial: Node = { ...s, key: key(s), score: Math.hypot(g.x - s.x, g.z - s.z), cost: 0 };
  push(initial); costs.set(initial.key, 0);
  while (heap.length) {
    const n = pop();
    if (n.cost !== costs.get(n.key)) continue;
    if (n.x === g.x && n.z === g.z) {
      const raw: Point[] = [goal]; let cursor: Node | undefined = n;
      while (cursor) { raw.push({ x: cursor.x, z: cursor.z }); cursor = cursor.parent; }
      raw.push(start); raw.reverse();
      const smooth: Point[] = [];
      for (let i = 0; i < raw.length - 1;) {
        let j = raw.length - 1;
        while (j > i + 1 && !clearSegment(raw[i], raw[j], gates, r)) j--;
        smooth.push(raw[j]); i = j;
      }
      return smooth;
    }
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (!dx && !dz) continue;
      const p = { x: n.x + dx, z: n.z + dz };
      if (!valid(p) || dx && dz && (!valid({ x: n.x + dx, z: n.z }) || !valid({ x: n.x, z: n.z + dz }))) continue;
      if (!clearSegment(n, p, gates, r)) continue;
      const k = key(p), cost = n.cost + Math.hypot(dx, dz);
      if (cost >= (costs.get(k) ?? Infinity)) continue;
      costs.set(k, cost); push({ ...p, key: k, cost, score: cost + Math.hypot(g.x - p.x, g.z - p.z), parent: n });
    }
  }
  return [];
}
