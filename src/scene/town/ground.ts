import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { DistrictId } from "../../game/content/ids";
import { WALK_AREAS, type Area } from "../../game/world/layout";
import { PartBuilder, QuadWriter } from "../partBuilder";

/** Tops are y = 0 for paving (the walking height) and just below for everything around it. */
export const GRASS_Y = -0.06;
const WATER_Y = -0.28;
const VERGE_Y = -0.05;
const KERB_Y = 0.035;

function hash(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise(x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Deterministic random numbers so the town is the same on every load. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GRASS_DARK = new THREE.Color("#7fb655"), GRASS_MID = new THREE.Color("#97c964"), GRASS_LIGHT = new THREE.Color("#b2da73"), GRASS_STRAW = new THREE.Color("#cdd97c");
function grassAt(x: number, z: number): THREE.Color {
  const n = noise(x * 0.055, z * 0.055) * 0.62 + noise(x * 0.19 + 9, z * 0.19 + 4) * 0.38;
  const c = GRASS_DARK.clone().lerp(GRASS_MID, THREE.MathUtils.smoothstep(n, 0.22, 0.52)).lerp(GRASS_LIGHT, THREE.MathUtils.smoothstep(n, 0.52, 0.82));
  const dry = noise(x * 0.03 + 40, z * 0.03 + 13);
  return dry > 0.66 ? c.lerp(GRASS_STRAW, (dry - 0.66) * 1.3) : c;
}

/** The river bank's wandering edge. Stays south of the paved edge at z = 18 plus its kerb. */
const bank = (x: number) => 19.4 + (noise(x * 0.13, 3) - 0.5) * 1.2;
const HARBOR = { x: 3.5, z: 33.5, hx: 28, hz: 6.2 };
const SAND = new THREE.Color("#efdba6"), WET_SAND = new THREE.Color("#c9b98b");

/** Mottled grass with a natural shoreline. One draw call for the whole valley. */
export function landGeometry(): THREE.BufferGeometry {
  const q = new QuadWriter();
  const cell = 5, x0 = -105, x1 = 105, z0 = -90;
  const rows: number[] = [];
  for (let z = z0; z < 16; z += cell) rows.push(z);
  const zAt = (row: number, x: number) => row < rows.length ? rows[row] : bank(x);
  // Grass wholly under paving could never be seen, so it is not drawn at all.
  const paved = (ax: number, az: number, bx: number, bz: number) => WALK_AREAS.some(w => ax >= w.x - w.hx && bx <= w.x + w.hx && az >= w.z - w.hz && bz <= w.z + w.hz && w.id !== "bridge");
  for (let x = x0; x < x1; x += cell) for (let row = 0; row < rows.length; row++) {
    const a = zAt(row, x), b = zAt(row + 1, x), c = zAt(row + 1, x + cell), d = zAt(row, x + cell);
    if (paved(x, Math.min(a, d), x + cell, Math.max(b, c))) continue;
    q.quad([x, GRASS_Y, a], [x, GRASS_Y, b], [x + cell, GRASS_Y, c], [x + cell, GRASS_Y, d], [grassAt(x, a), grassAt(x, b), grassAt(x + cell, c), grassAt(x + cell, d)]);
  }
  // A sandy lip where the grass meets the river, sloping under the water.
  for (let x = x0; x < x1; x += 2.5) {
    const a = bank(x), b = bank(x + 2.5);
    q.quad([x, GRASS_Y, a], [x, WATER_Y - 0.08, a + 1.7], [x + 2.5, WATER_Y - 0.08, b + 1.7], [x + 2.5, GRASS_Y, b], [SAND, WET_SAND, WET_SAND, SAND]);
  }
  // The harbor bank is a soft-cornered island in the same style.
  const corner = 3, hx = HARBOR.hx - corner, hz = HARBOR.hz - corner, edge: [number, number][] = [];
  const arc = (cx: number, cz: number, from: number) => { for (let i = 0; i <= 5; i++) { const a = from + i / 5 * Math.PI / 2; edge.push([cx + Math.cos(a) * corner, cz + Math.sin(a) * corner]); } };
  const side = (x0: number, z0: number, x1: number, z1: number) => { const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / 3); for (let i = 1; i < n; i++) edge.push([x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n]); };
  arc(hx, hz, 0); side(hx, hz + corner, -hx, hz + corner);
  arc(-hx, hz, Math.PI / 2); side(-hx - corner, hz, -hx - corner, -hz);
  arc(-hx, -hz, Math.PI); side(-hx, -hz - corner, hx, -hz - corner);
  arc(hx, -hz, Math.PI * 1.5); side(hx + corner, -hz, hx + corner, hz);
  const outline = edge.map(([px, pz]): [number, number] => {
    const wobble = (noise(px * 0.22 + 7, pz * 0.22) - 0.5) * 0.7, d = Math.hypot(px, pz) || 1;
    return [HARBOR.x + px + px / d * wobble, HARBOR.z + pz + pz / d * wobble];
  });
  const middle = new THREE.Color("#a3d06c");
  const outward = (px: number, pz: number): [number, number] => {
    const dx = px - HARBOR.x, dz = pz - HARBOR.z, d = Math.hypot(dx, dz) || 1;
    return [px + dx / d * 1.7, pz + dz / d * 1.7];
  };
  outline.forEach(([x, z], i) => {
    const [nx, nz] = outline[(i + 1) % outline.length];
    q.quad([HARBOR.x, GRASS_Y, HARBOR.z], [nx, GRASS_Y, nz], [x, GRASS_Y, z], [HARBOR.x, GRASS_Y, HARBOR.z], [middle, grassAt(nx, nz), grassAt(x, z), middle]);
    const [ox, oz] = outward(x, z), [mx, mz] = outward(nx, nz);
    q.quad([x, GRASS_Y, z], [nx, GRASS_Y, nz], [mx, WATER_Y - 0.08, mz], [ox, WATER_Y - 0.08, oz], [SAND, SAND, WET_SAND, WET_SAND]);
  });
  // Past the fog line the valley only needs to be green.
  const far = 430, y = GRASS_Y - 0.04, flat = new THREE.Color("#92c362");
  q.rect(-far, -far, far, z0, y, flat).rect(-far, z0, x0, 19, y, flat).rect(x1, z0, far, 19, y, flat);
  return q.build();
}

/**
 * Stylised water with analytic shallows and foam, so the shoreline needs no
 * extra geometry. Only water pixels pay for it, and it is absent from most frames.
 */
export function waterMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      time: { value: 0 }, deep: { value: new THREE.Color("#3ea6c7") }, shallow: { value: new THREE.Color("#7fdcd6") }, foam: { value: new THREE.Color("#f4fff4") }
    }]),
    vertexShader: /* glsl */ `
      varying vec2 vWorld;
      varying float vFogDepth;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xz;
        vec4 view = viewMatrix * world;
        vFogDepth = -view.z;
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float time, fogNear, fogFar;
      uniform vec3 deep, shallow, foam, fogColor;
      varying vec2 vWorld;
      varying float vFogDepth;
      void main() {
        vec2 p = vWorld;
        float swell = sin(p.x * 0.31 + time * 0.55) + sin(p.y * 0.43 - time * 0.42) + sin((p.x + p.y) * 0.19 + time * 0.31);
        float ripple = sin(p.x * 0.62 + p.y * 0.21 + swell * 2.6 + time * 0.8) * sin(p.y * 0.93 - p.x * 0.17 - swell * 2.1 - time * 0.6);
        vec2 q = abs(p - vec2(${HARBOR.x.toFixed(1)}, ${HARBOR.z.toFixed(1)})) - vec2(${HARBOR.hx.toFixed(1)}, ${HARBOR.hz.toFixed(1)});
        float shore = min(length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 1.5, p.y - 20.9);
        vec3 color = mix(deep, shallow, clamp(0.34 + 0.11 * swell, 0.0, 1.0));
        color = mix(shallow * 1.08, color, smoothstep(0.2, 4.2, shore));
        // Thin glints that drift and break up: never a regular pattern of dots.
        float glints = smoothstep(0.86, 0.98, ripple) * smoothstep(-0.4, 1.2, sin(p.x * 0.17 - p.y * 0.23 + swell));
        color += foam * glints * 0.13;
        color = mix(color, foam, smoothstep(0.7, 0.1, shore + 0.22 * sin(p.x * 1.4 + p.y * 1.1 + time * 0.9)) * 0.62);
        color = mix(color, fogColor, smoothstep(fogNear, fogFar, vFogDepth));
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `
  });
}

