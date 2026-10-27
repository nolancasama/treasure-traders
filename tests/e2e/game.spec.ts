import { expect, test } from "@playwright/test";
import { approach, openGame, play, read, respond, settle, shot, speech, startListening, type GameRead } from "./game.helpers";

test.describe("SPEC 14 playable integration", () => {
  test.setTimeout(15 * 60_000);

  test("contradicting answers spotlight the bag, grant no reward, and re-ask with Kiwi modelling", async ({ page }) => {
    await openGame(page);
    // The first question whose truthful answer is "Yes" (plan order may ask other questions first).
    const truthfulYes = (state: GameRead) => state.prompt?.kind === "answer" && (state.game?.holdings.player?.[state.prompt.item] ?? 0) >= state.prompt.count;
    await play(page, { until: state => truthfulYes(state) && !state.presentation.tip });
    const before = await read(page);
    if (before.prompt?.kind !== "answer") throw new Error("expected an answer prompt");
    const item = before.prompt.item;
    let questionId = before.prompt.questionId;
    for (let attempt = 1; attempt <= 2; attempt++) {
      await page.getByTestId("answer-choice-no").click();
      await settle(page, state => state.presentation.screen === "backpack");
      await expect(page.getByTestId(`backpack-card-${item}`)).toHaveClass(/tt-spotlight/);
      expect((await read(page)).game?.holdings).toEqual(before.game?.holdings);
      await page.getByTestId("backpack-panel-close").click();
      const retry = await settle(page, state => state.prompt?.kind === "answer" && state.prompt.questionId !== questionId && !state.presentation.screen);
      expect(retry.game?.question?.contradictions).toBe(attempt);
      expect(retry.game?.holdings).toEqual(before.game?.holdings);
      if (retry.prompt?.kind !== "answer") throw new Error("expected the re-asked question");
      questionId = retry.prompt.questionId;
    }
    await page.getByTestId("answer-choice-yes").click();
    await settle(page, state => !state.game?.question || state.game.question.id !== questionId);
    expect((await read(page)).game?.question?.contradictions ?? 0).toBe(0);
  });

  test("permission denied switches to mic-free for the session", async ({ page }) => {
    await openGame(page, false);
    await play(page, { mode: "speech", until: state => !!state.prompt && !state.presentation.tip });
    const before = await read(page);
    await startListening(page); await speech(page, { kind: "unavailable" });
    await expect(page.getByTestId("answer-choice-yes")).toBeEnabled();
    expect((await read(page)).speech.micFree).toBe(true);
    expect((await read(page)).game?.holdings).toEqual(before.game?.holdings);
    await expect(page.getByRole("status").filter({ hasText: "Mic-free mode is on." })).toBeVisible();
    await respond(page, await read(page), "buttons");
    const next = await play(page, { until: state => !!state.prompt && !state.presentation.tip });
    expect(next.speech.micFree).toBe(true);
  });

  test("mid-chapter save and Continue preserve the exact instance, rules state and player position", async ({ page }) => {
    await openGame(page);
    await play(page, { until: state => !state.busy && !state.prompt && !!state.game?.holdings.player?.pencil });
    await settle(page, state => !state.busy && !state.presentation.beat && !state.presentation.tip);
    const saved = await page.evaluate(() => localStorage.getItem("tt.save.v1"));
    expect(saved).not.toBeNull();
    const stored = JSON.parse(saved!);
    await page.reload();
    await page.getByTestId("title-continue").click();
    const restored = await settle(page, state => !state.busy && state.presentation.screen === null);
    expect(restored.game).toEqual(stored);
    expect(restored.position.x).toBeCloseTo(stored.position.x, 3);
    expect(restored.position.z).toBeCloseTo(stored.position.z, 3);
    expect(restored.position.yaw).toBeCloseTo(stored.position.yaw, 3);
  });

  test("chapter replay starts a different seeded canonical puzzle, uses its own slot and returns to chapters", async ({ page }) => {
    await openGame(page);
    await play(page, { until: state => state.game?.chapter === 3 && !state.busy && !state.presentation.card && !state.presentation.beat && !state.presentation.tip });
    const campaign = await page.evaluate(() => localStorage.getItem("tt.save.v1"));
    await page.reload(); await page.getByTestId("title-chapters").click();
    await page.getByTestId("chapter-2").click();
    const replay = await settle(page, state => state.game?.mode === "replay" && !state.busy && !state.presentation.card && !state.presentation.beat && !state.presentation.tip);
    expect(replay.game?.chapter).toBe(2);
    expect(replay.game?.campaignSeed).not.toBe(101);
    expect(replay.game?.holdings.player).toEqual({ pen: 1 });
    expect(replay.game?.flags).toEqual({});
    expect(await page.evaluate(() => localStorage.getItem("tt.replay.v1"))).not.toBeNull();
    await play(page, { until: state => state.presentation.screen === "chapters" });
    await expect(page.getByTestId("chapter-select")).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("tt.save.v1"))).toBe(campaign);
  });

  test("keyboard movement and interaction plus real world click movement and interaction", async ({ page }) => {
    await openGame(page);
    let state = await settle(page, current => current.phase === "playing" && !!current.game && !current.busy && !current.presentation.card && !current.presentation.tip && !current.presentation.beat);
    const position = state.position;
    await page.keyboard.down("ArrowRight"); await page.waitForTimeout(550); await page.keyboard.up("ArrowRight");
    state = await read(page);
    expect(Math.hypot(state.position.x - position.x, state.position.z - position.z)).toBeGreaterThan(0.5);
    await approach(page, { kind: "collect", spot: "square-pencil" });
    await settle(page, current => !!current.game?.holdings.player?.pencil);
    await settle(page, current => !current.busy && !current.presentation.beat && !current.presentation.tip);
    await approach(page, { kind: "talk", target: "pom" });
    await settle(page, current => current.prompt?.kind === "answer" && !current.presentation.tip);
    await page.keyboard.press("Escape");
    await settle(page, current => !current.busy && !current.prompt);
    await page.keyboard.press("e");
    await settle(page, current => current.prompt?.kind === "answer");
    await page.keyboard.press("1");
    await settle(page, current => !!current.game?.holdings.chest?.pencil);
  });

  test("touch taps move, interact and answer at Chromebook resolution", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1, hasTouch: true });
    const page = await context.newPage();
    try {
      await openGame(page);
      await settle(page, state => state.phase === "playing" && !state.busy && !!state.game && !state.presentation.card && !state.presentation.beat && !state.presentation.tip);
      await shot(page, "touch-square-1366x768");
      await approach(page, { kind: "collect", spot: "square-pencil" }, true);
      await settle(page, state => !!state.game?.holdings.player?.pencil);
      await settle(page, state => !state.busy && !state.presentation.beat && !state.presentation.tip);
      await approach(page, { kind: "talk", target: "pom" }, true);
      await settle(page, state => state.prompt?.kind === "answer" && !state.presentation.tip);
      await shot(page, "touch-dialogue-answer-1366x768");
      await page.getByTestId("answer-choice-yes").tap();
      await settle(page, state => !!state.game?.holdings.chest?.pencil);
      expect((await read(page)).game?.holdings.player?.pencil ?? 0).toBe(0);
    } finally { await context.close(); }
  });

  test("corrupt saves are backed up with a friendly notice and the test hook is query gated", async ({ page }) => {
    await page.goto("/");
    expect(await page.evaluate(() => "__tt" in window)).toBe(false);
    await page.evaluate(() => localStorage.setItem("tt.save.v1", "{invalid save"));
    await page.goto("/?e2e=1");
    expect(await page.evaluate(() => localStorage.getItem("tt.save.bak"))).toBe("{invalid save");
    await expect(page.getByTestId("title-continue")).toBeDisabled();
    await expect(page.getByTestId("notice-dismiss")).toBeVisible();
  });
});
