import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ITEM_IDS, type ItemId } from "../../game/content/ids";
import { PartBuilder } from "../partBuilder";
import { flatMat, glowMat, smoothMat } from "../materials";
import { plaqueGeometry } from "./items";
import { GOLD, WOOD } from "./palette";

/**
 * The Festival Treasure Chest (SPEC §6): a big festive wooden chest whose
 * front shows nine medallions in canonical item order. Empty medallions show
 * a pale silhouette; filled ones show the item in colour on gold; a glowing
 * slot pulses. The lid hinges at the back for the finale.
 */
export type SlotState = "empty" | "filled" | "glowing";

const W = 1.6;
const D = 0.9;
const H = 0.78;
const MED = 0.2;

/** Medallion centres on the front face, row-major in canonical order. */
export const CHEST_SLOTS: { item: ItemId; pos: THREE.Vector3 }[] = ITEM_IDS.map((item, i) => {
  const col = i % 3;
  const row = Math.floor(i / 3);
  return { item, pos: new THREE.Vector3((col - 1) * 0.25, H - 0.17 - row * 0.235, D / 2 + 0.03) };
});

function baseGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0.25);
  b.box(W, H - 0.04, D, 0, 0, 0, WOOD.main);
  // Dark interior, visible when the lid opens.
  b.box(W - 0.1, 0.01, D - 0.1, 0, H - 0.04, 0, "#2a160a");
  // Planks and gold trim.
  for (let i = 1; i < 4; i++) b.box(W + 0.01, 0.018, D + 0.01, 0, (H / 4) * i - 0.009, 0, WOOD.dark);
  for (const x of [-W / 2 + 0.06, W / 2 - 0.06]) b.box(0.1, H + 0.02, D + 0.02, x, -0.01, 0, GOLD.dark);
  // Gold rim around the opening.
  for (const z of [-D / 2 + 0.015, D / 2 - 0.015]) b.box(W + 0.03, 0.1, 0.06, 0, H - 0.1, z, GOLD.main);
  for (const x of [-W / 2 + 0.015, W / 2 - 0.015]) b.box(0.06, 0.1, D + 0.03, x, H - 0.1, 0, GOLD.main);
  b.box(W + 0.04, 0.07, D + 0.04, 0, 0, 0, WOOD.deep);
  // Front panel behind the medallions.
  b.box(0.82, 0.74, 0.04, 0, 0.03, D / 2 + 0.005, WOOD.dark);
  for (const s of CHEST_SLOTS) {
    b.add(new THREE.CylinderGeometry(MED / 2 + 0.018, MED / 2 + 0.018, 0.03, 20), GOLD.main, [s.pos.x, s.pos.y, D / 2 + 0.02], [Math.PI / 2, 0, 0]);
    b.add(new THREE.CylinderGeometry(MED / 2, MED / 2, 0.032, 20), "#3a2410", [s.pos.x, s.pos.y, D / 2 + 0.024], [Math.PI / 2, 0, 0]);
  }
  // Festival ribbons on the sides.
  for (const x of [-W / 2 - 0.012, W / 2 + 0.012]) b.box(0.02, H * 0.9, 0.24, x, 0.03, 0, "#e5484d");
  return b.build();
}

function lidGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  // Rounded lid around the hinge at the back top edge (origin = hinge).
  b.add(new THREE.CylinderGeometry(D / 2, D / 2, W, 20, 1, false, 0, Math.PI), WOOD.main, [0, 0, D / 2], [0, 0, Math.PI / 2], [0.62, 1, 1], { flatAo: true });
  for (const x of [-W / 2 + 0.06, 0, W / 2 - 0.06])
    b.add(new THREE.CylinderGeometry(D / 2 + 0.012, D / 2 + 0.012, 0.09, 20, 1, false, 0, Math.PI), GOLD.main, [x, 0, D / 2], [0, 0, Math.PI / 2], [0.62, 1, 1], { flatAo: true });
  // Underside plate: the inside of the lid when it opens (the dome is single-sided).
  b.add(new THREE.BoxGeometry(W - 0.01, 0.02, D - 0.01), WOOD.dark, [0, 0.01, D / 2], [0, 0, 0], [1, 1, 1], { flatAo: true });
  // Clasp.
  b.add(new THREE.BoxGeometry(0.16, 0.18, 0.05), GOLD.main, [0, -0.02, D + 0.01], [0, 0, 0], [1, 1, 1], { flatAo: true });
  b.add(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 12), GOLD.dark, [0, -0.04, D + 0.04], [Math.PI / 2, 0, 0], [1, 1, 1], { flatAo: true });
  return b.build();
}

