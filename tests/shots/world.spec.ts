import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { openGallery, shoot } from "./helpers";

// Daylight districts stop one short of the finale; dusk has its own views.
const shots = [
  ...["square", "market", "school", "harbor", "festival", "library"].map(view => ({ view, chapter: 5, chest: 8, extra: "" })),
  { view: "festival", chapter: 5, chest: 9, extra: "", file: "festival-dusk" },
  { view: "square", chapter: 5, chest: 9, extra: "", file: "square-dusk" },
  { view: "play-follow", chapter: 1, chest: 0, extra: "" },
  { view: "conversation", chapter: 1, chest: 0, extra: "" },
  { view: "stall-talk", chapter: 2, chest: 2, extra: "" },
  { view: "bench", chapter: 1, chest: 0, extra: "" },
  { view: "title", chapter: 1, chest: 0, extra: "" },
  { view: "market-play", chapter: 5, chest: 4, extra: "" },
  { view: "school-play", chapter: 5, chest: 6, extra: "" },
  { view: "harbor-play", chapter: 5, chest: 8, extra: "" },
  { view: "festival-play", chapter: 5, chest: 8, extra: "" },
  { view: "gates-ch1", chapter: 1, chest: 0, extra: "" },
  { view: "gates-closed", chapter: 1, chest: 0, extra: "" },
  { view: "arch-closed", chapter: 1, chest: 0, extra: "" },
  { view: "wind", chapter: 1, chest: 0, extra: "" },
  { view: "fireworks", chapter: 5, chest: 9, extra: "" },
  { view: "finale", chapter: 5, chest: 9, extra: "" },
  { view: "trade", chapter: 2, chest: 2, extra: "&age=0.42" },
  { view: "deposit", chapter: 2, chest: 3, extra: "&age=0.8" },
  { view: "chest-close", chapter: 3, chest: 5, extra: "" },
  { view: "sea-chest", chapter: 4, chest: 6, extra: "" },
  { view: "chest-2", chapter: 5, chest: 2, extra: "" },
  { view: "sky", chapter: 5, chest: 8, extra: "" }
] as { view: string; chapter: number; chest: number; extra: string; file?: string }[];

for (const { view, chapter, chest, extra, file } of shots) {
  const name = file ?? view;
  test(`world gallery: ${name}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await openGallery(page, "world", `&view=${view}&chapter=${chapter}&chest=${chest}${extra}&clean=1`);
    await page.waitForTimeout(1600);
    const metrics = await page.evaluate(() => ({ calls: Number(document.body.dataset.worldCalls), triangles: Number(document.body.dataset.worldTriangles) }));
    const review = await page.evaluate(() => JSON.parse(document.body.dataset.worldReview!));
    await shoot(page, "world", name);
    await mkdir(".tmp/shots/world", { recursive: true });
    await writeFile(`.tmp/shots/world/${name}.json`, JSON.stringify({ view, viewport: [1366, 768], ...metrics, ...review }, null, 2));
    if (view === "play-follow") expect(review.camera).toBe("follow");
    if (view === "conversation") { expect(review.camera).toBe("conversation"); expect(review.bottomPanel).toBe(200); }
    if (view === "wind" || view === "fireworks") {
      expect(review.effects).toHaveLength(1);
      expect(review.effects[0].kind).toBe(view);
      expect(review.effects[0].age).toBeCloseTo(view === "wind" ? 1.6 : 1.3);
    }
    expect(errors).toEqual([]);
    expect(metrics.calls).toBeGreaterThan(0);
    expect(metrics.calls).toBeLessThanOrEqual(120);
    expect(metrics.triangles).toBeLessThanOrEqual(120_000);
  });
}
