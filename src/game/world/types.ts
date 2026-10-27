import type { ChapterId, DistrictId, ItemId, NpcId } from "../content/ids";
import type { RigGesture, RigState } from "../../scene/models/people";

export interface Point { x: number; z: number }
export interface Position extends Point { y: number }
export type GateId = "cart" | "school" | "bridge" | "arch";
export type Gates = Record<GateId, boolean>;
export type Interaction = { kind: "npc"; id: NpcId } | { kind: "spot"; id: string } | { kind: "seaChest" };
export interface NpcPlacement extends Position { yaw?: number; indicator?: "!" | "?" | "sticker" | "star" | null; district: DistrictId }
export interface WorldItem { spotId: string; item: ItemId; kind: "collect" | "hidden" | "distractor"; active: boolean }
export interface WorldState {
  chapter: ChapterId;
  gates: Gates;
  chestCount: number;
  chestItems: ItemId[];
  npcs: Partial<Record<NpcId, NpcPlacement>>;
  items: WorldItem[];
  seaChest: { items: ItemId[]; locks: boolean[]; open: boolean };
}
export interface CameraKey { position: Position; target: Position; duration: number }
export type CameraCommand = { mode: "follow" } | { mode: "conversation"; target: Position } | { mode: "path"; keys: CameraKey[]; elapsed: number };
export type FxCommand =
  | { kind: "pickup"; item: ItemId; from: Position; screen: { x: number; y: number } }
  | { kind: "trade" | "give" | "deposit"; item: ItemId; from: Position; to: Position }
  | { kind: "sparkles" | "decoration" | "lock" | "fireworks"; at: Position; index?: number }
  | { kind: "wind"; from: Position; targets: Position[] };
export interface NpcCommand { gesture?: RigGesture | RigState; held?: ItemId | null; serial: number }
export interface WorldRuntime {
  state: WorldState;
  revision: number;
  time: number;
  player: Position & { yaw: number; speed: number };
  locked: boolean;
  bottomPanel: number;
  camera: CameraCommand;
  cameraYaw: number;
  path: Point[];
  pending: Interaction | null;
  focus: Interaction | null;
  npcCommands: Partial<Record<NpcId, NpcCommand>>;
  kiwi: { mode: "follow" | "perch" | "hint"; target?: Position };
  effects: (FxCommand & { id: number; started: number })[];
  emitInteract: (target: Interaction) => void;
  emitArrive: (position: Position) => void;
}