/** A medallion's contents: a pale silhouette, or the item in colour on a cream disc. */
function slotGeometry(item: ItemId, filled: boolean): THREE.BufferGeometry {
  if (!filled) return plaqueGeometry(item, MED * 0.78, { silhouette: "#8a6a48" });
  const disc = new PartBuilder(0)
    .add(new THREE.CylinderGeometry(MED / 2 - 0.006, MED / 2 - 0.006, 0.006, 24), "#fff3d1", [0, 0, -0.018], [Math.PI / 2, 0, 0], [1, 1, 1], { flatAo: true })
    .build();
  const merged = mergeGeometries([disc, plaqueGeometry(item, MED * 0.86)], false);
  disc.dispose();
  return merged;
}

export class FestivalChest {
  readonly group = new THREE.Group();
  readonly lid = new THREE.Group();
  private slotMeshes: THREE.Mesh[] = [];
  private glows: THREE.Sprite[] = [];
  private states: SlotState[] = ITEM_IDS.map(() => "empty");
  private t = 0;
  private lidOpen = 0;

  constructor() {
    const base = new THREE.Mesh(baseGeometry(), flatMat());
    this.group.add(base);
    this.lid.position.set(0, H, -D / 2);
    this.lid.add(new THREE.Mesh(lidGeometry(), flatMat()));
    this.group.add(this.lid);
    CHEST_SLOTS.forEach((s, i) => {
      const m = new THREE.Mesh(slotGeometry(s.item, false), smoothMat());
      m.position.set(s.pos.x, s.pos.y, D / 2 + 0.045);
      this.group.add(m);
      this.slotMeshes.push(m);
      const g = new THREE.Sprite(glowMat(GOLD.light, 0));
      g.scale.setScalar(0.42);
      g.position.set(s.pos.x, s.pos.y, D / 2 + 0.08);
      this.group.add(g);
      this.glows.push(g);
      this.states[i] = "empty";
    });
    this.group.name = "festivalChest";
  }

  /** Sets one slot by canonical index or item id. */
  setSlot(slot: number | ItemId, state: SlotState): void {
    const i = typeof slot === "number" ? slot : ITEM_IDS.indexOf(slot);
    if (this.states[i] === state) return;
    const was = this.states[i];
    this.states[i] = state;
    const item = CHEST_SLOTS[i].item;
    if ((was === "empty") !== (state === "empty")) {
      const m = this.slotMeshes[i];
      m.geometry.dispose();
      m.geometry = slotGeometry(item, state !== "empty");
    }
  }

  /** Filled slots from a list of deposited items. */
  setContents(items: readonly ItemId[]): void {
    ITEM_IDS.forEach((id, i) => {
      if (this.states[i] !== "glowing" || !items.includes(id)) this.setSlot(i, items.includes(id) ? "filled" : "empty");
    });
  }

  slotState(i: number): SlotState {
    return this.states[i];
  }

  /** World position of a slot (for deposit fly-in effects). */
  slotWorld(item: ItemId): THREE.Vector3 {
    const s = CHEST_SLOTS[ITEM_IDS.indexOf(item)];
    return this.group.localToWorld(new THREE.Vector3(s.pos.x, s.pos.y, D / 2 + 0.06));
  }

  /** 0 = closed, 1 = open. */
  setLidOpen(v: number): void {
    this.lidOpen = THREE.MathUtils.clamp(v, 0, 1);
  }

  /** The point fireworks burst from. */
  get mouth(): THREE.Vector3 {
    return this.group.localToWorld(new THREE.Vector3(0, H + 0.1, 0));
  }

  update(dt: number): void {
    this.t += dt;
    this.lid.rotation.x = -this.lidOpen * 1.9;
    this.glows.forEach((g, i) => {
      const st = this.states[i];
      const target = st === "glowing" ? 0.6 + Math.sin(this.t * 5) * 0.35 : st === "filled" ? 0.3 + Math.sin(this.t * 1.5 + i) * 0.08 : 0;
      g.material.opacity += (target - g.material.opacity) * Math.min(1, dt * 6);
    });
  }
}

export const FESTIVAL_CHEST_SIZE = { w: W, d: D, h: H + D * 0.31 };
