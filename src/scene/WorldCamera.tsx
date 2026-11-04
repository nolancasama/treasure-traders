import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { WorldRuntime } from "../game/world/types";
import { WALK_AREAS } from "../game/world/layout";
import { FOLLOW_CAMERA } from "../game/world/followCamera";
import { conversationShot, type Shot } from "./cameraRig";
import { sceneUniforms } from "./materials";

const library = WALK_AREAS.find(a => a.id === "library")!;
const scratchA = new THREE.Vector3(), scratchB = new THREE.Vector3();

/** Depth-buffer value at a view distance, for the see-through test in scenery shaders. */
function bufferDepth(camera: THREE.PerspectiveCamera, viewDistance: number): number {
  const { near, far } = camera;
  return far / (far - near) * (1 - near / Math.max(near, viewDistance));
}

export function WorldCamera({ runtime: rt }: { runtime: WorldRuntime }) {
  const { camera, gl, size } = useThree();
  const scratch = useMemo(() => ({ position: new THREE.Vector3(), target: new THREE.Vector3(), look: new THREE.Vector3(), buffer: new THREE.Vector2() }), []);
  const ready = useRef(false), shift = useRef(0), shot = useRef<{ key: string; value: Shot } | null>(null);
  const strength = useRef([0, 0, 0]);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1), p = rt.player, c = rt.camera;
    const { position, target, look } = scratch;
    const { offset } = FOLLOW_CAMERA;
    position.set(p.x + offset.x, p.y + offset.y, p.z + offset.z);
    target.set(p.x, p.y + FOLLOW_CAMERA.targetHeight, p.z);
    if (c.mode === "conversation") {
      // Chosen once per pairing: re-picking while they talk would make the view jump.
      const key = `${c.target.x},${c.target.z},${p.x.toFixed(1)},${p.z.toFixed(1)}`;
      if (shot.current?.key !== key) {
        const others = Object.values(rt.state.npcs).filter(n => Math.hypot(n.x - c.target.x, n.z - c.target.z) > 0.2);
        shot.current = { key, value: conversationShot(p, c.target, others) };
      }
      const { position: at, target: to } = shot.current.value;
      position.set(at.x, at.y, at.z);
      target.set(to.x, to.y, to.z);
    } else if (c.mode === "path" && c.keys.length) {
      c.elapsed += dt;
      let remaining = c.elapsed, index = 0;
      while (index < c.keys.length - 1 && remaining > c.keys[index].duration) remaining -= Math.max(0.001, c.keys[index++].duration);
      const a = c.keys[index], b = c.keys[Math.min(index + 1, c.keys.length - 1)];
      const u = THREE.MathUtils.clamp(remaining / Math.max(0.001, a.duration), 0, 1), ease = u * u * (3 - 2 * u);
      position.set(a.position.x, a.position.y, a.position.z).lerp(scratchA.set(b.position.x, b.position.y, b.position.z), ease);
      target.set(a.target.x, a.target.y, a.target.z).lerp(scratchB.set(b.target.x, b.target.y, b.target.z), ease);
      if (index === c.keys.length - 1 && remaining >= a.duration) rt.camera = { mode: "follow" };
    }
    // Keep the view close to the floor inside the roofless library cutaway.
    if (c.mode === "follow" && Math.abs(p.x - library.x) < library.hx && Math.abs(p.z - library.z) < library.hz) {
      position.set(p.x, p.y + 6.2, p.z + 7);
      target.set(p.x, p.y + 0.5, p.z - 0.5);
    }
    const k = ready.current ? 1 - Math.exp(-dt * (c.mode === "follow" ? 6 : 3)) : 1;
    camera.position.lerp(position, k); look.lerp(target, k);
    camera.lookAt(look); ready.current = true;
    rt.cameraYaw = Math.atan2(camera.position.x - look.x, camera.position.z - look.z);
    // The compact backpack bar sits above the panel, so centre on what remains visible.
    const covered = rt.bottomPanel > 0 ? rt.bottomPanel + 56 : 0;
    shift.current += (Math.min(covered * 0.5, size.height * 0.3) - shift.current) * Math.min(1, dt * 5);
    const perspective = camera as THREE.PerspectiveCamera;
    if (shift.current > 0.5) perspective.setViewOffset(size.width, size.height, 0, shift.current, size.width, size.height);
    else if (perspective.view) perspective.clearViewOffset();
    camera.updateMatrixWorld();

    // See-through holes for whoever must stay visible, drawn by the scenery shaders.
    const focus = sceneUniforms.ttFocus.value;
    const nearest = c.mode === "follow" ? Object.values(rt.state.npcs)
      .map(n => ({ n, d: Math.hypot(n.x - p.x, n.z - p.z) })).filter(e => e.d < 10).sort((a, b) => a.d - b.d) : [];
    const points = c.mode === "path" ? [] : [
      p, c.mode === "conversation" ? c.target : nearest[0]?.n, nearest[1]?.n
    ];
    const buffer = gl.getDrawingBufferSize(scratch.buffer);
    const pixelsPerMetre = buffer.y / 2 / Math.tan(THREE.MathUtils.degToRad(perspective.fov / 2));
    for (let i = 0; i < 3; i++) {
      const point = points[i];
      strength.current[i] += ((point ? 1 : 0) - strength.current[i]) * Math.min(1, dt * 7);
      if (!point || strength.current[i] < 0.02) { focus[i].z = -1; continue; }
      scratchA.set(point.x, point.y + 0.85, point.z);
      scratchB.copy(scratchA).applyMatrix4(camera.matrixWorldInverse);
      const distance = -scratchB.z;
      if (distance <= 0.1) { focus[i].z = -1; continue; }
      scratchB.copy(scratchA).project(camera);
      const radius = 1.2 * pixelsPerMetre / distance * strength.current[i];
      // A character only sees through things well in front of them, not what they stand beside.
      focus[i].set((scratchB.x + 1) / 2 * buffer.x, (scratchB.y + 1) / 2 * buffer.y, bufferDepth(perspective, distance - 1.1), 1 / (radius * radius));
    }
    sceneUniforms.ttNear.value.set(bufferDepth(perspective, 0.9), bufferDepth(perspective, 3.2));
  }, -2);
  return null;
}

/** One irreversible drop per mounted renderer after four continuously slow seconds. */
export function AdaptiveDpr() {
  const { setDpr, viewport } = useThree();
  const slow = useRef(0), warmup = useRef(0), dropped = useRef(false);
  useFrame((_, dt) => {
    warmup.current += dt;
    if (dropped.current || viewport.dpr <= 1 || warmup.current < 1) return;
    slow.current = dt > 1 / 28 ? slow.current + dt : 0;
    if (slow.current >= 4) { dropped.current = true; setDpr(1); }
  });
  return null;
}
