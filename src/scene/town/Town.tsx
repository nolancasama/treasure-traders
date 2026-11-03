import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DISTRICT_IDS, type DistrictId } from "../../game/content/ids";
import { decorationLevel } from "../../game/runtime";
import { DISTRICTS, HOUSES, LAMP_POSITIONS, SOLIDS, TREES } from "../../game/world/layout";
import type { GateId, WorldRuntime } from "../../game/world/types";
import { PartBuilder } from "../partBuilder";
import { flatMat, glowTexture, sceneryMat, sceneUniforms, shadowMat, softBoxMat } from "../materials";
import { props } from "../models/props";
import { createAmbient, type Ambient } from "./ambient";
import { boatGeometry, gateGeometry, gatePosts, libraryFurniture, libraryGeometry, PALETTE, rowboatGeometry, schoolGateWheelGeometry } from "./builders";
import { createDecorations, type Decorations } from "./decorations";
import { districtParts, forestGeometry } from "./districts";
import { GRASS_Y, landGeometry, pavingGeometry, waterGeometry, waterMaterial } from "./ground";
import { SignBatch, signMat } from "./signs";

interface TownScene {
  root: THREE.Group;
  districts: Record<DistrictId, THREE.Group>;
  gates: Record<GateId, THREE.Group>;
  gateProgress: Record<GateId, number>;
  schoolGateWheels: THREE.Mesh[];
  library: { open: THREE.Mesh; closed: THREE.Mesh; label: THREE.Mesh };
  boats: THREE.Object3D[];
  water: THREE.ShaderMaterial;
  bulbs: THREE.MeshLambertMaterial;
  lampGlow: THREE.Points;
  decorations: Decorations;
  ambient: Ambient;
  dispose: () => void;
}

const CULL_RADIUS = 90;
const noRaycast = () => {};
/** Raised, the bridge's leaf stays low enough that the follow camera clears it over the whole square. */
const BRIDGE_RAISED = 0.5;
const SHADOW_DROP = { x: 0.26, z: -0.22 };
const GROUND_ORDER = 2;

