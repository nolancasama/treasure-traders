import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ITEM_IDS, type ItemId } from "../../game/content/ids";
import type { WorldRuntime, Position } from "../../game/world/types";
import { buildItem, ITEM_DISPLAY } from "../models/items";

interface Visual { group: THREE.Group; items: THREE.Mesh[]; particles: THREE.InstancedMesh; duration: number }
const COLORS = ["#ffd65c", "#fff7c4", "#ed7390", "#78cec2", "#a997df"];
const vec = (p: Position) => new THREE.Vector3(p.x, p.y, p.z);

/** One instanced particle batch per active effect; item meshes reuse the art kit cache. */
export function WorldEffects({ runtime }: { runtime: WorldRuntime }) {
  const effects = useMemo(() => {
    const group = new THREE.Group();
    const geometry = new THREE.OctahedronGeometry(0.065, 0);
    const material = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
    return { group, geometry, material, active: new Map<number, Visual>() };
  }, []);
  useEffect(() => () => {
    for (const visual of effects.active.values()) visual.particles.dispose();
    effects.geometry.dispose();
    effects.material.dispose();
  }, [effects]);

  useFrame(({ camera, size }) => {
    const expired = new Set<number>();
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    for (const effect of runtime.effects) {
      let visual = effects.active.get(effect.id);
      if (!visual) {
        const group = new THREE.Group();
        const ids: ItemId[] = "item" in effect ? [effect.item] : effect.kind === "wind" ? [...ITEM_IDS] : [];
        const items = ids.map(id => {
          const mesh = buildItem(id);
          mesh.scale.setScalar(ITEM_DISPLAY[id].world);
          group.add(mesh);
          return mesh;
        });
        const count = effect.kind === "fireworks" ? 168 : effect.kind === "wind" ? 48 : 24;
        const particles = new THREE.InstancedMesh(effects.geometry, effects.material, count);
        particles.frustumCulled = false;
        for (let i = 0; i < count; i++) particles.setColorAt(i, new THREE.Color(COLORS[i % COLORS.length]));
        group.add(particles);
        effects.group.add(group);
        const duration = effect.kind === "fireworks" ? 4.5 : effect.kind === "wind" ? 3.5 : effect.kind === "pickup" ? 1.15 : effect.kind === "deposit" ? 1.5 : 1.2;
        visual = { group, items, particles, duration };
        effects.active.set(effect.id, visual);
      }
      const age = Math.max(0, runtime.time - effect.started);
      const t = Math.min(1, age / visual.duration);
      if (t >= 1) {
        expired.add(effect.id);
        continue;
      }
      const origin = "from" in effect ? vec(effect.from) : vec(effect.at);
      const destination = "to" in effect ? vec(effect.to) : origin.clone();
      visual.items.forEach((mesh, i) => {
        const start = origin.clone();
        let end = destination;
        let phase = t;
        if (effect.kind === "pickup") {
          const target = new THREE.Vector3(effect.screen.x / size.width * 2 - 1, 1 - effect.screen.y / size.height * 2, 0.5).unproject(camera);
          end = target.sub(camera.position).normalize().multiplyScalar(6).add(camera.position);
          phase = THREE.MathUtils.smoothstep(t, 0.22, 1);
          start.y += Math.sin(Math.min(t / 0.22, 1) * Math.PI / 2) * 1.3;
          mesh.scale.setScalar(ITEM_DISPLAY[effect.item].world * (1 - phase * 0.6));
        } else if (effect.kind === "wind") {
          phase = THREE.MathUtils.smoothstep(t, i * 0.025, 0.78 + i * 0.025);
          end = vec(effect.targets[i % Math.max(1, effect.targets.length)] ?? effect.from);
        }
        mesh.position.lerpVectors(start, end, phase);
        mesh.position.y += Math.sin(phase * Math.PI) * (effect.kind === "wind" ? 7 + i * 0.3 : 1.4);
        if (effect.kind === "wind") {
          mesh.position.x += Math.sin(phase * Math.PI * 4 + i) * Math.sin(phase * Math.PI) * 2;
          mesh.position.z += Math.cos(phase * Math.PI * 4 + i) * Math.sin(phase * Math.PI) * 2;
        }
        mesh.rotation.set(t * Math.PI * 2, t * Math.PI * 4 + i, t * Math.PI);
      });
      for (let i = 0; i < visual.particles.count; i++) {
        const p = origin.clone();
        const angle = i * 2.399963;
        let k = 1;
        if (effect.kind === "fireworks") {
          const burst = Math.floor(i / 28);
          const phase = ((age + burst * 0.41) % 2.2) / 2.2;
          const direction = new THREE.Vector3(Math.sin(angle) * Math.cos(i * 1.7), Math.sin(i * 1.7), Math.cos(angle) * Math.cos(i * 1.7));
          p.x += Math.sin(burst * 2) * 4;
          p.z += Math.cos(burst * 2) * 4;
          p.y += 5 + burst * 0.7;
          p.addScaledVector(direction, phase * 4.5);
          p.y -= phase * phase * 2;
          k = Math.sin(phase * Math.PI) * (1 - t * 0.5);
        } else if (effect.kind === "wind") {
          const phase = (t + i / visual.particles.count) % 1;
          const end = vec(effect.targets[i % Math.max(1, effect.targets.length)] ?? effect.from);
          p.lerp(end, phase);
          p.x += Math.sin(phase * 15 + angle) * 1.2;
          p.z += Math.cos(phase * 15 + angle) * 1.2;
          p.y += Math.sin(phase * Math.PI) * 6;
          k = Math.sin(phase * Math.PI) * (1 - t);
        } else if ("item" in effect) {
          const mesh = visual.items[0];
          p.copy(mesh.position);
          p.x += Math.sin(angle + t * 5) * 0.35;
          p.y += Math.cos(angle) * 0.35;
          p.z += Math.sin(angle) * 0.35;
          if (effect.kind === "deposit" && t > 0.65) {
            p.copy(destination);
            p.x += Math.cos(angle) * 0.36 * (1 + t);
            p.y += Math.sin(angle) * 0.36 * (1 + t);
          }
          k = Math.sin(t * Math.PI);
        } else {
          const distance = t * (effect.kind === "decoration" ? 2.5 : 1.3);
          p.x += Math.sin(angle) * distance;
          p.z += Math.cos(angle) * distance;
          p.y += 0.3 + Math.sin(t * Math.PI) * (0.8 + (i % 4) * 0.22);
          k = Math.sin(t * Math.PI) * (effect.kind === "lock" ? 1.6 : 1);
        }
        scale.setScalar(Math.max(0.001, k));
        rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, angle + age * 3);
        matrix.compose(p, rotation, scale);
        visual.particles.setMatrixAt(i, matrix);
      }
      visual.particles.instanceMatrix.needsUpdate = true;
    }
    const live = new Set(runtime.effects.map(effect => effect.id));
    for (const [id, visual] of effects.active) {
      if (!live.has(id) || expired.has(id)) {
        effects.group.remove(visual.group);
        visual.particles.dispose();
        effects.active.delete(id);
      }
    }
    if (expired.size) runtime.effects = runtime.effects.filter(effect => !expired.has(effect.id));
  });
  return <primitive object={effects.group} dispose={null} />;
}
