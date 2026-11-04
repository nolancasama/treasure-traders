import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { approach, openGame, play, read, type GameRead } from "./game.helpers";
import type { Intent } from "../../src/game/logic/plan";
import type { Interaction } from "../../src/game/world/types";

interface GateRead {
  progress: Record<string, number> | null;
  open: Record<string, boolean>;
  school: { displacement: number; wheelRotation: number; wheelRadius: number; travel: number } | null;
  schoolHeld: boolean;
  camera: { mode: string; elapsed?: number; keys?: { target: { z: number } }[] };
  cameraYaw: number;
  manualInputYaw: number | null;
}
interface GateHook {
  read(): GameRead;
  readGates(): GateRead;
  projectPoint(point: { x: number; y: number; z: number }): { x: number; y: number; visible: boolean };
  project(target: Interaction): { x: number; y: number; visible: boolean } | null;
  approachPath(target: Interaction): { x: number; z: number }[];
}
type GateWindow = Window & { __tt: GateHook };
interface GateSample extends GateRead { at: number }
interface GateAudit { samples: GateSample[]; requested: string[]; error: string | null; stop: boolean }
type AuditWindow = GateWindow & { __schoolGateAudit: GateAudit; __captureSchoolGate(label: string, png: string): Promise<void> };

async function precondition(name: string, action: () => Promise<unknown>) {
  try { await action(); }
  catch (error) { throw new Error(`HARNESS_PRECONDITION_FAILED: ${name}`, { cause: error }); }
}

const gates = (page: Page) => page.evaluate(() => (window as unknown as GateWindow).__tt.readGates());
const nextFrame = (page: Page) => page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
const playable = (s: GameRead) => s.phase === "playing" && !s.busy && !s.prompt && !s.presentation.beat && !s.presentation.card && !s.presentation.tip && !s.presentation.screen;

/** Steer with actual held keys, resolving their camera-relative direction each frame. */
async function keyboardTo(page: Page, target: { x: number; z: number }, schoolOpen = true) {
  let held: string[] = [];
  const deadline = Date.now() + 60_000;
  // No progress means a wall or corner is in the way. Like a player steering
  // round it, hold one axis alone for a moment, taking turns between the axes.
  let closest = Infinity, stalledFrames = 0, detourFrames = 0, detourMinor = true;
  try {
    while (Date.now() < deadline) {
      const s = await read(page), g = await gates(page);
      if (schoolOpen) expect(g.progress?.school, "school remains fully open during keyboard travel").toBe(1);
      const dx = target.x - s.position.x, dz = target.z - s.position.z, distance = Math.hypot(dx, dz);
      if (distance < 0.35) return;
      if (distance < closest - 0.05) { closest = distance; stalledFrames = 0; }
      else if (detourFrames === 0 && ++stalledFrames >= 20) { detourFrames = 30; stalledFrames = 0; }
      const yaw = g.manualInputYaw ?? g.cameraYaw;
      const x = dx * Math.cos(yaw) - dz * Math.sin(yaw), y = -dx * Math.sin(yaw) - dz * Math.cos(yaw);
      const magnitude = Math.hypot(x, y);
      const xKey = x > 0 ? "ArrowRight" : "ArrowLeft", yKey = y > 0 ? "ArrowUp" : "ArrowDown";
      let wanted = [
        ...(Math.abs(x) / magnitude > 0.12 ? [xKey] : []),
        ...(Math.abs(y) / magnitude > 0.12 ? [yKey] : [])
      ];
      if (detourFrames > 0) {
        wanted = [(Math.abs(x) < Math.abs(y)) === detourMinor ? xKey : yKey];
        if (--detourFrames === 0) { detourMinor = !detourMinor; closest = Infinity; }
      }
      for (const key of held.filter(key => !wanted.includes(key))) await page.keyboard.up(key);
      for (const key of wanted.filter(key => !held.includes(key))) await page.keyboard.down(key);
      held = wanted;
      await nextFrame(page);
    }
    throw new Error(`Keyboard walk did not reach ${JSON.stringify(target)}: ${JSON.stringify((await read(page)).position)}`);
  } finally {
    for (const key of held) await page.keyboard.up(key);
  }
}

