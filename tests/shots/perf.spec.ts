import { test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { openGallery } from "./helpers";

// Relative frame cost under SwiftShader, for before/after comparison only:
// software rendering says nothing absolute about a real Chromebook GPU.
// PERF_LABEL names the output file in .tmp/shots/perf/.
const label = process.env.PERF_LABEL ?? "current";
const views = [
  { view: "play-follow", chapter: 1, chest: 0 },
  { view: "square", chapter: 5, chest: 8 },
  { view: "market", chapter: 5, chest: 8 },
  { view: "school", chapter: 5, chest: 8 },
  { view: "harbor", chapter: 5, chest: 8 },
  { view: "festival", chapter: 5, chest: 9 },
  // What children actually look at; these views did not exist before the graphics upgrade.
  { view: "market-play", chapter: 5, chest: 4 },
  { view: "school-play", chapter: 5, chest: 6 },
  { view: "harbor-play", chapter: 5, chest: 8 },
  { view: "festival-play", chapter: 5, chest: 8 },
  { view: "conversation", chapter: 1, chest: 0 },
  { view: "finale", chapter: 5, chest: 9 }
];
const results: Record<string, unknown> = {};

for (const { view, chapter, chest } of views) {
  test(`frame cost: ${view}`, async ({ page }) => {
    await openGallery(page, "world", `&view=${view}&chapter=${chapter}&chest=${chest}`);
    await page.waitForTimeout(1500);
    const measured = await page.evaluate(() => new Promise<{ frames: number; ms: number }>(resolve => {
      const start = performance.now();
      let frames = 0;
      const tick = () => {
        frames++;
        if (performance.now() - start < 8000) requestAnimationFrame(tick);
        else resolve({ frames, ms: performance.now() - start });
      };
      requestAnimationFrame(tick);
    }));
    const info = await page.evaluate(() => ({ calls: Number(document.body.dataset.worldCalls), triangles: Number(document.body.dataset.worldTriangles) }));
    results[view] = { frameMs: Math.round(measured.ms / measured.frames * 10) / 10, ...info };
    await mkdir(".tmp/shots/perf", { recursive: true });
    await writeFile(`.tmp/shots/perf/${label}.json`, JSON.stringify(results, null, 2));
  });
}
