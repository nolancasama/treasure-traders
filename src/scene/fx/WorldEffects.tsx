import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ITEM_IDS, type ItemId } from "../../game/content/ids";
import type { WorldRuntime, Position } from "../../game/world/types";
import { starTexture } from "../materials";
import { buildItem, ITEM_DISPLAY, THICKEN } from "../models/items";
import { createSalvo, SALVO_SECONDS } from "./fireworks";

interface Visual { group: THREE.Group; items: THREE.Mesh[]; duration: number; salvo: THREE.Points | null }
const COLORS = ["#ffd65c", "#fff7c4", "#ff7a94", "#58d6c6", "#b49cff", "#ffa94d"].map(c => new THREE.Color(c));
const GOLDS = ["#ffd65c", "#fff3b0", "#ffbe3d"].map(c => new THREE.Color(c));
const WIND_WHITE = new THREE.Color("#ffffff");
const POOL = 420;
const vec = (out: THREE.Vector3, p: Position) => out.set(p.x, p.y, p.z);
const DURATIONS: Record<string, number> = { fireworks: SALVO_SECONDS, wind: 4.8, pickup: 1.15, deposit: 1.5, trade: 0.82, give: 0.82 };

/**
 * All sparkles share one camera-facing instanced batch (one draw call however
 * many effects run); fireworks are their own GPU-animated points; item meshes
 * reuse the art kit cache.
 */
