import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_SETTINGS, startChapter } from "../../src/game/logic";
import { judgeAsk } from "../../src/game/logic/speechJudge";
import { play, read, settle, speech, startListening, type GameRead } from "./game.helpers";

test.use({ hasTouch: true });

const playable = (s: GameRead) => s.phase === "playing" && !s.busy && !s.prompt && !s.presentation.beat && !s.presentation.card && !s.presentation.tip && !s.presentation.screen && !s.navigation.locked;
async function precondition(name: string, work: () => Promise<unknown>) {
  try { await work(); } catch (cause) { throw new Error(`HARNESS_PRECONDITION_FAILED: ${name}`, { cause }); }
}

async function openPrompt(page: Page, kind: "ask" | "answer", micFree: boolean) {
  const game = startChapter(kind === "answer" ? 1 : 2, { mode: "campaign", seed: 165939, campaignSeed: 101 });
  await page.addInitScript(({ game, settings }) => {
    localStorage.setItem("tt.save.v1", JSON.stringify(game));
    localStorage.setItem("tt.settings.v1", JSON.stringify(settings));
  }, { game, settings: { ...DEFAULT_SETTINGS, micFree, seenTips: ["intro", "moving", "mic", "asking"] } });
  await page.goto("./?e2e=1");
  await precondition(`${kind} prompt in ${micFree ? "mic-free" : "mic"} mode`, async () => {
    await page.getByTestId("title-continue").click();
    await settle(page, playable);
    await play(page, { mode: micFree ? "buttons" : "speech", until: s => s.prompt?.kind === kind });
    expect((await read(page)).prompt?.kind).toBe(kind);
    expect((await read(page)).speech.micFree).toBe(micFree);
    await expect(page.getByTestId(`${kind}-prompt`)).toBeVisible();
    await expect(page.getByTestId("prompt-bye")).toBeEnabled();
    // Wait for the entrance animation, using rendered bounds rather than a sleep.
    await page.getByTestId("prompt-bye").evaluate(async element => {
      await Promise.all(element.closest(".tt-prompt")!.getAnimations().map(animation => animation.finished));
    });
  });
}

type Box = { x: number; y: number; width: number; height: number };
const intersects = (a: Box, b: Box) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

async function checkLayout(page: Page, micFree: boolean) {
  const bye = (await page.getByTestId("prompt-bye").boundingBox())!;
  // The old header button has a 44px minimum height; these fail that layout.
  expect(bye.width, "large Bye target").toBeGreaterThanOrEqual(112);
  expect(bye.height, "large Bye target").toBeGreaterThanOrEqual(56);
  const area = (await page.locator(".tt-mic-area").boundingBox())!;
  expect(Math.abs(bye.x + bye.width / 2 - area.x - area.width / 2), "Bye shares the mic column axis").toBeLessThanOrEqual(1);
  if (!micFree) {
    const mic = (await page.getByTestId("prompt-mic").boundingBox())!;
    expect(Math.abs(bye.x + bye.width / 2 - mic.x - mic.width / 2), "Bye and mic centers").toBeLessThanOrEqual(1);
    expect(mic.y - bye.y - bye.height, "gap above mic").toBeGreaterThanOrEqual(7);
  } else {
    await expect(page.getByTestId("prompt-mic")).toHaveCount(0);
    const label = (await page.locator(".tt-mic-area > span").boundingBox())!;
    expect(label.y - bye.y - bye.height, "mode label beneath Bye").toBeGreaterThanOrEqual(7);
  }
  for (const selector of [".tt-prompt-content h2", ".tt-prompt-jp", ".tt-choice", ".tt-prompt-feedback", ".tt-coach:not(:empty)"]) {
    for (const element of await page.locator(selector).all()) {
      expect(intersects(bye, (await element.boundingBox())!), `Bye clears ${selector}`).toBe(false);
    }
  }
  const viewport = page.viewportSize()!;
  for (const [name, box] of [["Bye", bye], ["prompt", (await page.locator(".tt-prompt").boundingBox())!]] as const) {
    expect(box.x, `${name} inside left edge`).toBeGreaterThan(0);
    expect(box.y, `${name} inside top edge`).toBeGreaterThan(0);
    expect(box.x + box.width, `${name} inside right edge`).toBeLessThan(viewport.width);
    expect(box.y + box.height, `${name} inside bottom edge`).toBeLessThan(viewport.height);
  }
  return bye;
}

for (const viewport of [{ width: 1366, height: 768 }, { width: 1280, height: 800 }]) {
  test.describe(`${viewport.width}x${viewport.height} Bye`, () => {
    test.use({ viewport });
    for (const kind of ["ask", "answer"] as const) for (const micFree of [false, true]) {
      test(`${kind}, ${micFree ? "mic-free" : "mic"}: centered pill closes with real input`, async ({ page }) => {
        await openPrompt(page, kind, micFree);
        await checkLayout(page, micFree);
        if (kind === "ask" && !micFree) {
          await precondition("real pronunciation coach opens on an item near miss", async () => {
            const text = ["Do you have a pin?", "Do you have a pancil?", "Do you have a ruber?"].find(value => judgeAsk([value]).kind === "nearMiss");
            expect(text, "a near-miss input for the real judge").toBeDefined();
            await startListening(page);
            await speech(page, { kind: "text", text: text! });
            await expect.poll(async () => (await read(page)).speech.coach).not.toBeNull();
            await expect(page.getByTestId("pronunciation-coach")).toBeVisible();
          });
          await checkLayout(page, micFree);
        }
        const bye = (await page.getByTestId("prompt-bye").boundingBox())!;
        if (micFree) await page.touchscreen.tap(bye.x + bye.width / 2, bye.y + bye.height / 2);
        else await page.mouse.click(bye.x + bye.width / 2, bye.y + bye.height / 2);
        await expect(page.getByTestId(`${kind}-prompt`)).toBeHidden();
        await expect.poll(async () => (await read(page)).prompt).toBeNull();
        await expect.poll(async () => (await read(page)).navigation.locked, { message: "Bye releases navigation" }).toBe(false);
      });
    }
  });
}