export function waterGeometry(): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(860, 430).rotateX(-Math.PI / 2);
  g.translate(0, WATER_Y, 14 + 215);
  return g;
}

/* ---------------------------------------------------------------- paving */

interface PaveStyle { w: number; d: number; colors: string[]; road?: string[]; grout: string }
const SQUARE: PaveStyle = { w: 1.5, d: 0.95, colors: ["#f2dfbb", "#edd6ae", "#f6e6c8", "#e9cfa6"], road: ["#fbf0d8", "#f8ebcf", "#fdf4e0"], grout: "#c9b48e" };
const MARKET: PaveStyle = { w: 1.25, d: 0.8, colors: ["#f0bf99", "#e9b18a", "#f4cca9", "#e4a680"], road: ["#f8d8ba", "#f6d1b0", "#fbe0c4"], grout: "#bd8a68" };
const SCHOOL: PaveStyle = { w: 2.1, d: 1.5, colors: ["#ebe8d4", "#e1e1cc", "#f1eedb", "#dbdec8"], road: ["#f8f5e4", "#f4f1df"], grout: "#b9b9a0" };
const HARBOR_STONE: PaveStyle = { w: 1.7, d: 1.05, colors: ["#f0ddb0", "#e8d19e", "#f4e4bd", "#e0c791"], grout: "#b9a379" };
const NECK: PaveStyle = { w: 1.3, d: 0.85, colors: ["#f3d7ab", "#eccc9c", "#f7e0ba", "#e7c491"], grout: "#c0a57c" };
const STYLES: Record<string, PaveStyle> = {
  square: SQUARE, "school-approach": SCHOOL, "arch-approach": NECK, "bridge-approach": SQUARE, "market-neck": MARKET, market: MARKET,
  "school-neck": SCHOOL, courtyard: SCHOOL, "harbor-bank": HARBOR_STONE, "festival-neck": NECK
};
const PLANKS = ["#d5a877", "#cb9c6b", "#deb487", "#c4935f"];
const DECK = ["#cda06c", "#c2925e", "#d6ac7b", "#b98857"];

