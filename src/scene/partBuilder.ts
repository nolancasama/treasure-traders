import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

type V3 = [number, number, number];
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Collects primitive shapes into one vertex-coloured geometry, so a whole
 * piece of furniture is a single draw call. Colours get a gentle height-based
 * darkening near the floor (cheap ambient occlusion) and a tiny per-part
 * variation so flat colours look hand-painted. `ao` 0 means no darkening at
 * all, including for parts at or below y = 0.
 *
 * A `swayable` builder also writes uv.x as a wind weight (see swayMat): zero
 * for parts that stay put, so a merged scenery mesh can hold both.
 */
export class PartBuilder {
  private parts: THREE.BufferGeometry[] = [];
  private seed = 1;
  private frame: THREE.Matrix4 | null = null;
  private windDefault = 0;

  constructor(private ao = 0.55, private swayable = false) {}

  private rand(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  add(
    geo: THREE.BufferGeometry,
    color: THREE.ColorRepresentation,
    pos: V3,
    rot: V3 = [0, 0, 0],
    scale: V3 = [1, 1, 1],
    opts: { vary?: boolean; flatAo?: boolean; wind?: number; hang?: boolean } = {}
  ): this {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(...pos),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
      new THREE.Vector3(...scale)
    );
    if (this.frame) m.premultiply(this.frame);
    g.applyMatrix4(m);
    const base = new THREE.Color(color);
    if (opts.vary !== false) base.multiplyScalar(0.94 + this.rand() * 0.12);
    const p = g.attributes.position;
    const colors = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const t = opts.flatAo || this.ao <= 0 ? 1 : THREE.MathUtils.smoothstep(y, 0, this.ao);
      const k = 0.64 + 0.36 * t;
      colors[i * 3] = base.r * k;
      colors[i * 3 + 1] = base.g * k;
      colors[i * 3 + 2] = base.b * k;
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    if (this.swayable) {
      const uv = new Float32Array(p.count * 2);
      const wind = opts.wind ?? this.windDefault;
      if (wind) {
        let min = Infinity, max = -Infinity;
        for (let i = 0; i < p.count; i++) { min = Math.min(min, p.getY(i)); max = Math.max(max, p.getY(i)); }
        const range = Math.max(0.001, max - min);
        // Plants bend from the root; flags and lanterns swing from where they hang.
        for (let i = 0; i < p.count; i++) uv[i * 2] = wind * (opts.hang ? max - p.getY(i) : p.getY(i) - min) / range;
      }
      g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    } else if (!g.attributes.uv) {
      g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(p.count * 2), 2));
    }
    if (!g.attributes.normal) g.computeVertexNormals();
    this.parts.push(g);
    return this;
  }

  /** Runs `build` with every added part placed in a local frame (origin + yaw). */
  at(x: number, y: number, z: number, yaw: number, build: () => void): this {
    const previous = this.frame;
    const local = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y, z);
    this.frame = previous ? previous.clone().multiply(local) : local;
    build();
    this.frame = previous;
    return this;
  }

  /** Runs `build` with parts swaying by `weight` at their top unless they say otherwise. */
  sway(weight: number, build: () => void): this {
    const previous = this.windDefault;
    this.windDefault = weight;
    build();
    this.windDefault = previous;
    return this;
  }

  /** Box resting on `y` (its bottom), centred on x/z. */
  box(w: number, h: number, d: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, rotY = 0): this {
    return this.add(new THREE.BoxGeometry(w, h, d), color, [x, y + h / 2, z], [0, rotY, 0]);
  }

  /** Box with an arbitrary rotation, centred on (x, y, z). */
  boxAt(
    w: number,
    h: number,
    d: number,
    pos: V3,
    rot: V3,
    color: THREE.ColorRepresentation
  ): this {
    return this.add(new THREE.BoxGeometry(w, h, d), color, pos, rot);
  }

  /** Vertical cylinder resting on `y`. */
  cyl(rTop: number, rBot: number, h: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, seg = 12): this {
    return this.add(new THREE.CylinderGeometry(rTop, rBot, h, seg), color, [x, y + h / 2, z]);
  }

  /** Cylinder centred on pos with rotation. */
  cylAt(
    r: number,
    h: number,
    pos: V3,
    rot: V3,
    color: THREE.ColorRepresentation,
    seg = 10
  ): this {
    return this.add(new THREE.CylinderGeometry(r, r, h, seg), color, pos, rot);
  }

  sphere(
    r: number,
    x: number,
    y: number,
    z: number,
    color: THREE.ColorRepresentation,
    scale: V3 = [1, 1, 1],
    seg = 12
  ): this {
    return this.add(new THREE.SphereGeometry(r, seg, Math.max(4, Math.floor(seg * 0.7))), color, [x, y, z], [0, 0, 0], scale);
  }

  /** Faceted blob for foliage, shrubs and stones (20 triangles at detail 0). */
  blob(r: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, scale: V3 = [1, 1, 1], detail = 0): this {
    return this.add(new THREE.IcosahedronGeometry(r, detail), color, [x, y, z], [x * 0.7, z * 0.9, 0], scale);
  }

  cone(r: number, h: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, seg = 12, open = false): this {
    return this.add(new THREE.ConeGeometry(r, h, seg, 1, open), color, [x, y + h / 2, z]);
  }

  torus(r: number, tube: number, pos: V3, rot: V3, color: THREE.ColorRepresentation): this {
    return this.add(new THREE.TorusGeometry(r, tube, 6, 16), color, pos, rot);
  }

  /** A straight bar between two points. */
  beam(a: V3, b: V3, width: number, color: THREE.ColorRepresentation, opts: { wind?: number } = {}): this {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b);
    const length = from.distanceTo(to);
    const q = new THREE.Quaternion().setFromUnitVectors(UP, to.clone().sub(from).normalize());
    const e = new THREE.Euler().setFromQuaternion(q);
    const mid = from.add(to).multiplyScalar(0.5);
    return this.add(new THREE.BoxGeometry(width, length, width), color, [mid.x, mid.y, mid.z], [e.x, e.y, e.z], [1, 1, 1], opts);
  }

  /** A sagging wire between two points, as a few straight bars. */
  wire(a: V3, b: V3, sag: number, segments: number, color: THREE.ColorRepresentation, width = 0.035): this {
    for (let i = 0; i < segments; i++) this.beam(wirePoint(a, b, sag, i / segments), wirePoint(a, b, sag, (i + 1) / segments), width, color);
    return this;
  }

  /** Vertices added so far (parts are non-indexed and merged in order). */
  get vertexCount(): number {
    return this.parts.reduce((n, p) => n + p.attributes.position.count, 0);
  }

  get empty(): boolean {
    return this.parts.length === 0;
  }

  build(): THREE.BufferGeometry {
    if (!this.parts.length) return new THREE.BufferGeometry();
    const merged = mergeGeometries(this.parts, false);
    this.parts.forEach((p) => p.dispose());
    this.parts = [];
    merged.computeBoundingSphere();
    return merged;
  }

  /**
   * Merges into square map cells instead of one mesh, so frustum culling can
   * skip the blocks out of view: a whole-district bounding sphere never gets culled.
   */
  buildChunks(cell: number): THREE.BufferGeometry[] {
    const groups = new Map<string, THREE.BufferGeometry[]>();
    for (const part of this.parts) {
      part.computeBoundingSphere();
      const c = part.boundingSphere!.center, key = `${Math.floor(c.x / cell)},${Math.floor(c.z / cell)}`;
      const list = groups.get(key);
      if (list) list.push(part); else groups.set(key, [part]);
    }
    const chunks = [...groups.values()].map((parts) => {
      const merged = mergeGeometries(parts, false);
      merged.computeBoundingSphere();
      return merged;
    });
    this.parts.forEach((p) => p.dispose());
    this.parts = [];
    return chunks;
  }
}

