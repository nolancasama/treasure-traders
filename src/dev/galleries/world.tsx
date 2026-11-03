import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { DISTRICT_IDS, ITEM_IDS, NPC_IDS, type ChapterId, type DistrictId, type NpcId } from "../../game/content/ids";
import { startChapter } from "../../game/logic";
import { createWorld, worldStateFromGame, type WorldAPI } from "../../game/runtime";
import { chestPose, DISTRICTS, FINALE_CREW, FINALE_VIEW, GATE_POSITIONS } from "../../game/world/layout";
import type { GateId, Position } from "../../game/world/types";
import { World } from "../../scene/World";
import { markGalleryReady } from "../ready";

const params = new URLSearchParams(location.search);
interface FixView {
  chapter: ChapterId;
  player: { x: number; z: number };
  chest?: number;
  gates?: Partial<Record<GateId, number>>;
  closeup?: { position: Position; target: Position };
  time?: number;
}
// Stable names shared by review URLs and fixes.spec.ts; later batches retain these views.
const FIX_VIEWS = {
  "fixes-bench-ume": { chapter: 1, player: { x: -9, z: 6.7 } },
  "fixes-chest-base-closed": { chapter: 1, player: { x: 0, z: -5.3 }, chest: 0 },
  "fixes-chest-base-open": { chapter: 1, player: { x: 0, z: -5.3 }, chest: 9 },
  "fixes-bridge-raised": { chapter: 3, player: { x: 0, z: 15.5 }, gates: { bridge: 0 } },
  "fixes-bridge-lowered": { chapter: 4, player: { x: 0, z: 17 }, gates: { bridge: 1 } },
  "fixes-bridge-rope-south": { chapter: 4, player: { x: 0, z: 29.5 } },
  "fixes-arch-sign-rope": { chapter: 4, player: { x: -18, z: 0 }, gates: { arch: 0 } },
  "fixes-school-gate-000": { chapter: 3, player: { x: 0, z: -18.5 }, gates: { school: 0 } },
  "fixes-school-gate-025": { chapter: 3, player: { x: 0, z: -18.5 }, gates: { school: 0.25 } },
  "fixes-school-gate-050": { chapter: 3, player: { x: 0, z: -18.5 }, gates: { school: 0.5 } },
  "fixes-school-gate-075": { chapter: 3, player: { x: 0, z: -18.5 }, gates: { school: 0.75 } },
  "fixes-school-gate-100": { chapter: 3, player: { x: 0, z: -18.5 }, gates: { school: 1 } },
  "fixes-school-east-post": { chapter: 3, player: { x: 6, z: -20 }, gates: { school: 0.5 }, closeup: { position: { x: 7, y: 2.8, z: -17 }, target: { x: 4, y: 1.4, z: -22 } } },
  "fixes-school-grass": { chapter: 3, player: { x: 5, z: -25 } },
  "fixes-library-outside": { chapter: 3, player: { x: -9, z: -40.5 } },
  "fixes-library-doorway": { chapter: 3, player: { x: -10.5, z: -42 } },
  "fixes-library-inside": { chapter: 3, player: { x: -18, z: -40 } },
  "fixes-librarian": { chapter: 3, player: { x: -13.4, z: -38.5 } },
  "fixes-bookshelf-closeup": { chapter: 3, player: { x: -23.5, z: -44 }, closeup: { position: { x: -21.7, y: 2.5, z: -42.2 }, target: { x: -23.5, y: 1, z: -45.7 } } },
  "fixes-northeast-house": { chapter: 3, player: { x: 19, z: -20 }, closeup: { position: { x: 24.5, y: 8, z: -13.8 }, target: { x: 20.5, y: 0.8, z: -24.8 } } },
  "fixes-harbor-easel": { chapter: 4, player: { x: -9, z: 34.5 } },
  "fixes-harbor-fish-jump": { chapter: 4, player: { x: -3, z: 37.2 }, time: 0.45 },
  "fixes-harbor-chest": { chapter: 4, player: { x: 10, z: 38 } },
  "fixes-east-harbor-house": { chapter: 4, player: { x: 25, z: 36 }, closeup: { position: { x: 31.8, y: 8, z: 43.4 }, target: { x: 27.8, y: 0.8, z: 32.4 } } },
  "fixes-pier-end": { chapter: 4, player: { x: 8, z: 46 } },
  "fixes-prize-tent": { chapter: 5, player: { x: -55, z: -10 } },
  "fixes-stage-steps": { chapter: 5, player: { x: -55.4, z: 0 } },
  "fixes-player-on-step": { chapter: 5, player: { x: -57.5, z: 0 } },
  "fixes-player-on-stage": { chapter: 5, player: { x: -59.8, z: 2.3 } }
} satisfies Record<string, FixView>;
type FixViewName = keyof typeof FIX_VIEWS;
const fixView = (view: string): FixView | undefined => (FIX_VIEWS as Record<string, FixView>)[view];
const VIEWS = ["walk", ...DISTRICT_IDS, "library", "play-follow", "conversation", "gates-ch1", "gates-closed", "arch-closed", "wind", "fireworks", "chest-2", "finale", "title", "bench", "stall-talk", "market-play", "school-play", "harbor-play", "festival-play", "trade", "deposit", "chest-close", "sea-chest", "sky", ...Object.keys(FIX_VIEWS) as FixViewName[]] as const;
type View = typeof VIEWS[number];
const initialView: View = VIEWS.find(v => v === params.get("view")) ?? "walk";
const districtShots = {
  square: { x: 20, y: 23, z: 30, target: { x: 0, y: 0, z: -1 } },
  market: { x: 54, y: 20, z: 26, target: { x: 36, y: 0, z: 0 } },
  school: { x: 19, y: 23, z: -14, target: { x: -3, y: 0, z: -39 } },
  harbor: { x: 28, y: 23, z: 62, target: { x: 6, y: 0, z: 35 } },
  festival: { x: -25, y: 23, z: 29, target: { x: -48, y: 0, z: 0 } },
  library: { x: -14, y: 10, z: -29, target: { x: -19, y: 0.6, z: -42 } },
  "gates-ch1": { x: 29, y: 13, z: 18, target: { x: 18, y: 0.8, z: 0 } },
  "gates-closed": { x: 44, y: 43, z: 10, target: { x: 0, y: 1, z: 0 } },
  "arch-closed": { x: -8, y: 8, z: 13, target: { x: -22, y: 2, z: 0 } },
  wind: { x: 15, y: 6.5, z: 22, target: { x: 4, y: 6, z: 0 } },
  fireworks: { ...FINALE_VIEW.position, target: FINALE_VIEW.target },
  finale: { ...FINALE_VIEW.position, target: FINALE_VIEW.target },
  "chest-2": { x: 20, y: 23, z: 30, target: { x: 0, y: 0, z: -1 } },
  title: { x: 20, y: 15, z: 22, target: { x: 0, y: 0.5, z: -3 } },
  bench: { x: -7, y: 3, z: 9.5, target: { x: -10, y: 0.7, z: 4.3 } },
  "chest-close": { x: 2.4, y: 2.5, z: -3.4, target: { x: 0, y: 1, z: -8 } },
  "sea-chest": { x: 11.4, y: 2.2, z: 38.6, target: { x: 10, y: 0.6, z: 36 } },
  sky: { x: 0, y: 3, z: 15, target: { x: 0, y: 12, z: -30 } }
};

