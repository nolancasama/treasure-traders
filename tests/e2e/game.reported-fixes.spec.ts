import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { DEFAULT_SETTINGS, startChapter } from "../../src/game/logic";
import type { ChapterId } from "../../src/game/content/ids";
import { read, settle, type GameRead } from "./game.helpers";

// Real pointer, touch and key input, with screenshots for visual review in .tmp/shots/verify.
// BASE_URL points this at the published site. Touch needs a touch-enabled context.
test.use({ hasTouch: true });

interface Hook {
  read(): GameRead;
  teleport(position: { x: number; z: number; yaw?: number }): void;
  projectPoint(point: { x: number; y: number; z: number }): { x: number; y: number; visible: boolean };
  readGates(): { cameraYaw: number; camera: { mode: string } };
  tts: { hold(value: boolean): void; isSpeaking(): boolean };
}
const hook = <T>(page: Page, fn: (h: Hook, arg: never) => T, arg?: unknown) => page.evaluate(
  ([source, value]) => (new Function("h", "a", `return (${source})(h, a)`))((window as unknown as { __tt: Hook }).__tt, value) as T,
  [fn.toString(), arg] as const
);
const VIEWPORTS = [{ width: 1366, height: 768 }, { width: 1280, height: 800 }];
const playable = (s: GameRead) => s.phase === "playing" && !s.busy && !s.prompt && !s.presentation.beat && !s.presentation.card && !s.presentation.tip && !s.presentation.screen && !s.navigation.locked;
const shot = async (page: Page, name: string) => {
  await mkdir(".tmp/shots/verify", { recursive: true });
  const { width, height } = page.viewportSize()!;
  await page.screenshot({ path: `.tmp/shots/verify/${name}-${width}x${height}.png` });
};
const settings = (seenTips: string[]) => ({ ...DEFAULT_SETTINGS, micFree: true, seenTips });

async function fromSave(page: Page, chapter: ChapterId, position: { x: number; z: number }) {
  const game = startChapter(chapter, { mode: "campaign", seed: 165939, campaignSeed: 101 });
  game.position = { ...position, yaw: Math.PI };
  await page.addInitScript(({ game, settings }) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("tt.save.v1", JSON.stringify(game));
    localStorage.setItem("tt.settings.v1", JSON.stringify(settings));
  }, { game, settings: settings(["intro", "moving", "mic", "asking"]) });
  await page.goto("/?e2e=1&coach=off");
  await page.getByTestId("title-continue").click();
  await settle(page, playable);
}

async function settleAt(page: Page, position: { x: number; z: number; yaw?: number }) {
  await hook(page, (h, p) => h.teleport(p), position);
  await page.waitForTimeout(1800);
}

/** Every line that reaches the screen, in order, observed from the DOM. */
async function recordLines(page: Page) {
  await page.evaluate(() => {
    const seen: string[] = [];
    Object.assign(window, { __lines: seen });
    const note = () => {
      const text = document.querySelector(".tt-dialogue-lines")?.textContent ?? "";
      if (text && seen.at(-1) !== text) seen.push(text);
    };
    new MutationObserver(note).observe(document.body, { childList: true, subtree: true, characterData: true });
    note();
  });
}
const lines = (page: Page) => page.evaluate(() => (window as unknown as { __lines: string[] }).__lines.length);
const beatText = async (page: Page) => (await read(page)).presentation.beat?.en ?? null;

