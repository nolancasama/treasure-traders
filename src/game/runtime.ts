import { ITEM_IDS, NPC_IDS, type NpcId } from "./content/ids";
import { indicators, objectives, placement, spotActive, unasked, type GameState } from "./logic";
import { findPath, nearestWalkable, standY } from "./world/collision";
import { CHEST_SCALE, chestPose, GATE_POSITIONS, npcPosition, SPOTS } from "./world/layout";
import type { CameraCommand, CameraKey, FinaleStage, FxCommand, GateId, Gates, Interaction, NpcCommand, Point, Position, WorldRuntime, WorldState } from "./world/types";
import type { Expression, RigGesture, RigState } from "../scene/models/people";
import { CHEST_SLOTS } from "../scene/models/festivalChest";
import { SCHOOL_GATE_SECONDS } from "../scene/town/schoolGate";

/** Adapter only: world rendering never decides or applies game rules. */
export function worldStateFromGame(game: GameState): WorldState {
  const marks = indicators(game), unknown = unasked(game);
  const objective = objectives(game)[0]?.target;
  const npcs: WorldState["npcs"] = {};
  for (const id of NPC_IDS) {
    const p = npcPosition(game.chapter, id, placement(game, id));
    npcs[id] = { ...p, indicator: objective?.kind === "npc" && objective.id === id ? "star" : marks[id] === "ask" ? "!" : marks[id] === "sticker" ? "sticker" : unknown.includes(id) ? "?" : null };
  }
  const chestItems = ITEM_IDS.filter(i => (game.holdings.chest?.[i] ?? 0) > 0);
  return {
    chapter: game.chapter,
    gates: { cart: game.unlockedAreas.includes("market"), school: game.unlockedAreas.includes("school"), bridge: game.unlockedAreas.includes("harbor"), arch: game.unlockedAreas.includes("festival") },
    chestCount: chestItems.length, chestItems, npcs,
    items: game.instance.spots.filter(s => s.kind === "distractor" || (game.holdings[`spot:${s.id}`]?.[s.item] ?? 0) > 0).map(s => ({ spotId: s.id, item: s.item, kind: s.kind, active: spotActive(game.instance, s.id, game.flags) })),
    seaChest: { items: game.instance.seaChest ?? [], locks: (game.instance.seaChest ?? []).map((_, i) => !!game.flags[`seaLock${i}`]), open: !!game.flags.seaOpened }
  };
}

/** The chest count decorations show: a deposit waits for its item to land first. */
export const decorationLevel = (rt: WorldRuntime) => rt.decorHold === null ? rt.state.chestCount : Math.min(rt.state.chestCount, rt.decorHold);
/** All nine in the chest and its lid is allowed to be open: dusk and the lanterns follow. */
export const festivalRevealed = (rt: WorldRuntime) => rt.state.chestCount >= 9 && rt.finale !== "armed" && rt.finale !== "blaze";

/** Closing blocks immediately; opening waits for the visible barrier to settle. */
export function navigationGates(rt: WorldRuntime): Gates {
  return Object.fromEntries((Object.keys(rt.state.gates) as GateId[]).map(id =>
    [id, rt.state.gates[id] && (rt.gateProgress === null || rt.gateProgress[id] === 1)])) as Gates;
}

export interface WorldAPI {
  /** Renderer handle; consumers should use commands for mutations. */
  readonly runtime: WorldRuntime;
  setState(state: WorldState, options?: { settleGates?: boolean }): void;
  setInputLocked(locked: boolean): void;
  setBottomPanel(height: number): void;
  setCamera(command: CameraCommand): void;
  playCutscene(name: "intro" | "cart" | "school" | "bridge" | "arch" | "finale"): void;
  gesture(npc: NpcId, gesture: RigGesture | RigState): void;
  hold(npc: NpcId, item: Parameters<import("../scene/models/people").CharacterRig["hold"]>[0]): void;
  setKiwi(mode: "follow" | "perch" | "hint" | "cheer", target?: Position): void;
  kiwiSpeak(seconds: number): void;
  /** Sets (or with null, clears) an NPC's face until told otherwise. */
  mood(npc: NpcId, mood: Expression | null): void;
  /** Moves an NPC's mouth and head for about this many seconds. */
  speak(npc: NpcId, seconds: number): void;
  playerGesture(gesture: RigGesture | RigState): void;
  playerHold(item: Parameters<import("../scene/models/people").CharacterRig["hold"]>[0]): void;
  playerMood(mood: Expression | null): void;
  holdDecorations(level: number | null): void;
  setFinale(stage: FinaleStage): void;
  setParty(party: boolean): void;
  fx(command: FxCommand): number;
  walkTo(point: Point, interact?: Interaction): boolean;
  relocate(position: Point & { yaw: number }): Point & { yaw: number };
  teleport(position: Point & { yaw?: number }): void;
  positionOf(target: Interaction): Position | undefined;
  chestSlot(item: typeof ITEM_IDS[number]): Position;
  onInteract(listener: (target: Interaction) => void): () => void;
  onArrive(listener: (position: Position) => void): () => void;
}

