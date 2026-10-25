import { test } from "@playwright/test";
import { openGallery, shoot } from "./helpers";

const VIEWS: [string, string][] = [
  ["lineup", ""],
  ["states", "&view=states"],
  ["faces", "&view=faces"],
  ["kiwi", "&view=kiwi"],
  ["portraits", "&view=portraits"],
  ["closeup-player", "&view=closeup&id=player"],
  ["closeup-pom", "&view=closeup&id=pom"]
];

for (const [name, extra] of VIEWS) {
  test(`people gallery: ${name}`, async ({ page }) => {
    await openGallery(page, "people", extra);
    await page.waitForTimeout(900);
    await shoot(page, "people", name);
  });
}