test("Village Square looks along the bridge, in play and again after a conversation", async ({ page }) => {
  await fromSave(page, 1, { x: 0, z: 8 });
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    for (const at of [{ x: 0, z: 8 }, { x: 0, z: 15 }]) {
      await settleAt(page, at);
      expect(Math.abs((await hook(page, h => h.readGates())).cameraYaw), `yaw at ${JSON.stringify(at)}`).toBeLessThan(0.002);
    }
    // Both ends of the bridge's short edge land on the same screen row.
    const edge = await hook(page, h => [h.projectPoint({ x: -2.45, y: 0.12, z: 18 }), h.projectPoint({ x: 2.45, y: 0.12, z: 18 })]);
    expect(Math.abs(edge[0].y - edge[1].y), "short edge level on screen").toBeLessThan(1);
    expect(edge[1].x - edge[0].x).toBeGreaterThan(50);
    await shot(page, "1-square-bridge");
    await settleAt(page, { x: -10, z: 8 });
    const bench = await hook(page, h => [h.projectPoint({ x: -11.7, y: 0.42, z: 4.43 }), h.projectPoint({ x: -8.3, y: 0.42, z: 4.43 })]);
    expect(Math.abs(bench[0].y - bench[1].y), "bench level on screen").toBeLessThan(1);
    await shot(page, "1-square-bench");
  }
  // A real conversation hands the camera over; afterwards the view must return.
  await settleAt(page, { x: -10, z: 6.5 });
  await page.keyboard.press("e");
  await expect.poll(async () => (await hook(page, h => h.readGates())).camera.mode, { timeout: 15_000 }).toBe("conversation");
  await page.keyboard.press("Escape");
  await settle(page, playable);
  await page.waitForTimeout(1800);
  const after = await hook(page, h => h.readGates());
  expect(after.camera.mode).toBe("follow");
  expect(Math.abs(after.cameraYaw), "back to the square view after talking").toBeLessThan(0.002);
});

test("the view eases over the bridge, and the harbor keeps its own angle", async ({ page }) => {
  await fromSave(page, 4, { x: 0, z: 26 });
  await page.setViewportSize(VIEWPORTS[0]);
  await settleAt(page, { x: 0, z: 26 });
  expect(Math.abs((await hook(page, h => h.readGates())).cameraYaw), "on the deck").toBeLessThan(0.002);
  await settleAt(page, { x: 8, z: 41 });
  expect((await hook(page, h => h.readGates())).cameraYaw, "harbor").toBeCloseTo(Math.atan2(4, 11), 2);
});

test("Continue advances at once with speech running: touch, mouse and keys, one line per press", async ({ page }) => {
  await page.addInitScript(value => localStorage.setItem("tt.settings.v1", JSON.stringify(value)), settings([]));
  await page.goto("/?e2e=1&seed=101&coach=off");
  await page.setViewportSize(VIEWPORTS[0]);
  await page.waitForFunction(() => !!(window as unknown as { __tt?: Hook }).__tt);
  await hook(page, h => h.tts.hold(true)); // Speech never finishes by itself, so only the press can advance.
  await page.getByTestId("title-new").click();
  const button = page.getByTestId("dialogue-continue");
  await expect(button).toBeVisible({ timeout: 30_000 });
  await recordLines(page);
  await shot(page, "2-dialogue-before");
  const inputs: [string, () => Promise<unknown>][] = [
    ["touch", async () => { const b = (await button.boundingBox())!; await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); }],
    ["mouse", () => button.click()],
    ["Enter", () => page.keyboard.press("Enter")],
    ["Space", () => page.keyboard.press("Space")]
  ];
  for (const [name, press] of inputs) {
    const before = await beatText(page), count = await lines(page);
    expect(await hook(page, h => h.tts.isSpeaking()), `${name}: speech is running`).toBe(true);
    await press();
    await expect.poll(() => beatText(page), { message: `${name} advanced`, timeout: 1000, intervals: [20] }).not.toBe(before);
    await page.waitForTimeout(350);
    expect(await lines(page), `${name} moved exactly one line`).toBe(count + 1);
    if (name === "touch") await shot(page, "2-dialogue-after");
  }
});

test("a double tap and a held key move one line, and a next line is spoken", async ({ page }) => {
  await page.addInitScript(value => localStorage.setItem("tt.settings.v1", JSON.stringify(value)), settings([]));
  await page.goto("/?e2e=1&seed=101&coach=off");
  await page.setViewportSize(VIEWPORTS[1]);
  await page.waitForFunction(() => !!(window as unknown as { __tt?: Hook }).__tt);
  await hook(page, h => h.tts.hold(true));
  await page.getByTestId("title-new").click();
  const button = page.getByTestId("dialogue-continue");
  await expect(button).toBeVisible({ timeout: 30_000 });
  await recordLines(page);
  const b = (await button.boundingBox())!, count = await lines(page);
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(350);
  expect(await lines(page), "double tap").toBe(count + 1);
  expect(await hook(page, h => h.tts.isSpeaking()), "the next line is speaking").toBe(true);
  // Focus left on the Replay button by a click must not capture Space.
  await page.getByTestId("dialogue-replay").click();
  await page.waitForTimeout(350);
  const focused = await lines(page);
  await page.keyboard.press("Space");
  await page.waitForTimeout(350);
  expect(await lines(page), "Space after clicking Replay").toBe(focused + 1);
  const held = await lines(page);
  await page.keyboard.down("Enter");
  await page.keyboard.down("Enter"); // Auto-repeat.
  await page.keyboard.down("Enter");
  await page.keyboard.up("Enter");
  await page.waitForTimeout(350);
  expect(await lines(page), "held Enter").toBe(held + 1);
});

