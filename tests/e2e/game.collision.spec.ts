import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_SETTINGS, startChapter } from "../../src/game/logic";
import type { ChapterId } from "../../src/game/content/ids";
import type { Interaction } from "../../src/game/world/types";
import { read, settle, type GameRead } from "./game.helpers";

// Real keyboard and tap input against the rendered world. A chapter checkpoint only
// chooses where the walk starts; the teleport and setGate controls exist under ?e2e=1.
interface WorldHook {
  read(): GameRead;
  teleport(position: { x: number; z: number; yaw?: number }): void;
  setGate(id: string, open: boolean): void;
  projectPoint(point: { x: number; y: number; z: number }): { x: number; y: number; visible: boolean };
  project(target: Interaction): { x: number; y: number; visible: boolean } | null;
  readGates(): { progress: Record<string, number> | null; open: Record<string, boolean>; cameraYaw: number; manualInputYaw: number | null };
}
type HookWindow = Window & { __tt: WorldHook };

const playable = (s: GameRead) => s.phase === "playing" && !s.busy && !s.prompt && !s.presentation.beat && !s.presentation.card && !s.presentation.tip && !s.presentation.screen && !s.navigation.locked;

async function start(page: Page, chapter: ChapterId, position: { x: number; z: number }) {
  const game = startChapter(chapter, { mode: "campaign", seed: 165939, campaignSeed: 101 });
  game.position = { ...position, yaw: Math.PI };
  await page.addInitScript(({ game, settings }) => {
    localStorage.setItem("tt.save.v1", JSON.stringify(game));
    localStorage.setItem("tt.settings.v1", JSON.stringify(settings));
  }, { game, settings: { ...DEFAULT_SETTINGS, micFree: true, seenTips: ["intro", "moving", "mic", "asking"] } });
  await page.goto("/?e2e=1&coach=off");
  await page.getByTestId("title-continue").click();
  await settle(page, playable);
}

const teleport = async (page: Page, position: { x: number; z: number; yaw?: number }) => {
  await page.evaluate(p => (window as unknown as HookWindow).__tt.teleport(p), position);
  await settleCamera(page);
};

/** Waits for the follow camera to stop easing, so a projected tap lands where it was aimed. */
async function settleCamera(page: Page) {
  await page.evaluate(async () => {
    const hook = (window as unknown as HookWindow).__tt;
    const at = () => { const p = hook.read().position; return hook.projectPoint({ x: p.x, y: p.y, z: p.z }); };
    let last = at(), still = 0;
    const deadline = performance.now() + 15_000;
    while (still < 4 && performance.now() < deadline) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const now = at();
      still = Math.hypot(now.x - last.x, now.y - last.y) < 0.5 ? still + 1 : 0;
      last = now;
    }
  });
}

interface Sample { x: number; y: number; z: number }

/** Holds real arrow keys toward a point and records every position it passes through. */
async function keyboardToward(page: Page, target: { x: number; z: number }, ms: number): Promise<Sample[]> {
  const samples: Sample[] = [];
  let held: string[] = [];
  const end = Date.now() + ms;
  try {
    while (Date.now() < end) {
      const [s, yaw] = await page.evaluate(() => {
        const hook = (window as unknown as HookWindow).__tt;
        const camera = hook.readGates();
        return [hook.read().position, camera.manualInputYaw ?? camera.cameraYaw] as const;
      });
      samples.push({ x: s.x, y: s.y, z: s.z });
      const dx = target.x - s.x, dz = target.z - s.z;
      if (Math.hypot(dx, dz) < 0.3) break;
      const x = dx * Math.cos(yaw) - dz * Math.sin(yaw), y = -dx * Math.sin(yaw) - dz * Math.cos(yaw);
      const size = Math.hypot(x, y);
      const wanted = [
        ...(Math.abs(x) / size > 0.38 ? [x > 0 ? "ArrowRight" : "ArrowLeft"] : []),
        ...(Math.abs(y) / size > 0.38 ? [y > 0 ? "ArrowUp" : "ArrowDown"] : [])
      ];
      for (const key of held.filter(k => !wanted.includes(k))) await page.keyboard.up(key);
      for (const key of wanted.filter(k => !held.includes(k))) await page.keyboard.down(key);
      held = wanted;
      await page.waitForTimeout(60);
    }
  } finally {
    for (const key of held) await page.keyboard.up(key);
  }
  const last = (await read(page)).position;
  samples.push({ x: last.x, y: last.y, z: last.z });
  return samples;
}

