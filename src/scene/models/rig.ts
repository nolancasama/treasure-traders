import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Builds a whole character as ONE skinned mesh: every primitive is rigidly
 * weighted to one bone, so a body with moving head, arms and legs costs a
 * single draw call (Chromebook budget, SPEC §13). Colours follow PartBuilder:
 * vertex colours with a gentle height-based ambient occlusion.
 */

export type V3 = [number, number, number];

export interface BoneSpec {
  name: string;
  parent: string | null;
  /** Rest position in model space. */
  pos: V3;
}

export class RigBuilder {
  private parts: THREE.BufferGeometry[] = [];
  private index = new Map<string, number>();
  private seed = 7;

  constructor(
    readonly bones: BoneSpec[],
    private ao = 0.5
  ) {
    bones.forEach((b, i) => this.index.set(b.name, i));
  }

  private rand(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  /** Adds a primitive in model space, weighted to `bone`. */
  add(
    geo: THREE.BufferGeometry,
    color: THREE.ColorRepresentation,
    bone: string,
    pos: V3,
    rot: V3 = [0, 0, 0],
    scale: V3 = [1, 1, 1],
    opts: { flatAo?: boolean; vary?: boolean } = {}
  ): this {
    const bi = this.index.get(bone);
    if (bi === undefined) throw new Error(`unknown bone ${bone}`);
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    g.applyMatrix4(
      new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale))
    );
    const base = new THREE.Color(color);
    if (opts.vary) base.multiplyScalar(0.95 + this.rand() * 0.1);
    const p = g.attributes.position;
    const colors = new Float32Array(p.count * 3);
    const skinIndex = new Uint16Array(p.count * 4);
    const skinWeight = new Float32Array(p.count * 4);
    for (let i = 0; i < p.count; i++) {
      const t = opts.flatAo ? 1 : THREE.MathUtils.smoothstep(p.getY(i), 0, this.ao);
      const k = 0.72 + 0.28 * t;
      colors[i * 3] = base.r * k;
      colors[i * 3 + 1] = base.g * k;
      colors[i * 3 + 2] = base.b * k;
      skinIndex[i * 4] = bi;
      skinWeight[i * 4] = 1;
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndex, 4));
    g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeight, 4));
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(p.count * 2), 2));
    this.parts.push(g);
    return this;
  }

  get triangleCount(): number {
    return this.parts.reduce((n, p) => n + p.attributes.position.count / 3, 0);
  }

  build(): THREE.BufferGeometry {
    const merged = mergeGeometries(this.parts, false);
    this.parts.forEach((p) => p.dispose());
    this.parts = [];
    merged.computeBoundingSphere();
    merged.computeBoundingBox();
    return merged;
  }
}

/** Creates the bone hierarchy at rest (positions relative to parents). */
export function createBones(specs: BoneSpec[]): { list: THREE.Bone[]; byName: Record<string, THREE.Bone> } {
  const byName: Record<string, THREE.Bone> = {};
  const list: THREE.Bone[] = [];
  for (const s of specs) {
    const b = new THREE.Bone();
    b.name = s.name;
    const parent = s.parent ? specs.find((x) => x.name === s.parent)! : null;
    b.position.set(s.pos[0] - (parent?.pos[0] ?? 0), s.pos[1] - (parent?.pos[1] ?? 0), s.pos[2] - (parent?.pos[2] ?? 0));
    if (s.parent) byName[s.parent].add(b);
    byName[s.name] = b;
    list.push(b);
  }
  return { list, byName };
}

/**
 * A skinned mesh bound to freshly created bones. `bounds` is a fixed sphere
 * covering every pose (model space), so frustum culling stays on without
 * recomputing skinned bounds each frame.
 */
export function skinnedMesh(
  geometry: THREE.BufferGeometry,
  specs: BoneSpec[],
  material: THREE.Material,
  bounds: THREE.Sphere
): { mesh: THREE.SkinnedMesh; bones: Record<string, THREE.Bone> } {
  const { list, byName } = createBones(specs);
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.add(list[0]);
  mesh.bind(new THREE.Skeleton(list));
  mesh.boundingSphere = bounds;
  return { mesh, bones: byName };
}
