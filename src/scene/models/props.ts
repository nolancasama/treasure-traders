import * as THREE from "three";
import { PartBuilder } from "../partBuilder";
import { flatMat } from "../materials";

/**
 * Character props (SPEC §8): Grandma Ume's bench and knitting, Leo's easel,
 * Finn's fishing rod and Ken's paint brush. Each is one merged mesh.
 */

export function benchGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0.3);
  const wood = "#b97a45";
  const iron = "#3f4450";
  for (const x of [-0.62, 0.62]) {
    b.box(0.06, 0.42, 0.06, x, 0, 0.16, iron);
    b.box(0.06, 0.42, 0.06, x, 0, -0.16, iron);
    b.box(0.06, 0.06, 0.42, x, 0.36, 0, iron);
    b.box(0.06, 0.5, 0.06, x, 0.42, -0.2, iron);
  }
  for (let i = 0; i < 3; i++) b.box(1.45, 0.04, 0.11, 0, 0.42, -0.13 + i * 0.13, wood);
  for (let i = 0; i < 2; i++) b.box(1.45, 0.1, 0.035, 0, 0.6 + i * 0.16, -0.22, wood);
  return b.build();
}

export function knittingGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  b.sphere(0.07, 0, 0.07, 0, "#e5484d");
  b.add(new THREE.CylinderGeometry(0.005, 0.005, 0.3, 6), "#d9c4a0", [-0.04, 0.12, 0.02], [0.3, 0, 0.6]);
  b.add(new THREE.CylinderGeometry(0.005, 0.005, 0.3, 6), "#d9c4a0", [0.04, 0.12, 0.02], [0.3, 0, -0.6]);
  b.box(0.18, 0.02, 0.1, 0, 0.0, 0.0, "#f2a3b0");
  return b.build();
}

export function easelGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0.4);
  const wood = "#a8743f";
  b.add(new THREE.BoxGeometry(0.05, 1.6, 0.05), wood, [-0.32, 0.78, 0.0], [0.08, 0, -0.18]);
  b.add(new THREE.BoxGeometry(0.05, 1.6, 0.05), wood, [0.32, 0.78, 0.0], [0.08, 0, 0.18]);
  b.add(new THREE.BoxGeometry(0.05, 1.5, 0.05), wood, [0, 0.72, -0.32], [-0.38, 0, 0]);
  b.box(0.8, 0.04, 0.1, 0, 0.62, 0.06, wood);
  // Canvas with a painted river.
  b.box(0.74, 0.56, 0.03, 0, 0.66, 0.09, "#fbf7ee");
  b.box(0.66, 0.16, 0.034, 0, 0.72, 0.09, "#8fd3f4");
  b.box(0.66, 0.1, 0.035, 0, 0.7, 0.09, "#2f8cc7");
  b.box(0.66, 0.12, 0.034, 0, 0.88, 0.09, "#cdeaa5");
  b.sphere(0.06, 0.2, 1.06, 0.1, "#ffd23f", [1, 1, 0.3]);
  return b.build();
}

export function fishingRodGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  b.add(new THREE.CylinderGeometry(0.012, 0.02, 1.9, 8), "#6b4a2b", [0, 0.95, 0], [0, 0, 0]);
  b.add(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 10), "#3a3f4b", [0.03, 0.32, 0], [0, 0, Math.PI / 2]);
  b.add(new THREE.CylinderGeometry(0.002, 0.002, 1.2, 4), "#e8e8e8", [0.22, 1.35, 0], [0, 0, 0.35]);
  b.sphere(0.03, 0.42, 0.78, 0, "#e5484d");
  return b.build();
}

export function brushGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  b.add(new THREE.CylinderGeometry(0.012, 0.012, 0.26, 8), "#c98a4b", [0, 0, 0], [0, 0, 0]);
  b.add(new THREE.CylinderGeometry(0.016, 0.013, 0.05, 8), "#c9cdd3", [0, 0.15, 0], [0, 0, 0]);
  b.add(new THREE.ConeGeometry(0.02, 0.07, 8), "#2f6fe4", [0, 0.21, 0], [0, 0, 0]);
  return b.build();
}

const cache = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry): THREE.Mesh {
  let g = cache.get(key);
  if (!g) cache.set(key, (g = make()));
  return new THREE.Mesh(g, flatMat());
}

export const props = {
  bench: () => cached("bench", benchGeometry),
  knitting: () => cached("knitting", knittingGeometry),
  easel: () => cached("easel", easelGeometry),
  fishingRod: () => cached("rod", fishingRodGeometry),
  brush: () => cached("brush", brushGeometry)
};