// Hold review FX at a known age, independent of software-renderer frame speed.
function ReviewEffect({ world, view }: { world: WorldAPI; view: View }) {
  useFrame(() => {
    const age = params.get("age");
    for (const effect of world.runtime.effects) {
      if (view === "wind") effect.started = world.runtime.time - (age ? Number(age) : 1.6);
      if (view === "fireworks" || view === "finale") effect.started = world.runtime.time - (age ? Number(age) : effect.kind === "fireworks" ? 1.3 : 0);
      if ((view === "trade" || view === "deposit") && age) effect.started = world.runtime.time - Number(age);
    }
  }, -1);
  return null;
}

/** Review fixtures only: hold a known ambient pose and use the requested gameplay lens. */
function FixReviewFrame({ world, view }: { world: WorldAPI; view: View }) {
  useFrame(() => {
    const time = fixView(view)?.time;
    if (time !== undefined) world.runtime.time = time;
  }, -2.5);
  useFrame(({ camera }) => {
    const fix = fixView(view);
    if (!fix || fix.closeup) return;
    const p = world.runtime.player;
    // Inside the library normal play uses a closer cutaway lens. The fixes
    // comparison explicitly requests the shared (+4,+8,+11) offset throughout.
    camera.position.set(p.x + 4, p.y + 8, p.z + 11);
    camera.lookAt(p.x, p.y + 0.8, p.z);
    camera.updateMatrixWorld();
  }, -1.5);
  return null;
}

