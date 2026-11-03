import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ITEM_IDS, type ItemId } from "../../game/content/ids";
import { PartBuilder } from "../partBuilder";
import { glowMat, smoothMat } from "../materials";
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
const H = 0.9;
const MED = 0.235;

/** Medallion centres on the front face, row-major in canonical order. */
export const CHEST_SLOTS: { item: ItemId; pos: THREE.Vector3 }[] = ITEM_IDS.map((item, i) => {
  const col = i % 3;
  const row = Math.floor(i / 3);
  return { item, pos: new THREE.Vector3((col - 1) * 0.285, H - 0.175 - row * 0.262, D / 2 + 0.03) };
});

export function festivalChestBaseGeometry(): THREE.BufferGeometry {
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
  b.box(W + 0.05, 0.03, D + 0.05, 0, 0.07, 0, GOLD.dark);
  // Corner brackets and rivets catch the light from a distance.
  for (const x of [-W / 2 + 0.11, W / 2 - 0.11]) {
    b.box(0.14, 0.16, 0.02, x, 0.1, D / 2 + 0.006, GOLD.main);
    b.box(0.14, 0.16, 0.02, x, H - 0.3, D / 2 + 0.006, GOLD.main);
    for (const y of [0.34, 0.47, 0.6]) b.sphere(0.018, x - 0.05, y, D / 2 + 0.014, GOLD.light, [1, 1, 0.5], 6);
  }
  // Carrying handles on the sides.
  for (const x of [-W / 2 - 0.02, W / 2 + 0.02]) b.add(new THREE.TorusGeometry(0.1, 0.02, 5, 12, Math.PI), GOLD.main, [x, 0.5, 0], [0, Math.PI / 2, Math.PI]);
  // Front panel behind the medallions, with a gold border.
  b.box(0.98, 0.88, 0.035, 0, 0.012, D / 2 + 0.003, GOLD.dark);
  b.box(0.93, 0.83, 0.04, 0, 0.037, D / 2 + 0.005, WOOD.deep);
  for (const s of CHEST_SLOTS) {
    b.add(new THREE.CylinderGeometry(MED / 2 + 0.02, MED / 2 + 0.02, 0.03, 20), GOLD.main, [s.pos.x, s.pos.y, D / 2 + 0.02], [Math.PI / 2, 0, 0]);
    b.add(new THREE.CylinderGeometry(MED / 2, MED / 2, 0.032, 20), "#4a2e16", [s.pos.x, s.pos.y, D / 2 + 0.024], [Math.PI / 2, 0, 0]);
  }
  // Festival ribbons on the sides.
  for (const x of [-W / 2 - 0.012, W / 2 + 0.012]) b.box(0.02, H * 0.9, 0.24, x, 0.03, 0, "#e5484d");
  return b.build();
}

export function festivalChestLidGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  // Rounded lid around the hinge at the back top edge (origin = hinge).
  b.add(new THREE.CylinderGeometry(D / 2, D / 2, W, 20, 1, false, 0, Math.PI), WOOD.main, [0, 0, D / 2], [0, 0, Math.PI / 2], [0.62, 1, 1], { flatAo: true });
  for (const x of [-W / 2 + 0.06, -0.32, 0.32, W / 2 - 0.06])
    b.add(new THREE.CylinderGeometry(D / 2 + 0.012, D / 2 + 0.012, 0.09, 20, 1, false, 0, Math.PI), GOLD.main, [x, 0, D / 2], [0, 0, Math.PI / 2], [0.62, 1, 1], { flatAo: true });
  // Underside plate: the inside of the lid when it opens (the dome is single-sided).
  b.add(new THREE.BoxGeometry(W - 0.01, 0.02, D - 0.01), "#8a5526", [0, 0.01, D / 2], [0, 0, 0], [1, 1, 1], { flatAo: true });
  // A star on the crown of the lid, and a big clasp.
  b.add(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 5), GOLD.light, [0, D * 0.31 + 0.005, D / 2], [0, Math.PI / 2, 0], [1, 1, 1], { flatAo: true });
  b.add(new THREE.BoxGeometry(0.22, 0.24, 0.05), GOLD.main, [0, -0.03, D + 0.012], [0, 0, 0], [1, 1, 1], { flatAo: true });
  b.add(new THREE.CylinderGeometry(0.045, 0.045, 0.06, 12), GOLD.dark, [0, -0.05, D + 0.045], [Math.PI / 2, 0, 0], [1, 1, 1], { flatAo: true });
  return b.build();
}