/** Hand-framed so nothing but the subject sits between the lens and the action. */
function cutsceneKeys(name: "intro" | "cart" | "school" | "bridge" | "arch" | "finale"): CameraKey[] {
  if (name === "intro") return [
    // The cart spills into the sky above the square, then the view settles on the Mayor.
    { position: { x: 15, y: 6.5, z: 22 }, target: { x: 4, y: 6, z: 0 }, duration: 2.8 },
    { position: { x: 13, y: 7, z: 21 }, target: { x: 3, y: 7, z: 0 }, duration: 2.2 },
    { position: { x: 5.5, y: 3.4, z: 0.6 }, target: { x: 1.8, y: 1.3, z: -8 }, duration: 60 }
  ];
  // The finale opens close on the chest; the flow pulls back from here when the lid is open.
  if (name === "finale") {
    const pose = chestPose(5);
    return [
      { position: { x: pose.x + 9, y: 3.8, z: pose.z }, target: { x: pose.x, y: 1.5, z: pose.z }, duration: 1 },
      { position: { x: pose.x + 6.6, y: 2.9, z: pose.z }, target: { x: pose.x, y: 1.6, z: pose.z }, duration: 60 }
    ];
  }
  if (name === "school") return [
    // Keep the closed span and its entire eastward parking bay in frame.
    { position: { x: 4, y: 6.8, z: -5 }, target: { x: 4, y: 1.4, z: -22 }, duration: SCHOOL_GATE_SECONDS + 0.9 },
    { position: { x: 4, y: 6.8, z: -5 }, target: { x: 4, y: 1.4, z: -22 }, duration: 0.3 }
  ];
  const at = GATE_POSITIONS[name], y = standY(at.x, at.z);
  return [
    { position: { x: at.x + 10, y: y + 9, z: at.z + 14 }, target: { ...at, y: y + 1 }, duration: 1.2 },
    { position: { x: at.x + 4, y: y + 5, z: at.z + 9 }, target: { ...at, y: y + 1 }, duration: 2 }
  ];
}