const isRoad = (a: Area, x: number, z: number) => {
  if (a.id === "square") return Math.abs(x) < 2.9 || Math.abs(z) < 2.9;
  if (a.id === "market") return Math.abs(z) < 2.7;
  if (a.id === "courtyard" || a.id === "school-neck" || a.id === "school-approach") return Math.abs(x) < 2.7;
  return false;
};

/** Trims a stone to the part outside earlier areas: overlapping paving would z-fight. */
function trimToFree(earlier: readonly Area[], x0: number, z0: number, x1: number, z1: number): [number, number, number, number] | null {
  const eps = 1e-4;
  for (const e of earlier) {
    const ax = e.x - e.hx, bx = e.x + e.hx, az = e.z - e.hz, bz = e.z + e.hz;
    const ix0 = Math.max(x0, ax), ix1 = Math.min(x1, bx), iz0 = Math.max(z0, az), iz1 = Math.min(z1, bz);
    if (ix0 >= ix1 || iz0 >= iz1) continue;
    if (iz0 <= z0 + eps && iz1 >= z1 - eps) {
      if (ix0 <= x0 + eps && ix1 >= x1 - eps) return null;
      if (ix0 <= x0 + eps) x0 = ix1; else if (ix1 >= x1 - eps) x1 = ix0; else return null;
    } else if (ix0 <= x0 + eps && ix1 >= x1 - eps) {
      if (iz0 <= z0 + eps) z0 = iz1; else if (iz1 >= z1 - eps) z1 = iz0; else return null;
    } else return null;
  }
  return x1 - x0 > 0.08 && z1 - z0 > 0.08 ? [x0, z0, x1, z1] : null;
}