function Probe({ world, view, onInfo }: { world: WorldAPI; view: View; onInfo: (info: string) => void }) {
  const { gl, scene, camera } = useThree();
  const frames = useRef(0), acc = useRef(0);
  const stable = useRef(0), last = useRef("");
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  useFrame((_, dt) => {
    frames.current++; acc.current += dt;
    if (frames.current === 16) markGalleryReady();
    if (fixView(view)) {
      const rt = world.runtime, fix = fixView(view)!;
      const lid = scene.getObjectByName("festival-chest-lid");
      const fish = scene.getObjectByName("harbor-fish") as THREE.InstancedMesh | undefined;
      if (fish) fish.getMatrixAt(0, matrix);
      const gatesReady = rt.gateProgress !== null && Object.entries(rt.state.gates).every(([id, open]) => Math.abs(rt.gateProgress![id as GateId] - (fix.gates?.[id as GateId] ?? (open ? 1 : 0))) < 0.001);
      const position = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
      const fog = scene.fog as THREE.Fog | null;
      const key = JSON.stringify([view, ...Object.values(position).map(n => n.toFixed(3)), rt.player.y.toFixed(3), lid?.rotation.x.toFixed(3), fog?.color.toArray().map(n => n.toFixed(3))]);
      stable.current = key === last.current && gatesReady ? stable.current + 1 : 0;
      last.current = key;
      document.body.dataset.fixesReview = JSON.stringify({
        view, chapter: rt.state.chapter, player: rt.player, camera: { mode: rt.camera.mode, position },
        gateProgress: rt.gateProgress, gates: rt.state.gates, chestCount: rt.state.chestCount,
        chestLid: lid?.rotation.x ?? null, fishY: fish ? matrix.elements[13] : null,
        time: rt.time, frames: frames.current, stableFrames: stable.current,
        calls: gl.info.render.calls, triangles: gl.info.render.triangles
      });
    }
    if (acc.current > 0.5) {
      acc.current = 0;
      const { calls, triangles } = gl.info.render;
      document.body.dataset.worldCalls = String(calls);
      document.body.dataset.worldTriangles = String(triangles);
      document.body.dataset.worldReview = JSON.stringify({ camera: world.runtime.camera.mode, bottomPanel: world.runtime.bottomPanel, gates: world.runtime.state.gates, chestCount: world.runtime.state.chestCount, effects: world.runtime.effects.map(effect => ({ kind: effect.kind, age: world.runtime.time - effect.started })) });
      onInfo(`${calls} draw calls · ${triangles.toLocaleString()} triangles · DPR ${gl.getPixelRatio().toFixed(1)}`);
    }
  });
  return null;
}

/** A follow-camera view at a spot in play: what a child actually sees while walking. */
const PLAY_SPOTS: Partial<Record<View, { x: number; z: number; yaw?: number }>> = {
  "market-play": { x: 37, z: 1 }, "school-play": { x: 1, z: -38 }, "harbor-play": { x: 8, z: 37 }, "festival-play": { x: -47, z: 5 }
};

