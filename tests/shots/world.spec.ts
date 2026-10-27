import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { openGallery, shoot } from "./helpers";

const shots = [
  ...["square", "market", "school", "harbor", "festival", "library"].map(view => ({ view, chapter: 5, chest: 9 })),
  { view: "play-follow", chapter: 1, chest: 0 },
  { view: "conversation", chapter: 1, chest: 0 },
  { view: "gates-ch1", chapter: 1, chest: 0 },
  { view: "gates-closed", chapter: 1, chest: 0 },
  { view: "arch-closed", chapter: 1, chest: 0 },
  { view: "wind", chapter: 1, chest: 0 },
  { view: "fireworks", chapter: 5, chest: 9 },
  { view: "chest-2", chapter: 5, chest: 2 }
];

for (const { view, chapter, chest } of shots) {
  test(`world gallery: ${view}`, async ({ page }) => {
    await openGallery(page, "world", `&view=${view}&chapter=${chapter}&chest=${chest}`);
    await page.waitForTimeout(1200);
    const metrics = await page.evaluate(() => ({ calls: Number(document.body.dataset.worldCalls), triangles: Number(document.body.dataset.worldTriangles) }));
    const review = await page.evaluate(() => JSON.parse(document.body.dataset.worldReview!));
    await shoot(page, "world", view);
    await mkdir(".tmp/shots/world", { recursive: true });
    await writeFile(`.tmp/shots/world/${view}.json`, JSON.stringify({ view, viewport: [1366, 768], ...metrics, ...review }, null, 2));
    if (view === "play-follow") expect(review.camera).toBe("follow");
    if (view === "conversation") { expect(review.camera).toBe("conversation"); expect(review.bottomPanel).toBe(200); }
    if (view === "wind" || view === "fireworks") {
      expect(review.effects).toHaveLength(1);
      expect(review.effects[0].kind).toBe(view);
      expect(review.effects[0].age).toBeCloseTo(view === "wind" ? 1.6 : 1.3);
    }
    expect(metrics.calls).toBeGreaterThan(0);
    expect(metrics.calls).toBeLessThanOrEqual(120);
    expect(metrics.triangles).toBeLessThanOrEqual(120_000);
  });
}