/** Taps the ground through the real canvas and records the walk until it stops. */
async function tapGround(page: Page, at: { x: number; y?: number; z: number }, ms = 30_000): Promise<Sample[]> {
  await settleCamera(page);
  const point = await page.evaluate(p => (window as unknown as HookWindow).__tt.projectPoint(p), { x: at.x, y: at.y ?? 0, z: at.z });
  expect(point.visible && point.y < 640, `tap target ${JSON.stringify(at)} is on the canvas, clear of the backpack bar: ${JSON.stringify(point)}`).toBe(true);
  await page.mouse.click(point.x, point.y);
  const samples: Sample[] = [];
  const end = Date.now() + ms;
  let idle = 0;
  while (Date.now() < end && idle < 6) {
    const s = await read(page);
    samples.push({ x: s.position.x, y: s.position.y, z: s.position.z });
    idle = s.navigation.path.length ? 0 : idle + 1;
    await page.waitForTimeout(60);
  }
  return samples;
}

test.describe("collision with real input", () => {
  test.setTimeout(180_000);

  test("raised bridge stops keyboard and tap at the hinge", async ({ page }) => {
    await start(page, 1, { x: 0, z: 12 });
    for (const sample of await keyboardToward(page, { x: 0, z: 24 }, 7_000)) expect(sample.z, "keyboard stays north of the raised leaf").toBeLessThan(16.95);
    expect((await read(page)).position.z, "and it did reach the barrier").toBeGreaterThan(16.5);
    await teleport(page, { x: 0, z: 15 });
    for (const sample of await tapGround(page, { x: 0, z: 17.8 })) expect(sample.z, "tap beyond the hinge stays north of it").toBeLessThan(16.95);
    for (const x of [-2, 2]) {
      await teleport(page, { x, z: 14 });
      for (const sample of await keyboardToward(page, { x, z: 22 }, 4_000)) expect(sample.z, `keyboard along x=${x}`).toBeLessThan(16.95);
    }
  });

  test("a lowering bridge stays blocked until it has finished, then crosses cleanly", async ({ page }) => {
    await start(page, 1, { x: 0, z: 15 });
    await page.evaluate(() => (window as unknown as HookWindow).__tt.setGate("bridge", true));
    const samples: { p: number; z: number }[] = [];
    let crossed = false, held: string[] = [];
    const end = Date.now() + 60_000;
    try {
      while (Date.now() < end && !crossed) {
        const r = await page.evaluate(() => {
          const hook = (window as unknown as HookWindow).__tt;
          return { p: hook.readGates().progress!.bridge, z: hook.read().position.z, x: hook.read().position.x, yaw: hook.readGates().cameraYaw };
        });
        samples.push({ p: r.p, z: r.z });
        crossed = r.z > 25;
        const dx = 0 - r.x, dz = 27 - r.z, x = dx * Math.cos(r.yaw) - dz * Math.sin(r.yaw), y = -dx * Math.sin(r.yaw) - dz * Math.cos(r.yaw), size = Math.hypot(x, y);
        const wanted = [...(Math.abs(x) / size > 0.38 ? [x > 0 ? "ArrowRight" : "ArrowLeft"] : []), ...(Math.abs(y) / size > 0.38 ? [y > 0 ? "ArrowUp" : "ArrowDown"] : [])];
        for (const key of held.filter(k => !wanted.includes(k))) await page.keyboard.up(key);
        for (const key of wanted.filter(k => !held.includes(k))) await page.keyboard.down(key);
        held = wanted;
        await page.waitForTimeout(30);
      }
    } finally { for (const key of held) await page.keyboard.up(key); }
    const moving = samples.filter(s => s.p < 1);
    expect(moving.length, "observed frames while the bridge was moving").toBeGreaterThan(2);
    for (const s of moving) expect(s.z, `blocked at progress ${s.p}`).toBeLessThan(16.95);
    expect(crossed, "crosses after it settles").toBe(true);
  });

  test("lowered bridge crosses by keyboard and tap without catching at either end", async ({ page }) => {
    await start(page, 4, { x: 0, z: 14 });
    await keyboardToward(page, { x: 0, z: 33 }, 30_000);
    expect((await read(page)).position.z, "keyboard crossing south").toBeGreaterThan(32);
    await keyboardToward(page, { x: 0, z: 14 }, 30_000);
    expect((await read(page)).position.z, "keyboard crossing north").toBeLessThan(15);
    // South, toward the camera, in short taps that stay above the backpack bar.
    for (const z of [16.5, 19, 21.5, 24, 26.5, 29, 31.5]) {
      await tapGround(page, { x: 0, y: z > 17.2 && z < 30.8 ? 0.12 : 0, z });
      expect((await read(page)).position.z, `tap south to z=${z}`).toBeGreaterThan(z - 0.5);
    }
    // North in long taps, the direction the view opens up.
    for (const z of [26, 20, 15]) {
      await tapGround(page, { x: 0, y: z > 17.2 ? 0.12 : 0, z });
      expect((await read(page)).position.z, `tap north to z=${z}`).toBeLessThan(z + 0.5);
    }
  });

  test("the harbor chest blocks walking, stays reachable by tap and by E, and traps nobody", async ({ page }) => {
    const inside = (s: Sample) => Math.abs(s.x - 10) < 0.66 + 0.33 && Math.abs(s.z - 36.02) < 0.43 + 0.33;
    await start(page, 4, { x: 10, z: 33.5 });
    for (const sample of await keyboardToward(page, { x: 10, z: 39 }, 9_000)) expect(inside(sample), `keyboard ${JSON.stringify(sample)}`).toBe(false);
    await teleport(page, { x: 10, z: 38.5 });
    for (const sample of await tapGround(page, { x: 10, z: 33 })) expect(inside(sample), `tap ${JSON.stringify(sample)}`).toBe(false);
    const around = (await read(page)).position;
    expect(Math.hypot(around.x - 10, around.z - 33), "tap walked around to the far side").toBeLessThan(0.6);

    // E from the south side, not facing the chest.
    await teleport(page, { x: 9.2, z: 37.2, yaw: Math.PI });
    await settle(page, s => s.focus?.kind === "seaChest");
    await page.keyboard.press("e");
    await settle(page, s => s.busy || !!s.prompt || !!s.presentation.beat);
    await settle(page, playable);

    // A tap from a distance walks over and starts the same interaction.
    await teleport(page, { x: 7, z: 40 });
    const chest = await page.evaluate(() => (window as unknown as HookWindow).__tt.project({ kind: "seaChest" }));
    await page.mouse.click(chest!.x, chest!.y);
    await settle(page, s => s.busy || !!s.prompt || !!s.presentation.beat);
    await settle(page, playable);

    await keyboardToward(page, { x: 8, z: 44 }, 12_000);
    expect((await read(page)).position.z, "pier beyond the chest is still walkable").toBeGreaterThan(43);
  });

  test("the stage steps carry the player up and down; the stage front is solid", async ({ page }) => {
    await start(page, 5, { x: -55, z: 0 });
    let path = await keyboardToward(page, { x: -59.2, z: 0 }, 15_000);
    const peak = Math.max(...path.map(s => s.y));
    expect(peak, "keyboard climbs").toBeGreaterThan(0.4);
    expect(path.some(s => s.y > 0.05 && s.y < 0.55), "height changes along the way").toBe(true);
    await expect.poll(async () => (await read(page)).position.y).toBeGreaterThan(0.55);
    path = await keyboardToward(page, { x: -55, z: 0 }, 15_000);
    await expect.poll(async () => (await read(page)).position.y, { message: "keyboard back down to the ground" }).toBeLessThan(0.02);

    await teleport(page, { x: -56, z: -3.4 });
    for (const sample of await keyboardToward(page, { x: -62, z: -3.4 }, 6_000)) {
      expect(sample.x, "the stage front stops the player").toBeGreaterThan(-58.75);
      expect(sample.y, "and it does not climb the front").toBeLessThan(0.05);
    }

    await teleport(page, { x: -56, z: 0 });
    await tapGround(page, { x: -60.5, y: 0.62, z: -3 });
    await expect.poll(async () => (await read(page)).position.y, { message: "tap walks up onto the stage" }).toBeGreaterThan(0.55);
    await tapGround(page, { x: -55.5, z: -2.5 });
    await expect.poll(async () => (await read(page)).position.y, { message: "tap walks back down" }).toBeLessThan(0.02);
  });

  test("E works in range whichever way the player faces, never at a distance, never during dialogue", async ({ page }) => {
    await start(page, 1, { x: 0, z: 10 });
    await page.keyboard.press("e");
    await page.waitForTimeout(300);
    expect((await read(page)).busy, "nothing in range").toBe(false);

    await teleport(page, { x: 2.6, z: -6.2, yaw: 0 });
    await settle(page, s => s.focus?.kind === "npc" && s.focus.id === "pom");
    // Three quick presses open one conversation.
    await page.keyboard.press("e"); await page.keyboard.press("e"); await page.keyboard.press("e");
    const open = await settle(page, s => !!s.prompt || !!s.presentation.beat || s.busy);
    const where = open.position;
    const canvas = await page.locator("canvas").first().boundingBox();
    await page.mouse.click(canvas!.x + canvas!.width / 2, canvas!.y + 120);
    await page.waitForTimeout(400);
    const after = await read(page);
    expect(Math.hypot(after.position.x - where.x, after.position.z - where.z), "a tap during dialogue does not walk").toBeLessThan(0.05);
  });
});
