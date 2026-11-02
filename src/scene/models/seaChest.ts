import * as THREE from "three";
import type { ItemId } from "../../game/content/ids";
import { PartBuilder } from "../partBuilder";
import { flatMat, smoothMat } from "../materials";
import { plaqueGeometry } from "./items";
import { IRON } from "./palette";

/**
 * Captain Bo's old sea chest (SPEC §6.4): three engraved item silhouettes on
 * the lid and three brass padlocks on the front, each able to open.
 */
const W = 0.95;
const D = 0.58;
const H = 0.46;
const WOOD = "#8a5c34";
const WOOD_DARK = "#5e3d20";
const BRASS = "#e0b24f";
const BRASS_DARK = "#a97f32";

function base(): THREE.BufferGeometry {
  const b = new PartBuilder(0.2);
  b.box(W, H, D, 0, 0, 0, WOOD);
  for (const y of [0.12, 0.3]) b.box(W + 0.012, 0.014, D + 0.012, 0, y, 0, WOOD_DARK);
  for (const x of [-W / 2 + 0.05, W / 2 - 0.05]) b.box(0.06, H + 0.01, D + 0.02, x, -0.005, 0, IRON.main);
  // Brass corners and rows of rivets: this one has been round the world.
  for (const x of [-W / 2 + 0.03, W / 2 - 0.03]) for (const y of [0.02, H - 0.08]) b.box(0.08, 0.08, D + 0.03, x, y, 0, BRASS);
  for (const x of [-W / 2 + 0.05, W / 2 - 0.05])
    for (const y of [0.13, 0.25, 0.32]) b.sphere(0.013, x, y, D / 2 + 0.014, BRASS, [1, 1, 0.6], 6);
  for (const x of [-W / 2 - 0.02, W / 2 + 0.02]) b.add(new THREE.TorusGeometry(0.055, 0.014, 5, 12, Math.PI), BRASS_DARK, [x, 0.28, 0], [0, Math.PI / 2, Math.PI]);
  // A plate behind each padlock, so the locks read against the dark wood.
  for (let i = 0; i < 3; i++) {
    b.box(0.17, 0.17, 0.01, (i - 1) * 0.27, H - 0.2, D / 2 + 0.006, BRASS_DARK);
    b.box(0.14, 0.14, 0.012, (i - 1) * 0.27, H - 0.185, D / 2 + 0.007, "#f4dfa8");
  }
  return b.build();
}

function lidGeo(): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  b.add(new THREE.BoxGeometry(W + 0.02, 0.1, D + 0.02), WOOD, [0, 0.05, D / 2], [0, 0, 0], [1, 1, 1], { flatAo: true });
  b.add(new THREE.BoxGeometry(W - 0.12, 0.012, D - 0.12), WOOD_DARK, [0, 0.104, D / 2], [0, 0, 0], [1, 1, 1], { flatAo: true });
  for (const x of [-W / 2 + 0.05, W / 2 - 0.05]) b.add(new THREE.BoxGeometry(0.06, 0.106, D + 0.03), IRON.main, [x, 0.05, D / 2], [0, 0, 0], [1, 1, 1], { flatAo: true });
  // Long hinge straps running forward from the back edge.
  for (const x of [-W / 2 + 0.2, W / 2 - 0.2]) {
    b.add(new THREE.BoxGeometry(0.07, 0.016, D * 0.42), BRASS, [x, 0.108, D * 0.22], [0, 0, 0], [1, 1, 1], { flatAo: true });
    b.add(new THREE.CylinderGeometry(0.028, 0.028, 0.12, 8), BRASS_DARK, [x, 0.01, -0.005], [0, 0, Math.PI / 2], [1, 1, 1], { flatAo: true });
  }
  return b.build();
}