/** Scenery and collision consume the same footprints; animation reads mutable runtime. */
function makeTown(runtime: WorldRuntime): TownScene {
  const root = new THREE.Group();
  root.name = "Treasure Traders town";
  const ownedGeometries = new Set<THREE.BufferGeometry>();
  const ownedMaterials = new Set<THREE.Material>();
  const mesh = (geometry: THREE.BufferGeometry, parent: THREE.Object3D = root, material: THREE.Material = flatMat()) => {
    ownedGeometries.add(geometry);
    const m = new THREE.Mesh(geometry, material);
    parent.add(m);
    return m;
  };
  const districts = {} as TownScene["districts"];
  for (const id of DISTRICT_IDS) {
    const group = new THREE.Group();
    group.name = `district:${id}`;
    root.add(group);
    districts[id] = group;
    const parts = districtParts(id);
    // Ground draws after what stands on it, so hidden ground is never shaded.
    mesh(pavingGeometry(id), group).renderOrder = GROUND_ORDER;
    for (const chunk of parts.low) mesh(chunk, group);
    for (const chunk of parts.tall) mesh(chunk, group, sceneryMat());
    mesh(parts.signs, group, signMat());
  }
  // The valley: paving and collision agree exactly; this is everything around them.
  const land = mesh(landGeometry());
  land.name = "decorative nonwalkable land";
  land.renderOrder = GROUND_ORDER + 1;
  for (const chunk of forestGeometry()) mesh(chunk).raycast = noRaycast;
  const water = waterMaterial();
  ownedMaterials.add(water);
  const waterMesh = mesh(waterGeometry(), root, water);
  waterMesh.raycast = noRaycast;
  waterMesh.renderOrder = GROUND_ORDER + 2;
  const easel = props.easel();
  easel.position.set(-10, 0, 32);
  easel.rotation.y = Math.PI / 2;
  easel.scale.set(1.4, 1.05, 1.4);
  districts.harbor.add(easel);

  mesh(gatePosts(), root, sceneryMat());
  const rootSigns = new SignBatch().add("arch", -21.82, 4.86, 0, 0.92, Math.PI / 2).add("school", 0, 3.76, -21.86, 0.7);
  mesh(rootSigns.build(), root, signMat());
  const schoolBoard = new PartBuilder(0.5, true);
  schoolBoard.box(SignBatch.width("school", 0.7) + 0.2, 0.84, 0.09, 0, 3.34, -21.92, PALETTE.darkWood);
  mesh(schoolBoard.build(), root, sceneryMat());
  const gates = {} as TownScene["gates"];
  const gateProgress = {} as TownScene["gateProgress"];
  const schoolGateWheels: THREE.Mesh[] = [];
  for (const id of ["cart", "school", "bridge", "arch"] as const) {
    const group = new THREE.Group();
    gates[id] = group;
    root.add(group);
    const g = gateGeometry(id);
    mesh(g, group, sceneryMat());
    if (id === "school") {
      // Independent roller meshes rotate as the entire panel slides sideways.
      const rollerGeometry = schoolGateWheelGeometry();
      ownedGeometries.add(rollerGeometry);
      for (const x of [-3.2, 3.2]) {
        const roller = new THREE.Mesh(rollerGeometry, sceneryMat());
        roller.position.set(x, 0.255, 0.18);
        roller.raycast = noRaycast;
        group.add(roller);
        schoolGateWheels.push(roller);
      }
    }
    if (id === "cart") group.position.set(18, 0, 0);
    if (id === "school") group.position.set(0, 0, -22);
    if (id === "bridge") group.position.set(0, 0.12, 17.2);
    if (id === "arch") group.position.set(-22, 0, 0);
    gateProgress[id] = runtime.state.gates[id] ? 1 : 0;
  }
  // The rope's board turns to face the approach, so its lettering can actually be read.
  const soonYaw = 0.85, soonWidth = SignBatch.width("soon", 0.62) + 0.16;
  const soonBoard = new PartBuilder(0.3, true);
  soonBoard.boxAt(soonWidth, 0.78, 0.07, [0, 1, 0], [0, soonYaw, 0], PALETTE.darkWood);
  mesh(soonBoard.build(), gates.arch, sceneryMat());
  mesh(new SignBatch().add("soon", Math.sin(soonYaw) * 0.05, 1, Math.cos(soonYaw) * 0.05, 0.62, soonYaw).build(), gates.arch, signMat());

  const closed = mesh(libraryGeometry(SOLIDS, false), districts.school, sceneryMat());
  const open = mesh(libraryGeometry(SOLIDS, true), districts.school, sceneryMat());
  mesh(libraryFurniture(SOLIDS), districts.school);
  const label = mesh(new SignBatch().add("library", -19, 2.98, -36.7, 0.7).build(), districts.school, signMat());

  // Lamp bulbs share one emissive material, lit as the festival evening comes.
  const lampPoints = DISTRICT_IDS.flatMap(id => LAMP_POSITIONS[id]);
  const bulbGeometry = new THREE.BoxGeometry(0.42, 0.52, 0.42);
  ownedGeometries.add(bulbGeometry);
  const bulbs = new THREE.MeshLambertMaterial({ color: "#ffeeb0", emissive: "#ffb040", emissiveIntensity: 0 });
  ownedMaterials.add(bulbs);
  const bulbMesh = new THREE.InstancedMesh(bulbGeometry, bulbs, lampPoints.length);
  const scratch = new THREE.Matrix4();
  lampPoints.forEach((p, i) => bulbMesh.setMatrixAt(i, scratch.makeTranslation(p.x, 3.05, p.z)));
  bulbMesh.raycast = noRaycast;
  root.add(bulbMesh);
  const glowGeometry = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(lampPoints.flatMap(p => [p.x, 3.05, p.z]), 3));
  ownedGeometries.add(glowGeometry);
  const glowMaterial = new THREE.PointsMaterial({ map: glowTexture(), color: "#ffc070", size: 3, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false });
  ownedMaterials.add(glowMaterial);
  const lampGlow = new THREE.Points(glowGeometry, glowMaterial);
  lampGlow.raycast = noRaycast;
  lampGlow.visible = false;
  root.add(lampGlow);

  const boats: THREE.Object3D[] = [];
  const hull = mesh(boatGeometry(PALETTE.gold, PALETTE.blue), districts.harbor, sceneryMat());
  hull.position.set(19, -0.14, 42); hull.rotation.y = 0.3;
  const yacht = mesh(boatGeometry("#ff8fa8", "#e8604c"), districts.harbor, sceneryMat());
  yacht.position.set(-2.4, -0.14, 42); yacht.rotation.y = -0.45; yacht.scale.setScalar(0.82);
  const skiff = mesh(rowboatGeometry(), districts.harbor);
  skiff.position.set(-8, -0.16, 45.5); skiff.rotation.y = 0.9;
  boats.push(hull, yacht, skiff);
  // Mooring lines from the bank, slack enough to hide the boats' gentle bobbing.
  const moorings = new PartBuilder(0, true);
  moorings.wire([17, 0.7, 37.4], [19, 0.75, 39.6], 0.5, 5, "#e4c58f", 0.04);
  moorings.wire([5.05, 0.5, 40.5], [-1.3, 0.7, 41], 0.5, 6, "#e4c58f", 0.04);
  moorings.wire([5.05, 0.5, 46], [-7.2, 0.2, 45.4], 0.6, 8, "#e4c58f", 0.04);
  mesh(moorings.build(), districts.harbor, flatMat());

  // Soft contact shadows, slid away from the low sun: real depth for two draw calls.
  const shadowPlane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  ownedGeometries.add(shadowPlane);
  const rounds: [number, number, number, number][] = [];
  for (const id of DISTRICT_IDS) for (const t of TREES[id]) rounds.push([t.x + SHADOW_DROP.x * 4 * t.s, t.z + SHADOW_DROP.z * 4 * t.s, 5.4 * t.s, GRASS_Y + 0.012]);
  for (const s of SOLIDS) if (s.kind === "circle" && !s.id.startsWith("lamp-")) rounds.push([s.x + SHADOW_DROP.x, s.z + SHADOW_DROP.z, (s.r + 0.5) * 2.6, 0.012]);
  for (const id of DISTRICT_IDS) for (const p of LAMP_POSITIONS[id]) rounds.push([p.x + SHADOW_DROP.x * 2, p.z + SHADOW_DROP.z * 2, 1.7, 0.012]);
  const roundShadows = new THREE.InstancedMesh(shadowPlane, shadowMat(), rounds.length);
  rounds.forEach(([x, z, size, y], i) => roundShadows.setMatrixAt(i, scratch.makeScale(size, 1, size).setPosition(x, y, z)));
  roundShadows.renderOrder = 1;
  roundShadows.raycast = noRaycast;
  root.add(roundShadows);
  const rects: [number, number, number, number, number][] = [];
  for (const h of HOUSES) rects.push([h.x + SHADOW_DROP.x * 7, h.z + SHADOW_DROP.z * 7, h.w + 2, h.d + 2, GRASS_Y + 0.012]);
  for (const s of SOLIDS) if (s.kind === "box" && !s.id.includes("wall") && !s.id.includes("east-") && !s.id.startsWith("library-") && s.id !== "grandma-bench" && s.id !== "festival-chest-base") {
    const drop = s.height > 2 ? 3 : 1.4;
    rects.push([s.x + SHADOW_DROP.x * drop, s.z + SHADOW_DROP.z * drop, s.hx * 2 + 1, s.hz * 2 + 1, 0.012]);
  }
  rects.push([-19 + SHADOW_DROP.x * 6, -42 + SHADOW_DROP.z * 6, 16, 12, GRASS_Y + 0.012]);
  const rectShadows = new THREE.InstancedMesh(shadowPlane, softBoxMat(), rects.length);
  rects.forEach(([x, z, w, d, y], i) => rectShadows.setMatrixAt(i, scratch.makeScale(w / 0.64, 1, d / 0.64).setPosition(x, y, z)));
  rectShadows.renderOrder = 1;
  rectShadows.raycast = noRaycast;
  root.add(rectShadows);

  const decorations = createDecorations(districts);
  const ambient = createAmbient(root, districts);
  const dispose = () => {
    decorations.dispose();
    ambient.dispose();
    roundShadows.dispose(); rectShadows.dispose(); bulbMesh.dispose();
    for (const g of ownedGeometries) g.dispose();
    for (const m of ownedMaterials) m.dispose();
  };
  return { root, districts, gates, gateProgress, schoolGateWheels, library: { open, closed, label }, boats, water, bulbs, lampGlow, decorations, ambient, dispose };
}

