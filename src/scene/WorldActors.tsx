import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ITEM_IDS, NPC_IDS, type NpcId } from "../game/content/ids";
import { SPOTS } from "../game/world/layout";
import type { WorldRuntime } from "../game/world/types";
import { blobShadow, glowMat, shadowMat } from "./materials";
import { FestivalChest } from "./models/festivalChest";
import { buildItem, ITEM_DISPLAY } from "./models/items";
import { KiwiRig } from "./models/kiwi";
import { buildCharacter } from "./models/people";
import { SeaChest } from "./models/seaChest";
import { textSprite } from "./textSprite";

/** These chests own their geometries; cached item geometry/materials are never disposed here. */
function disposeChest(group: THREE.Group) {
  const geometries = new Set<THREE.BufferGeometry>();
  group.traverse(object => {
    if (object instanceof THREE.Mesh) geometries.add(object.geometry);
    if (object instanceof THREE.Sprite) object.material.dispose();
  });
  for (const geometry of geometries) geometry.dispose();
}

function disposeSeaChest(chest: SeaChest) {
  // Each rig owns both shared lock geometries, including the one currently hidden.
  const lockGeometries = new Set<THREE.BufferGeometry>();
  for (const open of [false, true]) {
    for (let i = 0; i < 3; i++) chest.setLockOpen(i, open);
    chest.group.traverse(object => { if (object instanceof THREE.Mesh) lockGeometries.add(object.geometry); });
  }
  lockGeometries.forEach(geometry => geometry.dispose());
}