function lockGeo(open: boolean): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  b.add(new THREE.BoxGeometry(0.12, 0.105, 0.036), BRASS, [0, 0, 0], [0, 0, 0], [1, 1, 1], { flatAo: true });
  b.add(new THREE.BoxGeometry(0.1, 0.012, 0.04), BRASS_DARK, [0, 0.03, 0], [0, 0, 0], [1, 1, 1], { flatAo: true });
  // Keyhole: a dot and a slot, easy to read at a glance.
  b.add(new THREE.CylinderGeometry(0.015, 0.015, 0.02, 10), "#2a1b0f", [0, -0.004, 0.018], [Math.PI / 2, 0, 0], [1, 1, 1], { flatAo: true });
  b.add(new THREE.BoxGeometry(0.012, 0.03, 0.02), "#2a1b0f", [0, -0.024, 0.018], [0, 0, 0], [1, 1, 1], { flatAo: true });
  // An open shackle swings well clear of the body, so open and shut look different.
  b.add(new THREE.TorusGeometry(0.038, 0.012, 6, 12, Math.PI), "#c5cad3", [open ? 0.05 : 0, 0.06 + (open ? 0.034 : 0), open ? 0.02 : 0], [0, open ? 1.1 : 0, open ? 0.4 : 0], [1, 1, 1], { flatAo: true });
  return b.build();
}

export class SeaChest {
  readonly group = new THREE.Group();
  readonly lid = new THREE.Group();
  private locks: THREE.Mesh[] = [];
  private lockOpen: boolean[] = [false, false, false];
  private lockPop: number[] = [0, 0, 0];
  private openGeo = lockGeo(true);
  private closedGeo = lockGeo(false);
  private lidOpen = 0;

  constructor(readonly silhouettes: ItemId[]) {
    this.group.add(new THREE.Mesh(base(), flatMat()));
    this.lid.position.set(0, H, -D / 2);
    this.lid.add(new THREE.Mesh(lidGeo(), flatMat()));
    // Engravings are pale gold inlays: children must read them to know what to ask.
    silhouettes.forEach((item, i) => {
      const m = new THREE.Mesh(plaqueGeometry(item, 0.25, { silhouette: "#f7dc96", up: true, chunky: true }), smoothMat());
      m.position.set((i - 1) * 0.28, 0.114, D / 2);
      this.lid.add(m);
    });
    this.group.add(this.lid);
    for (let i = 0; i < 3; i++) {
      const l = new THREE.Mesh(this.closedGeo, flatMat());
      l.position.set((i - 1) * 0.27, H - 0.115, D / 2 + 0.03);
      this.group.add(l);
      this.locks.push(l);
    }
    this.group.name = "seaChest";
  }

  setLockOpen(i: number, open: boolean): void {
    if (open && !this.lockOpen[i]) this.lockPop[i] = 1;
    this.lockOpen[i] = open;
    this.locks[i].geometry = open ? this.openGeo : this.closedGeo;
    if (!open) this.lockPop[i] = 0;
  }

  isLockOpen(i: number): boolean {
    return this.lockOpen[i];
  }

  setLidOpen(v: number): void {
    this.lidOpen = THREE.MathUtils.clamp(v, 0, 1);
    this.lid.rotation.x = -this.lidOpen * 1.6;
  }

  /** A lock that just opened jumps, swings and settles. */
  update(dt: number): void {
    this.locks.forEach((lock, i) => {
      this.lockPop[i] = Math.max(0, this.lockPop[i] - dt * 1.7);
      const pop = this.lockPop[i];
      const settled = this.lockOpen[i] ? 0.35 : 0;
      lock.rotation.z = settled + Math.sin(pop * Math.PI * 4) * pop * 0.55;
      lock.scale.setScalar(1 + Math.sin(pop * Math.PI) * 0.45);
    });
  }

  lockWorld(i: number): THREE.Vector3 {
    return this.locks[i].getWorldPosition(new THREE.Vector3());
  }
}

export const SEA_CHEST_SIZE = { w: W, d: D, h: H + 0.1 };
