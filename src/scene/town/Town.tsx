import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DISTRICT_IDS, type DistrictId } from "../../game/content/ids";
import { DISTRICTS, LAMP_POSITIONS, SOLIDS, WALK_AREAS } from "../../game/world/layout";
import type { GateId, WorldRuntime } from "../../game/world/types";
import { PartBuilder } from "../partBuilder";
import { flatMat, shadowMat } from "../materials";
import { textSprite } from "../textSprite";
import { props } from "../models/props";
import {
  PALETTE, birdGeometry, boatGeometry, districtDetails, fishGeometry, gateGeometry,
  gatePosts, groundGeometry, lampGeometry, libraryFurniture, libraryGeometry,
  solidGeometry, treeGeometry
} from "./builders";

interface MovingInstances { mesh: THREE.InstancedMesh; count: number }
interface Decoration { root: THREE.Group; threshold: number; district: DistrictId; scale: number }
interface TownScene {
  root: THREE.Group;
  districts: Record<DistrictId, THREE.Group>;
  gates: Record<GateId, THREE.Group>;
  gateProgress: Record<GateId, number>;
  decorations: Decoration[];
  library: { open: THREE.Mesh; closed: THREE.Mesh; label: THREE.Sprite };
  boats: THREE.Mesh[];
  pigeons: MovingInstances;
  gulls: MovingInstances;
  fish: MovingInstances;
  drops: MovingInstances;
  folk: MovingInstances;
  flags: MovingInstances;
  bunting: MovingInstances;
  dispose: () => void;
}

const CULL_RADIUS = 83;
const matrix = new THREE.Matrix4();
const transform = new THREE.Object3D();
const rgb = new THREE.Color();

function instanceAt(mesh: THREE.InstancedMesh, i: number, x: number, y: number, z: number, yaw = 0, scale = 1) {
  transform.position.set(x, y, z);
  transform.rotation.set(0, yaw, 0);
  transform.scale.setScalar(scale);
  transform.updateMatrix();
  mesh.setMatrixAt(i, transform.matrix);
}

