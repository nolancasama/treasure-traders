import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { ItemId } from "../../game/content/ids";
import { PartBuilder } from "../partBuilder";
import { smoothMat } from "../materials";
import { ITEM_COLORS, INK } from "./palette";

/**
 * The nine stationery models (SPEC §9) at real-world scale in metres. Each
 * lies along +x, rests on y = 0 and is centred on x/z, so it can sit on any
 * surface without floating. One merged vertex-coloured geometry each.
 */

type V3 = [number, number, number];

class ItemBuilder {
  private b = new PartBuilder();
  add(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, pos: V3, rot: V3 = [0, 0, 0], scale: V3 = [1, 1, 1]): this {
    this.b.add(geo, color, pos, rot, scale, { flatAo: true, vary: false });
    return this;
  }
  /** Cylinder along x. */
  rodX(r: number, l: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, seg = 14, rotX = 0): this {
    return this.add(new THREE.CylinderGeometry(r, r, l, seg), color, [x, y, z], [rotX, 0, Math.PI / 2]);
  }
  /** Cone along +x (tip toward +x). */
  coneX(r: number, l: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, seg = 14, rotX = 0): this {
    return this.add(new THREE.ConeGeometry(r, l, seg), color, [x, y, z], [rotX, 0, -Math.PI / 2]);
  }
  box(w: number, h: number, d: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, rot: V3 = [0, 0, 0]): this {
    return this.add(new THREE.BoxGeometry(w, h, d), color, [x, y, z], rot);
  }
  rbox(w: number, h: number, d: number, r: number, x: number, y: number, z: number, color: THREE.ColorRepresentation): this {
    return this.add(new RoundedBoxGeometry(w, h, d, 2, r), color, [x, y, z]);
  }
  sphere(r: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, scale: V3 = [1, 1, 1], seg = 12): this {
    return this.add(new THREE.SphereGeometry(r, seg, Math.max(6, Math.round(seg * 0.7))), color, [x, y, z], [0, 0, 0], scale);
  }
  build(): THREE.BufferGeometry {
    return this.b.build();
  }
}

function pen(): THREE.BufferGeometry {
  const c = ITEM_COLORS.pen;
  const y = 0.0062;
  const b = new ItemBuilder();
  b.sphere(0.0052, -0.071, y, 0, c.dark, [0.6, 1, 1]);
  b.rodX(0.0062, 0.045, -0.0475, y, 0, c.dark);
  b.box(0.034, 0.0018, 0.0024, -0.05, y * 2 + 0.0006, 0, c.accent);
  b.sphere(0.0016, -0.0335, y * 2 + 0.0006, 0, c.accent);
  b.rodX(0.0055, 0.06, 0.0025, y, 0, c.main);
  b.rodX(0.0058, 0.022, 0.043, y, 0, c.dark);
  b.coneX(0.0046, 0.012, 0.06, y, 0, c.accent);
  b.sphere(0.0012, 0.0665, y, 0, INK, [1, 1, 1], 6);
  return b.build();
}

function marker(): THREE.BufferGeometry {
  const c = ITEM_COLORS.marker;
  const y = 0.0097;
  const b = new ItemBuilder();
  b.rodX(0.0086, 0.008, -0.061, y, 0, c.dark);
  b.rodX(0.009, 0.075, -0.0195, y, 0, c.main);
  b.rodX(0.0093, 0.028, -0.026, y, 0, c.accent);
  b.box(0.012, 0.0012, 0.006, -0.026, y * 2 + 0.0001, 0, c.main);
  b.rodX(0.0097, 0.004, 0.02, y, 0, c.dark);
  b.rodX(0.0095, 0.042, 0.042, y, 0, c.dark);
  b.sphere(0.0095, 0.063, y, 0, c.dark, [0.45, 1, 1]);
  b.box(0.03, 0.0022, 0.0032, 0.043, y * 2 + 0.0009, 0, c.main);
  return b.build();
}

function ruler(): THREE.BufferGeometry {
  const c = ITEM_COLORS.ruler;
  const b = new ItemBuilder();
  b.rbox(0.3, 0.0035, 0.036, 0.0012, 0, 0.00175, 0, c.main);
  for (let i = 0; i <= 29; i++) {
    const len = i % 10 === 0 ? 0.013 : i % 5 === 0 ? 0.009 : 0.005;
    b.box(0.0009, 0.0006, len, -0.145 + i * 0.01, 0.0037, -0.018 + len / 2 + 0.0005, c.accent);
  }
  // A few digit marks along the long ticks and the hanging hole.
  for (let i = 0; i < 3; i++) b.box(0.0012, 0.0006, 0.004, -0.1415 + i * 0.1, 0.0037, -0.0035, c.accent);
  b.add(new THREE.CylinderGeometry(0.0032, 0.0032, 0.0008, 12), c.dark, [0.138, 0.0036, 0.008]);
  return b.build();
}

