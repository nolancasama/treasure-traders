import { ITEM_IDS, NPC_IDS, type NpcId } from "./content/ids";
import { indicators, objectives, placement, spotActive, unasked, type GameState } from "./logic";
import { findPath, nearestWalkable, standY } from "./world/collision";
import { DISTRICTS, GATE_POSITIONS, npcPosition, SPOTS } from "./world/layout";
import type { CameraCommand, FxCommand, Interaction, Point, Position, WorldRuntime, WorldState } from "./world/types";
import type { RigGesture, RigState } from "../scene/models/people";
import { CHEST_SLOTS } from "../scene/models/festivalChest";

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

export interface WorldAPI {
  /** Renderer handle; consumers should use commands for mutations. */
  readonly runtime: WorldRuntime;
  setState(state: WorldState): void;
  setInputLocked(locked: boolean): void;
  setBottomPanel(height: number): void;
  setCamera(command: CameraCommand): void;
  playCutscene(name: "intro" | "cart" | "school" | "bridge" | "arch" | "finale"): void;
  gesture(npc: NpcId, gesture: RigGesture | RigState): void;
  hold(npc: NpcId, item: Parameters<import("../scene/models/people").CharacterRig["hold"]>[0]): void;
  setKiwi(mode: "follow" | "perch" | "hint", target?: Position): void;
  fx(command: FxCommand): number;
  walkTo(point: Point, interact?: Interaction): boolean;
  relocate(position: Point & { yaw: number }): Point & { yaw: number };
  teleport(position: Point & { yaw?: number }): void;
  positionOf(target: Interaction): Position | undefined;
  chestSlot(item: typeof ITEM_IDS[number]): Position;
  onInteract(listener: (target: Interaction) => void): () => void;
  onArrive(listener: (position: Position) => void): () => void;
}

/** One independent world per mount. Public command surface is frozen. */
export function createWorld(initial: WorldState): WorldAPI {
  const interacts = new Set<(target: Interaction) => void>();
  const arrivals = new Set<(position: Position) => void>();
  let serial = 0;
  const runtime: WorldRuntime = {
    state: structuredClone(initial), revision: 0, time: 0,
    player: { x: 0, y: 0, z: 8, yaw: Math.PI, speed: 0 },
    locked: false, bottomPanel: 0, camera: { mode: "follow" }, cameraYaw: 0,
    path: [], pending: null, focus: null, npcCommands: {}, kiwi: { mode: "follow" }, effects: [],
    emitInteract: target => interacts.forEach(f => f(target)),
    emitArrive: position => arrivals.forEach(f => f({ ...position }))
  };
  const positionOf = (target: Interaction): Position | undefined => target.kind === "npc" ? runtime.state.npcs[target.id] : target.kind === "spot" ? SPOTS[target.id] : { x: 10, y: standY(10, 36), z: 36 };
  const relocate = (p: Point & { yaw: number }) => ({ ...nearestWalkable(p.x, p.z, runtime.state.gates), yaw: Number.isFinite(p.yaw) ? p.yaw : 0 });
  const api: WorldAPI = {
    runtime,
    setState(state) {
      runtime.state = structuredClone(state); runtime.revision++;
      runtime.path = []; runtime.pending = null;
      const p = relocate(runtime.player);
      Object.assign(runtime.player, p, { y: standY(p.x, p.z), speed: 0 });
    },
    setInputLocked(locked) { runtime.locked = locked; runtime.path = []; runtime.pending = null; runtime.player.speed = 0; },
    setBottomPanel(height) { runtime.bottomPanel = Number.isFinite(height) ? Math.max(0, height) : 0; },
    setCamera(command) { runtime.camera = structuredClone(command); },
    playCutscene(name) {
      const at = name === "intro" ? DISTRICTS.square : name === "finale" ? DISTRICTS.festival : GATE_POSITIONS[name];
      const y = standY(at.x, at.z);
      runtime.camera = { mode: "path", elapsed: 0, keys: [
        { position: { x: at.x + 10, y: y + 9, z: at.z + 14 }, target: { ...at, y: y + 1 }, duration: 1.2 },
        { position: { x: at.x + 4, y: y + 5, z: at.z + 9 }, target: { ...at, y: y + 1 }, duration: name === "intro" ? 4 : 2 }
      ] };
    },
    gesture(npc, gesture) { runtime.npcCommands[npc] = { ...runtime.npcCommands[npc], gesture, serial: ++serial }; },
    hold(npc, held) { runtime.npcCommands[npc] = { held, serial: ++serial }; },
    setKiwi(mode, target) { runtime.kiwi = { mode, target: target ? { ...target } : undefined }; },
    fx(command) { const id = ++serial; runtime.effects.push({ ...structuredClone(command), id, started: runtime.time }); return id; },
    walkTo(point, interact) {
      if (runtime.locked) return false;
      const path = findPath(runtime.player, point, runtime.state.gates);
      if (!path.length) return false;
      runtime.path = path; runtime.pending = interact ?? null;
      return true;
    },
    relocate,
    teleport(p) { Object.assign(runtime.player, relocate({ ...p, yaw: p.yaw ?? runtime.player.yaw })); runtime.player.y = standY(runtime.player.x, runtime.player.z); runtime.path = []; runtime.pending = null; runtime.player.speed = 0; },
    positionOf,
    chestSlot(item) {
      const slot = CHEST_SLOTS[ITEM_IDS.indexOf(item)].pos;
      return { x: (runtime.state.chapter === 5 ? -55 : 0) + slot.x, y: slot.y + (runtime.state.chapter === 5 ? 0 : 0.15), z: (runtime.state.chapter === 5 ? 0 : -8) + slot.z + 0.03 };
    },
    onInteract(listener) { interacts.add(listener); return () => { interacts.delete(listener); }; },
    onArrive(listener) { arrivals.add(listener); return () => { arrivals.delete(listener); }; }
  };
  return Object.freeze(api);
}
