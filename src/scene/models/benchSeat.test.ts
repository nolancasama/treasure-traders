import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { CLOSED, findPath, isWalkable } from "../../game/world/collision";
import { followOffset } from "../cameraRig";
import { canInteract, interactionFocus } from "../../game/world/interaction";
import { GRANDMA_BENCH_YAW, NPC_HOMES, SOLIDS, UME_SEAT } from "../../game/world/layout";
import { createWorld, worldStateFromGame } from "../../game/runtime";
import { startChapter } from "../../game/logic/state";
import { activateInteraction, approachInteraction, stepController } from "../WorldController";
import { buildCharacter } from "./people";

const bench = SOLIDS.find(s => s.id === "grandma-bench")!;
const frame = new THREE.Matrix4().makeRotationY(GRANDMA_BENCH_YAW).setPosition(bench.x, 0, bench.z);
const inverse = frame.clone().invert();
const point = (x: number, z: number) => new THREE.Vector3(x, 0, z).applyMatrix4(frame);

describe("Grandma's bench frame and supported pose", () => {
  it("aligns the bench's long axis with the camera's horizontal forward direction", () => {
    expect(bench.kind === "box" && bench.yaw).toBe(GRANDMA_BENCH_YAW);
    expect(UME_SEAT.yaw).toBe(GRANDMA_BENCH_YAW);
    expect(NPC_HOMES.ume.yaw).toBe(GRANDMA_BENCH_YAW);
    const axis = new THREE.Vector3(1, 0, 0).transformDirection(frame);
    const offset = followOffset(UME_SEAT);
    const forward = new THREE.Vector3(-offset.x, 0, -offset.z).normalize();
    expect(Math.abs(axis.dot(forward))).toBeCloseTo(1, 10);
    expect(new THREE.Vector3(0, 0, 1).transformDirection(frame).x).toBeCloseTo(1, 10);
  });

  it("leaves walking clearance between the bench's south end and the square lamp", () => {
    const lamp = SOLIDS.find(s => s.id === "lamp-square-0")!;
    expect(lamp.kind).toBe("circle");
    if (bench.kind !== "box" || lamp.kind !== "circle") throw new Error("Missing bench or lamp footprint");
    expect(lamp.z - lamp.r - (bench.z + bench.hx)).toBeGreaterThanOrEqual(0.72);
    expect(isWalkable(lamp.x, (lamp.z - lamp.r + bench.z + bench.hx) / 2, CLOSED)).toBe(true);
  });

  it("keeps front and side walking routes, keyboard focus and tapped approaches reachable", () => {
    const target = { kind: "npc", id: "ume" } as const;
    const candidate = { target, position: NPC_HOMES.ume };
    expect(isWalkable(candidate.position.x, candidate.position.z, CLOSED)).toBe(true);
    for (const [x, z] of [[0, 2], [-2.3, 0.9], [2.3, 0.9]]) {
      const from = point(x, z);
      expect(isWalkable(from.x, from.z, CLOSED)).toBe(true);
      expect(findPath({ x: 0, z: 7 }, from, CLOSED).length).toBeGreaterThan(0);
      expect(canInteract(from, candidate, CLOSED)).toBe(true);
      expect(interactionFocus({ ...from, yaw: Math.PI }, [candidate], CLOSED)).toEqual(target);
      for (const input of ["keyboard", "tap"] as const) {
        const state = worldStateFromGame(startChapter(1, { mode: "campaign", campaignSeed: 1234 }));
        state.npcs = { ume: NPC_HOMES.ume };
        const world = createWorld(state), received: unknown[] = [];
        world.onInteract(value => received.push(value));
        world.teleport(input === "keyboard" ? from : point(x * 2, z * 2 + 2));
        if (input === "keyboard") expect(activateInteraction(world, target)).toBe(true);
        else {
          approachInteraction(world, target);
          for (let i = 0; i < 180 && !received.length; i++) stepController(world, 1 / 30);
        }
        expect(received, `${input} from ${x},${z}`).toEqual([target]);
      }
    }
  });

  it("keeps the pelvis on wood, knees ahead, shins vertical and shoe soles grounded through every blend", () => {
    const rig = buildCharacter("ume"), standing = rig.mesh.geometry;
    rig.setSeated(UME_SEAT.y);
    rig.group.position.set(UME_SEAT.x, rig.seatedOriginY, UME_SEAT.z);
    rig.group.rotation.y = UME_SEAT.yaw;
    const geo = rig.mesh.geometry, positions = geo.getAttribute("position"), indices = geo.getAttribute("skinIndex");
    const boneIds = (names: string[]) => names.map(name => rig.mesh.skeleton.bones.indexOf(rig.bones[name]));
    const knees = boneIds(["kneeL", "kneeR"]), hips = boneIds(["hips"]), torso = boneIds(["spine"]);
    const floor = 0.24 - UME_SEAT.y / rig.group.scale.y - 0.09;
    const shoeVertices: number[][] = knees.map(() => []), bottomVertices: number[] = [], backVertices: number[] = [];
    for (let v = 0; v < positions.count; v++) {
      const id = indices.getX(v), y = positions.getY(v);
      if (knees.includes(id) && y < floor + 0.081) shoeVertices[knees.indexOf(id)].push(v);
      if (hips.includes(id) && y < 0.392) bottomVertices.push(v);
      if (torso.includes(id) || hips.includes(id)) backVertices.push(v);
    }
    expect(shoeVertices.every(vertices => vertices.length > 0)).toBe(true);
    expect(bottomVertices.length).toBeGreaterThan(0);
    const vertex = (v: number) => rig.mesh.getVertexPosition(v, new THREE.Vector3()).applyMatrix4(rig.mesh.matrixWorld).applyMatrix4(inverse);
    try {
      for (const state of ["sit", "idle", "talk", "think", "sad", "present", "nod", "cheer", "hop", "wave", "clap", "sit"] as const) {
        rig.setState(state);
        rig.setExpression(state === "cheer" ? "happy" : "neutral");
        if (state === "talk") rig.speak(2);
        for (let i = 0; i < 90; i++) {
          rig.update(1 / 60);
          rig.group.updateMatrixWorld(true);
          rig.mesh.skeleton.update();
          expect(rig.seated).toBe(true);
          expect(rig.group.userData.seated).toBe(true);
          for (const vertices of shoeVertices) {
            const box = new THREE.Box3().setFromPoints(vertices.map(vertex));
            expect(box.min.y, state).toBeCloseTo(0, 5);
            expect(box.max.y, state).toBeCloseTo(0.08 * rig.group.scale.y, 5);
            expect(box.min.z, state).toBeGreaterThan(0.43);
          }
          expect(Math.min(...bottomVertices.map(v => vertex(v).y)), state).toBeCloseTo(UME_SEAT.y, 5);
          expect(Math.min(...backVertices.map(v => vertex(v).z)), state).toBeGreaterThan(-0.425);
          for (const name of ["kneeL", "kneeR"]) {
            const knee = rig.bones[name].getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse);
            expect(knee.z, state).toBeGreaterThan(0.43);
            const down = new THREE.Vector3(0, -1, 0).transformDirection(rig.bones[name].matrixWorld);
            expect(down.y, state).toBeCloseTo(-1, 8);
          }
        }
      }
      rig.setSeated(null);
      expect(rig.mesh.geometry).toBe(standing);
      expect(rig.seated).toBe(false);
      expect(rig.group.userData.seated).toBe(false);
      const other = buildCharacter("page"), original = other.mesh.geometry;
      other.setSeated(UME_SEAT.y);
      expect(other.seated).toBe(false);
      expect(other.mesh.geometry).toBe(original);
      other.dispose(); other.mesh.skeleton.dispose();
    } finally {
      rig.dispose(); rig.mesh.skeleton.dispose();
    }
  }, 30_000);
});
