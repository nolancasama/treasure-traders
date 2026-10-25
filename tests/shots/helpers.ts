import type { Page } from "@playwright/test";

/** Opens a review gallery and waits until it reports that it has rendered. */
export async function openGallery(page: Page, name: string, extra = ""): Promise<void> {
  await page.goto(`/?e2e=1&gallery=${name}${extra}`);
  await page.waitForSelector("body[data-gallery-ready='1']", { timeout: 60_000 });
  // Let a few frames settle (animations, lazy materials).
  await page.waitForTimeout(400);
}

/** Saves a screenshot to .tmp/shots/<group>/<file>.png */
export async function shoot(page: Page, group: string, file: string): Promise<void> {
  await page.screenshot({ path: `.tmp/shots/${group}/${file}.png` });
}
