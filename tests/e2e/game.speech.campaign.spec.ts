import { expect, test } from "@playwright/test";
import { openGame, play, read, respond, speech, startListening } from "./game.helpers";

test.describe("SPEC 14 playable integration", () => {
  test.setTimeout(15 * 60_000);

  test("full stubbed-speech campaign includes misses, Kiwi ladder, tap rescue, transient and fallback", async ({ page }) => {
    await openGame(page, false);
    await play(page, { mode: "speech", until: state => state.prompt?.kind === "answer" && !state.presentation.tip });
    const original = await read(page);
    expect(original.speech.choicesEnabled).toBe(false);
    await expect(page.getByTestId("answer-choice-yes")).toBeDisabled();
    for (let miss = 1; miss <= 3; miss++) {
      await startListening(page);
      await speech(page, { kind: "text", text: "banana umbrella" });
      await expect.poll(async () => (await read(page)).speech.misses).toBe(miss);
      await expect.poll(async () => (await read(page)).speech.modelling).toBe(false);
      expect((await read(page)).speech.listening).toBe(false);
    }
    expect((await read(page)).speech.choicesEnabled).toBe(true);
    await respond(page, await read(page), "buttons");
    await play(page, { mode: "speech", until: state => !!state.prompt && !state.presentation.tip });
    await startListening(page); await speech(page, { kind: "transient" });
    expect((await read(page)).speech.micFree).toBe(false);
    expect((await read(page)).speech.misses).toBe(0);
    await startListening(page); await speech(page, { kind: "fallbackSuggested" });
    expect((await read(page)).speech.choicesEnabled).toBe(true);
    await respond(page, await read(page), "buttons");
    const ending = await play(page, { mode: "speech" });
    expect(ending.game?.finished).toBe(true);
    expect(ending.speech.micFree).toBe(false);
    await expect(page.getByTestId("results-screen")).toBeVisible();
  });
});
