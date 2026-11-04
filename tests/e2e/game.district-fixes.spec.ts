import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { DEFAULT_SETTINGS, startChapter } from "../../src/game/logic";
import type { ChapterId } from "../../src/game/content/ids";
import { NPC_HOMES, chestPose } from "../../src/game/world/layout";
import { followOffset, followYaw } from "../../src/scene/cameraRig";
import { play, read, settle, type GameRead } from "./game.helpers";

interface Point { x: number; z: number }
interface Sample extends Point { yaw: number; latch: number | null }
interface Hook {
  read(): GameRead;
  teleport(at: Point): void;
  projectPoint(at: Point & { y: number }): { x: number; y: number; visible: boolean };
  readGates(): { cameraYaw: number; manualInputYaw: number | null; camera: { mode: string } };
  readScenery(): { cameraPosition: Point & { y: number }; finale: string; lidAngle: number | null; walkable: boolean };
  previewChest(open: boolean): boolean;
}
type TestWindow = Window & { __tt: Hook; __districtTrace?: { active: boolean; samples: Sample[] } };
const hook = <T>(page: Page, fn: (h: Hook, arg: never) => T, arg?: unknown) => page.evaluate(
  ([source, value]) => (new Function("h", "a", `return (${source})(h, a)`))((window as unknown as TestWindow).__tt, value) as T,
  [fn.toString(), arg] as const
);
const playable = (s: GameRead) => s.phase === "playing" && !s.busy && !s.prompt && !s.presentation.beat && !s.presentation.card && !s.presentation.tip && !s.presentation.screen && !s.navigation.locked;
const settings = { ...DEFAULT_SETTINGS, micFree: true, seenTips: ["intro", "moving", "mic", "asking"] };
async function precondition(name: string, work: () => Promise<unknown>) {
  try { await work(); } catch (error) { throw new Error(`HARNESS_PRECONDITION_FAILED: ${name}`, { cause: error }); }
}

async function start(page: Page, chapter: ChapterId, position: Point) {
  const game = startChapter(chapter, { mode: "campaign", seed: 165939, campaignSeed: 101 });
  game.position = { ...position, yaw: 0 };
  await page.addInitScript(({ game, settings }) => {
    localStorage.setItem("tt.save.v1", JSON.stringify(game));
    localStorage.setItem("tt.settings.v1", JSON.stringify(settings));
  }, { game, settings });
  await page.goto("./?e2e=1&coach=off");
  await precondition(`Continue Chapter ${chapter}`, async () => {
    await page.getByTestId("title-continue").click();
    await settle(page, playable);
  });
}

async function at(page: Page, point: Point) {
  await hook(page, (h, p) => h.teleport(p), point);
  const offset = followOffset(point);
  await precondition(`settled district view ${JSON.stringify(point)}`, async () => {
    await expect.poll(async () => {
      const s = await hook(page, h => ({ p: h.read().position, c: h.readScenery().cameraPosition, gate: h.readGates() }));
      return s.gate.camera.mode === "follow" ? Math.max(
        Math.hypot(s.p.x - point.x, s.p.z - point.z),
        Math.hypot(s.c.x - s.p.x - offset.x, s.c.y - s.p.y - offset.y, s.c.z - s.p.z - offset.z),
        Math.abs(s.gate.cameraYaw - followYaw(point))
      ) : Infinity;
    }, { timeout: 25_000 }).toBeLessThan(0.025);
    expect(await hook(page, h => h.readScenery().walkable)).toBe(true);
  });
}

async function shot(page: Page, name: string) {
  await precondition(`rendered ${name}`, async () => {
    await expect.poll(async () => (await read(page)).renderer?.calls ?? 0).toBeGreaterThan(0);
    expect(await hook(page, h => {
      const p = h.read().position;
      return [0.1, 1.6].every(y => h.projectPoint({ ...p, y: p.y + y }).visible);
    })).toBe(true);
  });
  await mkdir(".tmp/shots/district", { recursive: true });
  const { width, height } = page.viewportSize()!;
  await page.screenshot({ path: `.tmp/shots/district/${name}-${width}x${height}.png` });
}

