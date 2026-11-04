import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_SETTINGS } from "../../src/game/logic";

// Real clicks on a new game. Times are read in the page, since a test's round trip can
// stall on a software-rendered frame. BASE_URL points this at the published site.
const settings = (seenTips: string[], micFree: boolean) => ({ ...DEFAULT_SETTINGS, micFree, seenTips });

async function newGame(page: Page, seenTips: string[], micFree: boolean) {
  await page.addInitScript(value => localStorage.setItem("tt.settings.v1", JSON.stringify(value)), settings(seenTips, micFree));
  await page.addInitScript(() => {
    const times = { lastPress: 0, start: 0, card: 0 };
    Object.assign(window, { __introTimes: times });
    window.addEventListener("pointerdown", () => { times.lastPress = performance.now(); }, true);
    addEventListener("DOMContentLoaded", () => new MutationObserver(() => {
      if (!times.card && document.querySelector('[data-testid="card-mission"]')) times.card = performance.now();
    }).observe(document.body, { childList: true, subtree: true }));
  });
  await page.goto("./?e2e=1&seed=101&coach=off");
  await page.getByTestId("title-new").click();
  await page.evaluate(() => { const t = (window as unknown as { __introTimes: { start: number } }).__introTimes; t.start = performance.now(); });
}
const times = (page: Page) => page.evaluate(() => (window as unknown as { __introTimes: { lastPress: number; start: number; card: number } }).__introTimes);

for (const micFree of [false, true]) test(`the mission card follows the last intro line at once (${micFree ? "mic-free" : "speech"})`, async ({ page }) => {
  await newGame(page, [], micFree);
  const card = page.getByTestId("card-mission"), next = page.getByTestId("dialogue-continue");
  // Real presses through every line, as quickly as a child reading fast could.
  while (!await card.isVisible()) {
    if (await next.isVisible()) { await next.click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(350); }
    else await page.waitForTimeout(50);
  }
  const t = await times(page), afterLastLine = t.card - t.lastPress, total = t.card - t.start;
  console.log(`INTRO ${micFree ? "mic-free" : "speech"}: last line to card ${Math.round(afterLastLine)}ms; new game to card ${Math.round(total)}ms`);
  expect(afterLastLine, "no wait after the last line").toBeLessThan(1000);
});

test("skipping shows the mission card at once", async ({ page }) => {
  await newGame(page, ["intro"], true);
  const skip = page.getByTestId("intro-skip");
  await expect(skip).toBeVisible({ timeout: 30_000 });
  await skip.click();
  await expect(page.getByTestId("card-mission")).toBeVisible({ timeout: 15_000 });
  const t = await times(page), afterSkip = t.card - t.lastPress;
  console.log(`INTRO skip: skip press to card ${Math.round(afterSkip)}ms`);
  expect(afterSkip, "no wait after skipping").toBeLessThan(1000);
});
