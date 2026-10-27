import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { WorldRuntime } from "../game/world/types";
import { WALK_AREAS } from "../game/world/layout";

const library = WALK_AREAS.find(a => a.id === "library")!;

export function WorldCamera({ runtime: rt }: { runtime: WorldRuntime }) {
  const { camera, size } = useThree();
  const scratch = useMemo(() => ({ position: new THREE.Vector3(), target: new THREE.Vector3(), look: new THREE.Vector3() }), []);
  const ready = useRef(false), shift = useRef(0);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1), p = rt.player, c = rt.camera;
    const { position, target, look } = scratch;
    position.set(p.x + 4, p.y + 8, p.z + 11);
    target.set(p.x, p.y + 0.8, p.z);
    if (c.mode === "conversation") {
      const dx = c.target.x - p.x, dz = c.target.z - p.z;
      const distance = Math.max(0.01, Math.hypot(dx, dz));
      target.set((p.x + c.target.x) / 2, Math.max(p.y, c.target.y) + 1, (p.z + c.target.z) / 2);
      position.set(target.x - dx / distance * 4 + dz / distance * 3, target.y + 2.4, target.z - dz / distance * 4 - dx / distance * 3);
    } else if (c.mode === "path" && c.keys.length) {
      c.elapsed += dt;
      let remaining = c.elapsed, index = 0;
      while (index < c.keys.length - 1 && remaining > c.keys[index].duration) remaining -= Math.max(0.001, c.keys[index++].duration);
      const a = c.keys[index], b = c.keys[Math.min(index + 1, c.keys.length - 1)];
      const u = THREE.MathUtils.clamp(remaining / Math.max(0.001, a.duration), 0, 1), ease = u * u * (3 - 2 * u);
      position.set(a.position.x, a.position.y, a.position.z).lerp(new THREE.Vector3(b.position.x, b.position.y, b.position.z), ease);
      target.set(a.target.x, a.target.y, a.target.z).lerp(new THREE.Vector3(b.target.x, b.target.y, b.target.z), ease);
      if (index === c.keys.length - 1 && remaining >= a.duration) rt.camera = { mode: "follow" };
    }
    // Keep the view close to the floor inside the roofless library cutaway.
    if (c.mode === "follow" && Math.abs(p.x - library.x) < library.hx && Math.abs(p.z - library.z) < library.hz) {
      position.set(p.x + 1, p.y + 6.2, p.z + 7);
      target.set(p.x, p.y + 0.5, p.z - 0.5);
    }
    const k = ready.current ? 1 - Math.exp(-dt * (c.mode === "follow" ? 6 : 3)) : 1;
    camera.position.lerp(position, k); look.lerp(target, k);
    camera.lookAt(look); ready.current = true;
    rt.cameraYaw = Math.atan2(camera.position.x - look.x, camera.position.z - look.z);
    shift.current += (Math.min(rt.bottomPanel * 0.5, size.height * 0.3) - shift.current) * Math.min(1, dt * 5);
    const perspective = camera as THREE.PerspectiveCamera;
    if (shift.current > 0.5) perspective.setViewOffset(size.width, size.height, 0, shift.current, size.width, size.height);
    else if (perspective.view) perspective.clearViewOffset();
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
