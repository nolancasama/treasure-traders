import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { DEFAULT_SETTINGS, startChapter } from "../../src/game/logic";
import type { ChapterId } from "../../src/game/content/ids";
import { GRANDMA_BENCH_CENTER, NPC_HOMES, SOLIDS, SPOTS, chestPose, stallPoint } from "../../src/game/world/layout";
import { followOffset, followYaw } from "../../src/scene/cameraRig";
import { read, settle, type GameRead } from "./game.helpers";

interface Hook {
  read(): GameRead;
  teleport(at: { x: number; z: number }): void;
  projectPoint(at: { x: number; y: number; z: number }): { x: number; y: number; visible: boolean };
  readGates(): { cameraYaw: number; camera: { mode: string } };
  previewChest(open: boolean): boolean;
  readScenery(): {
    walkable: boolean; finale: string; chestCount: number; lidAngle: number | null;
    cameraPosition: { x: number; y: number; z: number };
    painters: Record<"ken" | "leo", {
      moment: "painting" | "looking"; visible: boolean; atHome: boolean; yaw: number;
      position: { x: number; y: number; z: number };
    } | null>;
  };
}
const hook = <T>(page: Page, fn: (h: Hook, arg: never) => T, arg?: unknown) => page.evaluate(
  ([source, value]) => (new Function("h", "a", `return (${source})(h, a)`))((window as unknown as { __tt: Hook }).__tt, value) as T,
  [fn.toString(), arg] as const
);
const playable = (s: GameRead) => s.phase === "playing" && !s.busy && !s.prompt && !s.presentation.beat && !s.presentation.card && !s.presentation.tip && !s.presentation.screen && !s.navigation.locked;
const precondition = async (name: string, work: () => Promise<unknown>) => {
  try { await work(); } catch (error) { throw new Error(`HARNESS_PRECONDITION_FAILED: ${name}`, { cause: error }); }
};

async function start(page: Page, chapter: ChapterId, position: { x: number; z: number }) {
  const game = startChapter(chapter, { mode: "campaign", seed: 165939, campaignSeed: 101 });
  game.position = { ...position, yaw: Math.PI };
  await page.addInitScript(({ game, settings }) => {
    localStorage.setItem("tt.save.v1", JSON.stringify(game));
    localStorage.setItem("tt.settings.v1", JSON.stringify(settings));
  }, { game, settings: { ...DEFAULT_SETTINGS, micFree: true, seenTips: ["intro", "moving", "mic", "asking"] } });
  await page.goto("./?e2e=1&coach=off");
  await precondition(`Chapter ${chapter} gameplay`, async () => {
    await page.getByTestId("title-continue").click();
    await settle(page, playable);
  });
}

async function at(page: Page, position: { x: number; z: number }) {
  const expectedOffset = followOffset(position);
  await hook(page, (h, p) => h.teleport(p), position);
  await precondition(`follow view at ${JSON.stringify(position)}`, async () => {
    await expect.poll(async () => {
      const s = await read(page);
      return Math.hypot(s.position.x - position.x, s.position.z - position.z);
    }).toBeLessThan(0.03);
    await expect.poll(async () => {
      const s = await hook(page, h => ({ p: h.read().position, scenery: h.readScenery(), camera: h.readGates().camera }));
      const indoor = s.p.x > -26 && s.p.x < -12 && s.p.z > -47 && s.p.z < -37;
      const offset = indoor ? { x: 0, y: 6.2, z: 7 } : expectedOffset;
      const camera = s.scenery.cameraPosition;
      return s.camera.mode === "follow" ? Math.hypot(camera.x - s.p.x - offset.x, camera.y - s.p.y - offset.y, camera.z - s.p.z - offset.z) : Infinity;
    }, { timeout: 20_000 }).toBeLessThan(0.02);
  });
  await precondition(`walkable, visible player and settled yaw at ${JSON.stringify(position)}`, async () => {
    await expect.poll(async () => Math.abs((await hook(page, h => h.readGates())).cameraYaw - followYaw(position)), { message: "district follow yaw", timeout: 20_000 }).toBeLessThan(0.002);
    expect(await hook(page, h => h.readScenery().walkable), "player stands on a walkable surface").toBe(true);
    const visible = await hook(page, h => {
      const p = h.read().position;
      return [0.1, 1.6].every(y => h.projectPoint({ ...p, y: p.y + y }).visible);
    });
    expect(visible, "player feet and head are visible in gameplay framing").toBe(true);
  });
}

