import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { DistrictId } from "../../game/content/ids";
import type { WorldRuntime } from "../../game/world/types";
import { glowTexture, sceneUniforms } from "../materials";
import { PartBuilder } from "../partBuilder";
import { birdGeometry, fishGeometry, flyerGeometry, PALETTE } from "./builders";

/**
 * Small repeating life (SPEC §9): birds, fish, ripples, fountain water and the
 * anonymous townsfolk. Everything lives in shared instanced batches and steers
 * clear of interactive people, the camera and the player.
 */
const transform = new THREE.Object3D();
function place(mesh: THREE.InstancedMesh, i: number, x: number, y: number, z: number, yaw = 0, scale = 1, pitch = 0) {
  transform.position.set(x, y, z);
  transform.rotation.set(pitch, yaw, 0);
  transform.scale.setScalar(scale);
  transform.updateMatrix();
  mesh.setMatrixAt(i, transform.matrix);
}

/* ------------------------------------------------------------------- birds */

interface Bird { x: number; z: number; yaw: number; fly: { t: number; x0: number; z0: number; x1: number; z1: number; length: number } | null; rest: number; hop: number; hopX: number; hopZ: number; cx: number; cz: number }
const BIRD_HOMES = [[-4.5, 5.2], [4.6, 4.8], [-6.2, -3.6], [5.8, -3.2], [-2.4, 12], [3.2, 12.4], [37.5, 6.2], [39, -7.8]] as const;
const FLIGHT_LENGTH = 1.7;

/* ------------------------------------------------------------------- folk */

interface FolkPart { build: (b: PartBuilder) => void; swing: number; pivot: number; tint: boolean }
function folkGeometry(kid: boolean): THREE.BufferGeometry {
  const k = kid ? 0.74 : 1, hip = 0.62 * k, shoulder = 1.12 * k;
  const skin = "#f0c9a2", shirt = "#ffffff", leg = kid ? "#5a7fa8" : "#566a78", hair = kid ? "#5a3a26" : "#6e5140";
  const parts: FolkPart[] = [
    { swing: 1, pivot: hip, tint: false, build: b => { b.box(0.15 * k, hip, 0.17 * k, -0.1 * k, 0, 0, leg); b.box(0.17 * k, 0.09, 0.26 * k, -0.1 * k, 0, 0.04, "#403830"); } },
    { swing: -1, pivot: hip, tint: false, build: b => { b.box(0.15 * k, hip, 0.17 * k, 0.1 * k, 0, 0, leg); b.box(0.17 * k, 0.09, 0.26 * k, 0.1 * k, 0, 0.04, "#403830"); } },
    { swing: 0, pivot: 0, tint: true, build: b => { b.cyl(0.19 * k, 0.24 * k, shoulder - hip, 0, hip, 0, shirt, 7); } },
    { swing: -0.8, pivot: shoulder, tint: true, build: b => { b.box(0.1 * k, 0.46 * k, 0.11 * k, -0.26 * k, shoulder - 0.46 * k, 0, shirt); } },
    { swing: 0.8, pivot: shoulder, tint: true, build: b => { b.box(0.1 * k, 0.46 * k, 0.11 * k, 0.26 * k, shoulder - 0.46 * k, 0, shirt); } },
    { swing: -0.8, pivot: shoulder, tint: false, build: b => { b.sphere(0.065 * k, -0.26 * k, shoulder - 0.5 * k, 0, skin, [1, 1, 1], 5); } },
    { swing: 0.8, pivot: shoulder, tint: false, build: b => { b.sphere(0.065 * k, 0.26 * k, shoulder - 0.5 * k, 0, skin, [1, 1, 1], 5); } },
    { swing: 0, pivot: 0, tint: false, build: b => {
      b.sphere(0.22 * k, 0, shoulder + 0.22 * k, 0, skin, [1, 1.05, 1], 8);
      b.sphere(0.235 * k, 0, shoulder + 0.3 * k, -0.04, hair, [1, 0.72, 1], 7);
      for (const x of [-0.08, 0.08]) b.sphere(0.024 * k, x * k, shoulder + 0.2 * k, 0.2 * k, "#2b2d42", [1, 1.2, 0.5], 4);
    } }
  ];
  const pieces = parts.map(part => {
    const b = new PartBuilder(0);
    part.build(b);
    const g = b.build(), n = g.attributes.position.count, attr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { attr[i * 3] = part.swing; attr[i * 3 + 1] = part.pivot; attr[i * 3 + 2] = part.tint ? 1 : 0; }
    g.setAttribute("aPart", new THREE.BufferAttribute(attr, 3));
    return g;
  });
  const merged = mergeGeometries(pieces, false);
  pieces.forEach(g => g.dispose());
  return merged;
}