const nearCamera = new Map<DistrictId, boolean>();

export function Town({ runtime, mood, reviewGateProgress }: { runtime: WorldRuntime; mood: () => { gold: number; dusk: number }; reviewGateProgress?: Partial<Record<GateId, number>> }) {
  const town = useMemo(() => makeTown(runtime), [runtime]);
  useEffect(() => {
    runtime.gateProgress = town.gateProgress;
    return () => { if (runtime.gateProgress === town.gateProgress) runtime.gateProgress = null; };
  }, [runtime, town]);
  useEffect(() => () => town.dispose(), [town]);
  useFrame(({ camera }, delta) => {
    const t = runtime.time;
    sceneUniforms.ttTime.value = t;
    const { dusk } = mood();
    const insideLibrary = runtime.player.x > -26.4 && runtime.player.x < -11.5 && runtime.player.z > -47.5 && runtime.player.z < -36.5;
    town.library.open.visible = insideLibrary;
    town.library.closed.visible = !insideLibrary;
    town.library.label.visible = !insideLibrary;
    for (const id of DISTRICT_IDS) {
      const p = DISTRICTS[id], close = Math.hypot(camera.position.x - p.x, camera.position.z - p.z) < CULL_RADIUS;
      town.districts[id].visible = close;
      nearCamera.set(id, close);
    }
    const smooth = 1 - Math.exp(-delta * 4);
    for (const id of ["cart", "school", "bridge", "arch"] as const) {
      const target = runtime.state.gates[id] ? 1 : 0;
      const next = town.gateProgress[id] + (target - town.gateProgress[id]) * smooth;
      // Exponential motion needs an exact endpoint for collision to open.
      const p = town.gateProgress[id] = reviewGateProgress?.[id] ?? (Math.abs(target - next) < 0.001 ? target : next);
      const g = town.gates[id];
      if (id === "bridge") g.rotation.x = -(1 - p) * BRIDGE_RAISED;
      if (id === "school") {
        // Move completely clear of the two schoolhouse posts before settling.
        const displacement = 8.7 * p;
        g.position.x = displacement;
        g.rotation.y = 0;
        for (const wheel of town.schoolGateWheels) wheel.rotation.z = -displacement / 0.25;
      }
      if (id === "cart") { g.position.set(18 + p * 4, p * 0.35, p * 9); g.rotation.x = 0.15 * (1 - p); g.scale.setScalar(1 - Math.max(0, p - 0.7) / 0.3); }
      if (id === "arch") { g.position.y = -p * 2; g.scale.y = 1 - p * 0.95; }
      g.visible = (id !== "cart" && id !== "arch") || p < 0.995;
    }
    town.decorations.update(decorationLevel(runtime), dusk, delta);
    town.ambient.update(runtime, camera, delta, id => nearCamera.get(id) ?? true);
    town.boats.forEach((boat, i) => {
      boat.position.y = -0.14 + Math.sin(t * 1.1 + i * 2.1) * 0.07;
      boat.rotation.z = Math.sin(t * 0.8 + i) * 0.035;
      boat.rotation.x = Math.sin(t * 0.63 + i * 1.7) * 0.022;
    });
    town.water.uniforms.time.value = t;
    town.water.uniforms.deep.value.set("#3ea6c7").lerp(tmpColor.set("#2a3f78"), dusk);
    town.water.uniforms.shallow.value.set("#7fdcd6").lerp(tmpColor.set("#7a6fa6"), dusk);
    town.bulbs.emissiveIntensity = dusk * 1.25;
    town.lampGlow.visible = dusk > 0.02;
    (town.lampGlow.material as THREE.PointsMaterial).opacity = dusk * 0.8;
  });
  return <primitive object={town.root} dispose={null} />;
}

const tmpColor = new THREE.Color();
