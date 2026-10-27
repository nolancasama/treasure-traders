import { expect, test } from "@playwright/test";
import { openGallery, shoot } from "./helpers";

const views = [
  "title", "title-confirm", "title-new", "hud", "backpack-bar", "backpack-compact", "backpack", "inspect", "bag-check",
  "dialogue", "dialogue-happy", "dialogue-ja-only", "ask-0", "ask-1", "ask-incomplete", "ask-2", "ask-3", "ask-listening", "ask-all", "ask-coach",
  "answer", "answer-3", "answer-listening", "mic-free", "unavailable", "transient", "fallback",
  "journal-festival", "journal-people", "journal-words", "journal-stickers", "settings", "settings-reset", "chapters",
  "mission", "chapter-clear", "new-area", "notice", "results", "tip-moving", "tip-mic", "tip-asking", "tip-backpack", "tip-journal"
];
for (const view of views) {
  test(`ui gallery: ${view}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await openGallery(page, "ui", `&view=${view}`);
    await expect(page.getByTestId("ui-gallery")).toHaveAttribute("data-ui-view", view);
    if (view === "inspect") await expect(page.locator('[data-testid="item-inspect-model"] canvas')).toBeVisible();
    if (view === "ask-0") await expect(page.getByTestId("ask-choice-pen")).toBeDisabled();
    if (view === "ask-3" || view === "mic-free") await expect(page.getByTestId("ask-choice-pen")).toBeEnabled();
    if (view === "title-confirm" || view === "settings-reset") await expect(page.getByRole("alertdialog")).toBeVisible();
    if (view === "ask-coach" || view === "ask-all") {
      const bar = await page.locator(".tt-gallery-prompt-dock").boundingBox();
      const prompt = await page.getByTestId("ask-prompt").boundingBox();
      expect(bar!.y + bar!.height).toBeLessThanOrEqual(prompt!.y);
    }
    await shoot(page, "ui", view);
    expect(errors).toEqual([]);
  });
}
for (const touch of [false, true]) {
  test(`ui layout: ${touch ? "touch" : "1280x800"}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: touch ? { width: 1366, height: 768 } : { width: 1280, height: 800 }, hasTouch: touch });
    const page = await context.newPage();
    await openGallery(page, "ui", "&view=ask-all");
    const boxes = await page.locator('[data-testid^="ask-choice-"]').evaluateAll(elements => elements.map(element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
    for (const box of boxes) { expect(box.w).toBeGreaterThanOrEqual(44); expect(box.h).toBeGreaterThanOrEqual(44); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y + box.h).toBeLessThanOrEqual(touch ? 768 : 800); }
    await shoot(page, "ui", touch ? "touch-ask-all" : "1280-ask-all");
    await context.close();
  });
}