/** Limbs shear from hip and shoulder; instance colour only tints clothes, not faces. */
function folkMaterial(): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  m.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec3 aPart;\nattribute vec2 aWalk;")
      .replace("#include <color_vertex>", "vColor = color * mix(vec3(1.0), instanceColor, aPart.z);")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        transformed.z += (aPart.y - position.y) * sin(aWalk.x) * aWalk.y * aPart.x;`);
  };
  m.customProgramCacheKey = () => "tt:folk";
  return m;
}

/** Walks a loop of stops, pausing at each one to look at what is there. */
interface FolkRoute { kid: boolean; shirt: string; district: DistrictId; stops: readonly (readonly [number, number, number])[]; pause: number; speed: number; swing?: boolean; hops?: boolean }
const YAW_N = Math.PI, YAW_S = 0;
const ROUTES: FolkRoute[] = [
  { kid: false, shirt: "#d8e8b0", district: "square", stops: [[-7, 9, YAW_N], [-3, 12, YAW_S], [-9, 13, YAW_N]], pause: 4, speed: 1.2 },
  { kid: false, shirt: "#f0c6c0", district: "square", stops: [[7, -12, YAW_N], [10, -9, 1.4], [5, -14, YAW_N]], pause: 5, speed: 1 },
  // Browsers stop in front of a stall and look at it, on the open street.
  { kid: false, shirt: "#b9d9e6", district: "market", stops: [[33.5, -3.4, YAW_N], [41, -3.2, YAW_N], [48.5, -3.4, YAW_N], [41, 3.2, YAW_S], [33.5, 3.4, YAW_S]], pause: 4.5, speed: 1.25 },
  { kid: false, shirt: "#f3d58e", district: "market", stops: [[48.5, 3.4, YAW_S], [41.5, 2.8, YAW_S], [26.5, 3.2, YAW_S], [26.5, -3.2, YAW_N], [41.5, -2.8, YAW_N]], pause: 5.5, speed: 1.1 },
  { kid: true, shirt: "#ffb3c1", district: "school", stops: [[19.6, -37, 1.57]], pause: 1, speed: 0, swing: true },
  { kid: true, shirt: "#a8dcae", district: "school", stops: [[-8, -36, YAW_N], [-8, -42.5, YAW_N]], pause: 1.5, speed: 1.05, hops: true },
  { kid: false, shirt: "#c9c1ee", district: "harbor", stops: [[14, 31, 0.4], [8, 30.5, YAW_N], [-4, 30.8, 0.3]], pause: 4, speed: 1.1 },
  { kid: false, shirt: "#ffc99a", district: "festival", stops: [[-41, 5, 1.2], [-37, 8, 0], [-42, 9.5, YAW_S]], pause: 4, speed: 1.05 }
];

export interface Ambient {
  update(runtime: WorldRuntime, camera: THREE.Camera, dt: number, near: (district: DistrictId) => boolean): void;
  dispose(): void;
}

export function createAmbient(root: THREE.Group, districts: Record<DistrictId, THREE.Group>): Ambient {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  const flat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  materials.add(flat);
  const instanced = (geometry: THREE.BufferGeometry, count: number, parent: THREE.Object3D, material: THREE.Material = flat) => {
    geometries.add(geometry);
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.raycast = () => {};
    parent.add(mesh);
    return mesh;
  };

  const pigeons = instanced(birdGeometry(), BIRD_HOMES.length, root);
  const birds: Bird[] = BIRD_HOMES.map(([cx, cz], i) => ({ x: cx, z: cz, yaw: i * 1.3, fly: null, rest: 1 + i * 0.7, hop: 1, hopX: cx, hopZ: cz, cx, cz }));

  // Gulls and flying pigeons share one flapping batch.
  const flyerMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  flyerMaterial.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, sceneUniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float ttTime;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        transformed.y += uv.x * sin(ttTime * 11.0 + instanceMatrix[3].x * 2.0) * 1.05;`);
  };
  flyerMaterial.customProgramCacheKey = () => "tt:flyer";
  materials.add(flyerMaterial);
  const gullCount = 4;
  const flyers = instanced(flyerGeometry(), gullCount + BIRD_HOMES.length, root, flyerMaterial);
  const color = new THREE.Color();
  for (let i = 0; i < gullCount + BIRD_HOMES.length; i++) flyers.setColorAt(i, color.set(i < gullCount ? "#ffffff" : "#aab2c6"));

  const fish = instanced(fishGeometry(), 3, districts.harbor);
  fish.name = "harbor-fish";

  const dropBuilder = new PartBuilder(0);
  dropBuilder.add(new THREE.OctahedronGeometry(0.07), "#c8f1f3", [0, 0, 0], [0, 0, 0], [1, 1.6, 1], { flatAo: true });
  const drops = instanced(dropBuilder.build(), 28, districts.square);

  // Expanding rings on the water: the fountain's two bowls, the boats and the fish.
  const ringTexture = (() => {
    if (typeof document === "undefined") return glowTexture();
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    g.strokeStyle = "#ffffff"; g.lineWidth = 5;
    g.beginPath(); g.arc(32, 32, 28, 0, Math.PI * 2); g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const ringMaterial = new THREE.MeshBasicMaterial({ map: ringTexture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  materials.add(ringMaterial);
  const ringGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const ripples = instanced(ringGeometry, 8, root, ringMaterial);
  ripples.renderOrder = 2;
  // [x, y, z, size, period]; the last two follow the fish that are jumping.
  const RINGS: [number, number, number, number, number][] = [[0, 0.73, 0, 3.6, 2.6], [0, 0.73, 0, 3.6, 3.7], [0, 2.31, 0, 1.6, 1.9], [4.4, -0.26, 37, 2.2, 4.2], [11.8, -0.26, 44, 2.2, 3.6], [4.4, -0.26, 47, 2.2, 5]];
  const splash: { x: number; z: number; t: number }[] = [{ x: 0, z: 0, t: 9 }, { x: 0, z: 0, t: 9 }];

  const folkTints = (kid: boolean) => ROUTES.map((route, index) => ({ route, index })).filter(({ route }) => route.kid === kid);
  const makeFolk = (kid: boolean) => {
    const entries = folkTints(kid), geometry = folkGeometry(kid);
    const walk = new THREE.InstancedBufferAttribute(new Float32Array(entries.length * 2), 2);
    walk.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("aWalk", walk);
    const mesh = instanced(geometry, entries.length, root, folkMaterial());
    materials.add(mesh.material as THREE.Material);
    entries.forEach(({ route }, i) => mesh.setColorAt(i, color.set(route.shirt)));
    return { mesh, entries, walk, state: entries.map(({ route }) => ({ x: route.stops[0][0], z: route.stops[0][1], yaw: route.stops[0][2], stop: 0, wait: 1 + route.pause * Math.random(), phase: Math.random() * 6, amp: 0, shown: 1 })) };
  };
  const folk = [makeFolk(false), makeFolk(true)];

  return {
    update(rt, camera, dt, near) {
      const t = rt.time, player = rt.player, conversing = rt.camera.mode === "conversation";

      // Pigeons hop about and peck, and take off when somebody walks up to them.
      birds.forEach((b, i) => {
        const flyerIndex = gullCount + i;
        if (b.fly) {
          b.fly.t += dt;
          const u = Math.min(1, b.fly.t / b.fly.length), e = u * u * (3 - 2 * u);
          b.x = b.fly.x0 + (b.fly.x1 - b.fly.x0) * e;
          b.z = b.fly.z0 + (b.fly.z1 - b.fly.z0) * e;
          place(flyers, flyerIndex, b.x, 0.3 + Math.sin(u * Math.PI) * 3, b.z, b.yaw, 0.9);
          place(pigeons, i, 0, -5, 0, 0, 0.0001);
          if (u >= 1) { b.fly = null; b.rest = 1.5 + Math.random() * 2; b.hop = 1; }
          return;
        }
        place(flyers, flyerIndex, 0, -5, 0, 0, 0.0001);
        const startled = Math.hypot(player.x - b.x, player.z - b.z) < 1.7 && player.speed > 0.5;
        if (startled || (b.rest <= 0 && b.hop >= 1 && Math.random() < dt * 0.05)) {
          // Land near a different home, a short flight away.
          const home = BIRD_HOMES[(i + 1 + Math.floor(Math.random() * 3)) % BIRD_HOMES.length];
          const away = startled ? BIRD_HOMES[(i + 2) % 6] : home;
          b.fly = { t: 0, x0: b.x, z0: b.z, x1: away[0] + (Math.random() - 0.5) * 2, z1: away[1] + (Math.random() - 0.5) * 2, length: FLIGHT_LENGTH };
          b.cx = away[0]; b.cz = away[1];
          b.yaw = Math.atan2(b.fly.x1 - b.x, b.fly.z1 - b.z);
          return;
        }
        let y = 0, pitch = 0;
        if (b.hop < 1) {
          b.hop = Math.min(1, b.hop + dt * 3.2);
          b.x += (b.hopX - b.x) * Math.min(1, dt * 7);
          b.z += (b.hopZ - b.z) * Math.min(1, dt * 7);
          y = Math.sin(b.hop * Math.PI) * 0.1;
        } else {
          b.rest -= dt;
          // Pecking while it stands still.
          pitch = Math.max(0, Math.sin(t * 5 + i * 2)) * 0.5 * (Math.sin(t * 0.7 + i) > 0.1 ? 1 : 0);
          if (b.rest <= 0) {
            b.rest = 0.6 + Math.random() * 2.2; b.hop = 0;
            const a = Math.random() * Math.PI * 2, r = Math.random() * 1.6;
            b.hopX = b.cx + Math.cos(a) * r; b.hopZ = b.cz + Math.sin(a) * r;
            b.yaw = Math.atan2(b.hopX - b.x, b.hopZ - b.z);
          }
        }
        place(pigeons, i, b.x, y, b.z, b.yaw, 1.2, pitch);
      });
      pigeons.instanceMatrix.needsUpdate = true;

      // Gulls wheel over the harbor; one crosses the square now and then.
      for (let i = 0; i < gullCount; i++) {
        const a = t * (0.2 + i * 0.03) + i * 2.1, wide = i === 3 ? 20 : 14;
        const cx = i === 3 ? 4 : 7, cz = i === 3 ? 24 : 40;
        place(flyers, i, cx + Math.sin(a) * wide, 6 + i * 0.5 + Math.sin(a * 2 + i), cz + Math.cos(a) * (wide * 0.65), a + Math.PI / 2, 1.5);
      }
      flyers.instanceMatrix.needsUpdate = true;

      // Fish break the surface in turn, away from the pier and the boats.
      const FISH_SPOTS = [[-3, 41], [15, 44], [-11, 39]];
      if (near("harbor")) {
        for (let i = 0; i < 3; i++) {
          const phase = ((t + i * 2.9) % 9) / 9, jump = phase < 0.1 ? phase / 0.1 : -1;
          const [x, z] = FISH_SPOTS[i];
          const y = jump >= 0 ? Math.sin(jump * Math.PI) * 1.05 - 0.35 : -1.2;
          transform.position.set(x + jump * 1.2, y, z);
          transform.rotation.set(0, 0, 0.9 - jump * 1.8);
          transform.scale.setScalar(1);
          transform.updateMatrix();
          fish.setMatrixAt(i, transform.matrix);
          if (jump >= 0 && jump < 0.1 && splash[i % 2].t > 1) splash[i % 2] = { x, z, t: 0 };
          if (jump > 0.85 && splash[(i + 1) % 2].t > 1) splash[(i + 1) % 2] = { x: x + 1.2, z, t: 0 };
        }
        fish.instanceMatrix.needsUpdate = true;
      }
      fish.visible = near("harbor");

      if (near("square")) {
        for (let i = 0; i < drops.count; i++) {
          const phase = (t * 0.75 + i / drops.count) % 1, a = i * 2.4, upper = i % 3 === 0;
          const reach = upper ? 0.95 : 1.65;
          place(drops, i, Math.cos(a) * phase * reach, (upper ? 2.76 : 2.5) + phase * (upper ? 0.9 : 1.5) - phase * phase * (upper ? 1.35 : 3.3), Math.sin(a) * phase * reach, 0, 0.8);
        }
        drops.instanceMatrix.needsUpdate = true;
      }
      drops.visible = near("square");

      for (let i = 0; i < ripples.count; i++) {
        const fixed = RINGS[i];
        let x: number, y: number, z: number, size: number, k: number;
        if (fixed) {
          const phase = (t / fixed[4] + i * 0.37) % 1;
          [x, y, z] = fixed; size = fixed[3] * (0.28 + phase * 0.72); k = (1 - phase) * 0.32;
        } else {
          const s = splash[i - RINGS.length];
          s.t += dt / 1.3;
          x = s.x; y = -0.26; z = s.z; size = 0.4 + Math.min(1, s.t) * 3.4; k = Math.max(0, 1 - s.t) * 0.8;
        }
        place(ripples, i, x, y, z, 0, Math.max(0.001, k > 0 ? size : 0.001));
        ripples.setColorAt(i, color.setRGB(k, k, k));
      }
      ripples.instanceMatrix.needsUpdate = true;
      if (ripples.instanceColor) ripples.instanceColor.needsUpdate = true;

      for (const group of folk) {
        group.entries.forEach(({ route }, i) => {
          const s = group.state[i];
          const areaOpen = near(route.district);
          // Folk make way: nobody wanders through a conversation or the finale's cast.
          const partyTime = rt.party && route.district === "festival";
          const target = rt.camera.mode === "conversation" ? rt.camera.target : null;
          const crowding = conversing && (Math.hypot(player.x - s.x, player.z - s.z) < 3 || (target && Math.hypot(target.x - s.x, target.z - s.z) < 3));
          const tooClose = Math.hypot(camera.position.x - s.x, camera.position.z - s.z) < 5;
          s.shown += ((areaOpen && !crowding && !tooClose && !partyTime ? 1 : 0) - s.shown) * Math.min(1, dt * 6);
          const distance = Math.hypot(player.x - s.x, player.z - s.z);
          const greet = distance < 2.2;
          let amp = 0;
          if (route.swing) {
            // Sits on the swing's seat and pumps their legs; the seat itself stays in the scenery mesh.
            s.x = route.stops[0][0];
            s.phase += dt * 3.2;
            place(group.mesh, i, s.x + Math.sin(s.phase) * 0.07, 0.14, route.stops[0][1], route.stops[0][2], s.shown < 0.01 ? 0.0001 : s.shown, Math.sin(s.phase) * 0.1);
            group.walk.setXY(i, s.phase, 0.42);
            return;
          }
          if (s.wait > 0 || greet) {
            s.wait -= dt;
            if (greet) s.yaw += Math.atan2(Math.sin(Math.atan2(player.x - s.x, player.z - s.z) - s.yaw), Math.cos(Math.atan2(player.x - s.x, player.z - s.z) - s.yaw)) * Math.min(1, dt * 4);
          } else {
            const next = route.stops[s.stop], dx = next[0] - s.x, dz = next[1] - s.z, d = Math.hypot(dx, dz);
            if (d < 0.1) {
              s.wait = route.pause * (0.7 + Math.random() * 0.6);
              s.stop = (s.stop + 1) % route.stops.length;
              s.yaw = next[2];
            } else {
              s.x += dx / d * route.speed * dt; s.z += dz / d * route.speed * dt;
              s.yaw = Math.atan2(dx, dz);
              s.phase += dt * route.speed * 6.5;
              amp = 0.55;
            }
          }
          s.amp += (amp - s.amp) * Math.min(1, dt * 8);
          group.walk.setXY(i, s.phase, s.amp);
          const hop = route.hops ? Math.abs(Math.sin(s.phase * 0.5)) * 0.22 * (s.amp > 0.1 ? 1 : 0) : Math.abs(Math.sin(s.phase)) * 0.03 * (s.amp > 0.1 ? 1 : 0);
          place(group.mesh, i, s.x, hop, s.z, s.yaw, s.shown < 0.01 ? 0.0001 : s.shown);
        });
        group.mesh.instanceMatrix.needsUpdate = true;
        group.walk.needsUpdate = true;
      }
    },
    dispose() {
      for (const mesh of [pigeons, flyers, fish, drops, ripples, ...folk.map(f => f.mesh)]) mesh.dispose();
      geometries.forEach(g => g.dispose());
      materials.forEach(m => m.dispose());
      ringGeometry.dispose();
      ringTexture.dispose();
    }
  };
}

export { PALETTE };