function stapler(): THREE.BufferGeometry {
  const c = ITEM_COLORS.stapler;
  const b = new ItemBuilder();
  b.box(0.145, 0.012, 0.036, -0.0025, 0.006, 0, c.accent);
  b.add(new THREE.CylinderGeometry(0.006, 0.006, 0.036, 12), c.accent, [0.07, 0.006, 0], [Math.PI / 2, 0, 0]);
  b.box(0.026, 0.0016, 0.018, 0.058, 0.0128, 0, INK);
  b.add(new THREE.CylinderGeometry(0.0085, 0.0085, 0.032, 12), "#9aa0aa", [-0.066, 0.017, 0], [Math.PI / 2, 0, 0]);
  b.add(new THREE.BoxGeometry(0.135, 0.019, 0.031), c.main, [0.002, 0.03, 0], [0, 0, -0.035]);
  b.add(new THREE.CylinderGeometry(0.0155, 0.0155, 0.13, 14), c.main, [0.001, 0.0385, 0], [0, 0, Math.PI / 2 - 0.035], [1, 1, 1]);
  b.sphere(0.0128, 0.066, 0.031, 0, c.main, [0.9, 1, 1.2]);
  b.box(0.045, 0.0018, 0.012, -0.005, 0.0545, 0, c.light, [0, 0, -0.035]);
  return b.build();
}

function calendar(): THREE.BufferGeometry {
  const c = ITEM_COLORS.calendar;
  const b = new ItemBuilder();
  b.box(0.21, 0.006, 0.28, 0, 0.003, 0, c.main);
  b.box(0.212, 0.0066, 0.064, 0, 0.0033, -0.108, c.accent);
  b.box(0.09, 0.0008, 0.014, 0, 0.0069, -0.108, c.main);
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 7; col++) {
      const special = row === 2 && col === 4;
      b.box(0.022, 0.0008, 0.022, -0.09 + col * 0.03, 0.0064, -0.052 + row * 0.04, special ? c.accent : c.dark);
    }
  }
  for (let i = 0; i < 6; i++)
    b.add(new THREE.TorusGeometry(0.0062, 0.0013, 5, 12), "#9aa0aa", [-0.075 + i * 0.03, 0.0076, -0.139], [0, Math.PI / 2, 0]);
  return b.build();
}

function notebook(): THREE.BufferGeometry {
  const c = ITEM_COLORS.notebook;
  const b = new ItemBuilder();
  b.box(0.18, 0.002, 0.25, 0, 0.001, 0, c.dark);
  b.box(0.172, 0.01, 0.244, 0.003, 0.007, 0, "#f7f5ee");
  b.box(0.18, 0.0022, 0.25, 0, 0.0131, 0, c.main);
  b.box(0.08, 0.0007, 0.042, 0.02, 0.0146, -0.06, c.accent);
  b.box(0.06, 0.0005, 0.003, 0.02, 0.0151, -0.065, "#9fb7c9");
  b.box(0.06, 0.0005, 0.003, 0.02, 0.0151, -0.055, "#9fb7c9");
  for (let i = 0; i < 9; i++) b.add(new THREE.TorusGeometry(0.0068, 0.0012, 5, 12), "#b5bac3", [-0.088, 0.0081, -0.11 + i * 0.0275]);
  return b.build();
}

function eraser(): THREE.BufferGeometry {
  const c = ITEM_COLORS.eraser;
  const b = new ItemBuilder();
  b.rbox(0.05, 0.013, 0.024, 0.003, 0, 0.0065, 0, c.main);
  b.box(0.031, 0.0138, 0.0248, -0.0085, 0.0069, 0, c.accent);
  b.box(0.006, 0.0139, 0.0249, 0.0045, 0.0069, 0, "#ffffff");
  b.box(0.004, 0.0139, 0.0249, -0.0215, 0.0069, 0, INK);
  return b.build();
}

function pencil(): THREE.BufferGeometry {
  const c = ITEM_COLORS.pencil;
  const r = 0.0039;
  const y = r * Math.cos(Math.PI / 6);
  const hex = Math.PI / 6;
  const b = new ItemBuilder();
  b.rodX(r, 0.135, 0.0, y, 0, c.main, 6, hex);
  b.rodX(r * 1.04, 0.012, -0.0735, y, 0, "#c9cdd3", 10);
  b.rodX(r * 1.07, 0.0016, -0.0705, y, 0, "#9aa0aa", 10);
  b.rodX(r * 1.07, 0.0016, -0.0765, y, 0, "#9aa0aa", 10);
  b.rodX(r * 0.95, 0.008, -0.0835, y, 0, c.accent, 10);
  b.sphere(r * 0.95, -0.0875, y, 0, c.accent, [0.5, 1, 1], 10);
  b.coneX(r, 0.02, 0.0775, y, 0, "#f2cf9a", 6, hex);
  b.coneX(0.0013, 0.0058, 0.0866, y, 0, "#3a3a40", 8);
  return b.build();
}