function setView(world: WorldAPI, view: View) {
  world.setBottomPanel(0);
  const fix = fixView(view);
  if (fix) {
    world.teleport(fix.player);
    world.setCamera(fix.closeup ? { mode: "path", elapsed: 0, keys: [{ ...fix.closeup, duration: 1e8 }] } : { mode: "follow" });
    return;
  }
  if (view === "walk") { world.setCamera({ mode: "follow" }); return; }
  if (view === "play-follow") {
    world.teleport({ x: 4, z: 6 }); world.setCamera({ mode: "follow" }); return;
  }
  const spot = PLAY_SPOTS[view];
  if (spot) { world.teleport(spot); world.setCamera({ mode: "follow" }); return; }
  if (view === "conversation" || view === "stall-talk" || view === "trade" || view === "deposit") {
    const id = view === "stall-talk" ? "max" : view === "deposit" ? "pom" : view === "trade" ? "bruno" : "ken";
    const target = world.positionOf({ kind: "npc", id })!;
    world.teleport(view === "stall-talk" ? { x: target.x - 1.7, z: target.z + 0.6 } : { x: target.x - 1.8, z: target.z + 1.3 });
    world.setBottomPanel(view === "stall-talk" ? 330 : 200);
    world.setCamera({ mode: "conversation", target });
    if (view === "conversation" || view === "stall-talk") { world.gesture(id, "talk"); world.speak(id, 60); }
    return;
  }
  const shot = districtShots[view as keyof typeof districtShots];
  const p = view === "library" ? { x: -19, z: -40 } : view === "fireworks" || view === "finale" ? { x: -44, z: 9 } : view in DISTRICTS ? DISTRICTS[view as DistrictId] : { x: 4, z: 6 };
  world.teleport(p);
  world.setCamera({ mode: "path", elapsed: 0, keys: [{ position: shot, target: shot.target, duration: 1e8 }] });
}

function gather(world: WorldAPI) {
  const snapshot = structuredClone(world.runtime.state);
  for (const [npc, spot] of Object.entries(FINALE_CREW)) snapshot.npcs[npc as NpcId] = { ...spot, y: 0, district: "festival", indicator: null };
  world.setState(snapshot);
  world.setParty(true);
  world.teleport({ x: -50.6, z: 2.6, yaw: -Math.PI / 2 });
  world.setKiwi("cheer");
  for (const npc of NPC_IDS) world.mood(npc, "happy");
}