/** One independent world per mount. Public command surface is frozen. */
export function createWorld(initial: WorldState): WorldAPI {
  const interacts = new Set<(target: Interaction) => void>();
  const arrivals = new Set<(position: Position) => void>();
  let serial = 0;
  const runtime: WorldRuntime = {
    state: structuredClone(initial), revision: 0, time: 0, gateProgress: null,
    player: { x: 0, y: 0, z: 8, yaw: Math.PI, speed: 0 },
    locked: false, bottomPanel: 0, camera: { mode: "follow" }, cameraYaw: 0, manualInputYaw: null,
    path: [], pending: null, deferredWalk: null, focus: null, npcCommands: {}, playerCommand: null, decorHold: null, finale: "none", party: false,
    kiwi: { mode: "follow" }, effects: [],
    emitInteract: target => interacts.forEach(f => f(target)),
    emitArrive: position => arrivals.forEach(f => f({ ...position }))
  };
  const positionOf = (target: Interaction): Position | undefined => target.kind === "npc" ? runtime.state.npcs[target.id] : target.kind === "spot" ? SPOTS[target.id] : { x: 10, y: standY(10, 36), z: 36 };
  const relocate = (p: Point & { yaw: number }) => ({ ...nearestWalkable(p.x, p.z, runtime.state.gates), yaw: Number.isFinite(p.yaw) ? p.yaw : 0 });
  const command = (npc: NpcId, patch: Partial<NpcCommand>) => { runtime.npcCommands[npc] = { ...runtime.npcCommands[npc], ...patch, serial: ++serial }; };
  const commandPlayer = (patch: Partial<NpcCommand>) => { runtime.playerCommand = { ...runtime.playerCommand, ...patch, serial: ++serial }; };
  const api: WorldAPI = {
    runtime,
    setState(state, options) {
      runtime.state = structuredClone(state); runtime.revision++;
      if (options?.settleGates || !state.gates.school) runtime.schoolGateHeld = false;
      if (options?.settleGates && runtime.gateProgress) {
        for (const id of Object.keys(state.gates) as GateId[]) runtime.gateProgress[id] = state.gates[id] ? 1 : 0;
      }
      runtime.path = []; runtime.pending = null; runtime.deferredWalk = null;
      const p = relocate(runtime.player);
      Object.assign(runtime.player, p, { y: standY(p.x, p.z), speed: 0 });
    },
    setInputLocked(locked) {
      // Only locking cancels a walk; a repeated unlock must not drop a tapped approach.
      if (locked) { runtime.path = []; runtime.pending = null; runtime.deferredWalk = null; runtime.player.speed = 0; runtime.focus = null; runtime.manualInputYaw = null; }
      runtime.locked = locked;
    },
    setBottomPanel(height) { runtime.bottomPanel = Number.isFinite(height) ? Math.max(0, height) : 0; },
    setCamera(command) { runtime.camera = structuredClone(command); },
    playCutscene(name) {
      runtime.camera = { mode: "path", elapsed: 0, keys: cutsceneKeys(name) };
    },
    gesture(npc, gesture) { command(npc, { gesture }); },
    hold(npc, held) { command(npc, { held }); },
    mood(npc, mood) { command(npc, { mood }); },
    speak(npc, seconds) { command(npc, { speak: seconds }); },
    playerGesture(gesture) { commandPlayer({ gesture }); },
    playerHold(held) { commandPlayer({ held }); },
    playerMood(mood) { commandPlayer({ mood }); },
    holdDecorations(level) { runtime.decorHold = level; },
    setFinale(stage) { runtime.finale = stage; },
    setParty(party) { runtime.party = party; },
    setKiwi(mode, target) { runtime.kiwi = { mode, target: target ? { ...target } : undefined, speakUntil: runtime.kiwi.speakUntil }; },
    kiwiSpeak(seconds) { runtime.kiwi.speakUntil = runtime.time + seconds; },
    fx(command) { const id = ++serial; runtime.effects.push({ ...structuredClone(command), id, started: runtime.time }); return id; },
    walkTo(point, interact) {
      if (runtime.locked) return false;
      const gates = navigationGates(runtime);
      if ((Object.keys(gates) as GateId[]).some(id => runtime.state.gates[id] && !gates[id])) {
        runtime.deferredWalk = { point: { x: point.x, z: point.z }, interact };
        runtime.path = []; runtime.pending = null;
        return true;
      }
      runtime.deferredWalk = null;
      const path = findPath(runtime.player, point, gates);
      if (!path.length) return false;
      runtime.path = path; runtime.pending = interact ?? null;
      return true;
    },
    relocate,
    teleport(p) { Object.assign(runtime.player, relocate({ ...p, yaw: p.yaw ?? runtime.player.yaw })); runtime.player.y = standY(runtime.player.x, runtime.player.z); runtime.path = []; runtime.pending = null; runtime.deferredWalk = null; runtime.player.speed = 0; },
    positionOf,
    chestSlot(item) {
      const slot = CHEST_SLOTS[ITEM_IDS.indexOf(item)].pos, pose = chestPose(runtime.state.chapter);
      const c = Math.cos(pose.yaw), s = Math.sin(pose.yaw), z = slot.z + 0.03;
      return { x: pose.x + (slot.x * c + z * s) * CHEST_SCALE, y: pose.y + slot.y * CHEST_SCALE, z: pose.z + (-slot.x * s + z * c) * CHEST_SCALE };
    },
    onInteract(listener) { interacts.add(listener); return () => { interacts.delete(listener); }; },
    onArrive(listener) { arrivals.add(listener); return () => { arrivals.delete(listener); }; }
  };
  return Object.freeze(api);
}