function pencilCase(): THREE.BufferGeometry {
  const c = ITEM_COLORS.pencilCase;
  const b = new ItemBuilder();
  b.add(new THREE.CapsuleGeometry(0.035, 0.14, 6, 16), c.main, [0, 0.026, 0], [0, 0, Math.PI / 2], [0.74, 1, 1.08]);
  b.box(0.168, 0.0045, 0.008, 0, 0.0515, 0, c.dark);
  b.box(0.164, 0.0016, 0.0026, 0, 0.0545, 0, c.accent);
  b.box(0.012, 0.003, 0.009, 0.074, 0.0545, 0.006, "#c9cdd3");
  b.add(new THREE.TorusGeometry(0.0045, 0.0012, 5, 10), "#c9cdd3", [0.074, 0.0545, 0.013], [Math.PI / 2, 0, 0]);
  b.box(0.045, 0.02, 0.002, 0.03, 0.027, 0.0385, c.light);
  return b.build();
}

const BUILDERS: Record<ItemId, () => THREE.BufferGeometry> = {
  pen,
  marker,
  ruler,
  stapler,
  calendar,
  notebook,
  eraser,
  pencil,
  pencilCase
};

const cache = new Map<ItemId, THREE.BufferGeometry>();

/** Shared, cached geometry for an item (do not dispose). */
export function itemGeometry(id: ItemId): THREE.BufferGeometry {
  let g = cache.get(id);
  if (!g) {
    g = BUILDERS[id]();
    g.computeBoundingBox();
    cache.set(id, g);
  }
  return g;
}

/** A mesh of the item at real scale. */
export function buildItem(id: ItemId): THREE.Mesh {
  const m = new THREE.Mesh(itemGeometry(id), smoothMat());
  m.name = `item:${id}`;
  return m;
}

/** How each item is shown: lying in the world, in a hand, and in plaques. */
export interface ItemDisplay {
  /** Scale for pickups lying in the world (items are small next to people). */
  world: number;
  /** Scale when held. */
  hand: number;
  /** Rotation (local to the hand socket) when held up to show. */
  holdRot: V3;
  /** Plaque orientation: flat items turn their top toward the viewer. */
  flat: boolean;
}

export const ITEM_DISPLAY: Record<ItemId, ItemDisplay> = {
  pen: { world: 3.2, hand: 2.2, holdRot: [0, 0, Math.PI / 2], flat: false },
  marker: { world: 3.0, hand: 2.0, holdRot: [0, 0, Math.PI / 2], flat: false },
  ruler: { world: 2.2, hand: 1.5, holdRot: [Math.PI / 2, 0, Math.PI / 2], flat: true },
  stapler: { world: 3.0, hand: 2.0, holdRot: [0, Math.PI / 2, 0], flat: false },
  calendar: { world: 2.0, hand: 1.4, holdRot: [Math.PI / 2, 0, 0], flat: true },
  notebook: { world: 2.1, hand: 1.4, holdRot: [Math.PI / 2, 0, 0], flat: true },
  eraser: { world: 4.2, hand: 3.0, holdRot: [Math.PI / 2, 0, 0], flat: true },
  pencil: { world: 3.0, hand: 2.0, holdRot: [0, 0, Math.PI / 2], flat: false },
  pencilCase: { world: 2.8, hand: 1.9, holdRot: [0, Math.PI / 2, 0], flat: false }
};

/** Real-scale size of an item's bounding box (x = length). */
export function itemSize(id: ItemId): THREE.Vector3 {
  const g = itemGeometry(id);
  return g.boundingBox!.getSize(new THREE.Vector3());
}

/**
 * Item geometry posed for a plaque facing +z (or +y with `up`), fitted inside
 * a square of side `size`. Long items lie diagonally like the icons.
 * `silhouette` flattens it and paints it one colour (engravings, empty slots).
 */
export function plaqueGeometry(id: ItemId, size: number, opts: { silhouette?: string; up?: boolean } = {}): THREE.BufferGeometry {
  const g = itemGeometry(id).clone();
  const box = g.boundingBox!;
  const center = box.getCenter(new THREE.Vector3());
  g.translate(-center.x, -center.y, -center.z);
  // Present the most recognisable outline toward +z.
  if (ITEM_DISPLAY[id].flat || id === "pencilCase" || id === "eraser") g.rotateX(Math.PI / 2);
  if (id === "ruler" || id === "pen" || id === "pencil" || id === "marker") g.rotateZ(Math.PI / 4);
  g.computeBoundingBox();
  const s = g.boundingBox!.getSize(new THREE.Vector3());
  const k = size / Math.max(s.x, s.y);
  g.scale(k, k, k);
  if (opts.silhouette) {
    g.scale(1, 1, 0.08);
    const col = new THREE.Color(opts.silhouette);
    const colors = g.attributes.color as THREE.BufferAttribute;
    for (let i = 0; i < colors.count; i++) colors.setXYZ(i, col.r, col.g, col.b);
  }
  if (opts.up) g.rotateX(-Math.PI / 2);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}
