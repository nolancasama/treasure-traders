import { expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import type { GameState, Prompt } from "../../src/game/logic";
import type { Intent } from "../../src/game/logic/plan";
import type { Interaction } from "../../src/game/world";
import type { SpeechSnapshot } from "../../src/audio/speech";
import type { Presentation } from "../../src/ui";

export interface GameRead {
  game: GameState | null;
  chapter: number;
  position: { x: number; y: number; z: number; yaw: number };
  focus: Interaction | null;
  prompt: Prompt;
  speech: SpeechSnapshot;
  presentation: Pick<Presentation, "beat" | "card" | "tip" | "screen" | "bagCheck">;
  busy: boolean;
  phase: string;
  renderer: { calls: number; triangles: number; dpr: number } | null;
  intents: Intent[];
  navigation: { path: { x: number; z: number }[]; pending: Interaction | null; locked: boolean };
}
interface TestHook {
  read(): GameRead;
  intent(intent: Intent): boolean;
  project(target: Interaction): { x: number; y: number; visible: boolean } | null;
  speech(event: { kind: "text"; text: string; interim?: boolean } | { kind: "unavailable" | "transient" | "fallbackSuggested" }): void;
}
type TestWindow = Window & { __tt: TestHook };
// After a reload the hook installs only once the Canvas has mounted, which can
// trail the title screen under SwiftShader.
export const read = async (page: Page) => {
  await page.waitForFunction(() => !!(window as unknown as Partial<TestWindow>).__tt);
  return page.evaluate(() => (window as unknown as TestWindow).__tt.read());
};
export const speech = (page: Page, event: Parameters<TestHook["speech"]>[0]) => page.evaluate(value => (window as unknown as TestWindow).__tt.speech(value), event);
export const shot = async (page: Page, name: string) => {
  await mkdir(".tmp/shots/game", { recursive: true });
  await page.screenshot({ path: `.tmp/shots/game/${name}.png` });
};

export async function openGame(page: Page, micFree = true) {
  await page.goto("/?e2e=1&seed=101&coach=off");
  await expect(page.getByTestId("title-screen")).toBeVisible();
  await page.getByTestId("title-mic-free").setChecked(micFree);
  await page.getByTestId("title-new").click();
}

/** These are real acknowledgement buttons; the hook never advances a flow. */
export async function acknowledge(page: Page, supplied?: GameRead): Promise<boolean> {
  const state = supplied ?? await read(page);
  if (state.presentation.tip) {
    await page.getByTestId(`tip-${state.presentation.tip}-dismiss`).click();
    return true;
  }
  if (state.presentation.card) {
    await page.getByTestId(`card-${state.presentation.card.kind}-continue`).click();
    return true;
  }
  if (state.presentation.screen === "backpack") {
    await page.getByTestId("backpack-panel-close").click();
    return true;
  }
  if (state.presentation.beat) {
    await page.getByTestId("dialogue-continue").click();
    // Allow the awaited continuation to publish the next line.
    await page.waitForTimeout(30);
    return true;
  }
  return false;
}

export async function settle(page: Page, until: (state: GameRead) => boolean, limit = 45_000): Promise<GameRead> {
  let end = Date.now() + limit;
  while (Date.now() < end) {
    const state = await read(page);
    if (until(state)) return state;
    // Each acknowledged line/card is progress. Slow SwiftShader rendering can
    // make a multi-line sequence exceed one idle timeout despite advancing.
    if (await acknowledge(page, state)) end = Date.now() + limit;
    else await page.waitForTimeout(75);
  }
  throw new Error(`Game did not settle: ${JSON.stringify(await read(page))}`);
}

const targetOf = (intent: Intent): Interaction => intent.kind === "collect" ? { kind: "spot", id: intent.spot } : intent.target === "seaChest" ? { kind: "seaChest" } : { kind: "npc", id: intent.target };

/** Screen clicks when the target is visible; path planning is only for offscreen walks. */
export async function approach(page: Page, intent: Intent, touch = false) {
  const target = targetOf(intent);
  // A pickup/conversation can unlock input while its camera is still easing.
  // Sample rendered frames so a projected NPC click cannot turn into a ground
  // click between projection and pointer-down. Keep the real click/tap path.
  const point = await page.evaluate(async value => {
    const hook = (window as unknown as TestWindow).__tt;
    let previous = hook.project(value), stableFrames = 0;
    const deadline = performance.now() + 10_000;
    while (performance.now() < deadline && stableFrames < 4) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const current = hook.project(value);
      if (!current || !current.visible) return current;
      stableFrames = previous && Math.hypot(current.x - previous.x, current.y - previous.y) < 0.5 ? stableFrames + 1 : 0;
      previous = current;
    }
    if (stableFrames < 4 && previous?.visible) throw new Error(`Target projection did not settle: ${JSON.stringify(value)}`);
    return previous;
  }, target);
  if (point?.visible && point.x > 30 && point.y > 150 && point.x < 1336 && point.y < 560) {
    if (touch) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
    return touch ? 'touch' : 'click';
  } else {
    expect(await page.evaluate(value => (window as unknown as TestWindow).__tt.intent(value), intent), `walk to ${JSON.stringify(intent)}`).not.toBe(false);
    return 'intent';
  }
}

