import { test } from "@playwright/test";
import { openGallery, shoot } from "./helpers";

const VIEWS: [string, string][] = [
  ["items", ""],
  ["chests", "&view=chests"],
  ["hand", "&view=hand"],
  ["icons", "&view=icons"],
  ["closeup-pen", "&view=closeup&item=pen"],
  ["closeup-stapler", "&view=closeup&item=stapler"],
  ["closeup-pencilCase", "&view=closeup&item=pencilCase"],
  ["closeup-eraser", "&view=closeup&item=eraser"]
];

for (const [name, extra] of VIEWS) {
  test(`items gallery: ${name}`, async ({ page }) => {
    await openGallery(page, "items", extra);
    await page.waitForTimeout(600);
    await shoot(page, "items", name);
  });
}
