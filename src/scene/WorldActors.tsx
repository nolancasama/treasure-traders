import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ITEM_IDS, NPC_IDS, type NpcId } from "../game/content/ids";
import { festivalRevealed } from "../game/runtime";
import { CHEST_SCALE, chestPose, NPC_HOMES, SPOTS, UME_SEAT } from "../game/world/layout";
import type { NpcCommand, WorldRuntime } from "../game/world/types";
import { blobShadow, glowMat, shadowMat, starTexture } from "./materials";
import { FestivalChest } from "./models/festivalChest";
import { buildItem, ITEM_DISPLAY, THICKEN } from "./models/items";
import { KiwiRig } from "./models/kiwi";
import { buildCharacter, type CharacterRig } from "./models/people";
import { props } from "./models/props";
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

/** People's tools, held in the right hand whenever no item is being shown. */
function equip(id: NpcId, rig: CharacterRig) {
  if (id === "ken" || id === "leo") {
    const brush = props.brush();
    brush.rotation.x = 3.8;
    brush.position.z = 0.02;
    brush.scale.setScalar(1.6);
    rig.setProp(brush);
  } else if (id === "finn") {
    const rod = props.fishingRod();
    rod.rotation.x = 2.1;
    rod.scale.setScalar(1.15);
    rig.setProp(rod);
  } else if (id === "ume") {
    const knitting = props.knitting();
    knitting.rotation.x = 2.1;
    knitting.position.set(0.06, 0.04, 0.05);
    knitting.scale.setScalar(1.15);
    rig.setProp(knitting);
  } else if (id === "page") {
    const book = props.book();
    book.rotation.set(1.9, 0, 0.1);
    book.position.set(0.1, 0, 0.1);
    rig.setProp(book);
  }
}

const atHome = (id: NpcId, x: number, z: number) => NPC_HOMES[id].x === x && NPC_HOMES[id].z === z;
const STROLLERS = new Set<NpcId>(["finn", "aya"]);
const TWINKLES = 28;

