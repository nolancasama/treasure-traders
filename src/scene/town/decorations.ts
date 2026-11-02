import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { DistrictId, ItemId } from "../../game/content/ids";
import { glowTexture, sceneryMat, sceneUniforms } from "../materials";
import { itemGeometry } from "../models/items";
import { PartBuilder, wirePoint } from "../partBuilder";
import { MAYPOLE_TOP, NORTH_POLES, SOUTH_POLES } from "./districts";
import { GRASS_Y } from "./ground";
import { PALETTE } from "./builders";
import { SignBatch, signMat } from "./signs";

type V3 = [number, number, number];
const PAPER = ["#ef6a55", "#ffcf5e", "#fff0d2", "#ff9568", "#f7b0c2"];
const PENNANTS = ["#e8604c", "#ffcc4d", "#4f9ad6", "#6fb35c", "#c77bd9", "#ff8fa8"];

/** Things that appear one by one at a chest milestone (SPEC §9), then never move again. */
interface Piece { mesh: THREE.InstancedMesh; index: number; position: THREE.Vector3; yaw: number; scale: number; delay: number }
interface Stage { threshold: number; root: THREE.Group; pieces: Piece[]; span: number; elapsed: number; settled: boolean; glow?: THREE.Points; lanterns?: THREE.MeshLambertMaterial }

/** A little overshoot, the difference between a decoration arriving and merely appearing. */
function backOut(t: number): number {
  const c = 1.9, u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
}

const object = new THREE.Object3D();
function writePiece(p: Piece, k: number) {
  object.position.copy(p.position);
  object.rotation.set(0, p.yaw, 0);
  object.scale.setScalar(Math.max(0.0001, k * p.scale));
  object.updateMatrix();
  p.mesh.setMatrixAt(p.index, object.matrix);
}

/** Hanging lantern, with its origin at the hook. Paper tinted per instance; lit by a shared emissive. */
function lanternGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0, true);
  b.add(new THREE.CylinderGeometry(0.1, 0.1, 0.07, 5, 1, true), PALETTE.ink, [0, -0.1, 0], [0, 0, 0], [1, 1, 1], { wind: 0.12 });
  b.add(new THREE.SphereGeometry(0.34, 7, 4), "#ffffff", [0, -0.48, 0], [0, 0, 0], [1, 1.1, 1], { wind: 0.22 });
  b.add(new THREE.CylinderGeometry(0.11, 0.11, 0.07, 5, 1, true), PALETTE.ink, [0, -0.86, 0], [0, 0, 0], [1, 1, 1], { wind: 0.26 });
  return b.build();
}

function pennantGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0, true);
  b.add(new THREE.ConeGeometry(0.34, 0.68, 3), "#ffffff", [0, -0.34, 0], [Math.PI, Math.PI / 2, 0], [1, 1, 0.1], { wind: 1, hang: true, flatAo: true });
  return b.build();
}

/** A flag whose free edge carries the wind weight, hung from a pole on its -x side. */
function flagGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0, true);
  b.add(new THREE.BoxGeometry(1.5, 0.92, 0.03, 4, 1), "#ffffff", [0.75, 0, 0], [0, 0, 0], [1, 1, 1], { flatAo: true });
  const g = b.build(), position = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < position.count; i++) uv.setX(i, position.getX(i) / 1.5);
  return g;
}

function balloonGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0, true);
  b.add(new THREE.SphereGeometry(0.44, 8, 6), "#ffffff", [0, 0, 0], [0, 0, 0], [1, 1.22, 1], { wind: 0.3 });
  b.add(new THREE.ConeGeometry(0.06, 0.1, 5), "#ffffff", [0, -0.56, 0], [Math.PI, 0, 0], [1, 1, 1], { wind: 0.3 });
  return b.build();
}

/** A giant stationery item used by the finished festival (SPEC §6.5), posed in the world. */
function placedItem(id: ItemId, scale: number, position: V3, rotation: V3): THREE.BufferGeometry {
  const g = itemGeometry(id).clone();
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(scale, scale, scale)));
  return g;
}

