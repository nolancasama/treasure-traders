import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { DEFAULT_SETTINGS, startChapter } from "../../src/game/logic";
import type { ChapterId } from "../../src/game/content/ids";
import { acknowledge, play, read, settle, type GameRead } from "./game.helpers";

// Real campaign play to the real unlock, with frames taken during the motion itself.
interface Sample { t: number; p: number; open: boolean; displacement: number | null; wheel: number | null; card: string | null; mode: string }
interface Hook {
  read(): GameRead;
  readGates(): { progress: Record<string, number> | null; open: Record<string, boolean>; school: { displacement: number; wheelRotation: number; wheelRadius: number } | null; camera: { mode: string } };
}
type HookWindow = Window & { __tt: Hook; __samples: Sample[] };

const playable = (s: GameRead) => s.phase === "playing" && !s.busy && !s.prompt && !s.presentation.beat && !s.presentation.card && !s.presentation.tip && !s.presentation.screen && !s.navigation.locked;
const progress = (page: Page, id: string) => page.evaluate(id => (window as unknown as HookWindow).__tt.readGates().progress?.[id] ?? 0, id);

async function fromSave(page: Page, chapter: ChapterId) {
  const game = startChapter(chapter, { mode: "campaign", campaignSeed: 101, seed: 165939 });
  game.position = { x: 0, z: 8, yaw: Math.PI };
  await page.addInitScript(({ game, settings }) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("tt.save.v1", JSON.stringify(game));
    localStorage.setItem("tt.settings.v1", JSON.stringify(settings));
  }, { game, settings: { ...DEFAULT_SETTINGS, micFree: true, seenTips: ["intro", "moving", "mic", "asking"] } });
  await page.goto("./?e2e=1&coach=off");
  await page.getByTestId("title-continue").click();
  await settle(page, playable);
}

const CASES = [
  { name: "school", chapter: 2 as ChapterId, gate: "school", beyond: { x: 0, z: -27 } },
  { name: "bridge", chapter: 3 as ChapterId, gate: "bridge", beyond: { x: 0, z: 31 } }
];

for (const viewport of [{ width: 1366, height: 768 }, { width: 1280, height: 800 }]) for (const c of CASES) {
  test(`${c.name} unlock plays on camera at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    test.setTimeout(12 * 60_000);
    await page.setViewportSize(viewport);
    const dir = `.tmp/shots/unlock/${viewport.width}x${viewport.height}`;
    await mkdir(dir, { recursive: true });
    await fromSave(page, c.chapter);
    expect(await progress(page, c.gate), "starts closed").toBe(0);

    // Real play up to the clear card; the gate must not move behind it.
    await play(page, { until: s => s.presentation.card?.kind === "chapter-clear" });
    await page.waitForTimeout(500);
    expect(await progress(page, c.gate), "still closed behind the clear card").toBe(0);

    await page.evaluate(gate => {
      const w = window as unknown as HookWindow, samples: Sample[] = [];
      w.__samples = samples;
      const tick = () => {
        const g = w.__tt.readGates(), r = w.__tt.read();
        samples.push({ t: performance.now(), p: g.progress?.[gate] ?? 0, open: g.open[gate], displacement: g.school?.displacement ?? null, wheel: g.school?.wheelRotation ?? null, card: r.presentation.card?.kind ?? null, mode: g.camera.mode });
        if (samples.length < 20_000 && !(samples.at(-1)!.card === "new-area")) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, c.gate);
    await page.getByTestId("card-chapter-clear-continue").click();

    // Frames through the motion: closed, then at each stage as it is reached.
    await expect.poll(async () => (await page.evaluate(() => (window as unknown as HookWindow).__tt.readGates().camera.mode)), { timeout: 15_000 }).toBe("path");
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${dir}/${c.name}-1-closed.png` });
    for (const [label, at] of [["2-early", 0.15], ["3-middle", 0.5], ["4-late", 0.85]] as const) {
      await expect.poll(() => progress(page, c.gate), { timeout: 60_000, intervals: [30] }).toBeGreaterThan(at);
      await page.screenshot({ path: `${dir}/${c.name}-${label}.png` });
    }
    await expect.poll(() => progress(page, c.gate), { timeout: 60_000, intervals: [30] }).toBe(1);
    await page.screenshot({ path: `${dir}/${c.name}-5-open.png` });
    await expect(page.getByTestId("card-new-area-continue")).toBeVisible({ timeout: 30_000 });

    const samples = await page.evaluate(() => (window as unknown as HookWindow).__samples);
    const moving = samples.filter(s => s.p > 0 && s.p < 1);
    expect(moving.length, "seen moving through many frames").toBeGreaterThan(8);
    const first = moving[0], last = moving.at(-1)!;
    console.log(`UNLOCK ${c.name} ${viewport.width}x${viewport.height}: ${Math.round(last.t - first.t)}ms over ${moving.length} frames`);
    expect(last.t - first.t, "deliberate length").toBeGreaterThan(2000);
    for (let i = 1; i < samples.length; i++) expect(samples[i].p, "never moves backward").toBeGreaterThanOrEqual(samples[i - 1].p);
    for (const s of moving) {
      expect(s.open, "blocked while it moves").toBe(false);
      expect(s.card, "no card covers the motion").toBeNull();
      expect(s.mode, "the unlock shot holds through the motion").toBe("path");
    }
    if (c.gate === "school") {
      // It rolls: the wheels turn exactly as far as the panel travels, with no slip.
      const at = moving[Math.floor(moving.length / 2)];
      expect(at.displacement!).toBeGreaterThan(0);
      expect(Math.abs(at.wheel!) * 0.25).toBeCloseTo(at.displacement!, 5);
    }

    // Afterward: back to normal play, and through on foot by real input.
    await page.getByTestId("card-new-area-continue").click();
    let state = await read(page);
    const until = Date.now() + 90_000;
    while (!playable(state) && Date.now() < until) { if (!await acknowledge(page, state)) await page.waitForTimeout(100); state = await read(page); }
    expect(playable(state), "the next chapter becomes playable").toBe(true);
    await page.evaluate(() => (window as unknown as { __tt: { teleport(p: { x: number; z: number }): void } }).__tt.teleport({ x: 0, z: 0 }));
    expect(await progress(page, c.gate), "stays open").toBe(1);
    expect(await page.evaluate(gate => (window as unknown as HookWindow).__tt.readGates().open[gate], c.gate), "navigation agrees").toBe(true);
    await page.evaluate(() => (window as unknown as { __tt: { teleport(p: { x: number; z: number }): void } }).__tt.teleport({ x: 0, z: 14 }));
    if (c.gate === "school") await page.evaluate(() => (window as unknown as { __tt: { teleport(p: { x: number; z: number }): void } }).__tt.teleport({ x: 0, z: -16 }));
    await page.waitForTimeout(1500);
    await page.keyboard.down(c.gate === "school" ? "ArrowUp" : "ArrowDown");
    await expect.poll(async () => (await read(page)).position.z, { timeout: 40_000 })[c.gate === "school" ? "toBeLessThan" : "toBeGreaterThan"](c.beyond.z);
    await page.keyboard.up(c.gate === "school" ? "ArrowUp" : "ArrowDown");
    await page.screenshot({ path: `${dir}/${c.name}-6-through.png` });
  });
}