async function shot(page: Page, name: string) {
  await precondition(`rendered ${name}`, async () => {
    await expect.poll(async () => (await read(page)).renderer?.calls ?? 0).toBeGreaterThan(0);
  });
  await mkdir(".tmp/shots/scenery", { recursive: true });
  const { width, height } = page.viewportSize()!;
  await page.screenshot({ path: `.tmp/shots/scenery/${name}-${width}x${height}.png` });
}

/** Check the subject in the real follow camera before writing evidence. */
async function subjectInFrame(page: Page, name: string, points: { x: number; y: number; z: number }[]) {
  await precondition(`${name} fits in gameplay framing`, async () => {
    await expect.poll(async () => hook(page, (h, points: { x: number; y: number; z: number }[]) =>
      points.every(point => h.projectPoint(point).visible), points)).toBe(true);
  });
}

const STALL_VIEWS = [
  ["flowers-stall", "flower"], ["fruit-stall", "fruit"],
  ["festival-stall-south", "games"], ["bakery-stall", "bakery"],
  ["toys-stall", "toy"], ["festival-stall-north", "snacks"]
] as const;

for (const viewport of [{ width: 1366, height: 768 }, { width: 1280, height: 800 }]) {
  test.describe(`${viewport.width}x${viewport.height} gameplay scenery`, () => {
    test.use({ viewport });

    for (const id of ["ken", "leo"] as const) {
      test(`${id} painter strokes and looking moments`, async ({ page }) => {
        const home = NPC_HOMES[id];
        const position = { x: home.x + (id === "ken" ? -2.5 : 2.5), z: home.z + 3 };
        // These chapters keep each painter at home regardless of generated roles.
        // Chapter 5 can relocate both of them to the festival.
        await start(page, id === "ken" ? 1 : 4, position);
        await at(page, position);
        await subjectInFrame(page, id, [home, { ...home, y: 1.8 }]);
        for (const moment of ["painting", "looking"] as const) {
          await precondition(`${id} rendered ${moment} moment at home`, async () => {
            await expect.poll(async () => {
              const painter = (await hook(page, h => h.readScenery())).painters[id];
              if (!painter || !painter.visible || !painter.atHome || painter.moment !== moment) return false;
              const angle = painter.yaw - (home.yaw ?? 0);
              return Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle))) < 0.02;
            }, { timeout: 30_000 }).toBe(true);
          });
          await shot(page, `${id}-${moment}`);
        }
      });
    }

    test("notice-board posters close in the gameplay camera", async ({ page }) => {
      await start(page, 1, { x: 8, z: 7.8 });
      await at(page, { x: 8, z: 7.8 });
      await subjectInFrame(page, "notice-board posters", [
        { x: 11.34, y: 0.86, z: 4.62 }, { x: 11.34, y: 2.14, z: 7.38 }
      ]);
      await shot(page, "notice-board-posters-close");
    });

    test("all stall front and rear supports, and drawing booth", async ({ page }) => {
      await start(page, 5, { x: 30, z: -3 });
      for (const [id, name] of STALL_VIEWS) {
        const stall = SOLIDS.find(s => s.id === id);
        if (!stall || stall.kind !== "box") throw new Error(`HARNESS_PRECONDITION_FAILED: box collider for ${id}`);
        for (const [side, direction] of [["front", 1], ["rear", -1]] as const) {
          // Stand on the corresponding local side. The production district camera
          // keeps its own yaw; the evidence never installs a gallery camera.
          const position = stallPoint(stall.x, stall.z, stall.yaw, 0, direction * (stall.hz + 2.1));
          await at(page, position);
          await subjectInFrame(page, `${name} ${side}`, [-1, 1].flatMap(x => [-1, 1].map(z => ({
            ...stallPoint(stall.x, stall.z, stall.yaw, x * (stall.hx - 0.16), z * (stall.hz - 0.14)), y: 3.4
          }))));
          await shot(page, `stall-${name}-${side}`);
        }
      }
      await at(page, { x: -35.5, z: -10.8 });
      await subjectInFrame(page, "drawing booth supports", [
        { x: -38.4, y: 3.2, z: -16.9 }, { x: -32.6, y: 3.5, z: -14.6 }
      ]);
      await shot(page, "drawing-booth-supports");
    });

    test("school fences have capped posts at both north ends", async ({ page }) => {
      await start(page, 5, { x: -11, z: -34 });
      for (const [side, x, z] of [["west", -14.3, -35], ["east", 14.3, -47]] as const) {
        await at(page, { x: x + (side === "west" ? 2.5 : -2.5), z: z + 2.5 });
        await subjectInFrame(page, `${side} school fence north post and cap`, [
          { x, y: 0, z }, { x, y: 1.27, z }
        ]);
        await shot(page, `school-fence-${side}-north-end`);
      }
    });

    test("square, seated Ume, flowerbed and mortar", async ({ page }) => {
      await start(page, 1, { x: 0, z: 8 });
      await at(page, { x: 0, z: 8 });
      await shot(page, "square");
      await at(page, { x: GRANDMA_BENCH_CENTER.x, z: GRANDMA_BENCH_CENTER.z + 4.3 });
      await precondition("Ume remains at her bench", async () => {
        expect((await read(page)).game!.chapter).toBe(1);
        expect(await hook(page, (h, p: { x: number; y: number; z: number }) => h.projectPoint(p).visible, { ...NPC_HOMES.ume, y: 1.2 })).toBe(true);
      });
      await shot(page, "ume-bench-lamp");
      await at(page, { x: SPOTS["square-eraser"].x + 3, z: SPOTS["square-eraser"].z + 3 });
      await shot(page, "flowerbed-ring");
      // The near paving fills the foreground of the normal follow camera.
      await at(page, { x: 4.5, z: 4.5 });
      await shot(page, "mortar-close");
    });

    test("district follow views, roof line, doorway and harbor sign", async ({ page }) => {
      await start(page, 5, { x: 0, z: -38 });
      for (const [name, position] of Object.entries({ schoolhouse: { x: 0, z: -38 }, market: { x: 37, z: 0 }, harbor: { x: 8, z: 41 }, "festival-grounds": { x: -48, z: 5 } })) {
        await at(page, position);
        await shot(page, `follow-${name}`);
      }
      await at(page, { x: -9.4, z: 33.5 });
      await shot(page, "harbor-sign-balloons");
      await at(page, { x: -13.5, z: -33 });
      await shot(page, "library-south-roof-outside");
      await at(page, { x: -10.5, z: -42 });
      const doorway = await hook(page, h => h.projectPoint({ x: -12.1, y: 0.12, z: -42 }));
      await precondition("doorway ground tap is in frame", async () => { expect(doorway.visible).toBe(true); });
      await page.mouse.click(doorway.x, doorway.y);
      await precondition("walk reaches the library doorway", async () => {
        await expect.poll(async () => (await read(page)).position.x, { timeout: 15_000 }).toBeLessThan(-11.7);
      });
      await precondition("player is in the doorway transition", async () => {
        const p = (await read(page)).position;
        expect(p.x).toBeGreaterThan(-14);
        expect(Math.abs(p.z + 42)).toBeLessThan(0.2);
      });
      await shot(page, "library-doorway-transition");
      await at(page, { x: -14, z: -42 });
      await shot(page, "library-doorway-inside");
    });

    test("Festival chest closed and open through its real lid animation", async ({ page }) => {
      const pose = chestPose(5);
      await start(page, 5, { x: pose.x + 2.1, z: pose.z });
      await at(page, { x: pose.x + 2.1, z: pose.z });
      const campaign = (await read(page)).game;
      for (const open of [false, true]) {
        await precondition(`chest ${open ? "open" : "closed"} fixture`, async () => {
          expect(await hook(page, (h, value: boolean) => h.previewChest(value), open)).toBe(true);
          await expect.poll(async () => (await hook(page, h => h.readScenery())).finale).toBe(open ? "open" : "armed");
          await expect.poll(async () => {
            const angle = (await hook(page, h => h.readScenery())).lidAngle;
            return angle === null ? Infinity : Math.abs(angle - (open ? -1.9 : 0));
          }, { timeout: 20_000 }).toBeLessThan(0.01);
        });
        expect((await hook(page, h => h.readScenery())).chestCount).toBe(open ? 9 : 8);
        expect((await read(page)).game, "preview leaves campaign state untouched").toEqual(campaign);
        await shot(page, `festival-chest-${open ? "open" : "closed"}`);
      }
    });
  });
}
