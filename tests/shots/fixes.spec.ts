import { test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

interface Review {
  view: string;
  chapter: number;
  player: { x: number; y: number; z: number };
  camera: { mode: string; position: { x: number; y: number; z: number } };
  gateProgress: Record<string, number> | null;
  chestCount: number;
  chestLid: number | null;
  fishY: number | null;
  time: number;
  stableFrames: number;
  calls: number;
  triangles: number;
}

const views = [
  "bench-ume", "chest-base-closed", "chest-base-open", "bridge-raised", "bridge-lowered", "bridge-rope-south", "arch-sign-rope",
  "school-gate-000", "school-gate-025", "school-gate-050", "school-gate-075", "school-gate-100", "school-east-post", "school-grass",
  "library-outside", "library-doorway", "library-inside", "librarian", "bookshelf-closeup", "northeast-house", "harbor-easel",
  "harbor-fish-jump", "harbor-chest", "east-harbor-house", "pier-end", "prize-tent", "stage-steps", "player-on-step", "player-on-stage"
] as const;
const closeups: readonly string[] = ["school-east-post", "bookshelf-closeup", "northeast-house", "east-harbor-house"];

async function precondition(name: string, action: () => Promise<unknown>): Promise<void> {
  try { await action(); }
  catch (error) { throw new Error(`HARNESS_PRECONDITION_FAILED: ${name}`, { cause: error }); }
}

async function reviewReady(page: Page, name: string): Promise<Review> {
  await precondition(`${name}: rendered gallery and fixture`, () => page.waitForFunction(({ name, closeup }) => {
    const raw = document.body.dataset.fixesReview;
    if (document.body.dataset.galleryReady !== "1" || !raw) return false;
    const r = JSON.parse(raw) as Review;
    if (r.view !== `fixes-${name}` || r.stableFrames < 12 || r.calls <= 0 || !r.gateProgress) return false;
    if (closeup) { if (r.camera.mode !== "path") return false; }
    else {
      if (r.camera.mode !== "follow") return false;
      const p = r.player, c = r.camera.position;
      if (Math.abs(c.x - p.x - 4) > 0.01 || Math.abs(c.y - p.y - 8) > 0.01 || Math.abs(c.z - p.z - 11) > 0.01) return false;
    }
    if (name.startsWith("school-gate-")) {
      const expected = Number(name.slice(-3)) / 100;
      if (Math.abs(r.gateProgress.school - expected) > 0.001) return false;
    }
    if (name === "school-east-post" && Math.abs(r.gateProgress.school - 0.5) > 0.001) return false;
    if (name === "bridge-raised" && r.gateProgress.bridge !== 0) return false;
    if (name === "bridge-lowered" && r.gateProgress.bridge !== 1) return false;
    if (name === "chest-base-open" && (r.chestCount !== 9 || r.chestLid === null || Math.abs(r.chestLid + 1.9) > 0.01)) return false;
    if (name === "chest-base-closed" && (r.chestCount !== 0 || r.chestLid === null || Math.abs(r.chestLid) > 0.01)) return false;
    if (name === "harbor-fish-jump" && (Math.abs(r.time - 0.45) > 0.001 || r.fishY === null || r.fishY < 0.65)) return false;
    if (name === "player-on-step" && Math.abs(r.player.y - 0.2) > 0.01) return false;
    if (name === "player-on-stage" && Math.abs(r.player.y - 0.6) > 0.01) return false;
    return true;
  }, { name, closeup: closeups.includes(name) }, { timeout: 90_000 }));
  return page.evaluate(() => JSON.parse(document.body.dataset.fixesReview!) as Review);
}

// Review artifacts only. No campaign progression or product acceptance runs here.
for (const viewport of [{ width: 1366, height: 768 }, { width: 1280, height: 800 }]) {
  const size = `${viewport.width}x${viewport.height}`;
  test.describe(`fixes review ${size}`, () => {
    test.use({ viewport });
    for (const name of views) {
      test(name, async ({ page }) => {
        const errors: string[] = [];
        page.on("pageerror", error => errors.push(error.message));
        await precondition(`${name}: navigation`, () => page.goto(`/?e2e=1&gallery=world&view=fixes-${name}&clean=1`));
        const review = await reviewReady(page, name);
        if (errors.length) throw new Error(`HARNESS_PRECONDITION_FAILED: ${name}: renderer errors: ${errors.join("; ")}`);
        const folder = `.tmp/shots/fixes/${size}`;
        await mkdir(folder, { recursive: true });
        await page.screenshot({ path: `${folder}/${name}.png` });
        await writeFile(`${folder}/${name}.json`, JSON.stringify({ viewport, ...review }, null, 2));
      });
    }
  });
}