test("the library has one working doorway, from outside and inside", async ({ page }) => {
  await fromSave(page, 3, { x: -7, z: -40 });
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await settleAt(page, { x: -8, z: -40 });
    await shot(page, "3-library-outside");
    await settleAt(page, { x: -11, z: -41.9 });
    await shot(page, "3-library-threshold");
    await settleAt(page, { x: -15, z: -41 });
    await shot(page, "3-library-inside");
  }
  await page.setViewportSize(VIEWPORTS[0]);
  // Keyboard: in through the door, then back out.
  await settleAt(page, { x: -9, z: -42 });
  await page.keyboard.down("ArrowLeft");
  await expect.poll(async () => (await read(page)).position.x, { timeout: 20_000 }).toBeLessThan(-13);
  await page.keyboard.up("ArrowLeft");
  const inside = await read(page);
  expect(Math.abs(inside.position.z + 42), "walked straight through").toBeLessThan(0.6);
  await page.keyboard.down("ArrowRight");
  await expect.poll(async () => (await read(page)).position.x, { timeout: 20_000 }).toBeGreaterThan(-11);
  await page.keyboard.up("ArrowRight");
  // Keyboard: the wall beside the door stops the player.
  await settleAt(page, { x: -9.5, z: -39 });
  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(2500);
  await page.keyboard.up("ArrowLeft");
  expect((await read(page)).position.x, "solid wall").toBeGreaterThan(-11.8);
  // Tap to move: from the courtyard, through the door, to the room.
  await settleAt(page, { x: -9, z: -41.5 });
  const spot = await hook(page, h => h.projectPoint({ x: -14, y: 0.12, z: -41.5 }));
  expect(spot.visible).toBe(true);
  await page.touchscreen.tap(spot.x, spot.y);
  await expect.poll(async () => (await read(page)).position.x, { timeout: 20_000 }).toBeLessThan(-12.5);
});

test("Ctrl+Alt+D opens the debug menu, which unlocks chapters", async ({ page }) => {
  await page.addInitScript(value => localStorage.setItem("tt.settings.v1", JSON.stringify(value)), settings(["intro", "moving", "mic", "asking"]));
  await page.goto("/?e2e=1&seed=101&coach=off");
  await page.setViewportSize(VIEWPORTS[0]);
  await expect(page.getByTestId("title-screen")).toBeVisible();
  await page.keyboard.press("Control+Alt+KeyD");
  await expect(page.getByTestId("debug-menu")).toBeVisible();
  await shot(page, "4-debug-menu");
  await page.keyboard.press("Control+Alt+KeyD");
  await expect(page.getByTestId("debug-menu")).toBeHidden();
  await expect(page.getByTestId("title-screen")).toBeVisible();
  await page.keyboard.press("Control+Alt+KeyD");
  await page.getByTestId("debug-chapter-4").click();
  await page.getByTestId("title-continue").click();
  await settle(page, playable);
  let state = await read(page);
  expect(state.chapter).toBe(4);
  expect(state.game!.completedChapters).toEqual([1, 2, 3]);
  expect(state.game!.unlockedAreas).toContain("harbor");
  // It also opens during play, and survives into Chapter Select.
  await page.keyboard.press("Control+Alt+KeyD");
  await expect(page.getByTestId("debug-menu")).toBeVisible();
  await page.getByTestId("debug-unlock-all").click();
  await page.getByTestId("title-chapters").click();
  for (const id of [1, 2, 3, 4, 5]) await expect(page.getByTestId(`chapter-${id}`)).toBeEnabled();
  await page.getByTestId("chapter-5").click();
  await page.waitForFunction(() => (window as unknown as { __tt: Hook }).__tt.read().chapter === 5, undefined, { timeout: 30_000 });
  state = await read(page);
  expect(state.game!.mode).toBe("replay");
});