/** Scenery and collision consume the same footprints; animation reads mutable runtime. */
function makeTown(runtime: WorldRuntime): TownScene {
  const root = new THREE.Group();
  root.name = "Treasure Traders town";
  const ownedGeometries = new Set<THREE.BufferGeometry>();
  const ownedMaterials = new Set<THREE.Material>();
  const mesh = (geometry: THREE.BufferGeometry, parent: THREE.Object3D = root) => {
    ownedGeometries.add(geometry);
    const m = new THREE.Mesh(geometry, flatMat());
    parent.add(m);
    return m;
  };
  const instances = (geometry: THREE.BufferGeometry, count: number, parent: THREE.Object3D = root): MovingInstances => {
    ownedGeometries.add(geometry);
    const m = new THREE.InstancedMesh(geometry, flatMat(), count);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Dynamic instance bounds otherwise retain the first frame's positions.
    m.frustumCulled = false;
    parent.add(m);
    return { mesh: m, count };
  };
  const districts = {} as TownScene["districts"];
  for (const id of DISTRICT_IDS) {
    const group = new THREE.Group();
    group.name = `district:${id}`;
    root.add(group);
    districts[id] = group;
    mesh(groundGeometry(id, WALK_AREAS), group);
    mesh(solidGeometry(id, SOLIDS), group);
    mesh(districtDetails(id), group);
  }
  const bench = props.bench();
  bench.position.set(-10, 0.035, 4);
  bench.scale.set(2.4, 1.33, 2.4);
  districts.square.add(bench);
  const easel = props.easel();
  easel.position.set(-10, 0.035, 32);
  easel.scale.set(1.4, 1.05, 1.4);
  districts.harbor.add(easel);

  // River is only visual: there is no corresponding walk rectangle.
  const waterGeometry = new THREE.PlaneGeometry(170, 76, 1, 1);
  const waterMaterial = new THREE.MeshLambertMaterial({ color: "#77bdc8" });
  ownedMaterials.add(waterMaterial); ownedGeometries.add(waterGeometry);
  const water = new THREE.Mesh(waterGeometry, waterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.28, 55.7);
  root.add(water);

  // Low green shoulders make the exact walking boundary legible without walls.
  const shoulder = new PartBuilder(0);
  // Landscape is deliberately lower than the paving and never enters WALK_AREAS.
  // It grounds the roadside trees while leaving the river channel clear.
  shoulder.box(170, 0.35, 85.7, 0, -0.61, -25.15, "#a5c886");
  shoulder.box(57, 0.35, 11, 3.5, -0.61, 33.5, "#a5c886");
  for (const a of WALK_AREAS.filter(a => !a.id.includes("bridge") && a.id !== "pier" && a.id !== "library")) {
    const grass = a.district === "festival" ? "#8fba77" : "#a5c886";
    shoulder.box(a.hx * 2 + 1.2, 0.2, a.hz * 2 + 1.2, a.x, a.y - 0.46, a.z, grass);
  }
  const landscape = mesh(shoulder.build());
  landscape.name = "decorative nonwalkable grass";

  const tree = treeGeometry(), lamp = lampGeometry();
  const trees: Record<DistrictId, [number, number][]> = {
    square: [[-19,-13],[-19,12],[19,-14],[18.5,13],[-12,-19],[12,-19]],
    market: [[24,-14],[39,-14],[54,-14],[54,14],[39,14],[24,14]],
    school: [[-16,-27],[16,-27],[16,-43],[-28,-46],[-28,-36],[16,-55]],
    harbor: [[-18,32],[-15,38],[23,38]],
    festival: [[-68,-14],[-68,14],[-57,-20],[-42,-20],[-57,20],[-42,20],[-27,15]]
  };
  for (const id of DISTRICT_IDS) {
    const t = instances(tree, trees[id].length, districts[id]);
    trees[id].forEach(([x,z], i) => instanceAt(t.mesh, i, x, -0.1, z, i * 1.7, 0.85 + (i % 3) * 0.15));
    const lamps = instances(lamp, LAMP_POSITIONS[id].length, districts[id]);
    LAMP_POSITIONS[id].forEach((position, i) => instanceAt(lamps.mesh, i, position.x, 0, position.z));
  }

  mesh(gatePosts());
  const gates = {} as TownScene["gates"];
  const gateProgress = {} as TownScene["gateProgress"];
  for (const id of ["cart", "school", "bridge", "arch"] as const) {
    const group = new THREE.Group();
    gates[id] = group;
    root.add(group);
    const g = gateGeometry(id);
    if (id === "school") g.translate(4.2, 0, 0);
    mesh(g, group);
    if (id === "cart") group.position.set(18, 0, 0);
    if (id === "school") group.position.set(-4.2, 0, -22);
    if (id === "bridge") group.position.set(0, 0.12, 17.2);
    if (id === "arch") group.position.set(-22, 0, 0);
    gateProgress[id] = runtime.state.gates[id] ? 1 : 0;
  }
  const comingSoon = textSprite("Coming soon!", { height: 0.52, color: "#8c5038", background: "#fff1d9" });
  // Keep the billboard clear of the solid sign plate from either approach.
  comingSoon.position.set(0, 2.3, 0);
  gates.arch.add(comingSoon);
  ownedMaterials.add(comingSoon.material);

  const closed = mesh(libraryGeometry(SOLIDS, false), districts.school);
  const open = mesh(libraryGeometry(SOLIDS, true), districts.school);
  mesh(libraryFurniture(SOLIDS), districts.school);

  const decorations: Decoration[] = [];
  const decoration = (threshold: number, district: DistrictId, x: number, z: number) => {
    const group = new THREE.Group(); group.position.set(x, 0, z);
    districts[district].add(group);
    const d = { root: group, threshold, district, scale: runtime.state.chestCount >= threshold ? 1 : 0 };
    decorations.push(d);
    return group;
  };
  const buntingRoot = decoration(2, "square", 0, 0);
  const flagBuilder = new PartBuilder(0);
  flagBuilder.add(new THREE.ConeGeometry(0.4, 0.75, 3), PALETTE.gold, [0, -0.3, 0], [0, 0, Math.PI], [1,1,0.08]);
  const bunting = instances(flagBuilder.build(), 32, buntingRoot);
  for (let i = 0; i < 32; i++) {
    const line = Math.floor(i / 8), offset = (i % 8) - 3.5;
    const x = line < 2 ? offset * 3.5 : (line - 2.5) * 26;
    const z = line < 2 ? (line - 0.5) * 26 : offset * 3.5;
    instanceAt(bunting.mesh, i, x, 4.5 - Math.sin((i % 8) / 7 * Math.PI), z, line < 2 ? 0 : Math.PI / 2);
    bunting.mesh.setColorAt(i, rgb.set(["#ef9b84", "#f4d576", "#83b9c8", "#9ebc7e"][i % 4]));
  }
  const wire = new PartBuilder(0);
  for (const z of [-13, 13]) wire.box(27, 0.035, 0.035, 0, 4.4, z, "#9a8263");
  for (const x of [-13, 13]) wire.box(0.035, 0.035, 27, x, 4.4, 0, "#9a8263");
  mesh(wire.build(), buntingRoot);

  const lanternBuilder = new PartBuilder(0);
  lanternBuilder.sphere(0.34, 0, 0, 0, "#f6c876", [1,1.25,1], 8);
  lanternBuilder.cyl(0.16, 0.16, 0.12, 0, 0.4, 0, PALETTE.darkWood, 8);
  lanternBuilder.cyl(0.16, 0.16, 0.12, 0, -0.5, 0, PALETTE.darkWood, 8);
  const lanternGeo = lanternBuilder.build();
  const marketDec = decoration(4, "market", 0, 0);
  const marketLanterns = instances(lanternGeo, 12, marketDec);
  for (let i = 0; i < 12; i++) instanceAt(marketLanterns.mesh, i, 24 + i * 2.7, 4, (i % 2 ? -1 : 1) * 4.5);
  const schoolDec = decoration(6, "school", 0, 0);
  const flagGeo = new PartBuilder(0);
  flagGeo.box(1.7, 1, 0.04, 0.85, 0, 0, PALETTE.red);
  const flags = instances(flagGeo.build(), 6, schoolDec);
  const poles = new PartBuilder();
  for (let i = 0; i < 6; i++) poles.cyl(0.045, 0.045, 2.5, -9 + i * 4, 5.5, -52, PALETTE.darkWood, 6);
  mesh(poles.build(), schoolDec);
  const harborDec = decoration(8, "harbor", 0, 0);
  const balloonBuilder = new PartBuilder(0);
  balloonBuilder.sphere(0.48, 0, 0, 0, "#f5ac9b", [1,1.25,1], 8);
  balloonBuilder.cyl(0.012, 0.012, 2, 0, -2.5, 0, "#d4b58a", 4);
  const balloons = instances(balloonBuilder.build(), 9, harborDec);
  for (let i = 0; i < 9; i++) {
    instanceAt(balloons.mesh, i, -14 + Math.floor(i / 3) * 17 + (i % 3 - 1) * 0.8, 3.1 + (i % 3) * 0.6, 31.3);
    balloons.mesh.setColorAt(i, rgb.set(["#ef9d9d", "#b1c977", "#9cc8e3"][i % 3]));
  }
  const archDec = decoration(8, "festival", -22, 0);
  const archLights = instances(lanternGeo, 7, archDec);
  for (let i = 0; i < 7; i++) instanceAt(archLights.mesh, i, 0.5, 4.3, -3.6 + i * 1.2, 0, 0.65);
  const festivalDec = decoration(9, "festival", 0, 0);
  const festivalLights = instances(lanternGeo, 28, festivalDec);
  for (let i = 0; i < 28; i++) instanceAt(festivalLights.mesh, i, -62 + (i % 14) * 1.9, 4.6 - Math.sin((i % 14) / 13 * Math.PI), Math.floor(i / 14) ? 15 : -15);
  // Pop from the district itself, with the already-authored world coordinates preserved.
  for (const d of decorations) {
    if (d.root.position.x !== 0 || d.root.position.z !== 0) continue;
    const center = DISTRICTS[d.district];
    d.root.position.set(center.x, 0, center.z);
    for (const child of d.root.children) child.position.set(-center.x, 0, -center.z);
  }

  const boats = [mesh(boatGeometry(), districts.harbor), mesh(boatGeometry(), districts.harbor)];
  boats[0].position.set(19, -0.12, 40); boats[0].rotation.y = 0.3;
  boats[1].position.set(-8, -0.12, 45); boats[1].rotation.y = -0.45; boats[1].scale.setScalar(0.65);
  const pigeons = instances(birdGeometry(), 5, districts.square);
  const gulls = instances(birdGeometry(true), 3, districts.harbor);
  const fish = instances(fishGeometry(), 3, districts.harbor);
  const dropGeo = new PartBuilder(0);
  dropGeo.sphere(0.07, 0, 0, 0, "#bbebef", [1,1.7,1], 5);
  const drops = instances(dropGeo.build(), 32, districts.square);

  // Six anonymous residents share one low-poly mesh; interactive cast use art-kit rigs.
  const folkBuilder = new PartBuilder();
  folkBuilder.cyl(0.2, 0.24, 0.6, 0, 0.48, 0, "#e9b78a", 7);
  folkBuilder.sphere(0.22, 0, 1.29, 0, "#f1d0ac", [1,1.1,1], 8);
  folkBuilder.sphere(0.23, 0, 1.4, -0.03, "#6e5d4d", [1,0.7,1], 7);
  folkBuilder.box(0.14, 0.48, 0.15, -0.11, 0, 0, "#607c86");
  folkBuilder.box(0.14, 0.48, 0.15, 0.11, 0, 0, "#607c86");
  const folk = instances(folkBuilder.build(), 6);
  for (let i = 0; i < 6; i++) folk.mesh.setColorAt(i, rgb.set(["#d6dfb5", "#e7c2be", "#b8d7e1"][i % 3]));

  // Single instanced batch for scenery contact shadows.
  const shadowGeo = new THREE.PlaneGeometry(4.5, 4.5);
  ownedGeometries.add(shadowGeo);
  const shadows = new THREE.InstancedMesh(shadowGeo, shadowMat(), DISTRICT_IDS.reduce((n,id) => n + trees[id].length, 0));
  let shadowIndex = 0;
  for (const id of DISTRICT_IDS) for (const [x,z] of trees[id]) {
    matrix.makeRotationX(-Math.PI / 2); matrix.setPosition(x, -0.245, z);
    shadows.setMatrixAt(shadowIndex++, matrix);
  }
  root.add(shadows);

  const signs: [string, number, number, number, DistrictId][] = [
    ["VILLAGE SQUARE", 0, 3.5, -13, "square"], ["STATIONERY MARKET", 38, 4.5, -9, "market"],
    ["SCHOOLHOUSE", 1, 5, -48.5, "school"], ["LIBRARY", -19, 4.9, -37, "school"],
    ["RIVERSIDE & HARBOR", 6, 3.8, 32, "harbor"], ["FESTIVAL GROUNDS", -57, 5.8, 0, "festival"]
  ];
  let libraryLabel!: THREE.Sprite;
  for (const [text,x,y,z,id] of signs) {
    const s = textSprite(text, { height: 0.72, color: "#5c5446", background: "#fff1d9", fontPx: 38 });
    s.position.set(x,y,z); districts[id].add(s);
    if (text === "LIBRARY") libraryLabel = s;
    ownedMaterials.add(s.material);
  }
  const dispose = () => {
    for (const g of ownedGeometries) g.dispose();
    for (const m of ownedMaterials) {
      if (m instanceof THREE.SpriteMaterial) m.map?.dispose();
      m.dispose();
    }
  };
  return { root, districts, gates, gateProgress, decorations, library: {open, closed, label: libraryLabel}, boats, pigeons, gulls, fish, drops, folk, flags, bunting, dispose };
}

