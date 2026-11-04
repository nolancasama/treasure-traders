import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { ITEM_IDS } from "../../game/content/ids";
import { findPath, isWalkable, moveCircle, OPEN, standY } from "../../game/world/collision";
import { CHEST_SCALE, chestPose, FINALE_CREW, SOLIDS, STAGE } from "../../game/world/layout";
import { CHEST_SLOTS, FestivalChest, festivalChestBaseGeometry, festivalChestLidGeometry, festivalChestShadowGeometry, FESTIVAL_CHEST_SHADOW_Y } from "./festivalChest";
import { itemGeometry, itemSize, plaqueGeometry } from "./items";
import { KiwiRig } from "./kiwi";
import { ALL_LOOK_IDS, buildCharacter, characterTriangles } from "./people";
import { props } from "./props";
import { SeaChest } from "./seaChest";

const tris = (g: THREE.BufferGeometry) => g.getAttribute("position").count / 3;

/** Expected real-world length range in metres (SPEC §9 proportions). */
const LENGTH: Record<string, [number, number]> = {
  pen: [0.12, 0.16],
  marker: [0.11, 0.15],
  ruler: [0.28, 0.32],
  stapler: [0.13, 0.17],
  calendar: [0.19, 0.24],
  notebook: [0.16, 0.2],
  eraser: [0.04, 0.07],
  pencil: [0.16, 0.19],
  pencilCase: [0.18, 0.24]
};

describe("stationery models", () => {
  for (const id of ITEM_IDS) {
    it(`${id} rests on the ground, is the right size and within budget`, () => {
      const g = itemGeometry(id);
      const box = g.boundingBox!;
      expect(Math.abs(box.min.y)).toBeLessThan(0.001);
      expect(Math.abs((box.min.x + box.max.x) / 2)).toBeLessThan(0.01);
      const len = itemSize(id).x;
      expect(len).toBeGreaterThanOrEqual(LENGTH[id][0]);
      expect(len).toBeLessThanOrEqual(LENGTH[id][1]);
      expect(tris(g)).toBeLessThan(1500);
      expect(g.attributes.color).toBeDefined();
    });
  }

  it("pen, marker and pencil differ in thickness so they never look alike", () => {
    const h = (id: "pen" | "marker" | "pencil") => itemSize(id).y;
    expect(h("marker")).toBeGreaterThan(h("pen") * 1.4);
    expect(h("pen")).toBeGreaterThan(h("pencil"));
  });

  it("plaques fit their square and silhouettes are flat", () => {
    for (const id of ITEM_IDS) {
      const g = plaqueGeometry(id, 0.2, { silhouette: "#888888" });
      const s = g.boundingBox!;
      expect(Math.max(s.max.x - s.min.x, s.max.y - s.min.y)).toBeLessThanOrEqual(0.2001);
      expect(s.max.z - s.min.z).toBeLessThan(0.02);
    }
  });
});