/** Plan destinations read-only; execute every approach with real held keys and clicks. */
async function realApproach(page: Page, intent: Intent) {
  const target: Interaction = intent.kind === "collect" ? { kind: "spot", id: intent.spot } : intent.target === "seaChest" ? { kind: "seaChest" } : { kind: "npc", id: intent.target };
  const visible = () => page.evaluate(target => {
    const p = (window as unknown as GateWindow).__tt.project(target);
    return !!p && p.visible && p.x > 30 && p.y > 150 && p.x < 1336 && p.y < 560;
  }, target);
  if (!await visible()) {
    const path = await page.evaluate(target => (window as unknown as GateWindow).__tt.approachPath(target), target);
    if (!path.length) throw new Error(`HARNESS_PRECONDITION_FAILED: real-input route to ${JSON.stringify(target)} unavailable`);
    for (const waypoint of path) {
      await keyboardTo(page, waypoint, false);
      if (await visible()) break;
    }
  }
  await approach(page, intent, false, true);
}

test("real school unlock rolls through the stone slot, settles, and permits tap and keyboard entry", async ({ page }) => {
  await mkdir(".tmp/shots/game", { recursive: true });
  test.setTimeout(15 * 60_000);
  await precondition("new mic-free campaign", () => openGame(page));
  await precondition("real Chapter 2 progression before school unlock", () => play(page, { approach: realApproach, until: s => s.chapter === 2 && playable(s) }));
  await precondition("rendered school gate starts closed", () => page.waitForFunction(() => {
    const g = (window as unknown as GateWindow).__tt.readGates();
    return g.progress?.school === 0 && !g.open.school && g.school !== null;
  }));
  expect((await gates(page)).progress?.school).toBe(0);
  expect((await gates(page)).open.school).toBe(false);

  const captures: Promise<void>[] = [];
  // A page screenshot takes seconds under SwiftShader, long after the frame that asked
  // for it. The sampler instead hands over the canvas of the very frame that crossed.
  await page.exposeFunction("__captureSchoolGate", (label: string, png: string) => {
    const capture = writeFile(`.tmp/shots/game/school-gate-${label}.png`, Buffer.from(png.split(",")[1], "base64"));
    captures.push(capture);
    return capture;
  });
  await page.evaluate(() => {
    const w = window as unknown as AuditWindow;
    const audit: GateAudit = { samples: [], requested: [], error: null, stop: false };
    w.__schoolGateAudit = audit;
    let last = -1, settledFrames = 0;
    const sample = () => {
      if (audit.stop) return;
      const g = w.__tt.readGates(), progress = g.progress?.school;
      if (progress === undefined) { audit.error = "school renderer disappeared"; return; }
      // Keep every moving frame, the initial zero, and 30 settled frames.
      if (progress !== last || progress === 1 && settledFrames < 30) audit.samples.push({ ...g, at: performance.now() });
      if (progress === 1) settledFrames++;
      if (progress === 0 && g.schoolHeld && g.camera.keys?.[0]?.target.z === -22 && (g.camera.elapsed ?? 0) >= 0.2 && !audit.requested.includes("000")) {
        audit.requested.push("000");
        void w.__captureSchoolGate("000", document.querySelector("canvas")!.toDataURL("image/png")).catch(error => { audit.error = String(error); });
      }
      for (const [threshold, label] of [[0.25, "025"], [0.5, "050"], [0.75, "075"], [1, "100"]] as const) {
        if (progress >= threshold && !audit.requested.includes(label)) {
          audit.requested.push(label);
          void w.__captureSchoolGate(label, document.querySelector("canvas")!.toDataURL("image/png")).catch(error => { audit.error = String(error); });
        }
      }
      last = progress;
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  // Existing helpers solve both chapters through real dialogue and world inputs.
  // No save, gate, player, inventory or game-state writes occur in this spec.
  await precondition("real school unlock and Chapter 3 introduction finish", () => play(page, { approach: realApproach, until: s => s.chapter === 3 && playable(s) }));
  await precondition("frame sampler observes all gate milestones and settlement", () => page.waitForFunction(() => {
    const audit = (window as unknown as AuditWindow).__schoolGateAudit;
    return audit.error !== null || audit.requested.length === 5 && audit.samples.filter(s => s.progress?.school === 1).length >= 30;
  }));
  await Promise.all(captures);
  const audit = await page.evaluate(() => {
    const audit = (window as unknown as AuditWindow).__schoolGateAudit;
    audit.stop = true;
    return audit;
  });
  await writeFile(".tmp/shots/game/school-gate-motion.json", JSON.stringify(audit, null, 2));
  expect(audit.error).toBeNull();
  expect(audit.requested).toEqual(["000", "025", "050", "075", "100"]);
  expect(audit.samples[0].progress?.school).toBe(0);
  expect(audit.samples[0].open.school).toBe(false);
  const moving = audit.samples.filter(s => s.progress!.school > 0 && s.progress!.school < 1);
  expect(moving.length, "real intermediate rendered gate frames").toBeGreaterThan(3);
  for (let i = 0; i < audit.samples.length; i++) {
    const s = audit.samples[i], p = s.progress!.school;
    expect(p).toBeGreaterThanOrEqual(i ? audit.samples[i - 1].progress!.school : 0);
    expect(p).toBeLessThanOrEqual(1);
    expect(s.open.school, "navigation opens at the rendered endpoint").toBe(p === 1);
    expect(s.school).not.toBeNull();
    expect(s.school!.displacement).toBeCloseTo(p * s.school!.travel, 6);
    expect(s.school!.wheelRotation).toBeCloseTo(-s.school!.displacement / s.school!.wheelRadius, 6);
    if (p > 0 && p < 1) expect(s.camera.mode, "school shot covers the complete actual slide").toBe("path");
  }
  expect(audit.samples.at(-1)!.progress!.school).toBe(1);
  expect(audit.samples.at(-1)!.school!.wheelRotation).not.toBe(audit.samples[0].school!.wheelRotation);

  await precondition("unlocked follow camera and controls", () => page.waitForFunction(() => {
    const hook = (window as unknown as GateWindow).__tt;
    return !hook.read().navigation.locked && hook.readGates().camera.mode === "follow";
  }));
  await precondition("real keyboard approach to the gate outside", () => keyboardTo(page, { x: 0, z: -19.5 }));
  // Wait for the actual ground projection to settle before the real touch input.
  const point = await preconditionPoint(page);
  await page.touchscreen.tap(point.x, point.y);
  await expect.poll(async () => (await read(page)).position.z, { message: "tap crosses the school gate into the courtyard", timeout: 30_000 }).toBeLessThan(-25.5);
  expect((await gates(page)).progress?.school).toBe(1);
  await precondition("real keyboard return outside for independent keyboard entry", () => keyboardTo(page, { x: 0, z: -19.5 }));
  expect((await read(page)).position.z).toBeGreaterThan(-21);
  await keyboardTo(page, { x: 0, z: -27 });
  expect((await read(page)).position.z).toBeLessThan(-25.5);
  expect((await gates(page)).progress?.school).toBe(1);
});

async function preconditionPoint(page: Page) {
  let point: { x: number; y: number; visible: boolean } | null = null;
  await precondition("visible stable courtyard ground target for a real tap", async () => {
    point = await page.evaluate(async () => {
      const hook = (window as unknown as GateWindow).__tt;
      let previous = hook.projectPoint({ x: 0, y: 0, z: -27 }), stable = 0;
      const deadline = performance.now() + 15_000;
      while (performance.now() < deadline) {
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        const current = hook.projectPoint({ x: 0, y: 0, z: -27 });
        stable = current.visible && previous.visible && Math.hypot(current.x - previous.x, current.y - previous.y) < 0.5 ? stable + 1 : 0;
        if (stable >= 4 && current.y > 100 && current.y < 650) return current;
        previous = current;
      }
      throw new Error("courtyard ground projection did not become visible and stable");
    });
  });
  if (!point) throw new Error("HARNESS_PRECONDITION_FAILED: courtyard ground projection missing");
  return point as { x: number; y: number; visible: boolean };
}