export function WorldEffects({ runtime }: { runtime: WorldRuntime }) {
  const { gl } = useThree();
  const effects = useMemo(() => {
    const group = new THREE.Group();
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({ map: starTexture(), transparent: true, depthWrite: false, fog: false });
    const particles = new THREE.InstancedMesh(geometry, material, POOL);
    particles.frustumCulled = false;
    particles.renderOrder = 5;
    particles.raycast = () => {};
    particles.count = 0;
    // instanceColor must exist before the first draw for the shader to use it.
    particles.setColorAt(0, COLORS[0]);
    group.add(particles);
    return { group, geometry, material, particles, active: new Map<number, Visual>(), buffer: new THREE.Vector2(), scratch: { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), p: new THREE.Vector3(), scale: new THREE.Vector3(), matrix: new THREE.Matrix4(), spin: new THREE.Quaternion(), turn: new THREE.Quaternion(), axis: new THREE.Vector3(0, 0, 1) } };
  }, []);
  useEffect(() => () => {
    for (const visual of effects.active.values()) if (visual.salvo) { visual.salvo.geometry.dispose(); (visual.salvo.material as THREE.Material).dispose(); }
    effects.particles.dispose();
    effects.geometry.dispose();
    effects.material.dispose();
  }, [effects]);

  useFrame(({ camera, size }) => {
    const expired = new Set<number>();
    const { a, b, c, p, scale, matrix, spin, turn, axis } = effects.scratch;
    let used = 0;
    const star = (x: number, y: number, z: number, s: number, color: THREE.Color, roll = 0) => {
      if (used >= POOL || s <= 0.002) return;
      p.set(x, y, z);
      scale.setScalar(s);
      turn.setFromAxisAngle(axis, roll);
      spin.copy(camera.quaternion).multiply(turn);
      matrix.compose(p, spin, scale);
      effects.particles.setMatrixAt(used, matrix);
      effects.particles.setColorAt(used, color);
      used++;
    };
    for (const effect of runtime.effects) {
      let visual = effects.active.get(effect.id);
      if (!visual) {
        const group = new THREE.Group();
        const ids: ItemId[] = "item" in effect ? [effect.item] : effect.kind === "wind" ? [...ITEM_IDS] : [];
        const items = ids.map(id => {
          const mesh = buildItem(id);
          const k = ITEM_DISPLAY[id].world, thick = THICKEN[id] ?? 1;
          mesh.scale.set(k, k * thick, k * thick);
          group.add(mesh);
          return mesh;
        });
        let salvo: THREE.Points | null = null;
        if (effect.kind === "fireworks") {
          salvo = createSalvo(effect.at, (effect.index ?? 0) * 7 + effect.id);
          group.add(salvo);
        }
        effects.group.add(group);
        visual = { group, items, salvo, duration: DURATIONS[effect.kind] ?? 1.2 };
        effects.active.set(effect.id, visual);
      }
      const age = Math.max(0, runtime.time - effect.started);
      const t = Math.min(1, age / visual.duration);
      if (t >= 1) {
        expired.add(effect.id);
        continue;
      }
      if (visual.salvo) {
        const uniforms = (visual.salvo.material as THREE.ShaderMaterial).uniforms;
        uniforms.age.value = age;
        uniforms.pixelScale.value = gl.getDrawingBufferSize(effects.buffer).y / 2 / Math.tan(THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov / 2));
        continue;
      }
      const origin = "from" in effect ? vec(a, effect.from) : vec(a, effect.at);
      const destination = "to" in effect ? vec(b, effect.to) : b.copy(origin);
      visual.items.forEach((mesh, i) => {
        let phase = t, sx = origin.x, sy = origin.y, sz = origin.z, ex = destination.x, ey = destination.y, ez = destination.z;
        if (effect.kind === "pickup") {
          // Pop up and spin first, then fly into the backpack's slot on screen.
          c.set(effect.screen.x / size.width * 2 - 1, 1 - effect.screen.y / size.height * 2, 0.5).unproject(camera);
          c.sub(camera.position).normalize().multiplyScalar(6).add(camera.position);
          ex = c.x; ey = c.y; ez = c.z;
          phase = THREE.MathUtils.smoothstep(t, 0.3, 1);
          sy += Math.sin(Math.min(t / 0.3, 1) * Math.PI / 2) * 1.2;
          const k = ITEM_DISPLAY[effect.item].world * (1 + Math.sin(Math.min(t / 0.3, 1) * Math.PI) * 0.45) * (1 - phase * 0.62), thick = THICKEN[effect.item] ?? 1;
          mesh.scale.set(k, k * thick, k * thick);
          // A trail of stars as it goes, then a burst where it lands.
          if (t > 0.3) star(mesh.position.x, mesh.position.y, mesh.position.z, 0.34 * (1 - t), GOLDS[i % 3], age * 4);
        } else if (effect.kind === "wind") {
          // Each item spirals up out of the cart and hangs in the sky, then streaks off toward its district.
          const id = ITEM_IDS[i], tumble = i / visual!.items.length * Math.PI * 2;
          const k = ITEM_DISPLAY[id].world * 2.8, thick = THICKEN[id] ?? 1;
          mesh.scale.set(k, k * thick, k * thick);
          const rise = THREE.MathUtils.smoothstep(t, 0, 0.32), away = THREE.MathUtils.smoothstep(t, 0.54 + i * 0.015, 0.98);
          const orbit = age * (2.1 + i * 0.05) + tumble, radius = 1.2 + rise * 7.2;
          const target = effect.targets[i % Math.max(1, effect.targets.length)] ?? effect.from;
          const hx = -1 + Math.cos(orbit) * radius, hy = 2 + rise * (6.6 + (i % 3) * 1.5) + Math.sin(orbit * 0.7) * 0.8, hz = -1 + Math.sin(orbit) * radius * 0.62;
          sx = origin.x + (hx + origin.x * -0.55) * rise; sy = origin.y + hy - 1.6; sz = origin.z + hz * rise;
          ex = target.x; ey = 16; ez = target.z;
          phase = away;
          // Bright streaks that make the flight legible even from far away.
          star(mesh.position.x, mesh.position.y, mesh.position.z, 1.7 * (1 - away * 0.6), WIND_WHITE, orbit);
        }
        mesh.position.set(sx + (ex - sx) * phase, sy + (ey - sy) * phase, sz + (ez - sz) * phase);
        if (effect.kind !== "wind" && effect.kind !== "pickup") mesh.position.y += Math.sin(phase * Math.PI) * 1.15;
        mesh.rotation.set(t * Math.PI * 2, t * Math.PI * 4 + i, t * Math.PI);
      });
      const count = effect.kind === "wind" ? 60 : effect.kind === "decoration" ? 54 : effect.kind === "deposit" ? 30 : effect.kind === "lock" ? 26 : effect.kind === "sparkles" ? 28 : 18;
      for (let i = 0; i < count; i++) {
        const angle = i * 2.399963;
        const color = COLORS[i % COLORS.length];
        if (effect.kind === "wind") {
          // Leaves of the gust: streaming sparkles that swirl up with the items and follow them out.
          const phase = (t * 1.5 + i / count) % 1, r = 1 + phase * 11;
          const up = Math.sin(phase * Math.PI);
          star(origin.x - phase * 12 + Math.cos(angle + age * 3) * r * 0.7, origin.y + phase * 11 + Math.sin(angle) * 1.4, origin.z + Math.sin(angle + age * 3) * r * 0.5, 0.42 * up * (1 - t * 0.5), i % 2 ? WIND_WHITE : color, age * 2 + i);
        } else if ("item" in effect) {
          const mesh = visual.items[0];
          const landed = effect.kind === "deposit" ? t > 0.42 : false;
          if (landed) {
            // The slot's flash: gold sparks thrown outward from where the item landed.
            const u = (t - 0.42) / 0.58;
            star(destination.x + Math.cos(angle) * (0.2 + u * 1.5), destination.y + Math.sin(angle) * (0.2 + u * 1.5), destination.z + 0.12, 0.3 * (1 - u), GOLDS[i % 3], age * 4 + i);
          } else {
            // Trail: small stars close behind the item in flight.
            star(mesh.position.x + Math.sin(angle + t * 5) * 0.28, mesh.position.y + Math.cos(angle) * 0.28, mesh.position.z + Math.sin(angle) * 0.28, 0.2 * Math.sin(t * Math.PI), color, age * 3 + i);
          }
        } else if (effect.kind === "decoration") {
          // Milestone confetti: thrown up and out, then fluttering down under gravity.
          const u = t, speed = 2.4 + (i % 5) * 0.55, dist = (1 - Math.exp(-u * 3)) * speed;
          star(origin.x + Math.sin(angle) * dist, origin.y + 0.6 + (1 - Math.exp(-u * 4)) * (2 + (i % 4) * 0.4) - u * u * 2.6, origin.z + Math.cos(angle) * dist, 0.34 * (1 - u * u), color, age * 5 + i);
        } else {
          const distance = t * (effect.kind === "lock" ? 1.05 : 1.45);
          const k = Math.sin(t * Math.PI) * (effect.kind === "lock" ? 0.34 : 0.3);
          star(origin.x + Math.sin(angle) * distance, origin.y + 0.3 + Math.sin(t * Math.PI) * (0.8 + (i % 4) * 0.22), origin.z + Math.cos(angle) * distance, k, effect.kind === "lock" ? GOLDS[i % 3] : color, age * 4 + i);
        }
      }
    }
    effects.particles.count = used;
    effects.particles.visible = used > 0;
    if (used) {
      effects.particles.instanceMatrix.needsUpdate = true;
      if (effects.particles.instanceColor) effects.particles.instanceColor.needsUpdate = true;
    }
    const live = new Set(runtime.effects.map(effect => effect.id));
    for (const [id, visual] of effects.active) {
      if (!live.has(id) || expired.has(id)) {
        effects.group.remove(visual.group);
        if (visual.salvo) { visual.salvo.geometry.dispose(); (visual.salvo.material as THREE.Material).dispose(); }
        effects.active.delete(id);
      }
    }
    if (expired.size) runtime.effects = runtime.effects.filter(effect => !expired.has(effect.id));
  });
  return <primitive object={effects.group} dispose={null} />;
}