describe("chests", () => {
  it("the festival chest has nine slots in canonical order and fills them", () => {
    expect(CHEST_SLOTS.map((s) => s.item)).toEqual([...ITEM_IDS]);
    const c = new FestivalChest();
    c.setContents(["pen", "ruler"]);
    expect(c.slotState(0)).toBe("filled");
    expect(c.slotState(1)).toBe("empty");
    c.setSlot("marker", "glowing");
    expect(c.slotState(1)).toBe("glowing");
  });

  it("keeps its sole on either support while the lid opens and a deposit pulses", () => {
    const chest = new FestivalChest();
    const base = chest.group.children.find(child => child instanceof THREE.Mesh) as THREE.Mesh;
    chest.setScale(CHEST_SCALE);
    try {
      for (const chapter of [1, 5] as const) {
        const pose = chestPose(chapter);
        chest.group.position.set(pose.x, pose.y, pose.z);
        chest.group.rotation.y = pose.yaw;
        chest.setLidOpen(0);
        chest.update(0);
        chest.group.updateMatrixWorld(true);
        const baseAtRest = base.matrixWorld.clone();
        const slotAtRest = chest.slotWorld("pen");
        chest.setLidOpen(1);
        for (let frame = 0; frame < 180; frame++) {
          chest.update(1 / 60);
          chest.group.updateMatrixWorld(true);
          expect(base.matrixWorld.elements).toEqual(baseAtRest.elements);
        }
        expect(chest.lid.rotation.x).toBeCloseTo(-1.9, 3);
        expect(chest.slotWorld("pen").distanceTo(slotAtRest)).toBeLessThan(1e-8);
        chest.pulse();
        for (let frame = 0; frame < 60; frame++) {
          chest.update(1 / 60);
          chest.group.updateMatrixWorld(true);
          const bounds = new THREE.Box3().setFromObject(base);
          expect(bounds.min.y).toBeCloseTo(pose.y, 6);
        }
      }
    } finally {
      chest.group.traverse(child => { if (child instanceof THREE.Mesh) child.geometry.dispose(); });
      chest.dispose();
    }
  });

  it("fits its sole and raised contact shadow inside the square dais", () => {
    const dais = SOLIDS.find(solid => solid.id === "festival-chest-base")!;
    expect(dais.kind).toBe("box");
    if (dais.kind !== "box") return;
    const base = festivalChestBaseGeometry();
    const shadow = festivalChestShadowGeometry(CHEST_SCALE);
    try {
      base.computeBoundingBox();
      shadow.computeBoundingBox();
      const vertices = base.getAttribute("position");
      expect(base.boundingBox!.min.y).toBeCloseTo(0, 6);
      for (let vertex = 0; vertex < vertices.count; vertex++) {
        if (Math.abs(vertices.getY(vertex)) > 1e-6) continue;
        expect(Math.abs(vertices.getX(vertex)) * CHEST_SCALE).toBeLessThanOrEqual(dais.hx);
        expect(Math.abs(vertices.getZ(vertex)) * CHEST_SCALE).toBeLessThanOrEqual(dais.hz);
      }
      expect(shadow.boundingBox!.max.x).toBeLessThan(dais.hx);
      expect(shadow.boundingBox!.max.z).toBeLessThan(dais.hz);
      expect(FESTIVAL_CHEST_SHADOW_Y).toBeGreaterThan(0.002);
      expect(chestPose(1).y).toBe(dais.y + dais.height);
    } finally {
      base.dispose();
      shadow.dispose();
    }
  });

  it("centres the stage chest between the drums with clear scenery and walking routes", () => {
    const pose = chestPose(5);
    expect(pose).toEqual({ x: -63, y: 0.6, z: 0, yaw: 0 });
    expect(chestPose(1)).toEqual({ x: 0, y: 0.15, z: -8, yaw: 0 });
    const chest = SOLIDS.find(s => s.id === "stage-chest")!;
    expect(chest).toMatchObject({ x: pose.x, z: pose.z, y: pose.y, yaw: pose.yaw });
    const base = festivalChestBaseGeometry(), lid = festivalChestLidGeometry();
    const root = new THREE.Matrix4().makeScale(CHEST_SCALE, CHEST_SCALE, CHEST_SCALE).setPosition(pose.x, pose.y, pose.z);
    try {
      base.computeBoundingBox(); lid.computeBoundingBox();
      for (const angle of [0, 0.95, 1.9]) {
        const lidMatrix = root.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.9, -0.45)).multiply(new THREE.Matrix4().makeRotationX(-angle));
        const bounds = base.boundingBox!.clone().applyMatrix4(root).union(lid.boundingBox!.clone().applyMatrix4(lidMatrix));
        for (const prop of SOLIDS.filter(s => s.id === "stage-back-edge" || s.id.startsWith("stage-drum-") || s.id.startsWith("stage-curtain-"))) {
          if (prop.kind !== "box") throw new Error("Expected stage box");
          const obstacle = new THREE.Box3(new THREE.Vector3(prop.x - prop.hx, prop.y, prop.z - prop.hz), new THREE.Vector3(prop.x + prop.hx, prop.y + prop.height, prop.z + prop.hz));
          expect(bounds.intersectsBox(obstacle), `${prop.id}, lid=${angle}`).toBe(false);
        }
        // The sun is fixed to the back wall, including its projecting rays.
        expect(bounds.min.x).toBeGreaterThan(STAGE.x - STAGE.hx + 0.35);
      }
    } finally { base.dispose(); lid.dispose(); }
    for (const p of Object.values(FINALE_CREW)) expect(isWalkable(p.x, p.z, OPEN, 0.2)).toBe(true);
    for (const target of [{ x: -61.3, z: 0 }, { x: -61.3, z: 1.8 }]) {
      expect(isWalkable(target.x, target.z, OPEN)).toBe(true);
      expect(standY(target.x, target.z)).toBe(pose.y);
      const start = { x: -54, z: 4 }, path = findPath(start, target, OPEN);
      expect(path.length).toBeGreaterThan(0);
      expect(path.at(-1)).toEqual(target);
      let walked = start;
      for (const next of path) walked = moveCircle(walked.x, walked.z, next.x, next.z, 0.35, OPEN);
      expect(walked.x).toBeCloseTo(target.x, 3);
      expect(walked.z).toBeCloseTo(target.z, 3);
    }
  });

  it("the sea chest opens its locks", () => {
    const s = new SeaChest(["stapler", "pen", "ruler"]);
    s.setLockOpen(2, true);
    expect(s.isLockOpen(2)).toBe(true);
    expect(s.isLockOpen(0)).toBe(false);
  });
});