async function trace(page: Page, key: string, reached: (s: GameRead) => boolean) {
  await page.evaluate(() => {
    const w = window as unknown as TestWindow;
    const record = { active: true, samples: [] as Sample[] };
    w.__districtTrace = record;
    const sample = () => {
      const p = w.__tt.read().position, c = w.__tt.readGates();
      record.samples.push({ x: p.x, z: p.z, yaw: c.cameraYaw, latch: c.manualInputYaw });
      if (record.active) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.keyboard.down(key);
  try {
    await precondition(`real ${key} reaches movement checkpoint`, async () => {
      await expect.poll(async () => reached(await read(page)), { timeout: 20_000 }).toBe(true);
    });
  } finally {
    await page.keyboard.up(key);
    await page.evaluate(() => { (window as unknown as TestWindow).__districtTrace!.active = false; });
  }
  await precondition("manual input released", async () => {
    await expect.poll(() => hook(page, h => h.readGates().manualInputYaw)).toBeNull();
  });
  return page.evaluate(() => (window as unknown as TestWindow).__districtTrace!.samples);
}

async function tapTo(page: Page, target: Point & { y?: number }) {
  const p = await hook(page, (h, at: Point & { y: number }) => h.projectPoint(at), { ...target, y: target.y ?? 0 });
  await precondition("ground tap lies on canvas above the backpack", async () => {
    expect(p.visible && p.y > 0 && p.y < page.viewportSize()!.height - 100).toBe(true);
  });
  await page.mouse.click(p.x, p.y);
  await precondition("tap starts a route", async () => {
    await expect.poll(async () => (await read(page)).navigation.path.length).toBeGreaterThan(0);
  });
  const samples: Point[] = [];
  await precondition("tap route reaches its destination", async () => {
    await expect.poll(async () => {
      const s = await read(page); samples.push(s.position);
      return Math.hypot(s.position.x - target.x, s.position.z - target.z);
    }, { timeout: 30_000 }).toBeLessThan(0.4);
  });
  return samples;
}

for (const viewport of [{ width: 1366, height: 768 }, { width: 1280, height: 800 }]) {
  test.describe(`${viewport.width}x${viewport.height} district fixes`, () => {
    test.use({ viewport });
    test("real gameplay scenery evidence", async ({ page }) => {
      await start(page, 5, { x: -60.9, z: 0 });
      const pose = chestPose(5);
      await at(page, { x: pose.x + 2.1, z: pose.z });
      for (const open of [false, true]) {
        await precondition(`Festival chest ${open ? "open" : "closed"}`, async () => {
          expect(await hook(page, (h, value: boolean) => h.previewChest(value), open)).toBe(true);
          await expect.poll(() => hook(page, h => h.readScenery().finale)).toBe(open ? "open" : "armed");
          await expect.poll(async () => Math.abs((await hook(page, h => h.readScenery().lidAngle) ?? Infinity) - (open ? -1.9 : 0)), { timeout: 20_000 }).toBeLessThan(0.01);
        });
        await shot(page, `festival-chest-east-${open ? "open" : "closed"}`);
      }
      for (const [name, point] of Object.entries({
        "festival-entrance-grass": { x: -27, z: 0 }, "festival-entrance-paving": { x: -20, z: 0 },
        "stage-connections": { x: -56, z: 0 }, "festival-view": { x: -48, z: 5 },
        "games-stall": { x: -43, z: 8 }, "market-view": { x: 37, z: 0 },
        "flowers-lily": { x: 30, z: 2 }, "fruit-sara": { x: 45, z: 2 },
        "market-sign": { x: 26, z: 0 }, "market-entrance": { x: 20, z: 0 },
        "harbor-rope-chest": { x: 9, z: 34.5 }
      })) {
        await at(page, point);
        if (name === "flowers-lily" || name === "fruit-sara") {
          const npc = NPC_HOMES[name === "flowers-lily" ? "lily" : "sara"];
          await precondition(`${name} keeper visible`, async () => {
            expect(await hook(page, (h, p: Point) => h.projectPoint({ ...p, y: 1.2 }).visible, npc)).toBe(true);
          });
        }
        await shot(page, name);
      }
    });
  });
}

test("district Up directions and held headings through both necks", async ({ page }) => {
  await start(page, 5, { x: 17, z: 0 });
  for (const [point, key, sign, edge] of [[{ x: 17, z: 0 }, "ArrowRight", 1, 26], [{ x: -17, z: 0 }, "ArrowLeft", -1, -29]] as const) {
    await at(page, point);
    const samples = await trace(page, key, s => sign * s.position.x > sign * edge);
    const moving = samples.filter(s => s.latch !== null);
    await precondition("observed held input throughout the camera turn", async () => {
      expect(moving.length).toBeGreaterThan(3);
      expect(Math.abs(moving.at(-1)!.yaw - moving[0].yaw)).toBeGreaterThan(0.5);
    });
    for (const p of moving) {
      expect(Math.abs(p.z - point.z), "held heading stays east/west").toBeLessThan(0.06);
      expect(Math.abs(p.latch!), "latched original north frame").toBeLessThan(0.002);
    }
  }
  for (const [point, sign] of [[{ x: 36, z: 0 }, 1], [{ x: -45, z: 5 }, -1]] as const) {
    await at(page, point);
    await trace(page, "ArrowUp", s => sign * (s.position.x - point.x) > 1.2);
    const after = (await read(page)).position;
    expect(sign * (after.x - point.x)).toBeGreaterThan(1.2);
    expect(Math.abs(after.z - point.z)).toBeLessThan(0.06);
  }
});

test("rope blocks real keyboard and redirects taps from both sides, with chest access", async ({ page }) => {
  await start(page, 4, { x: 10.2, z: 35 });
  for (const [point, key, sign, target] of [[{ x: 10.2, z: 35 }, "ArrowRight", 1, { x: 12.2, z: 35 }], [{ x: 12.2, z: 35 }, "ArrowLeft", -1, { x: 10.2, z: 35 }]] as const) {
    await at(page, point);
    await page.keyboard.down(key);
    try {
      await precondition("keyboard reaches rope", async () => {
        await expect.poll(async () => Math.abs((await read(page)).position.x - 11.15), { timeout: 15_000 }).toBeLessThan(0.4);
      });
      const stopped = (await read(page)).position;
      await precondition("player remains pressing against rope", async () => {
        await expect.poll(async () => hook(page, h => h.readGates().manualInputYaw)).not.toBeNull();
      });
      expect(sign * (stopped.x - 11.15)).toBeLessThan(-0.374);
      expect(Math.abs(stopped.z - 35)).toBeLessThan(0.05);
    } finally { await page.keyboard.up(key); }
    await at(page, point);
    const samples = await tapTo(page, target);
    expect(samples.some(p => p.z < 33.5), "tap goes around the north post").toBe(true);
    for (const p of samples) if (p.z > 34.18 && p.z < 36.8) expect(Math.abs(p.x - 11.15)).toBeGreaterThan(0.374);
  }
  await at(page, { x: 8, z: 35 });
  await tapTo(page, { x: 10, z: 34.8, y: 0.12 });
  await precondition("sea chest focused inside the rope", async () => {
    await expect.poll(async () => (await read(page)).focus).toEqual({ kind: "seaChest" });
  });
  await page.keyboard.press("e");
  await precondition("sea chest interaction began", async () => {
    await expect.poll(async () => !!(await read(page)).presentation.beat || !!(await read(page)).prompt).toBe(true);
  });
});

for (const continued of [false, true]) test(`talk to Lily and Sara with real input after ${continued ? "saved Continue" : "New Game"}`, async ({ page }) => {
  test.setTimeout(240_000);
  if (continued) await start(page, 2, { x: 28, z: 4 });
  else {
    await page.addInitScript(value => localStorage.setItem("tt.settings.v1", JSON.stringify(value)), settings);
    await page.goto("./?e2e=1&seed=101&coach=off");
    await precondition("new campaign reaches Chapter 2", async () => {
      await page.getByTestId("title-new").click();
      await play(page, { until: s => s.chapter === 2 && playable(s) });
    });
  }
  for (const id of ["lily", "sara"] as const) {
    const npc = NPC_HOMES[id];
    await at(page, { x: npc.x - 1.4, z: npc.z });
    await trace(page, "ArrowUp", s => s.position.x > npc.x - 0.9);
    await precondition(`${id} reachable at unchanged home`, async () => {
      await expect.poll(async () => (await read(page)).focus).toEqual({ kind: "npc", id });
    });
    await page.keyboard.press("e");
    await precondition(`${id} conversation started by E`, async () => {
      await expect.poll(() => hook(page, h => h.readGates().camera.mode)).toBe("conversation");
      await settle(page, s => s.prompt?.kind === "ask" && s.prompt.target === id);
    });
    await page.getByTestId("prompt-bye").click();
    await precondition(`${id} conversation ends`, async () => { await settle(page, playable); });
  }
});