function layStones(q: QuadWriter, a: Area, earlier: readonly Area[], style: PaveStyle, rand: () => number, skip?: (x: number, z: number) => boolean) {
  const gap = 0.045;
  let row = 0;
  for (let z = a.z - a.hz; z < a.z + a.hz - 0.01; z += style.d, row++) {
    const zEnd = Math.min(z + style.d, a.z + a.hz);
    // Running bond: every other row starts half a stone over.
    for (let x = a.x - a.hx - (row % 2 ? style.w / 2 : 0); x < a.x + a.hx - 0.01; x += style.w) {
      const xEnd = Math.min(x + style.w, a.x + a.hx);
      const free = trimToFree(earlier, Math.max(x, a.x - a.hx) + gap, z + gap, xEnd - gap, zEnd - gap);
      if (!free || skip?.((free[0] + free[2]) / 2, (free[1] + free[3]) / 2)) continue;
      const palette = style.road && isRoad(a, (free[0] + free[2]) / 2, (free[1] + free[3]) / 2) ? style.road : style.colors;
      q.rect(free[0], free[1], free[2], free[3], a.y, palette[Math.floor(rand() * palette.length)]);
    }
  }
}

/** Concentric paving rings: tells a child this is the middle of the town. */
function ringPaving(q: QuadWriter, cx: number, cz: number, r0: number, r1: number, y: number, tones: string[][], rand: () => number, size = 1.25) {
  let index = 0;
  for (let r = r0; r < r1 - 0.01; r += 0.85, index++) {
    const n = Math.max(8, Math.round(Math.PI * 2 * r / size));
    const palette = tones[index % tones.length];
    for (let i = 0; i < n; i++) {
      const a0 = (i + 0.03 + index * 0.5) / n * Math.PI * 2, a1 = (i + 0.97 + index * 0.5) / n * Math.PI * 2;
      const inner = r + 0.03, outer = r + 0.82;
      q.quad(
        [cx + Math.cos(a0) * inner, y, cz + Math.sin(a0) * inner], [cx + Math.cos(a1) * inner, y, cz + Math.sin(a1) * inner],
        [cx + Math.cos(a1) * outer, y, cz + Math.sin(a1) * outer], [cx + Math.cos(a0) * outer, y, cz + Math.sin(a0) * outer],
        palette[Math.floor(rand() * palette.length)]
      );
    }
  }
}

/** A flat ring, used for gold inlays around the paving rounds. */
function flatRing(q: QuadWriter, cx: number, cz: number, r0: number, r1: number, y: number, color: string, n = 48) {
  for (let i = 0; i < n; i++) {
    const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
    q.quad(
      [cx + Math.cos(a0) * r0, y, cz + Math.sin(a0) * r0], [cx + Math.cos(a1) * r0, y, cz + Math.sin(a1) * r0],
      [cx + Math.cos(a1) * r1, y, cz + Math.sin(a1) * r1], [cx + Math.cos(a0) * r1, y, cz + Math.sin(a0) * r1],
      color
    );
  }
}

const insideAnyArea = (x: number, z: number) => WALK_AREAS.some(a => Math.abs(x - a.x) <= a.hx && Math.abs(z - a.z) <= a.hz);

