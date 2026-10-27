import { expect, test } from "@playwright/test";
import { L } from "../../src/game/content/lines";
import { districtOf, play, probe, read, settle, shot, type GameRead } from "./game.helpers";

test.describe("SPEC 14 playable integration", () => {
  test.setTimeout(15 * 60_000);

  test("full mic-free campaign, ending, free roam and renderer budgets in all five districts", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(String(error)));
    await page.goto("/?e2e=1&seed=101&coach=off");
    await expect(page.getByTestId("title-screen")).toBeVisible();
    await shot(page, "title-1366x768");
    await page.setViewportSize({ width: 1280, height: 800 });
    await shot(page, "title-1280x800");
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.getByTestId("title-mic-free").check();
    await page.getByTestId("title-new").click();
    const districts = new Set<string>();
    const captures = new Set<string>();
    const observe = async (state: GameRead) => {
      const district = districtOf(state);
      if (district && !districts.has(district) && !state.busy && !state.presentation.screen && !state.presentation.card && !state.presentation.tip) {
        await probe(page, district, state); districts.add(district);
      }
      const finale = state.game?.finished && state.presentation.beat?.en === L.mayorOpen.en;
      const category = state.presentation.card?.kind === "chapter-clear" ? "chapter-clear" : state.prompt?.kind ? `dialogue-${state.prompt.kind}` : finale ? "finale" : null;
      if (category && !captures.has(category)) {
        await shot(page, `${category}-1366x768`); captures.add(category);
        if (category === "dialogue-ask") {
          await page.setViewportSize({ width: 1280, height: 800 });
          await shot(page, "dialogue-ask-1280x800");
          await page.setViewportSize({ width: 1366, height: 768 });
        }
      }
      if (state.game?.chapter === 1 && !state.busy && !state.prompt && !state.presentation.beat && !state.presentation.screen && !state.presentation.tip && !state.presentation.card && !captures.has("backpack")) {
        await page.keyboard.press("b"); await expect(page.getByTestId("backpack-panel")).toBeVisible();
        await shot(page, "backpack-1366x768"); await page.getByTestId("backpack-panel-close").click();
        await page.keyboard.press("j"); await expect(page.getByTestId("journal")).toBeVisible();
        await shot(page, "journal-1366x768"); await page.getByTestId("journal-close").click();
        captures.add("backpack");
      }
    };
    const result = await play(page, { observe });
    expect(result.game?.finished).toBe(true);
    await expect(page.getByTestId("results-screen")).toBeVisible();
    await shot(page, "results-ending-1366x768");
    await page.getByTestId("results-explore").click();
    await expect(page.getByTestId("results-screen")).not.toBeVisible();
    expect((await read(page)).game?.finished).toBe(true);
    await shot(page, "free-festival-roam-1366x768");
    await page.reload();
    await page.getByTestId("title-continue").click();
    await settle(page, state => !state.busy && state.presentation.screen === null);
    await expect(page.getByTestId("results-screen")).not.toBeVisible();
    expect((await read(page)).game?.finished).toBe(true);
    expect([...districts].sort()).toEqual(["festival", "harbor", "market", "school", "square"]);
    for (const capture of ["chapter-clear", "dialogue-ask", "dialogue-answer", "backpack", "finale"]) expect(captures.has(capture), capture).toBe(true);
    expect(errors).toEqual([]);
  });
});
