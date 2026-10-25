import * as THREE from "three";
import { skinnedMat } from "../materials";
import { RigBuilder, skinnedMesh, type BoneSpec } from "./rig";

/**
 * Kiwi, the green parrot who follows the player (SPEC §8): yellow cheeks, a
 * red tail tip, an orange beak. One skinned mesh; wings, head and tail move.
 * Model space: about 0.34 m long, facing +z, feet at y = 0.
 */
const SPECS: BoneSpec[] = [
  { name: "root", parent: null, pos: [0, 0, 0] },
  { name: "body", parent: "root", pos: [0, 0.1, 0] },
  { name: "head", parent: "body", pos: [0, 0.2, 0.04] },
  { name: "wingL", parent: "body", pos: [0.07, 0.17, 0.0] },
  { name: "wingR", parent: "body", pos: [-0.07, 0.17, 0.0] },
  { name: "tail", parent: "body", pos: [0, 0.1, -0.07] }
];

const GREEN = "#43b649";
const GREEN_DARK = "#2e8c3a";
const YELLOW = "#ffd23f";
const RED = "#e5484d";
const BEAK = "#ff9f2e";

function geometry(): THREE.BufferGeometry {
  const b = new RigBuilder(SPECS, 1e-6);
  const s = (r: number) => new THREE.SphereGeometry(r, 14, 10);
  // Body and belly.
  b.add(s(0.075), GREEN, "body", [0, 0.14, 0], [0.35, 0, 0], [1, 1.25, 1]);
  b.add(s(0.06), "#7fd36a", "body", [0, 0.12, 0.03], [0.3, 0, 0], [0.9, 1.1, 0.8]);
  // Feet.
  for (const x of [0.025, -0.025]) {
    b.add(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 6), "#9a7a5a", "root", [x, 0.03, 0.01]);
    b.add(new THREE.BoxGeometry(0.03, 0.01, 0.04), "#9a7a5a", "root", [x, 0.005, 0.02]);
  }
  // Head with cheeks, eyes, beak.
  b.add(s(0.062), GREEN, "head", [0, 0.25, 0.05]);
  for (const x of [0.04, -0.04]) {
    b.add(s(0.024), YELLOW, "head", [x, 0.235, 0.09], [0, 0, 0], [1, 0.8, 0.5]);
    b.add(s(0.017), "#ffffff", "head", [x * 0.9, 0.262, 0.096], [0, 0, 0], [1, 1, 0.6]);
    b.add(s(0.011), "#1d1712", "head", [x * 0.9, 0.262, 0.105], [0, 0, 0], [1, 1, 0.6]);
  }
  b.add(new THREE.ConeGeometry(0.022, 0.05, 8), BEAK, "head", [0, 0.236, 0.122], [Math.PI / 2 + 0.5, 0, 0]);
  b.add(new THREE.ConeGeometry(0.03, 0.05, 8), GREEN, "head", [0, 0.31, 0.03], [-0.5, 0, 0]);
  // Wings.
  for (const [bone, x] of [["wingL", 1], ["wingR", -1]] as const) {
    b.add(s(0.05), GREEN_DARK, bone, [x * 0.085, 0.13, -0.01], [0.3, 0, x * 0.15], [0.35, 1.25, 0.85]);
    b.add(s(0.03), RED, bone, [x * 0.087, 0.07, -0.04], [0.3, 0, 0], [0.3, 1, 0.7]);
  }
  // Tail.
  b.add(new THREE.BoxGeometry(0.05, 0.012, 0.13), GREEN_DARK, "tail", [0, 0.07, -0.12], [-0.6, 0, 0]);
  // Red tip overlapping the tail's last third (same tilt), so it never looks detached.
  b.add(new THREE.BoxGeometry(0.054, 0.014, 0.055), RED, "tail", [0, 0.07 - 0.05 * Math.sin(0.6), -0.12 - 0.05 * Math.cos(0.6)], [-0.6, 0, 0]);
  return b.build();
}

export type KiwiState = "perch" | "fly" | "hover" | "hop" | "talk";

export class KiwiRig {
  readonly group = new THREE.Group();
  readonly mesh: THREE.SkinnedMesh;
  private bones: Record<string, THREE.Bone>;
  private state: KiwiState = "perch";
  private t = Math.random() * 10;
  private flapBurst = 0;

  constructor() {
    const { mesh, bones } = skinnedMesh(geometry(), SPECS, skinnedMat(), new THREE.Sphere(new THREE.Vector3(0, 0.15, 0), 0.4));
    this.mesh = mesh;
    this.bones = bones;
    this.group.add(mesh);
    this.group.name = "kiwi";
    this.update(0);
  }

  setState(s: KiwiState): void {
    this.state = s;
  }

  /** A short excited flap (e.g. when offering a hint). */
  flap(): void {
    this.flapBurst = 0.8;
  }

  update(dt: number): void {
    this.t += dt;
    const t = this.t;
    const B = this.bones;
    this.flapBurst = Math.max(0, this.flapBurst - dt);
    const flying = this.state === "fly" || this.state === "hover" || this.flapBurst > 0;
    const flapRate = this.state === "fly" ? 16 : 11;
    const wing = flying ? 0.35 + Math.sin(t * flapRate) * 0.9 : 0.05 + Math.sin(t * 1.3) * 0.02;
    B.wingL.rotation.set(0, 0, wing);
    B.wingR.rotation.set(0, 0, -wing);
    B.tail.rotation.x = flying ? -0.25 : Math.sin(t * 2) * 0.05;
    B.body.rotation.x = this.state === "fly" ? 0.5 : this.state === "hover" ? 0.15 : 0;
    B.body.position.y = 0.1 + (this.state === "hop" ? Math.abs(Math.sin(t * 7)) * 0.05 : flying ? Math.sin(t * 5) * 0.012 : 0);
    const talk = this.state === "talk";
    B.head.rotation.set(talk ? Math.sin(t * 9) * 0.12 : Math.sin(t * 0.9) * 0.08, Math.sin(t * 0.6) * 0.35, talk ? 0 : Math.sin(t * 0.4) * 0.15);
  }
}