/** A raised kerb and a gravel verge fading into the grass, outside the exact walking edge. */
function edging(q: QuadWriter, a: Area, rand: () => number, kerbColors: string[], gravel: string) {
  const gravelColor = new THREE.Color(gravel);
  const sides: [number, number, number, number, number, number][] = [
    [a.x - a.hx, a.z - a.hz, 1, 0, 0, -1], [a.x + a.hx, a.z - a.hz, 0, 1, 1, 0],
    [a.x + a.hx, a.z + a.hz, -1, 0, 0, 1], [a.x - a.hx, a.z + a.hz, 0, -1, -1, 0]
  ];
  for (const [sx, sz, tx, tz, nx, nz] of sides) {
    const length = tx ? a.hx * 2 : a.hz * 2;
    for (let s = 0; s < length - 0.01;) {
      const run = Math.min(length - s, 1.1 + rand() * 0.8);
      const ax = sx + tx * s, az = sz + tz * s, bx = ax + tx * run, bz = az + tz * run;
      const mx = (ax + bx) / 2 + nx * 0.45, mz = (az + bz) / 2 + nz * 0.45;
      s += run;
      if (insideAnyArea(mx, mz)) continue;
      const k = 0.26, wide0 = 0.5 + noise(ax * 0.4, az * 0.4) * 1.1, wide1 = 0.5 + noise(bx * 0.4, bz * 0.4) * 1.1;
      // Side direction then outward keeps every one of these faces pointing up.
      const up = (p0: [number, number], p1: [number, number], p2: [number, number], p3: [number, number], y0: number, y1: number, c: THREE.ColorRepresentation | [THREE.Color, THREE.Color, THREE.Color, THREE.Color]) =>
        q.quad([p0[0], y0, p0[1]], [p1[0], y0, p1[1]], [p2[0], y1, p2[1]], [p3[0], y1, p3[1]], c);
      const color = kerbColors[Math.floor(rand() * kerbColors.length)];
      const a1: [number, number] = [ax + nx * k, az + nz * k], b1: [number, number] = [bx + nx * k, bz + nz * k];
      up([ax, az], [bx - tx * 0.05, bz - tz * 0.05], [b1[0] - tx * 0.05, b1[1] - tz * 0.05], a1, KERB_Y, KERB_Y, color);
      const a2: [number, number] = [ax + nx * (k + wide0), az + nz * (k + wide0)], b2: [number, number] = [bx + nx * (k + wide1), bz + nz * (k + wide1)];
      up(a1, b1, b2, a2, VERGE_Y, VERGE_Y, [gravelColor, gravelColor, grassAt(b2[0], b2[1]), grassAt(a2[0], a2[1])]);
      // Outer face of the kerb, down to the verge.
      q.quad([a1[0], KERB_Y, a1[1]], [b1[0], KERB_Y, b1[1]], [b1[0], VERGE_Y, b1[1]], [a1[0], VERGE_Y, a1[1]], new THREE.Color(color).multiplyScalar(0.72));
    }
  }
}

function festivalLawn(q: QuadWriter, a: Area, earlier: readonly Area[], rand: () => number) {
  const cell = 3;
  const dark = new THREE.Color("#a9d47f"), light = new THREE.Color("#bce18f"), c = new THREE.Color();
  let row = 0;
  for (let z = a.z - a.hz; z < a.z + a.hz - 0.01; z += cell, row++) for (let x = a.x - a.hx; x < a.x + a.hx - 0.01; x += cell) {
    const free = trimToFree(earlier, x, z, Math.min(x + cell, a.x + a.hx), Math.min(z + cell, a.z + a.hz));
    if (!free) continue;
    c.copy(row % 2 ? dark : light).multiplyScalar(0.96 + rand() * 0.08);
    q.rect(free[0], free[1], free[2], free[3], a.y, c);
  }
  // The gathering circle at the heart of the grounds, with a sunburst inlay.
  const y = a.y + 0.006;
  ringPaving(q, -47, 0, 1.1, 9.6, y, [["#f7dcb0", "#f3d3a2"], ["#f3c08d", "#efb580"], ["#fbe6c2", "#f8dfb6"]], rand, 1.5);
  flatRing(q, -47, 0, 9.6, 10.05, y, "#f5c04f", 56);
  flatRing(q, -47, 0, 0.72, 1.1, y, "#f5c04f", 20);
  // A stone path from the arch to the circle, which itself reaches the stage steps.
  for (let x = -37; x < -28.01; x += 1.25) for (let z = -2.1; z < 2.09; z += 0.9) {
    q.rect(x + 0.04, z + 0.04, Math.min(x + 1.25, -28) - 0.04, z + 0.86 + (rand() - 0.5) * 0.08, y, NECK.colors[Math.floor(rand() * NECK.colors.length)]);
  }
}