export function WorldActors({ runtime }: { runtime: WorldRuntime }) {
  const actors = useMemo(() => {
    const group = new THREE.Group();
    const player = buildCharacter("player");
    const shadowGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const shadows = new THREE.InstancedMesh(shadowGeometry, shadowMat(), NPC_IDS.length + 1);
    shadows.frustumCulled = false;
    shadows.renderOrder = 1;
    group.add(player.group, shadows);
    const kiwi = new KiwiRig();
    group.add(kiwi.group);
    const indicators = {
      "!": textSprite("!", { height: 0.52, color: "#6e402a", background: "#ffd25c" }),
      "?": textSprite("?", { height: 0.45, color: "#ffffff", background: "#5aaeb8" }),
      sticker: textSprite("✿", { height: 0.44, color: "#ffffff", background: "#c679ab" }),
      star: textSprite("★", { height: 0.48, color: "#8c4c21", background: "#ffde63" })
    };
    const npcs = NPC_IDS.map(id => {
      const rig = buildCharacter(id);
      const cell = new THREE.Group();
      const marker = new THREE.Sprite(indicators["!"].material);
      marker.position.y = rig.height + 0.48;
      marker.visible = false;
      cell.userData.interaction = { kind: "npc", id };
      cell.add(rig.group, marker);
      group.add(cell);
      return { id, rig, cell, marker, serial: -1 };
    });
    const festival = new FestivalChest();
    festival.group.userData.interaction = { kind: "npc", id: "pom" satisfies NpcId };
    const festivalShadow = blobShadow(1.8);
    const festivalRoot = new THREE.Group();
    festivalRoot.add(festival.group, festivalShadow);
    group.add(festivalRoot);
    const itemRoot = new THREE.Group();
    const seaRoot = new THREE.Group();
    seaRoot.position.set(10, 0.12, 36);
    seaRoot.userData.interaction = { kind: "seaChest" };
    const seaShadow = blobShadow(0.8);
    seaRoot.add(seaShadow);
    group.add(itemRoot, seaRoot);
    return {
      group, player, shadows, kiwi, npcs, indicators, festival, festivalRoot, festivalShadow,
      seaRoot, seaShadow, sea: null as SeaChest | null, seaKey: "", itemRoot,
      items: [] as { cell: THREE.Group; hidden: boolean; marker: THREE.Sprite | null }[],
      itemKey: "", itemMaterials: [] as THREE.SpriteMaterial[], lastKiwiMode: ""
    };
  }, []);

  useEffect(() => () => {
    actors.player.dispose();
    actors.player.mesh.skeleton.dispose();
    actors.shadows.geometry.dispose();
    actors.shadows.dispose();
    actors.kiwi.mesh.geometry.dispose();
    actors.kiwi.mesh.skeleton.dispose();
    for (const npc of actors.npcs) {
      npc.rig.dispose();
      npc.rig.mesh.skeleton.dispose();
    }
    for (const marker of Object.values(actors.indicators)) {
      marker.material.map?.dispose();
      marker.material.dispose();
    }
    for (const material of actors.itemMaterials) material.dispose();
    disposeChest(actors.festival.group);
    if (actors.sea) disposeSeaChest(actors.sea);
    actors.festivalShadow.geometry.dispose();
    actors.seaShadow.geometry.dispose();
  }, [actors]);

  useFrame(({ camera }, dt) => {
    const player = runtime.player;
    const playerPoint = new THREE.Vector3(player.x, player.y + actors.player.height * 0.85, player.z);
    actors.player.group.position.set(player.x, player.y, player.z);
    actors.player.group.rotation.y = player.yaw;
    const moving = player.speed > 0.08;
    actors.player.setWalkSpeed(player.speed);
    if (actors.player.state !== (moving ? "walk" : "idle")) actors.player.setState(moving ? "walk" : "idle");
    actors.player.update(dt);
    const shadowMatrix = new THREE.Matrix4();
    const shadowRotation = new THREE.Quaternion();
    const shadowScale = new THREE.Vector3();
    const shadowPosition = new THREE.Vector3();
    const placeShadow = (index: number, x: number, y: number, z: number, radius: number) => {
      shadowPosition.set(x, y + 0.015, z);
      shadowScale.set(radius * 2, 1, radius * 2);
      shadowMatrix.compose(shadowPosition, shadowRotation, shadowScale);
      actors.shadows.setMatrixAt(index, shadowMatrix);
    };
    placeShadow(0, player.x, player.y, player.z, 0.4);

    // Cull around the camera's ground target, including fixed gallery shots.
    const direction = camera.getWorldDirection(new THREE.Vector3());
    const center = camera.position.clone().addScaledVector(direction, direction.y < -0.05 ? -camera.position.y / direction.y : 15);
    const nearby = (point: THREE.Vector3, radius = 28) => Math.hypot(point.x - center.x, point.z - center.z) < radius;
    for (const [index, npc] of actors.npcs.entries()) {
      const placement = runtime.state.npcs[npc.id];
      npc.cell.visible = Boolean(placement);
      if (!placement) {
        placeShadow(index + 1, 0, 0, 0, 0);
        continue;
      }
      npc.cell.position.set(placement.x, placement.y, placement.z);
      npc.cell.visible = nearby(npc.cell.position);
      const command = runtime.npcCommands[npc.id];
      if (command && command.serial !== npc.serial) {
        npc.serial = command.serial;
        if (command.gesture) npc.rig.setState(command.gesture);
        if (command.held !== undefined) npc.rig.hold(command.held);
      }
      if (!npc.cell.visible) {
        placeShadow(index + 1, 0, 0, 0, 0);
        continue;
      }
      const distance = Math.hypot(player.x - placement.x, player.z - placement.z);
      // Small home-centred strolls stop well before the interaction radius.
      // Their <0.6 m offset stays within the same reachable home/interaction area.
      const strolling = (npc.id === "ken" || npc.id === "finn" || npc.id === "aya") && distance > 7 && !runtime.locked && !command?.gesture;
      const phase = runtime.time * 0.7 + index;
      const walking = strolling && Math.sin(phase * 0.35) > 0;
      const offsetX = walking ? Math.sin(phase) * 0.5 : 0;
      const offsetZ = walking ? Math.cos(phase) * 0.4 : 0;
      npc.rig.group.position.x = THREE.MathUtils.damp(npc.rig.group.position.x, offsetX, 3, dt);
      npc.rig.group.position.z = THREE.MathUtils.damp(npc.rig.group.position.z, offsetZ, 3, dt);
      if (!command?.gesture && npc.rig.state !== (walking ? "walk" : "idle")) npc.rig.setState(walking ? "walk" : "idle");
      npc.rig.setWalkSpeed(walking ? 0.7 : 0);
      placeShadow(index + 1, placement.x + npc.rig.group.position.x, placement.y, placement.z + npc.rig.group.position.z, npc.rig.radius * 1.35);
      let yaw = placement.yaw ?? Math.PI;
      if (walking) yaw = Math.atan2(Math.cos(phase) * 0.5, -Math.sin(phase) * 0.4);
      if (distance < 7) yaw = Math.atan2(player.x - placement.x, player.z - placement.z);
      const delta = Math.atan2(Math.sin(yaw - npc.rig.group.rotation.y), Math.cos(yaw - npc.rig.group.rotation.y));
      npc.rig.group.rotation.y += delta * Math.min(1, dt * 4);
      npc.rig.lookAt(distance < 8 ? playerPoint : null);
      npc.rig.update(dt);
      const indicator = placement.indicator;
      npc.marker.visible = Boolean(indicator);
      if (indicator) {
        const template = actors.indicators[indicator];
        npc.marker.material = template.material;
        npc.marker.scale.copy(template.scale);
        npc.marker.position.x = npc.rig.group.position.x;
        npc.marker.position.z = npc.rig.group.position.z;
        npc.marker.position.y = npc.rig.height + 0.48 + Math.sin(runtime.time * 2.8) * 0.07;
      }
    }
    actors.shadows.instanceMatrix.needsUpdate = true;

    // Perch indoors so follow offsets and hint flights cannot cross room walls.
    const indoors = player.x > -26.4 && player.x < -11.5 && player.z > -47.5 && player.z < -36.5;
    const kiwiMode = indoors ? "perch" : runtime.kiwi.mode;
    if (kiwiMode !== actors.lastKiwiMode) {
      actors.lastKiwiMode = kiwiMode;
      if (kiwiMode === "perch") actors.player.shoulder.add(actors.kiwi.group);
      else actors.group.attach(actors.kiwi.group);
      actors.kiwi.flap();
    }
    if (kiwiMode === "perch") {
      actors.kiwi.group.position.set(0, 0, 0);
      actors.kiwi.group.rotation.set(0, 0, 0);
      actors.kiwi.setState("perch");
    } else {
      const hint = kiwiMode === "hint" ? runtime.kiwi.target : undefined;
      const target = hint ? new THREE.Vector3(hint.x, hint.y + 1.35, hint.z) : new THREE.Vector3(player.x - Math.cos(player.yaw) * 0.85, player.y + actors.player.height + 0.35, player.z + Math.sin(player.yaw) * 0.85);
      target.y += Math.sin(runtime.time * 3.6) * 0.12;
      const distance = actors.kiwi.group.position.distanceTo(target);
      const travel = Math.min(1, dt * 5, dt * 10 / Math.max(0.01, distance));
      if (!hint && distance > 6) actors.kiwi.group.position.copy(target);
      else actors.kiwi.group.position.lerp(target, travel);
      actors.kiwi.group.rotation.y = Math.atan2(target.x - actors.kiwi.group.position.x, target.z - actors.kiwi.group.position.z);
      actors.kiwi.setState(distance > 0.7 ? "fly" : "hover");
    }
    actors.kiwi.update(dt);

    const itemKey = JSON.stringify(runtime.state.items);
    if (itemKey !== actors.itemKey) {
      actors.itemKey = itemKey;
      actors.itemRoot.clear();
      actors.items = [];
      actors.itemMaterials.forEach(material => material.dispose());
      actors.itemMaterials = [];
      for (const item of runtime.state.items) {
        const spot = SPOTS[item.spotId];
        if (!spot || !item.active) continue;
        const cell = new THREE.Group();
        cell.position.set(spot.x, spot.y, spot.z);
        cell.userData.interaction = { kind: "spot", id: item.spotId };
        let marker: THREE.Sprite | null = null;
        if (item.kind === "collect") {
          const mesh = buildItem(item.item);
          mesh.scale.setScalar(ITEM_DISPLAY[item.item].world);
          mesh.position.y = -mesh.geometry.boundingBox!.min.y * mesh.scale.y + 0.015;
          cell.add(mesh);
        } else if (item.kind === "hidden") {
          const material = glowMat("#fff0a0", 0.8);
          actors.itemMaterials.push(material);
          marker = new THREE.Sprite(material);
          marker.position.y = 0.18;
          marker.scale.setScalar(0.35);
          cell.add(marker);
        } else {
          marker = new THREE.Sprite(actors.indicators["?"].material);
          marker.scale.set(0.26, 0.3, 1);
          marker.position.y = 0.25;
          cell.add(marker);
        }
        actors.items.push({ cell, hidden: item.kind === "hidden", marker });
        actors.itemRoot.add(cell);
      }
    }
    for (const item of actors.items) {
      item.cell.visible = nearby(item.cell.position) && (!item.hidden || Math.hypot(player.x - item.cell.position.x, player.z - item.cell.position.z) < 5);
      if (item.hidden && item.marker) {
        const pulse = Math.pow(Math.max(0, Math.sin(runtime.time * 4 + item.cell.position.x)), 4);
        item.marker.material.opacity = 0.3 + pulse * 0.7;
        item.marker.scale.setScalar(0.18 + pulse * 0.24);
      }
    }

    actors.festivalRoot.position.set(runtime.state.chapter === 5 ? -55 : 0, runtime.state.chapter === 5 ? 0 : 0.15, runtime.state.chapter === 5 ? 0 : -8);
    actors.festivalRoot.visible = nearby(actors.festivalRoot.position, 30);
    const depositing = runtime.effects.filter(effect => effect.kind === "deposit" && runtime.time - effect.started > 0.7);
    ITEM_IDS.forEach(item => actors.festival.setSlot(item, depositing.some(effect => "item" in effect && effect.item === item) ? "glowing" : runtime.state.chestItems.includes(item) ? "filled" : "empty"));
    actors.festival.setLidOpen(runtime.state.chestCount >= 9 ? 1 : 0);
    actors.festival.update(dt);
    // Empty art-kit glows have opacity zero but still cost a draw call unless hidden.
    actors.festival.group.traverse(object => {
      if (object instanceof THREE.Sprite) object.visible = object.material.opacity > 0.005;
    });
    const seaKey = runtime.state.seaChest.items.join(",");
    if (seaKey !== actors.seaKey || !actors.sea) {
      if (actors.sea) {
        actors.seaRoot.remove(actors.sea.group);
        disposeSeaChest(actors.sea);
      }
      actors.sea = new SeaChest(runtime.state.seaChest.items);
      actors.seaKey = seaKey;
      actors.seaRoot.add(actors.sea.group);
    }
    actors.seaRoot.visible = nearby(actors.seaRoot.position, 28);
    runtime.state.seaChest.locks.forEach((open, i) => actors.sea?.setLockOpen(i, open));
    const targetAngle = runtime.state.seaChest.open ? -1.6 : 0;
    actors.sea.lid.rotation.x = THREE.MathUtils.damp(actors.sea.lid.rotation.x, targetAngle, 4, dt);
  });

  return <primitive object={actors.group} dispose={null} />;
}