export function Town({ runtime }: { runtime: WorldRuntime }) {
  const town = useMemo(() => makeTown(runtime), [runtime]);
  useEffect(() => () => town.dispose(), [town]);
  useFrame(({ camera }, delta) => {
    const t = runtime.time;
    const insideLibrary = runtime.player.x > -26.4 && runtime.player.x < -11.5 && runtime.player.z > -47.5 && runtime.player.z < -36.5;
    town.library.open.visible = insideLibrary;
    town.library.closed.visible = !insideLibrary;
    town.library.label.visible = !insideLibrary;
    for (const id of DISTRICT_IDS) {
      const p = DISTRICTS[id];
      town.districts[id].visible = Math.hypot(camera.position.x - p.x, camera.position.z - p.z) < CULL_RADIUS;
    }
    const smooth = 1 - Math.exp(-delta * 4);
    for (const id of ["cart", "school", "bridge", "arch"] as const) {
      const target = runtime.state.gates[id] ? 1 : 0;
      const p = town.gateProgress[id] += (target - town.gateProgress[id]) * smooth;
      const g = town.gates[id];
      if (id === "bridge") g.rotation.x = -(1 - p) * 1.37;
      if (id === "school") g.rotation.y = -p * Math.PI / 2;
      if (id === "cart") { g.position.set(18 + p * 4, p * 0.35, p * 9); g.rotation.x = 0.15 * (1-p); g.scale.setScalar(1 - Math.max(0, p - 0.7) / 0.3); }
      if (id === "arch") { g.position.y = -p * 2; g.scale.y = 1 - p * 0.95; }
      g.visible = (id !== "cart" && id !== "arch") || p < 0.995;
    }
    for (const d of town.decorations) {
      const target = runtime.state.chestCount >= d.threshold ? 1 : 0;
      d.scale += (target - d.scale) * (1 - Math.exp(-delta * 8));
      d.root.visible = d.scale > 0.005;
      // The brief little overshoot makes newly earned decorations feel placed.
      d.root.scale.setScalar(Math.max(0.001, d.scale + Math.sin(d.scale * Math.PI) * 0.2));
    }
    for (let i = 0; i < town.pigeons.count; i++) {
      const a = t * 0.16 + i * 1.7;
      instanceAt(town.pigeons.mesh, i, Math.cos(a) * (4 + i * 0.45), Math.max(0, Math.sin(t * 3 + i)) * 0.05, 4 + Math.sin(a) * 2, -a);
    }
    town.pigeons.mesh.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < town.gulls.count; i++) {
      const a = t * 0.23 + i * 2.1;
      instanceAt(town.gulls.mesh, i, 7 + Math.sin(a) * 14, 5 + Math.sin(a * 2 + i), 40 + Math.cos(a) * 9, a);
    }
    town.gulls.mesh.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < town.fish.count; i++) {
      const phase = (t * 0.2 + i / 3) % 1;
      const y = phase < 0.23 ? Math.sin(phase / 0.23 * Math.PI) * 1.6 - 0.3 : -1;
      instanceAt(town.fish.mesh, i, -8 + i * 13 + phase * 1.8, y, 41 + i * 2, i * 2);
    }
    town.fish.mesh.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < town.drops.count; i++) {
      const phase = (t * 0.8 + i / town.drops.count) % 1;
      const a = i * 2.4;
      instanceAt(town.drops.mesh, i, Math.cos(a) * phase * 1.6, 2.55 + phase * 1.7 - phase * phase * 3.5, Math.sin(a) * phase * 1.6, 0, 0.75);
    }
    town.drops.mesh.instanceMatrix.needsUpdate = true;
    town.boats.forEach((boat,i) => { boat.position.y = -0.08 + Math.sin(t * 1.3 + i * 2) * 0.08; boat.rotation.z = Math.sin(t * 0.8 + i) * 0.035; });
    const loops = [[-7,10,2.5,1.5], [6,-10,2.3,1], [37,0,3,1.3], [-4,-34,2,1], [16,33,1.5,1], [-47,4,3,1.4]];
    for (let i = 0; i < town.folk.count; i++) {
      const [cx,cz,rx,rz] = loops[i], a = t * 0.22 + i * 1.9;
      const gate: GateId | undefined = i < 2 ? undefined : (["cart", "school", "bridge", "arch"] as const)[i-2];
      const visible = !gate || runtime.state.gates[gate];
      const p = DISTRICTS[DISTRICT_IDS[Math.max(0, i - 1)]];
      const nearby = Math.hypot(camera.position.x - p.x, camera.position.z - p.z) < CULL_RADIUS;
      instanceAt(town.folk.mesh, i, cx + Math.cos(a) * rx, Math.abs(Math.sin(t * 4 + i)) * 0.025, cz + Math.sin(a) * rz, Math.atan2(-Math.sin(a) * rx, Math.cos(a) * rz), visible && nearby ? 1 : 0);
    }
    town.folk.mesh.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < town.flags.count; i++) instanceAt(town.flags.mesh, i, -9 + i * 4, 6.5, -52, Math.sin(t * 2 + i) * 0.16);
    town.flags.mesh.instanceMatrix.needsUpdate = true;
    town.bunting.mesh.rotation.y = Math.sin(t * 0.8) * 0.005;
  });
  return <primitive object={town.root} dispose={null} />;
}