/** Paving with the exact bounds used by the walking solver, one mesh per district. */
export function pavingGeometry(district: DistrictId): THREE.BufferGeometry {
  const base = new PartBuilder(0), q = new QuadWriter(), rand = seeded(district.length * 991 + 13);
  WALK_AREAS.forEach((a, index) => {
    if (a.district !== district || a.id === "bridge") return;
    const earlier = WALK_AREAS.slice(0, index).filter(e => e.id !== "bridge");
    const style = STYLES[a.id];
    const grout = a.id === "library" ? "#8d6a48" : a.id === "pier" ? "#6e5236" : a.id === "festival" ? "#94bd70" : style.grout;
    // Base tops step down by a hair so overlapping junctions never share a plane.
    base.box(a.hx * 2, 0.5, a.hz * 2, a.x, a.y - 0.52 - index * 0.0012, a.z, grout);
    if (a.id === "library" || a.id === "pier") {
      const palette = a.id === "library" ? PLANKS : DECK, width = a.id === "library" ? 0.72 : 0.92;
      for (let z = a.z - a.hz; z < a.z + a.hz - 0.01; z += width) q.rect(a.x - a.hx, z + 0.025, a.x + a.hx, Math.min(z + width, a.z + a.hz) - 0.025, a.y, palette[Math.floor(rand() * palette.length)]);
      return;
    }
    if (a.id === "festival") {
      festivalLawn(q, a, earlier, rand);
      edging(q, a, rand, ["#d7c293", "#cfb987", "#dfcca0"], "#c9c58e");
      return;
    }
    layStones(q, a, earlier, style, rand, a.id === "square" ? (x, z) => Math.hypot(x, z) < 8.2 : undefined);
    edging(q, a, rand, a.district === "market" ? ["#c99d7c", "#bf9170", "#d3a988"] : a.district === "school" ? ["#c7c7ae", "#bebea4", "#d1d1ba"] : ["#d3bd96", "#c9b28a", "#ddc8a3"], a.district === "harbor" ? "#e5d4a2" : "#d8c799");
  });
  if (district === "square") {
    const y = 0.004;
    ringPaving(q, 0, 0, 2.75, 8.7, y, [["#e9b48a", "#e2a87e"], ["#f8e9ca", "#f4e1bd"], ["#f1cda4", "#ecc397"]], rand);
    flatRing(q, 0, 0, 8.7, 9.1, y, "#f2bd57", 64);
  }
  if (district === "market") {
    // A painted centre line draws the eye down the shopping street.
    for (let x = 24; x < 55; x += 2.4) q.rect(x, -0.09, x + 1.35, 0.09, 0.004, "#fff2d8");
  }
  if (district === "school") {
    // Hopscotch, painted where the courtyard's open floor has room for it.
    const y = 0.004, tones = ["#f49aa6", "#ffd666", "#88cbe8", "#a5dc91"];
    [[-8, -36], [-8, -37.3], [-8.7, -38.6], [-7.3, -38.6], [-8, -39.9], [-8.7, -41.2], [-7.3, -41.2], [-8, -42.5]].forEach(([x, z], i) => {
      q.rect(x - 0.62, z - 0.62, x + 0.62, z + 0.62, y, "#fffaf0");
      q.rect(x - 0.54, z - 0.54, x + 0.54, z + 0.54, y + 0.002, tones[i % tones.length]);
    });
    // A welcome mat at the school door.
    q.rect(-1.4, -49, 1.4, -47.6, y, "#d9534f");
    q.rect(-1.22, -48.86, 1.22, -47.74, y + 0.002, "#f0b45a");
  }
  if (district === "harbor") {
    // Painted mooring marks, a little colour on the long bank.
    for (let x = -14; x < 3; x += 5.5) q.rect(x, 36.3, x + 1.5, 36.7, 0.004, "#5aa6c9");
  }
  // Stones first: the depth test then rejects the base under them. The other way round
  // shades every paved pixel twice, which measured as a third of the whole frame.
  const parts = [q.build(), base.build()];
  const merged = mergeGeometries(parts, false);
  parts.forEach(part => part.dispose());
  merged.computeBoundingSphere();
  return merged;
}