/** A point on a sagging wire; shared with the lanterns and flags hung on it. */
export function wirePoint(a: V3, b: V3, sag: number, t: number): V3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, a[2] + (b[2] - a[2]) * t];
}

/**
 * Writes flat quads directly, for the thousands of paving stones and grass
 * cells where a BoxGeometry per stone would be wasteful. Corners run
 * counter-clockwise seen from the front; colours may vary per corner.
 */
export class QuadWriter {
  private positions: number[] = [];
  private colors: number[] = [];
  private scratch = new THREE.Color();

  private rgb(color: THREE.ColorRepresentation | THREE.Color): [number, number, number] {
    const c = color instanceof THREE.Color ? color : this.scratch.set(color);
    return [c.r, c.g, c.b];
  }

  quad(a: V3, b: V3, c: V3, d: V3, color: THREE.ColorRepresentation | THREE.Color | [THREE.Color, THREE.Color, THREE.Color, THREE.Color]): this {
    const corners = Array.isArray(color) ? color.map((value) => this.rgb(value)) : [this.rgb(color), this.rgb(color), this.rgb(color), this.rgb(color)];
    for (const i of [0, 1, 2, 0, 2, 3]) {
      this.positions.push(...[a, b, c, d][i]);
      this.colors.push(...corners[i]);
    }
    return this;
  }

  /** Horizontal rectangle at height y, facing up. */
  rect(x0: number, z0: number, x1: number, z1: number, y: number, color: THREE.ColorRepresentation | THREE.Color | [THREE.Color, THREE.Color, THREE.Color, THREE.Color]): this {
    return this.quad([x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0], color);
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.colors, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(this.positions.length / 3 * 2), 2));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}
