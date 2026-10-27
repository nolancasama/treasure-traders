import { useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { WorldAPI } from "../game/runtime";
import { isWalkable, moveCircle, standY } from "../game/world/collision";
import type { Interaction, Position, WorldRuntime } from "../game/world/types";
import { installKeyboard, keyboardMove, keys } from "../input/keyboard";
import { TapTracker } from "../input/tap";

export function interactionPoints(rt: WorldRuntime): { target: Interaction; position: Position }[] {
  const entries: { target: Interaction; position: Position }[] = Object.entries(rt.state.npcs).map(([id, position]) => ({ target: { kind: "npc", id: id as keyof typeof rt.state.npcs }, position }));
  return entries;
}

/** Pure per-frame movement; dt clamping and collision substeps handle stalls. */
export function stepController(world: WorldAPI, dt: number, input = { x: 0, y: 0 }): void {
  const rt = world.runtime, p = rt.player;
  dt = Math.min(Math.max(dt, 0), 0.1);
  rt.time += dt;
  if (rt.locked) { p.speed = 0; rt.focus = null; return; }
  let dx = 0, dz = 0;
  const manual = Math.hypot(input.x, input.y);
  if (manual > 0) {
    rt.path = []; rt.pending = null;
    const c = Math.cos(rt.cameraYaw), s = Math.sin(rt.cameraYaw);
    dx = (input.x * c - input.y * s) / manual;
    dz = (-input.x * s - input.y * c) / manual;
  } else if (rt.path.length) {
    const pendingPosition = rt.pending && world.positionOf(rt.pending);
    if (pendingPosition && Math.hypot(p.x - pendingPosition.x, p.z - pendingPosition.z) <= 1.9) {
      const target = rt.pending!;
      p.yaw = Math.atan2(pendingPosition.x - p.x, pendingPosition.z - p.z);
      rt.path = []; rt.pending = null;
      rt.emitArrive(p); rt.emitInteract(target);
    } else {
      while (rt.path.length && Math.hypot(rt.path[0].x - p.x, rt.path[0].z - p.z) < 0.15) rt.path.shift();
      const next = rt.path[0];
      if (next) {
        const distance = Math.hypot(next.x - p.x, next.z - p.z);
        const speed = Math.min(1, distance / Math.max(0.0001, dt * 4.5));
        dx = (next.x - p.x) / distance * speed; dz = (next.z - p.z) / distance * speed;
      } else {
        rt.pending = null; rt.emitArrive(p);
      }
    }
  }
  const next = moveCircle(p.x, p.z, p.x + dx * dt * 4.5, p.z + dz * dt * 4.5, 0.35, rt.state.gates);
  p.speed = dt ? Math.hypot(next.x - p.x, next.z - p.z) / dt : 0;
  if (p.speed > 0.01) p.yaw = Math.atan2(next.x - p.x, next.z - p.z);
  Object.assign(p, next); p.y = standY(p.x, p.z);
  rt.focus = null;
  let closest = 2.4;
  const candidates = interactionPoints(rt);
  for (const item of rt.state.items.filter(i => i.active)) {
    const target = { kind: "spot", id: item.spotId } as const;
    const position = world.positionOf(target);
    if (position) candidates.push({ target, position });
  }
  if (rt.state.seaChest.items.length) candidates.push({ target: { kind: "seaChest" }, position: world.positionOf({ kind: "seaChest" })! });
  for (const { target, position } of candidates) {
    const x = position.x - p.x, z = position.z - p.z, d = Math.hypot(x, z);
    if (d <= closest && (d < 0.2 || (x * Math.sin(p.yaw) + z * Math.cos(p.yaw)) / d > 0.2)) {
      // A closed gate or a shelf must not permit interaction through a wall.
      const test = moveCircle(p.x, p.z, position.x, position.z, 0.1, rt.state.gates);
      if (target.kind !== "spot" && Math.hypot(test.x - position.x, test.z - position.z) > 0.8) continue;
      rt.focus = target; closest = d;
    }
  }
}

export function WorldController({ world }: { world: WorldAPI }) {
  const { gl, camera, scene } = useThree();
  useEffect(() => {
    const uninstall = installKeyboard(code => {
      if ((code === "KeyE" || code === "Enter") && !world.runtime.locked && world.runtime.focus) world.runtime.emitInteract(world.runtime.focus);
    });
    const canvas = gl.domElement, taps = new TapTracker(), ray = new THREE.Raycaster();
    const down = (e: PointerEvent) => { if (e.button === 0) { taps.down(e.pointerId, e.clientX, e.clientY); canvas.setPointerCapture(e.pointerId); } };
    const move = (e: PointerEvent) => taps.move(e.pointerId, e.clientX, e.clientY);
    const up = (e: PointerEvent) => {
      if (!taps.up(e.pointerId, e.clientX, e.clientY) || world.runtime.locked) return;
      const rect = canvas.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1), camera);
      for (const hit of ray.intersectObjects(scene.children, true)) {
        let object: THREE.Object3D | null = hit.object;
        if (!object.visible) continue;
        let target: Interaction | undefined;
        let visible = true;
        while (object) { if (!object.visible) visible = false; target ??= object.userData.interaction as Interaction | undefined; object = object.parent; }
        if (!visible) continue;
        if (target) { const p = world.positionOf(target); if (p) world.walkTo(p, target); return; }
        if (hit.object instanceof THREE.Sprite) continue;
        // Walkable targets may be selected through decorative overhead geometry.
        if (hit.point.y < 0.65 && isWalkable(hit.point.x, hit.point.z, world.runtime.state.gates, 0)) { world.walkTo(hit.point); return; }
      }
    };
    const cancel = () => taps.cancel();
    canvas.addEventListener("pointerdown", down); canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", cancel);
    const oldTouchAction = canvas.style.touchAction; canvas.style.touchAction = "none";
    return () => {
      uninstall(); keys.clear(); canvas.style.touchAction = oldTouchAction;
      canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up); canvas.removeEventListener("pointercancel", cancel);
    };
  }, [world, gl, camera, scene]);
  useFrame((_, dt) => stepController(world, dt, keyboardMove()), -3);
  return null;
}