describe("characters", () => {
  for (const id of ALL_LOOK_IDS) {
    it(`${id} builds a one-mesh rig within budget`, () => {
      const rig = buildCharacter(id);
      expect(rig.mesh.skeleton.bones.length).toBe(12);
      expect(rig.height).toBeGreaterThan(1.0);
      expect(rig.height).toBeLessThan(2.4);
      expect(characterTriangles(id)).toBeLessThan(4500);
      rig.hold("notebook");
      expect(rig.holding).toBe("notebook");
      for (const st of ["walk", "talk", "sit", "present"] as const) {
        rig.setState(st);
        rig.update(0.1);
      }
      rig.setState("nod");
      expect(rig.gesturing).toBe(true);
      for (let i = 0; i < 20; i++) rig.update(0.1);
      expect(rig.gesturing).toBe(false);
    });
  }

  it("kids are shorter than adults", () => {
    const kid = buildCharacter("tom").height;
    for (const adult of ["green", "bo", "dan", "page"] as const) expect(buildCharacter(adult).height).toBeGreaterThan(kid);
  });

  it("Page keeps her book on her palm, outside her torso and with pages inward across states", () => {
    const rig = buildCharacter("page");
    const book = props.book();
    rig.setProp(book);
    const inverse = new THREE.Matrix4();
    const point = new THREE.Vector3();
    const box = new THREE.Box3();
    const hand = new THREE.Vector3();
    const pages = new THREE.Vector3();
    const vertices = book.geometry.getAttribute("position");
    try {
      for (const state of ["idle", "talk", "sad", "think", "present", "walk", "dance", "nod", "shake", "cheer", "give", "show", "wave", "reach", "hop", "clap"] as const) {
        rig.setState(state);
        rig.setExpression("happy");
        if (state === "talk") rig.speak(2);
        for (let frame = 0; frame < 90; frame++) {
          rig.update(1 / 60);
          rig.group.updateMatrixWorld(true);
          inverse.copy(rig.bones.spine.matrixWorld).invert();
          box.makeEmpty();
          for (let v = 0; v < vertices.count; v++) {
            point.fromBufferAttribute(vertices, v).applyMatrix4(book.matrixWorld).applyMatrix4(inverse);
            box.expandByPoint(point);
          }
          // The palm centre in elbow-local coordinates comes from the actual
          // skinned hand; compare its height and footprint with the book edge.
          hand.set(0, -0.235, 0.005).applyMatrix4(rig.bones.elbowR.matrixWorld).applyMatrix4(inverse);
          expect(box.min.y - hand.y, state).toBeGreaterThan(0.045);
          expect(box.min.y - hand.y, state).toBeLessThan(0.065);
          expect(hand.x, state).toBeGreaterThan(box.min.x);
          expect(hand.x, state).toBeLessThan(box.max.x);
          expect(hand.z, state).toBeGreaterThan(box.min.z - 0.01);
          expect(hand.z, state).toBeLessThan(box.max.z + 0.01);
          expect(box.min.z, state).toBeGreaterThan(0.22); // Torso front is under 0.17 m.
          pages.set(0, 1, 0).transformDirection(book.matrixWorld).transformDirection(inverse);
          expect(pages.z, state).toBeLessThan(-0.99);
        }
      }
      rig.hold("notebook");
      rig.setState("present");
      for (let frame = 0; frame < 60; frame++) rig.update(1 / 60);
      expect(book.parent!.visible).toBe(false);
      expect(rig.bones.armR.rotation.x).toBeLessThan(-1.5);
    } finally {
      rig.dispose();
      rig.mesh.skeleton.dispose();
    }
  });

  it("Kiwi animates every state", () => {
    const k = new KiwiRig();
    for (const s of ["perch", "fly", "hover", "hop", "talk"] as const) {
      k.setState(s);
      k.update(0.05);
    }
    expect(k.mesh.skeleton.bones.length).toBe(6);
  });
});