/** A medallion's contents: a pale silhouette, or the item in colour on a cream disc. */
export function festivalChestSlotGeometry(item: ItemId, filled: boolean): THREE.BufferGeometry {
  if (!filled) return plaqueGeometry(item, MED * 0.8, { silhouette: "#c49b6c", chunky: true });
  const disc = new PartBuilder(0)
    .add(new THREE.CylinderGeometry(MED / 2 - 0.006, MED / 2 - 0.006, 0.006, 24), "#fff6d8", [0, 0, -0.018], [Math.PI / 2, 0, 0], [1, 1, 1], { flatAo: true })
    .build();
  const merged = mergeGeometries([disc, plaqueGeometry(item, MED * 0.88, { chunky: true })], false);
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
  private lidNow = 0;
  private lidSpeed = 0;
  private blaze = 0;
  private blazeNow = 0;
  private squash = 0;
  private baseScale = 1;
  private body: THREE.MeshLambertMaterial;
  private halo: THREE.Sprite;
  private shaft: THREE.Mesh;

  constructor() {
    // Its own material so the gold light can spread over the wood during the finale.
    this.body = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: "#ffa52e", emissiveIntensity: 0 });
    const base = new THREE.Mesh(festivalChestBaseGeometry(), this.body);
    this.group.add(base);
    this.lid.position.set(0, H, -D / 2);
    this.lid.add(new THREE.Mesh(festivalChestLidGeometry(), this.body));
    this.group.add(this.lid);
    CHEST_SLOTS.forEach((s, i) => {
      const m = new THREE.Mesh(festivalChestSlotGeometry(s.item, false), smoothMat());
      m.position.set(s.pos.x, s.pos.y, D / 2 + 0.045);
      this.group.add(m);
      this.slotMeshes.push(m);
      const g = new THREE.Sprite(glowMat(GOLD.light, 0));
      g.scale.setScalar(0.5);
      g.position.set(s.pos.x, s.pos.y, D / 2 + 0.08);
      g.visible = false;
      this.group.add(g);
      this.glows.push(g);
      this.states[i] = "empty";
    });
    this.halo = new THREE.Sprite(glowMat(GOLD.main, 0));
    this.halo.position.set(0, H * 0.7, 0.3);
    this.halo.visible = false;
    this.group.add(this.halo);
    // A shaft of gold rising from the open chest. Colour fades to black, which adds nothing.
    const beamGeometry = new THREE.CylinderGeometry(1.05, 0.6, 3.6, 16, 1, true);
    const position = beamGeometry.attributes.position, colors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      const k = 1 - (position.getY(i) + 1.8) / 3.6;
      colors[i * 3] = 1 * k; colors[i * 3 + 1] = 0.78 * k; colors[i * 3 + 2] = 0.32 * k;
    }
    beamGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    this.shaft = new THREE.Mesh(beamGeometry, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, opacity: 0 }));
    this.shaft.position.set(0, H + 1.8, 0);
    this.shaft.visible = false;
    this.shaft.raycast = () => {};
    this.group.add(this.shaft);
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
      m.geometry = festivalChestSlotGeometry(item, state !== "empty");
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

  /** Golden light across the whole chest, 0 to 1 (the finale). */
  setBlaze(v: number): void {
    this.blaze = THREE.MathUtils.clamp(v, 0, 1);
  }

  /** A small squash and a flash of gold when something lands in a slot. */
  pulse(): void {
    this.squash = 1;
  }

  /** The chest's scale in the world; pulses breathe around it. */
  setScale(v: number): void {
    this.baseScale = v;
    this.group.scale.setScalar(v);
  }

  /** The point fireworks burst from. */
  get mouth(): THREE.Vector3 {
    return this.group.localToWorld(new THREE.Vector3(0, H + 0.1, 0));
  }

  update(dt: number): void {
    this.t += dt;
    // A slightly springy lid: it throws open, then settles back.
    const target = this.lidOpen * 1.9;
    if (dt <= 0) this.lidNow = target;
    else {
      this.lidSpeed += (target - this.lidNow) * 34 * dt;
      this.lidSpeed *= Math.exp(-dt * 7);
      this.lidNow += this.lidSpeed * dt;
    }
    this.lid.rotation.x = -this.lidNow;
    this.blazeNow += (this.blaze - this.blazeNow) * Math.min(1, dt * 2.6);
    const shimmer = 0.5 + Math.sin(this.t * 7) * 0.5;
    this.squash = Math.max(0, this.squash - dt * 3);
    const s = Math.sin(this.squash * Math.PI) * 0.07;
    this.group.scale.set(this.baseScale * (1 + s * 0.6), this.baseScale * (1 - s), this.baseScale * (1 + s * 0.6));
    this.body.emissiveIntensity = this.blazeNow * (0.5 + shimmer * 0.16) + this.squash * 0.35;
    this.glows.forEach((g, i) => {
      const st = this.states[i];
      const want = Math.max(st === "glowing" ? 0.6 + Math.sin(this.t * 5) * 0.35 : 0, st === "empty" ? 0 : this.blazeNow * (0.72 + Math.sin(this.t * 6 + i) * 0.25));
      g.material.opacity += (want - g.material.opacity) * Math.min(1, dt * 6);
      // A hidden sprite costs nothing; an invisible but drawn one still costs a draw call.
      g.visible = g.material.opacity > 0.01;
    });
    const halo = Math.max(this.blazeNow * 0.95, this.squash * 0.75);
    this.halo.visible = halo > 0.01;
    this.halo.material.opacity = halo;
    this.halo.scale.setScalar(1.6 + halo * 2 + shimmer * 0.2);
    const beam = THREE.MathUtils.clamp(this.lidNow / 1.9, 0, 1) * Math.max(0.45, this.blazeNow);
    this.shaft.visible = beam > 0.02;
    (this.shaft.material as THREE.MeshBasicMaterial).opacity = beam * (0.6 + shimmer * 0.12);
  }

  dispose(): void {
    this.body.dispose();
    (this.shaft.material as THREE.Material).dispose();
    this.halo.material.dispose();
    this.glows.forEach(g => g.material.dispose());
  }
}

export const FESTIVAL_CHEST_SIZE = { w: W, d: D, h: H + D * 0.31 };