export function WorldActors({ runtime }: { runtime: WorldRuntime }) {
  const actors = useMemo(() => {
    const group = new THREE.Group();
    const player = buildCharacter("player");
    const shadowGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const shadows = new THREE.InstancedMesh(shadowGeometry, shadowMat(), NPC_IDS.length + 1);
    shadows.frustumCulled = false;
    shadows.renderOrder = 1;
    shadows.raycast = () => {};
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
      equip(id, rig);
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
    festival.setScale(CHEST_SCALE);
    festival.group.userData.interaction = { kind: "npc", id: "pom" satisfies NpcId };
    const festivalShadow = blobShadow(2.2);
    const festivalRoot = new THREE.Group();
    festivalRoot.add(festival.group, festivalShadow);
    group.add(festivalRoot);
    const itemRoot = new THREE.Group();
    const seaRoot = new THREE.Group();
    seaRoot.position.set(10, 0.12, 36);
    seaRoot.scale.setScalar(1.3);
    seaRoot.userData.interaction = { kind: "seaChest" };
    const seaShadow = blobShadow(0.95);
    seaRoot.add(seaShadow);
    group.add(itemRoot, seaRoot);
    // Twinkles on anything to collect: one batch of camera-facing stars for the whole world.
    const starMaterial = new THREE.MeshBasicMaterial({ map: starTexture(), transparent: true, depthWrite: false, depthTest: false, fog: false, color: "#fff4b0" });
    const stars = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), starMaterial, TWINKLES);
    stars.frustumCulled = false;
    stars.renderOrder = 5;
    stars.raycast = () => {};
    stars.count = 0;
    group.add(stars);
    return {
      group, player, shadows, kiwi, npcs, indicators, festival, festivalRoot, festivalShadow,
      seaRoot, seaShadow, sea: null as SeaChest | null, seaKey: "", itemRoot, stars, starMaterial,
      items: [] as { cell: THREE.Group; hidden: boolean; collect: boolean; mesh: THREE.Mesh | null; rest: number; marker: THREE.Sprite | null; glow: THREE.Sprite | null }[],
      itemKey: "", itemRevision: -1, itemMaterials: [] as THREE.SpriteMaterial[], lastKiwiMode: "", pulsed: new Set<number>(), playerSerial: -1,
      scratch: { matrix: new THREE.Matrix4(), rotation: new THREE.Quaternion(), scale: new THREE.Vector3(), position: new THREE.Vector3(), point: new THREE.Vector3(), direction: new THREE.Vector3(), center: new THREE.Vector3(), kiwi: new THREE.Vector3() }
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
    actors.festival.dispose();
    disposeChest(actors.festival.group);
    if (actors.sea) disposeSeaChest(actors.sea);
    actors.festivalShadow.geometry.dispose();
    actors.seaShadow.geometry.dispose();
    actors.stars.geometry.dispose();
    actors.stars.dispose();
    actors.starMaterial.dispose();
  }, [actors]);

  useFrame(({ camera }, dt) => {
    const player = runtime.player;
    const { matrix, rotation, scale, position, point, direction, center, kiwi: kiwiTarget } = actors.scratch;
    const apply = (rig: CharacterRig, command: NpcCommand, restState: "idle" | "sit" | "dance") => {
      if (command.held !== undefined) rig.hold(command.held);
      if (command.mood !== undefined) rig.setExpression(command.mood ?? "neutral");
      if (command.speak !== undefined) rig.speak(command.speak);
      if (command.gesture === "talk") {
        // Talking is a timed overlay; a person who was sulking or thinking stops to do it.
        if (rig.state !== restState) rig.setState(restState);
        if (command.speak === undefined) rig.speak(2.4);
      } else if (command.gesture === "idle") rig.setState(restState);
      else if (command.gesture) rig.setState(command.gesture);
    };
    const playerCommand = runtime.playerCommand;
    if (playerCommand && playerCommand.serial !== actors.playerSerial) {
      actors.playerSerial = playerCommand.serial;
      apply(actors.player, playerCommand, "idle");
      runtime.playerCommand = null;
    }
    point.set(player.x, player.y + actors.player.height * 0.85, player.z);
    actors.player.group.position.set(player.x, player.y, player.z);
    actors.player.group.rotation.y = player.yaw;
    const moving = player.speed > 0.08;
    actors.player.setWalkSpeed(player.speed);
    if (actors.player.state !== (moving ? "walk" : "idle")) actors.player.setState(moving ? "walk" : "idle");
    actors.player.update(dt);
    const placeShadow = (index: number, x: number, y: number, z: number, radius: number) => {
      position.set(x, y + 0.015, z);
      scale.set(radius * 2, 1, radius * 2);
      matrix.compose(position, rotation.identity(), scale);
      actors.shadows.setMatrixAt(index, matrix);
    };
    placeShadow(0, player.x, player.y, player.z, 0.42);

    // Cull around the camera's ground target, including fixed gallery shots.
    camera.getWorldDirection(direction);
    center.copy(camera.position).addScaledVector(direction, direction.y < -0.05 ? -camera.position.y / direction.y : 15);
    const nearby = (p: { x: number; z: number }, radius = 28) => Math.hypot(p.x - center.x, p.z - center.z) < radius;
    for (const [index, npc] of actors.npcs.entries()) {
      const placement = runtime.state.npcs[npc.id];
      npc.cell.visible = Boolean(placement);
      if (!placement) {
        placeShadow(index + 1, 0, 0, 0, 0);
        continue;
      }
      npc.cell.position.set(placement.x, placement.y, placement.z);
      npc.cell.visible = nearby(npc.cell.position);
      const seated = npc.id === "ume" && atHome(npc.id, placement.x, placement.z) && !runtime.party;
      const restState = runtime.party ? "dance" : seated ? "sit" : "idle";
      const command = runtime.npcCommands[npc.id];
      if (command && command.serial !== npc.serial) {
        npc.serial = command.serial;
        apply(npc.rig, command, restState);
        delete runtime.npcCommands[npc.id];
      }
      if (!npc.cell.visible) {
        placeShadow(index + 1, 0, 0, 0, 0);
        continue;
      }
      const distance = Math.hypot(player.x - placement.x, player.z - placement.z);
      // Small home-centred strolls stop well before the interaction radius.
      // Their <0.6 m offset stays within the same reachable home/interaction area.
      const free = npc.rig.state === "idle" || npc.rig.state === "walk";
      const strolling = STROLLERS.has(npc.id) && distance > 7 && !runtime.locked && free && !npc.rig.gesturing && !runtime.party;
      const phase = runtime.time * 0.7 + index;
      const walking = strolling && Math.sin(phase * 0.35) > 0;
      const offsetX = seated ? UME_SEAT.x - placement.x : walking ? Math.sin(phase) * 0.5 : 0;
      const offsetZ = seated ? UME_SEAT.z - placement.z : walking ? Math.cos(phase) * 0.4 : 0;
      npc.rig.group.position.x = THREE.MathUtils.damp(npc.rig.group.position.x, offsetX, 3, dt);
      npc.rig.group.position.z = THREE.MathUtils.damp(npc.rig.group.position.z, offsetZ, 3, dt);
      // Seated, the hips rest on the bench rather than the feet on the ground.
      npc.rig.group.position.y = seated ? UME_SEAT.y + 0.04 - 0.48 * npc.rig.group.scale.y : 0;
      if (free && !seated && !npc.rig.gesturing && npc.rig.state !== (walking ? "walk" : "idle")) npc.rig.setState(walking ? "walk" : "idle");
      if (seated && npc.rig.state !== "sit" && npc.rig.state !== "think" && npc.rig.state !== "sad") npc.rig.setState("sit");
      if (runtime.party && npc.rig.state !== "dance") npc.rig.setState("dance");
      if (!runtime.party && npc.rig.state === "dance") npc.rig.setState(restState);
      npc.rig.setWalkSpeed(walking ? 0.7 : 0);
      placeShadow(index + 1, placement.x + npc.rig.group.position.x, placement.y, placement.z + npc.rig.group.position.z, npc.rig.radius * 1.35);
      let yaw = placement.yaw ?? 0;
      if (walking) yaw = Math.atan2(Math.cos(phase) * 0.5, -Math.sin(phase) * 0.4);
      if (distance < 7 && !seated) yaw = Math.atan2(player.x - placement.x, player.z - placement.z);
      const delta = Math.atan2(Math.sin(yaw - npc.rig.group.rotation.y), Math.cos(yaw - npc.rig.group.rotation.y));
      npc.rig.group.rotation.y += delta * Math.min(1, dt * 4);
      npc.rig.lookAt(distance < 8 ? point : null);
      npc.rig.update(dt);
      const indicator = placement.indicator;
      npc.marker.visible = Boolean(indicator);
      if (indicator) {
        const template = actors.indicators[indicator];
        npc.marker.material = template.material;
        npc.marker.scale.copy(template.scale);
        npc.marker.position.x = npc.rig.group.position.x;
        npc.marker.position.z = npc.rig.group.position.z;
        npc.marker.position.y = npc.rig.height + 0.48 + npc.rig.group.position.y + Math.sin(runtime.time * 2.8) * 0.07;
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
    const kiwiTalking = (runtime.kiwi.speakUntil ?? 0) > runtime.time;
    if (kiwiMode === "perch") {
      actors.kiwi.group.position.set(0, 0, 0);
      actors.kiwi.group.rotation.set(0, 0, 0);
      actors.kiwi.group.scale.setScalar(1.1);
      actors.kiwi.setState(kiwiTalking ? "talk" : "perch");
    } else {
      // Big enough to read as a parrot, not a green speck, from the follow camera.
      actors.kiwi.group.scale.setScalar(1.55);
      const hint = kiwiMode === "hint" ? runtime.kiwi.target : undefined;
      if (hint) kiwiTarget.set(hint.x, hint.y + 1.35, hint.z);
      else if (kiwiMode === "cheer") {
        // Delighted circles over the player's head.
        const a = runtime.time * 4.2;
        kiwiTarget.set(player.x + Math.cos(a) * 1.15, player.y + actors.player.height + 0.75 + Math.sin(a * 2.3) * 0.4, player.z + Math.sin(a) * 1.15);
      } else kiwiTarget.set(player.x - Math.cos(player.yaw) * 0.85, player.y + actors.player.height + 0.35, player.z + Math.sin(player.yaw) * 0.85);
      kiwiTarget.y += Math.sin(runtime.time * 3.6) * 0.12;
      const distance = actors.kiwi.group.position.distanceTo(kiwiTarget);
      const travel = Math.min(1, dt * 5, dt * 10 / Math.max(0.01, distance));
      if (!hint && distance > 6) actors.kiwi.group.position.copy(kiwiTarget);
      else actors.kiwi.group.position.lerp(kiwiTarget, travel);
      actors.kiwi.group.rotation.y = Math.atan2(kiwiTarget.x - actors.kiwi.group.position.x, kiwiTarget.z - actors.kiwi.group.position.z);
      actors.kiwi.setState(kiwiTalking ? "talk" : distance > 0.7 || kiwiMode === "cheer" ? "fly" : "hover");
    }
    actors.kiwi.update(dt);

    if (runtime.revision !== actors.itemRevision) {
      actors.itemRevision = runtime.revision;
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
          let marker: THREE.Sprite | null = null, mesh: THREE.Mesh | null = null, glow: THREE.Sprite | null = null, rest = 0;
          if (item.kind === "collect") {
            mesh = buildItem(item.item);
            // Bigger than a hidden item would be, and fatter if it is one of the thin ones.
            const k = ITEM_DISPLAY[item.item].world * 1.2, thick = THICKEN[item.item] ?? 1;
            mesh.scale.set(k, k * thick, k * thick);
            rest = -mesh.geometry.boundingBox!.min.y * mesh.scale.y + 0.05;
            mesh.position.y = rest;
            if (item.spotId === "square-pencil") mesh.rotation.y = Math.PI / 2;
            cell.add(mesh);
            const material = glowMat("#ffe9a0", 0.6);
            actors.itemMaterials.push(material);
            glow = new THREE.Sprite(material);
            glow.position.y = 0.18;
            glow.scale.setScalar(1.1);
            cell.add(glow);
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
          actors.items.push({ cell, hidden: item.kind === "hidden", collect: item.kind === "collect", mesh, rest, marker, glow });
          actors.itemRoot.add(cell);
        }
      }
    }
    let twinkle = 0;
    for (const item of actors.items) {
      item.cell.visible = nearby(item.cell.position) && (!item.hidden || Math.hypot(player.x - item.cell.position.x, player.z - item.cell.position.z) < 5);
      if (!item.cell.visible) continue;
      if (item.hidden && item.marker) {
        const pulse = Math.pow(Math.max(0, Math.sin(runtime.time * 4 + item.cell.position.x)), 4);
        item.marker.material.opacity = 0.3 + pulse * 0.7;
        item.marker.scale.setScalar(0.18 + pulse * 0.24);
      }
      if (item.collect && item.mesh && item.glow) {
        // Things to collect float a little and catch the light, so a child's eye goes there first.
        item.mesh.position.y = item.rest + 0.03 + Math.sin(runtime.time * 2.2 + item.cell.position.x) * 0.03;
        item.glow.material.opacity = 0.34 + Math.sin(runtime.time * 3) * 0.14;
      }
      if (item.collect || item.hidden) {
        for (let i = 0; i < 4 && twinkle < TWINKLES; i++) {
          const phase = (runtime.time * 0.62 + i * 0.25 + item.cell.position.x * 0.13) % 1;
          const a = i * 1.57 + Math.floor(runtime.time * 0.62 + i * 0.25) * 2.4;
          position.set(item.cell.position.x + Math.cos(a) * 0.42, item.cell.position.y + 0.18 + phase * 0.42, item.cell.position.z + Math.sin(a) * 0.42);
          scale.setScalar(Math.sin(phase * Math.PI) * (item.collect ? 0.36 : 0.22) + 0.001);
          matrix.compose(position, camera.quaternion, scale);
          actors.stars.setMatrixAt(twinkle++, matrix);
        }
      }
    }
    actors.stars.count = twinkle;
    actors.stars.visible = twinkle > 0;
    if (twinkle) actors.stars.instanceMatrix.needsUpdate = true;

    const pose = chestPose(runtime.state.chapter);
    actors.festivalRoot.position.set(pose.x, pose.y, pose.z);
    actors.festivalRoot.rotation.y = pose.yaw;
    actors.festivalRoot.visible = nearby(actors.festivalRoot.position, 32);
    // A deposited item only fills its slot when it lands there, with a flash and a little jolt.
    ITEM_IDS.forEach(item => {
      const flying = runtime.effects.find(effect => effect.kind === "deposit" && effect.item === item);
      const landed = flying && runtime.time - flying.started > 0.62;
      if (flying && landed && !actors.pulsed.has(flying.id)) { actors.pulsed.add(flying.id); actors.festival.pulse(); }
      actors.festival.setSlot(item, flying ? (landed ? "glowing" : "empty") : runtime.state.chestItems.includes(item) ? "filled" : "empty");
    });
    actors.festival.setLidOpen(festivalRevealed(runtime) ? 1 : 0);
    actors.festival.setBlaze(runtime.finale === "blaze" ? 1 : runtime.finale === "open" ? 0.8 : festivalRevealed(runtime) ? 0.28 : 0);
    actors.festival.update(dt);
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
    runtime.state.seaChest.locks.forEach((open, i) => { if (actors.sea!.isLockOpen(i) !== open) actors.sea!.setLockOpen(i, open); });
    actors.sea.update(dt);
    const targetAngle = runtime.state.seaChest.open ? -1.6 : 0;
    actors.sea.lid.rotation.x = THREE.MathUtils.damp(actors.sea.lid.rotation.x, targetAngle, 4, dt);
  });

  return <primitive object={actors.group} dispose={null} />;
}
