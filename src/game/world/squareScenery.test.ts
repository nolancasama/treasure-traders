import { expect, it } from "vitest";
import { NPC_HOMES, SOLIDS, SPOTS, SURFACES } from "./layout";

it("keeps the entire flowerbed at least 0.45m outside the square's gold ring", () => {
  const bed = SOLIDS.find(s => s.id === "flower-bed")!;
  if (bed.kind !== "box") throw new Error("Missing flowerbed footprint");
  expect(bed.yaw).toBe(0);
  const nearestX = Math.max(0, Math.abs(bed.x) - bed.hx), nearestZ = Math.max(0, Math.abs(bed.z) - bed.hz);
  expect(Math.hypot(nearestX, nearestZ) - 9.1).toBeGreaterThanOrEqual(0.45);
  expect(SPOTS["square-eraser"]).toEqual({ x: bed.x, y: bed.y + bed.height, z: bed.z });
  expect(SURFACES.find(s => s.id === bed.id)).toMatchObject({ x: bed.x, z: bed.z, hx: bed.hx, hz: bed.hz, y: bed.y + bed.height });
});

it("stands the Fruit and Flower stalls square to those across the aisle, with vendors facing the aisle", () => {
  for (const [id, opposite] of [["fruit-stall", "toys-stall"], ["flowers-stall", "bakery-stall"]]) {
    const stall = SOLIDS.find(s => s.id === id)!, across = SOLIDS.find(s => s.id === opposite)!;
    if (stall.kind !== "box" || across.kind !== "box") throw new Error("Missing stall footprint");
    expect(stall.x).toBe(across.x);
    expect(stall.z).toBe(-across.z);
    // A half turn from the opposite stall's yaw, so the two fronts are parallel and facing.
    expect(stall.yaw - across.yaw).toBe(Math.PI);
  }
  for (const [id, x] of [["lily", 30], ["sara", 45]] as const) expect(NPC_HOMES[id]).toMatchObject({ x, z: 4, yaw: Math.PI });
  for (const id of ["bruno", "max"] as const) expect(NPC_HOMES[id].yaw).toBe(0);
});
