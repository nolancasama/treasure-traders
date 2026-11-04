import { expect, it } from "vitest";
import { SOLIDS, SPOTS, SURFACES } from "./layout";

it("keeps the entire flowerbed at least 0.45m outside the square's gold ring", () => {
  const bed = SOLIDS.find(s => s.id === "flower-bed")!;
  if (bed.kind !== "box") throw new Error("Missing flowerbed footprint");
  expect(bed.yaw).toBe(0);
  const nearestX = Math.max(0, Math.abs(bed.x) - bed.hx), nearestZ = Math.max(0, Math.abs(bed.z) - bed.hz);
  expect(Math.hypot(nearestX, nearestZ) - 9.1).toBeGreaterThanOrEqual(0.45);
  expect(SPOTS["square-eraser"]).toEqual({ x: bed.x, y: bed.y + bed.height, z: bed.z });
  expect(SURFACES.find(s => s.id === bed.id)).toMatchObject({ x: bed.x, z: bed.z, hx: bed.hx, hz: bed.hz, y: bed.y + bed.height });
});