export default function WorldGallery() {
  const [chapter, setChapter] = useState<ChapterId>(() => fixView(initialView)?.chapter ?? Math.max(1, Math.min(5, Number(params.get("chapter")) || 5)) as ChapterId);
  const [view, changeView] = useState<View>(initialView);
  const [chestCount, changeChestCount] = useState(Number(params.get("chest")) || 0);
  const [info, setInfo] = useState("");
  const [event, setEvent] = useState("WASD / arrows · tap ground · E / Enter talks");
  const world = useMemo(() => createWorld(worldStateFromGame(startChapter(chapter, { mode: "replay", campaignSeed: 31 }))), []);
  useEffect(() => {
    const fix = fixView(view);
    const state = worldStateFromGame(startChapter(fix?.chapter ?? chapter, { mode: "replay", campaignSeed: 31 }));
    if (chestCount) { state.chestCount = chestCount; state.chestItems = ITEM_IDS.slice(0, chestCount); }
    if (fix) {
      state.chestCount = fix.chest ?? 8; state.chestItems = ITEM_IDS.slice(0, state.chestCount);
      for (const [id, progress] of Object.entries(fix.gates ?? {})) state.gates[id as GateId] = progress > 0;
    }
    if (view === "chest-2") { state.chestCount = 2; state.chestItems = ITEM_IDS.slice(0, 2); }
    if (view === "gates-closed") { state.gates.school = false; state.gates.bridge = false; }
    if (view === "arch-closed") state.gates.arch = false;
    world.setState(state, { settleGates: !!fix }); setView(world, view);
    if (view === "wind") world.fx({ kind: "wind", from: { x: 14, y: 1.6, z: 1 }, targets: ["square", "square", "market", "market", "school", "school", "harbor", "harbor", "festival"].map(id => ({ ...DISTRICTS[id as DistrictId], y: 0.15 })) });
    const launch = chestPose(5);
    if (view === "fireworks") world.fx({ kind: "fireworks", at: { x: launch.x + 3, y: 1.8, z: launch.z }, index: 3 });
    if (view === "finale") {
      gather(world);
      world.setFinale("open");
      world.fx({ kind: "fireworks", at: { x: launch.x + 3, y: 1.8, z: launch.z }, index: 1 });
    }
    if (view === "stall-talk") { world.mood("max", "happy"); }
    if (view === "bench") world.gesture("ume", "sit");
    if (view === "trade") {
      const at = world.positionOf({ kind: "npc", id: "bruno" })!;
      const hand = { ...world.runtime.player, y: 1.05 }, npcHand = { ...at, y: 1.2 };
      world.playerGesture("give"); world.gesture("bruno", "give"); world.mood("bruno", "happy");
      world.fx({ kind: "trade", item: "pen", from: hand, to: npcHand });
      world.fx({ kind: "trade", item: "ruler", from: npcHand, to: hand });
    }
    if (view === "deposit") world.fx({ kind: "deposit", item: "pencil", from: { ...world.runtime.player, y: 1.05 }, to: world.chestSlot("pencil") });
    if (view === "sea-chest") world.runtime.state.seaChest = { items: ["stapler", "pen", "ruler"], locks: [true, false, false], open: false };
  }, [world, chapter, chestCount, view]);
  useEffect(() => world.onInteract(target => setEvent(`onInteract: ${target.kind}${"id" in target ? `:${target.id}` : ""}`)), [world]);
  return <main style={{ position: "fixed", inset: 0, background: "#cfe7f2" }}>
    <Canvas flat dpr={Math.min(devicePixelRatio, 1.5)} gl={{ antialias: true }} camera={{ position: [4, 8, 18], fov: 46, near: 0.1, far: 420 }}>
      <World world={world} reviewGateProgress={fixView(view)?.gates} />
      <FixReviewFrame world={world} view={view} />
      <ReviewEffect world={world} view={view} />
      <Probe world={world} view={view} onInfo={setInfo} />
    </Canvas>
    {!params.has("clean") && <><div style={{ position: "absolute", top: 12, left: 12, maxWidth: "calc(100% - 24px)", padding: 12, borderRadius: 12, background: "#fff9edee", color: "#3d4435", font: "16px system-ui", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <strong>Town review</strong>
      <label>Chapter <select aria-label="Chapter" value={chapter} onChange={e => setChapter(Number(e.target.value) as ChapterId)}>{[1, 2, 3, 4, 5].map(n => <option key={n}>{n}</option>)}</select></label>
      <label>View <select aria-label="View" value={view} onChange={e => changeView(e.target.value as View)}>{VIEWS.map(v => <option key={v}>{v}</option>)}</select></label>
      <label>Chest <select aria-label="Chest" value={chestCount} onChange={e => changeChestCount(Number(e.target.value))}>{[0, 2, 4, 6, 8, 9].map(n => <option key={n} value={n}>{n || "chapter start"}</option>)}</select></label>
      <button onClick={() => world.setInputLocked(!world.runtime.locked)}>Toggle input lock</button>
      <button onClick={() => { const target = world.runtime.focus && world.positionOf(world.runtime.focus); world.setCamera(target ? { mode: "conversation", target } : { mode: "follow" }); }}>Conversation</button>
      <button onClick={() => world.setBottomPanel(world.runtime.bottomPanel ? 0 : 250)}>Lens shift</button>
      <button onClick={() => { world.playCutscene("intro"); world.fx({ kind: "wind", from: { x: 14, y: 1.6, z: 1 }, targets: ["square", "square", "market", "market", "school", "school", "harbor", "harbor", "festival"].map(id => ({ ...DISTRICTS[id as DistrictId], y: 0.15 })) }); }}>Wind</button>
      <button onClick={() => world.fx({ kind: "fireworks", at: { x: -48, y: 2, z: 0 } })}>Fireworks</button>
      <select aria-label="Gate shot" defaultValue="" onChange={e => { if (e.target.value) world.playCutscene(e.target.value as keyof typeof GATE_POSITIONS); }}><option value="">Gate shot</option>{Object.keys(GATE_POSITIONS).map(g => <option key={g}>{g}</option>)}</select>
    </div>
    <div style={{ position: "absolute", bottom: 12, left: 12, padding: "8px 12px", borderRadius: 10, background: "#fff9edee", color: "#3d4435", font: "16px system-ui" }}>{event}</div>
    <output data-world-info style={{ position: "absolute", bottom: 12, right: 12, padding: "8px 12px", borderRadius: 10, background: "#fff9edee", color: "#3d4435", font: "16px system-ui" }}>{info}</output></>}
  </main>;
}
