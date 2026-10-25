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
const WOOD = "#7a5230";
const WOOD_DARK = "#56371e";
const BRASS = "#c8a04a";

function base(): THREE.BufferGeometry {
  const b = new PartBuilder(0.2);
  b.box(W, H, D, 0, 0, 0, WOOD);
  for (const y of [0.12, 0.3]) b.box(W + 0.012, 0.014, D + 0.012, 0, y, 0, WOOD_DARK);
  for (const x of [-W / 2 + 0.05, W / 2 - 0.05]) b.box(0.06, H + 0.01, D + 0.02, x, -0.005, 0, IRON.main);
  for (const x of [-W / 2 + 0.05, W / 2 - 0.05])
    for (const y of [0.06, 0.22, 0.38]) b.sphere(0.012, x, y, D / 2 + 0.012, IRON.dark);
  for (const x of [-W / 2 - 0.02, W / 2 + 0.02]) b.add(new THREE.TorusGeometry(0.05, 0.012, 5, 12, Math.PI), IRON.main, [x, 0.28, 0], [0, Math.PI / 2, Math.PI]);
  return b.build();
}

function lidGeo(): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  b.add(new THREE.BoxGeometry(W + 0.02, 0.1, D + 0.02), WOOD, [0, 0.05, D / 2], [0, 0, 0], [1, 1, 1], { flatAo: true });
  b.add(new THREE.BoxGeometry(W - 0.12, 0.012, D - 0.12), WOOD_DARK, [0, 0.104, D / 2], [0, 0, 0], [1, 1, 1], { flatAo: true });
  for (const x of [-W / 2 + 0.05, W / 2 - 0.05]) b.add(new THREE.BoxGeometry(0.06, 0.106, D + 0.03), IRON.main, [x, 0.05, D / 2], [0, 0, 0], [1, 1, 1], { flatAo: true });
  return b.build();
}

function lockGeo(open: boolean): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  b.add(new THREE.BoxGeometry(0.075, 0.075, 0.03), BRASS, [0, 0, 0], [0, 0, 0], [1, 1, 1], { flatAo: true });
  b.add(new THREE.CylinderGeometry(0.009, 0.009, 0.02, 8), "#3a2a1a", [0, -0.01, 0.016], [Math.PI / 2, 0, 0], [1, 1, 1], { flatAo: true });
  b.add(new THREE.TorusGeometry(0.026, 0.008, 6, 12, Math.PI), "#9aa0aa", [open ? 0.026 : 0, 0.038 + (open ? 0.02 : 0), 0], [0, open ? 0.9 : 0, 0], [1, 1, 1], { flatAo: true });
  return b.build();
}

export class SeaChest {
  readonly group = new THREE.Group();
  readonly lid = new THREE.Group();
  private locks: THREE.Mesh[] = [];
  private lockOpen: boolean[] = [false, false, false];
  private openGeo = lockGeo(true);
  private closedGeo = lockGeo(false);
  private lidOpen = 0;

  constructor(readonly silhouettes: ItemId[]) {
    this.group.add(new THREE.Mesh(base(), flatMat()));
    this.lid.position.set(0, H, -D / 2);
    this.lid.add(new THREE.Mesh(lidGeo(), flatMat()));
    // Engravings are pale gold inlays: children must read them to know what to ask.
    silhouettes.forEach((item, i) => {
      const m = new THREE.Mesh(plaqueGeometry(item, 0.25, { silhouette: "#f2d38a", up: true }), smoothMat());
      m.position.set((i - 1) * 0.28, 0.114, D / 2);
      this.lid.add(m);
    });
    this.group.add(this.lid);
    for (let i = 0; i < 3; i++) {
      const l = new THREE.Mesh(this.closedGeo, flatMat());
      l.position.set((i - 1) * 0.27, H - 0.08, D / 2 + 0.03);
      this.group.add(l);
      this.locks.push(l);
    }
    this.group.name = "seaChest";
  }

  setLockOpen(i: number, open: boolean): void {
    this.lockOpen[i] = open;
    this.locks[i].geometry = open ? this.openGeo : this.closedGeo;
    this.locks[i].rotation.z = open ? 0.35 : 0;
  }

  isLockOpen(i: number): boolean {
    return this.lockOpen[i];
  }

  setLidOpen(v: number): void {
    this.lidOpen = THREE.MathUtils.clamp(v, 0, 1);
    this.lid.rotation.x = -this.lidOpen * 1.6;
  }

  lockWorld(i: number): THREE.Vector3 {
    return this.locks[i].getWorldPosition(new THREE.Vector3());
  }
}

export const SEA_CHEST_SIZE = { w: W, d: D, h: H + 0.1 };
