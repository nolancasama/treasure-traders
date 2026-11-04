import { useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { navigationGates, type WorldAPI } from "../game/runtime";
import { isWalkable, moveCircle, standY } from "../game/world/collision";
import { canInteract, interactionFocus } from "../game/world/interaction";
import type { Interaction, Position, WorldRuntime } from "../game/world/types";
import { installKeyboard, keyboardMove, keys } from "../input/keyboard";
import { TapTracker } from "../input/tap";

export function interactionPoints(rt: WorldRuntime): { target: Interaction; position: Position }[] {
  const entries: { target: Interaction; position: Position }[] = Object.entries(rt.state.npcs).map(([id, position]) => ({ target: { kind: "npc", id: id as keyof typeof rt.state.npcs }, position }));
  return entries;
}

/** NPCs, active spot items and the sea chest that can currently be interacted with. */
export function interactables(world: WorldAPI): { target: Interaction; position: Position }[] {
  const rt = world.runtime, candidates = interactionPoints(rt);
  for (const item of rt.state.items.filter(i => i.active)) {
    const target = { kind: "spot", id: item.spotId } as const;
    const position = world.positionOf(target);
    if (position) candidates.push({ target, position });
  }
  if (rt.state.seaChest.items.length) candidates.push({ target: { kind: "seaChest" }, position: world.positionOf({ kind: "seaChest" })! });
  return candidates;
}

const lastInteraction = new WeakMap<WorldRuntime, number>();
/** Every input route shares range, visibility, lock and rapid-press protection. */
export function activateInteraction(world: WorldAPI, target: Interaction): boolean {
  const rt = world.runtime, candidate = interactables(world).find(entry => sameTarget(entry.target, target));
  if (rt.locked || rt.time - (lastInteraction.get(rt) ?? -Infinity) < 0.4 || !candidate || !canInteract(rt.player, candidate, navigationGates(rt))) return false;
  lastInteraction.set(rt, rt.time);
  rt.path = []; rt.pending = null;
  rt.player.yaw = Math.atan2(candidate.position.x - rt.player.x, candidate.position.z - rt.player.z);
  rt.emitInteract(target);
  return true;
}

function sameTarget(a: Interaction, b: Interaction): boolean {
  return a.kind === b.kind && (a.kind === "seaChest" || b.kind !== "seaChest" && a.id === b.id);
}

/** Canvas taps select an approach; an already reachable target fires immediately. */
export function approachInteraction(world: WorldAPI, target: Interaction): void {
  if (world.runtime.locked) return;
  const candidate = interactables(world).find(entry => sameTarget(entry.target, target));
  if (!candidate) return;
  if (canInteract(world.runtime.player, candidate, navigationGates(world.runtime))) {
    activateInteraction(world, target);
    return;
  }
  world.walkTo(candidate.position, target);
}

/** Pure per-frame movement; dt clamping and collision substeps handle stalls. */
export function stepController(world: WorldAPI, dt: number, input: { x: number; y: number; held?: boolean } = { x: 0, y: 0 }): void {
  const rt = world.runtime, p = rt.player;
  dt = Math.min(Math.max(dt, 0), 0.1);
  rt.time += dt;
  if (rt.locked) { p.speed = 0; rt.focus = null; rt.manualInputYaw = null; return; }
  let dx = 0, dz = 0;
  const manual = Math.hypot(input.x, input.y);
  if (manual > 0) {
    rt.path = []; rt.pending = null; rt.deferredWalk = null;
    rt.manualInputYaw ??= rt.cameraYaw;
    const c = Math.cos(rt.manualInputYaw), s = Math.sin(rt.manualInputYaw);
    dx = (input.x * c - input.y * s) / manual;
    dz = (-input.x * s - input.y * c) / manual;
  } else {
    if (!input.held) rt.manualInputYaw = null;
    if (rt.deferredWalk) world.walkTo(rt.deferredWalk.point, rt.deferredWalk.interact);
    const pendingPosition = rt.pending && world.positionOf(rt.pending);
    if (pendingPosition && canInteract(p, { target: rt.pending!, position: pendingPosition }, navigationGates(rt))) {
      const target = rt.pending!;
      rt.path = []; rt.pending = null;
      rt.emitArrive(p); activateInteraction(world, target);
    } else if (rt.path.length) {
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
  const gates = navigationGates(rt);
  const next = moveCircle(p.x, p.z, p.x + dx * dt * 4.5, p.z + dz * dt * 4.5, 0.35, gates);
  p.speed = dt ? Math.hypot(next.x - p.x, next.z - p.z) / dt : 0;
  if (p.speed > 0.01) p.yaw = Math.atan2(next.x - p.x, next.z - p.z);
  Object.assign(p, next); p.y += (standY(p.x, p.z, gates) - p.y) * (1 - Math.exp(-14 * dt));
  if (rt.pending) {
    const position = world.positionOf(rt.pending);
    if (position && canInteract(p, { target: rt.pending, position }, gates)) {
      const target = rt.pending;
      rt.path = []; rt.pending = null; rt.emitArrive(p); activateInteraction(world, target);
    }
  }
  updateFocus(world);
}

/** Nearest reachable interactable, including targets behind the player. */
export function updateFocus(world: WorldAPI): void {
  const rt = world.runtime;
  rt.focus = rt.locked ? null : interactionFocus(rt.player, interactables(world), navigationGates(rt));
}

export function hasFocusedDomControl(target: EventTarget | null): boolean {
  return typeof Element !== "undefined" && target instanceof Element && Boolean(target.closest("button, input, textarea, select, [contenteditable], [role=button]"));
}

export function WorldController({ world }: { world: WorldAPI }) {
  const { gl, camera, scene } = useThree();
  useEffect(() => {
    const uninstall = installKeyboard((code, event) => {
      if (code !== "KeyE" && code !== "Enter" || world.runtime.locked || hasFocusedDomControl(event.target) || hasFocusedDomControl(document.activeElement)) return;
      // Locked frames clear focus; a press right after unlocking must not
      // wait for the next rendered frame to find the NPC beside the player.
      updateFocus(world);
      if (world.runtime.focus) activateInteraction(world, world.runtime.focus);
    });
    const canvas = gl.domElement, taps = new TapTracker(), ray = new THREE.Raycaster();
    const down = (e: PointerEvent) => { if (e.button === 0) { taps.down(e.pointerId, e.clientX, e.clientY); canvas.setPointerCapture(e.pointerId); } };
    const move = (e: PointerEvent) => taps.move(e.pointerId, e.clientX, e.clientY);
    const up = (e: PointerEvent) => {
      if (!taps.up(e.pointerId, e.clientX, e.clientY) || world.runtime.locked) return;
      const rect = canvas.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1), camera);
      const hits = ray.intersectObjects(scene.children, true);
      const tagged = hits.some(hit => { for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) if (o.userData.interaction) return true; return false; });
      if (!tagged) {
        // Small items (a pencil on the fountain rim) are hard to hit exactly;
        // a tap within a finger's width of any interactable selects it.
        let best: Interaction | undefined, bestPx = 48;
        for (const { target, position } of interactables(world)) {
          const s = new THREE.Vector3(position.x, position.y + (target.kind === "npc" ? 1.1 : 0.1), position.z).project(camera);
          if (s.z < -1 || s.z > 1) continue;
          const px = Math.hypot((s.x + 1) / 2 * rect.width - (e.clientX - rect.left), (1 - s.y) / 2 * rect.height - (e.clientY - rect.top));
          if (px < bestPx) { bestPx = px; best = target; }
        }
        if (best) { approachInteraction(world, best); return; }
      }
      for (const hit of hits) {
        let object: THREE.Object3D | null = hit.object;
        if (!object.visible) continue;
        let target: Interaction | undefined;
        let visible = true;
        while (object) { if (!object.visible) visible = false; target ??= object.userData.interaction as Interaction | undefined; object = object.parent; }
        if (!visible) continue;
        if (target) { approachInteraction(world, target); return; }
        if (hit.object instanceof THREE.Sprite) continue;
        // Walkable targets may be selected through decorative overhead geometry.
        if (hit.point.y < 0.65 && isWalkable(hit.point.x, hit.point.z, navigationGates(world.runtime), 0)) { world.walkTo(hit.point); return; }
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