export interface Decorations {
  update(level: number, lit: number, dt: number): void;
  dispose(): void;
}

export function createDecorations(districts: Record<DistrictId, THREE.Group>): Decorations {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  const stages: Stage[] = [];
  const lantern = lanternGeometry(), pennant = pennantGeometry();
  geometries.add(lantern).add(pennant);

  const litMaterial = () => {
    const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: "#ff9c3f", emissiveIntensity: 0 });
    m.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, sceneUniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float ttTime;")
        .replace("#include <begin_vertex>", `#include <begin_vertex>
          float ttPhase = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.5;
          transformed.x += sin(ttTime * 1.6 + ttPhase) * 0.12 * uv.x;
          transformed.z += cos(ttTime * 1.25 + ttPhase) * 0.09 * uv.x;`);
    };
    m.customProgramCacheKey = () => "tt:lantern";
    materials.add(m);
    return m;
  };

  const stage = (threshold: number, district: DistrictId): Stage => {
    const root = new THREE.Group();
    root.visible = false;
    districts[district].add(root);
    const s: Stage = { threshold, root, pieces: [], span: 0, elapsed: -1, settled: false };
    stages.push(s);
    return s;
  };
  const batch = (s: Stage, geometry: THREE.BufferGeometry, material: THREE.Material, entries: { position: V3; yaw?: number; scale?: number; color?: string }[], delayStart = 0, delayEnd = 1.5) => {
    const mesh = new THREE.InstancedMesh(geometry, material, entries.length);
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.raycast = () => {};
    s.root.add(mesh);
    const color = new THREE.Color();
    entries.forEach((entry, index) => {
      const piece: Piece = { mesh, index, position: new THREE.Vector3(...entry.position), yaw: entry.yaw ?? 0, scale: entry.scale ?? 1, delay: delayStart + (delayEnd - delayStart) * index / Math.max(1, entries.length - 1) };
      s.pieces.push(piece);
      s.span = Math.max(s.span, piece.delay + 0.5);
      writePiece(piece, 0);
      if (entry.color) mesh.setColorAt(index, color.set(entry.color));
    });
    return mesh;
  };
  const statics = (s: Stage, build: (b: PartBuilder) => void, material: THREE.Material = sceneryMat()) => {
    const b = new PartBuilder(0.4, true);
    build(b);
    const geometry = b.build();
    geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.raycast = () => {};
    s.root.add(mesh);
    return mesh;
  };
  const halo = (s: Stage, points: V3[], size = 2.3) => {
    const geometry = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(points.flat(), 3));
    geometries.add(geometry);
    const material = new THREE.PointsMaterial({ map: glowTexture(), color: "#ffb45e", size, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false });
    materials.add(material);
    const glow = new THREE.Points(geometry, material);
    glow.raycast = () => {};
    glow.visible = false;
    s.root.add(glow);
    s.glow = glow;
  };
  /** Points along a wire, for a string of things hanging off it. */
  const along = (a: V3, b: V3, sag: number, count: number, drop = 0): V3[] => Array.from({ length: count }, (_, i) => {
    const p = wirePoint(a, b, sag, (i + 1) / (count + 1));
    return [p[0], p[1] - drop, p[2]];
  });
  const yawOf = (a: V3, b: V3) => Math.atan2(b[0] - a[0], b[2] - a[2]) + Math.PI / 2;

  /* 2 items: bunting over the square, and a crown of flags on the fountain. */
  {
    const s = stage(2, "square");
    const poleTop = 6.1, corners: V3[] = [[-18.7, poleTop, -18.8], [18.7, poleTop, -18.8], [-18.7, poleTop, 12], [18.7, poleTop, 12]];
    const lines: [V3, V3, number][] = [[corners[0], corners[1], 1.6], [corners[0], corners[2], 1.5], [corners[1], corners[3], 1.5]];
    statics(s, b => {
      for (const c of corners) {
        b.cyl(0.09, 0.14, poleTop + 0.06, c[0], GRASS_Y, c[2], PALETTE.wood, 6);
        b.sphere(0.15, c[0], poleTop + 0.08, c[2], PALETTE.gold, [1, 1, 1], 6);
      }
      for (const [a, c, sag] of lines) b.wire(a, c, sag, 8, "#8a6a48", 0.035);
    });
    const flags = lines.flatMap(([a, c, sag]) => along(a, c, sag, Math.round(Math.hypot(c[0] - a[0], c[2] - a[2]) / 1.65)).map((position, i) => ({ position, yaw: yawOf(a, c), color: PENNANTS[i % PENNANTS.length] })));
    batch(s, pennant, sceneryMat(), flags, 0.25, 1.7);
  }

  /* 4 items: paper lanterns on every stall and along the back of the street, on real hooks and wires. */
  {
    const s = stage(4, "market");
    const y = 4.6, wires: [V3, V3][] = [[[24, y, -12.6], [39, y, -12.6]], [[39, y, -12.6], [54, y, -12.6]]];
    statics(s, b => {
      for (const x of [24, 39, 54]) {
        b.cyl(0.07, 0.11, y + 0.04, x, GRASS_Y, -12.6, PALETTE.wood, 6);
        b.sphere(0.12, x, y + 0.06, -12.6, PALETTE.gold, [1, 1, 1], 6);
      }
      for (const [a, c] of wires) b.wire(a, c, 0.55, 6, "#8a6a48", 0.03);
    });
    const onWires = wires.flatMap(([a, c]) => along(a, c, 0.55, 5));
    // Two on each stall's camera-side corners, hung from the top of the frame.
    const onStalls: V3[] = [[30, -7], [30, 7], [45, -7], [45, 7]].flatMap(([x, z]) => [-3.14, 3.14].map((dx): V3 => [x + dx, 3.62, z + 1.72]));
    const entries = [...onStalls, ...onWires].map((position, i) => ({ position, scale: i < onStalls.length ? 0.85 : 1, color: PAPER[i % PAPER.length] }));
    const material = litMaterial();
    batch(s, lantern, material, entries, 0.25, 1.6);
    s.lanterns = material;
    halo(s, entries.map(e => [e.position[0], e.position[1] - 0.48, e.position[2]]));
  }

  /* 6 items: flags on the school roof, and pennants over the courtyard. */
  {
    const s = stage(6, "school");
    const flag = flagGeometry();
    geometries.add(flag);
    const xs = [-9, -5, 5, 9, 13];
    // Across the front of the school and down the sides of the yard, never over the middle of it.
    const schoolLines: [V3, V3][] = [[[-9.9, 3.45, -48.85], [13.9, 3.45, -48.85]], [[14.3, 3.2, -47], [14.3, 3.2, -26]], [[-14.3, 3.2, -35], [-14.3, 3.2, -26]]];
    statics(s, b => {
      for (const x of xs) {
        b.cyl(0.04, 0.05, 2.3, x, 6.2, -52, PALETTE.darkWood, 5);
        b.sphere(0.08, x, 8.52, -52, PALETTE.gold, [1, 1, 1], 5);
      }
      for (const [x, z] of [[14.3, -47], [14.3, -26], [-14.3, -35], [-14.3, -26]] as const) b.cyl(0.05, 0.07, 3.26, x, GRASS_Y, z, PALETTE.wood, 5);
      for (const [a, c] of schoolLines) b.wire(a, c, 0.7, 8, "#8a6a48", 0.03);
    });
    const flags = xs.map((x, i) => ({ position: [x, 8.05, -52] as V3, color: ["#e8604c", "#ffcc4d", "#4f9ad6", "#6fb35c", "#c77bd9"][i] }));
    batch(s, flag, sceneryMat(), flags, 0.2, 0.9);
    const strings = schoolLines.flatMap(([a, c]) => along(a, c, 0.7, Math.round(Math.hypot(c[0] - a[0], c[2] - a[2]) / 1.7)).map((position, i) => ({ position, yaw: yawOf(a, c), color: PENNANTS[i % PENNANTS.length] })));
    batch(s, pennant, sceneryMat(), strings, 0.5, 1.7);
  }

  /* 8 items: balloons at the harbor. */
  {
    const s = stage(8, "harbor");
    const balloon = balloonGeometry();
    geometries.add(balloon);
    const posts: V3[] = [[-13, 1.05, 27.82], [-7, 1.05, 27.82], [8, 1.05, 27.82], [14, 1.05, 27.82], [20, 1.05, 27.82], [23, 1.05, 27.82], [-16, 1.05, 27.82], [11.15, 1.25, 34]];
    const tints = ["#ef7a6c", "#ffd25c", "#6fb7e6", "#a4d97a", "#d79bea"];
    const entries: { position: V3; color: string }[] = [];
    const offsets: V3[] = [[0, 2.2, 0], [0.56, 1.7, 0.1], [-0.5, 1.8, -0.1]];
    posts.forEach((post, i) => offsets.forEach((o, k) => entries.push({ position: [post[0] + o[0], post[1] + o[1], post[2] + o[2]], color: tints[(i + k * 2) % tints.length] })));
    statics(s, b => posts.forEach(post => offsets.forEach(o => b.beam(post, [post[0] + o[0], post[1] + o[1] - 0.6, post[2] + o[2]], 0.016, "#e8e2d0"))));
    batch(s, balloon, sceneryMat(), entries, 0.2, 1.5);
  }

  /* 8 items: the festival arch's lanterns come on and stay on. */
  {
    const s = stage(8, "festival");
    const entries = Array.from({ length: 7 }, (_, i) => ({ position: [-22, 4.12, -3.3 + i * 1.1] as V3, scale: 0.72, color: PAPER[i % PAPER.length] }));
    const material = litMaterial();
    batch(s, lantern, material, entries, 0.2, 1);
    s.lanterns = material;
    halo(s, entries.map(e => [e.position[0], 3.78, e.position[2]]), 2);
  }

  /* 9 items: the grounds fully lit, and the stations put the supplies to use (SPEC §6.5). */
  {
    const s = stage(9, "festival");
    const entries = NORTH_POLES.flatMap(p => along(MAYPOLE_TOP, p, 0.75, 5).map((position, i) => ({ position, color: PAPER[i % PAPER.length] })));
    // Lines along both long edges, and a row hanging from the stage's roof.
    const edges: [V3, V3][] = [[NORTH_POLES[0], NORTH_POLES[1]], [NORTH_POLES[1], NORTH_POLES[2]], [SOUTH_POLES[0], SOUTH_POLES[1]], [SOUTH_POLES[1], SOUTH_POLES[2]]];
    for (const [a, c] of edges) entries.push(...along(a, c, 0.8, 5).map((position, i) => ({ position, color: PAPER[(i + 2) % PAPER.length] })));
    for (let i = 0; i < 6; i++) entries.push({ position: [-59.75, 5.05, -4.25 + i * 1.7], color: PAPER[i % PAPER.length] });
    statics(s, b => { for (const [a, c] of edges.slice(0, 2)) b.wire(a, c, 0.8, 8, "#8a6a48", 0.03); });
    const material = litMaterial();
    batch(s, lantern, material, entries, 0.1, 1.4);
    s.lanterns = material;
    halo(s, entries.map(e => [e.position[0], e.position[1] - 0.48, e.position[2]]));
    const items = [
      placedItem("calendar", 7, [-62.8, 2.35, -4.2], [Math.PI / 2 - 0.15, 0, -Math.PI / 2 + 0.9]),
      placedItem("pencilCase", 7, [-57, 0.96, -12.7], [0, 0.2, 0]),
      placedItem("notebook", 3.4, [-52.8, 0.8, 14.5], [0, 0.3, 0]),
      placedItem("marker", 8, [-61, 0.62, 3.4], [0, 0.6, 0]),
      placedItem("ruler", 6.5, [-60.1, 0.62, -2.8], [0, Math.PI / 2 + 0.25, 0]),
      placedItem("stapler", 6, [-43, 1.1, -11.2], [0, -0.5, 0])
    ];
    const merged = mergeGeometries(items, false);
    items.forEach(g => g.dispose());
    merged.computeBoundingSphere();
    geometries.add(merged);
    const shown = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ vertexColors: true }));
    shown.raycast = () => {};
    materials.add(shown.material as THREE.Material);
    s.root.add(shown);
    // The welcome sign, written with that marker: a board on the stage roof.
    const width = SignBatch.width("welcome", 1.3);
    statics(s, b => {
      for (const dz of [-width / 2 + 0.3, width / 2 - 0.3]) b.box(0.1, 0.5, 0.1, -59.7, 5.5, dz, PALETTE.darkWood);
      b.box(0.12, 1.5, width + 0.2, -59.7, 5.95, 0, PALETTE.darkWood);
    });
    const sign = new THREE.Mesh(new SignBatch().add("welcome", -59.62, 6.7, 0, 1.3, Math.PI / 2).build(), signMat());
    geometries.add(sign.geometry);
    sign.raycast = () => {};
    s.root.add(sign);
    const today = new THREE.Mesh(new SignBatch().add("today", -62.3, 3.42, -3.75, 0.52, Math.PI / 2 - 0.2).build(), signMat());
    geometries.add(today.geometry);
    today.raycast = () => {};
    s.root.add(today);
  }

  let first = true;
  return {
    update(level, lit, dt) {
      for (const s of stages) {
        const on = level >= s.threshold;
        if (!on) {
          if (s.elapsed >= 0) {
            s.elapsed = -1; s.settled = false; s.root.visible = false;
            for (const p of s.pieces) writePiece(p, 0);
            for (const mesh of new Set(s.pieces.map(p => p.mesh))) { mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false; }
          }
        } else if (s.elapsed < 0) {
          s.elapsed = first ? s.span : 0;
          s.root.visible = true;
        }
        if (on && !s.settled) {
          s.elapsed += dt;
          for (const p of s.pieces) writePiece(p, s.elapsed <= p.delay ? 0 : s.elapsed >= p.delay + 0.5 ? 1 : backOut((s.elapsed - p.delay) / 0.5));
          for (const mesh of new Set(s.pieces.map(p => p.mesh))) mesh.instanceMatrix.needsUpdate = true;
          // Poles and wires rise from the ground ahead of what they carry.
          for (const child of s.root.children) if (child instanceof THREE.Mesh && !(child instanceof THREE.InstancedMesh)) child.scale.y = THREE.MathUtils.clamp(s.elapsed / 0.4, 0.001, 1);
          if (s.elapsed >= s.span) {
            s.settled = true;
            // Now they have stopped moving, the batch can be culled like anything else.
            for (const mesh of new Set(s.pieces.map(p => p.mesh))) { mesh.computeBoundingSphere(); mesh.frustumCulled = true; }
          }
        }
        if (s.lanterns && s.root.visible) {
          // The arch stage is lit from the moment it opens; everything else waits for dusk.
          const glow = s.threshold === 8 ? Math.max(lit, 0.55) : lit;
          s.lanterns.emissiveIntensity = glow * 0.95;
          if (s.glow) {
            s.glow.visible = glow > 0.02;
            (s.glow.material as THREE.PointsMaterial).opacity = glow * 0.75;
          }
        }
      }
      first = false;
    },
    dispose() {
      for (const s of stages) for (const mesh of new Set(s.pieces.map(p => p.mesh))) mesh.dispose();
      geometries.forEach(g => g.dispose());
      materials.forEach(m => m.dispose());
    }
  };
}
