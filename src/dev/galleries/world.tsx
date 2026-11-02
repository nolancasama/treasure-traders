import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { DISTRICT_IDS, ITEM_IDS, NPC_IDS, type ChapterId, type DistrictId, type NpcId } from "../../game/content/ids";
import { startChapter } from "../../game/logic";
import { createWorld, worldStateFromGame, type WorldAPI } from "../../game/runtime";
import { chestPose, DISTRICTS, FINALE_CREW, FINALE_VIEW, GATE_POSITIONS } from "../../game/world/layout";
import { World } from "../../scene/World";
import { markGalleryReady } from "../ready";

const params = new URLSearchParams(location.search);
const VIEWS = ["walk", ...DISTRICT_IDS, "library", "play-follow", "conversation", "gates-ch1", "gates-closed", "arch-closed", "wind", "fireworks", "chest-2", "finale", "title", "bench", "stall-talk", "market-play", "school-play", "harbor-play", "festival-play", "trade", "deposit", "chest-close", "sea-chest", "sky"] as const;
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

function Probe({ world, onInfo }: { world: WorldAPI; onInfo: (info: string) => void }) {
  const { gl } = useThree();
  const frames = useRef(0), acc = useRef(0);
  useFrame((_, dt) => {
    frames.current++; acc.current += dt;
    if (frames.current === 16) markGalleryReady();
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
  const [chapter, setChapter] = useState<ChapterId>(() => Math.max(1, Math.min(5, Number(params.get("chapter")) || 5)) as ChapterId);
  const [view, changeView] = useState<View>(initialView);
  const [chestCount, changeChestCount] = useState(Number(params.get("chest")) || 0);
  const [info, setInfo] = useState("");
  const [event, setEvent] = useState("WASD / arrows · tap ground · E / Enter talks");
  const world = useMemo(() => createWorld(worldStateFromGame(startChapter(chapter, { mode: "replay", campaignSeed: 31 }))), []);
  useEffect(() => {
    const state = worldStateFromGame(startChapter(chapter, { mode: "replay", campaignSeed: 31 }));
    if (chestCount) { state.chestCount = chestCount; state.chestItems = ITEM_IDS.slice(0, chestCount); }
    if (view === "chest-2") { state.chestCount = 2; state.chestItems = ITEM_IDS.slice(0, 2); }
    if (view === "gates-closed") { state.gates.school = false; state.gates.bridge = false; }
    if (view === "arch-closed") state.gates.arch = false;
    world.setState(state); setView(world, view);
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
      <World world={world} />
      <ReviewEffect world={world} view={view} />
      <Probe world={world} onInfo={setInfo} />
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