export async function startListening(page: Page) {
  await expect(page.getByTestId("prompt-mic")).toBeEnabled();
  await page.getByTestId("prompt-mic").click();
  await expect.poll(async () => (await read(page)).speech.listening).toBe(true);
}

export async function respond(page: Page, state: GameRead, mode: "buttons" | "speech") {
  const prompt = state.prompt;
  if (!prompt || !state.game) return;
  let value: string;
  if (prompt.kind === "answer") value = (state.game.holdings.player?.[prompt.item] ?? 0) >= prompt.count ? "yes" : "no";
  else {
    const desired = state.intents.find((intent): intent is Extract<Intent, { kind: "ask" }> => {
      if (intent.kind !== "ask" || intent.target !== prompt.target) return false;
      if (intent.target === "seaChest") {
        const index = state.game!.instance.seaChest?.indexOf(intent.item) ?? -1;
        return index >= 0 && !state.game!.flags[`seaLock${index}`];
      }
      return true;
    });
    if (!desired) { await page.getByTestId("prompt-bye").click(); return; }
    value = desired.item;
  }
  if (mode === "buttons" || state.speech.micFree || state.speech.choicesEnabled) {
    await page.getByTestId(`${prompt.kind}-choice-${value}`).click();
  } else {
    await startListening(page);
    const item = value === "pencilCase" ? "pencil case" : value;
    const text = prompt.kind === "answer" ? value === "yes" ? "Yes, I do." : "No, I don't." : `Do you have ${value === "eraser" ? "an" : "a"} ${item}?`;
    await speech(page, { kind: "text", text });
  }
}

export interface PlayOptions {
  mode?: "buttons" | "speech";
  until?: (state: GameRead) => boolean;
  observe?: (state: GameRead) => Promise<void>;
}
/** The solver supplies destinations/questions; every rule transition uses real UI input. */
export async function play(page: Page, options: PlayOptions = {}): Promise<GameRead> {
  let navigatingAt = 0;
  let previousMaterial = "";
  const end = Date.now() + 14 * 60_000;
  while (Date.now() < end) {
    const state = await read(page);
    await options.observe?.(state);
    if (options.until?.(state) || state.presentation.screen === "results" || state.phase === "roam" || state.phase === "free-roam") return state;
    if (await acknowledge(page, state)) { navigatingAt = 0; continue; }
    if (state.prompt) { await respond(page, state, options.mode ?? "buttons"); navigatingAt = 0; continue; }
    if (state.busy || state.presentation.screen || state.phase !== "playing") { await page.waitForTimeout(80); continue; }
    const material = JSON.stringify([state.game?.chapter, state.game?.holdings, state.game?.flags, state.game?.once]);
    if (material !== previousMaterial) { previousMaterial = material; navigatingAt = 0; }
    if (!navigatingAt) {
      const intent = state.intents[0];
      if (!intent) { await page.waitForTimeout(100); continue; }
      await approach(page, intent);
      navigatingAt = Date.now();
    } else if (Date.now() - navigatingAt > 30_000) {
      throw new Error(`Walk did not reach an interaction: ${JSON.stringify(state)}`);
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`Campaign exceeded time budget: ${JSON.stringify(await read(page))}`);
}

export function districtOf(state: GameRead): string | null {
  const { x, z } = state.position;
  if (x > 25) return "market";
  if (z < -29) return "school";
  if (z > 29) return "harbor";
  if (x < -33) return "festival";
  if (Math.abs(x) < 15 && Math.abs(z) < 15) return "square";
  return null;
}

export async function probe(page: Page, district: string, state: GameRead) {
  expect(state.renderer, `renderer.info in ${district}`).not.toBeNull();
  expect(state.renderer!.calls).toBeGreaterThan(0);
  expect(state.renderer!.calls, `${district} draw calls`).toBeLessThanOrEqual(120);
  expect(state.renderer!.triangles, `${district} triangles`).toBeLessThanOrEqual(120_000);
  expect(state.renderer!.dpr).toBeLessThanOrEqual(1.5);
  await mkdir(".tmp/shots/game", { recursive: true });
  await writeFile(`.tmp/shots/game/renderer-${district}.json`, JSON.stringify({ district, position: state.position, ...state.renderer }, null, 2));
  await shot(page, `district-${district}-1366x768`);
}
