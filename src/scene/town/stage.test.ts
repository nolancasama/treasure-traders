import * as THREE from "three";
import { afterEach, expect, it, vi } from "vitest";
import { DISTRICT_IDS } from "../../game/content/ids";
import { SOLIDS, STAGE_ROOF, stageRoofUnderside } from "../../game/world/layout";
import { createDecorations } from "./decorations";
import { stagePillarGeometry, STAGE_BUNTING, STAGE_LANTERN_HOOKS } from "./stage";

afterEach(() => vi.unstubAllGlobals());

it("meets the sloping roof with every top-cap vertex and both bunting endpoints", () => {
  for (const x of [-60.5, -64.4]) {
    const geometry = stagePillarGeometry(x, x === -60.5 ? 0.24 : 0.2, x === -60.5 ? 0.3 : 0.26);
    const positions = geometry.getAttribute("position"), height = stageRoofUnderside(x);
    let top = 0;
    for (let i = 0; i < positions.count; i++) if (positions.getY(i) > 0) {
      expect(positions.getY(i) + height / 2).toBeCloseTo(stageRoofUnderside(x + positions.getX(i)), 6);
      top++;
    }
    expect(top).toBeGreaterThan(8);
    geometry.dispose();
    for (const side of [-1, 1]) expect(SOLIDS.find(s => s.id === `stage-post-${side}-${x}`)?.height).toBe(height);
  }
  for (const p of [STAGE_BUNTING.from, STAGE_BUNTING.to]) {
    expect(p[1]).toBeCloseTo(stageRoofUnderside(p[0]), 8);
    expect(SOLIDS.some(s => s.id.startsWith("stage-post-") && s.x === p[0] && s.z === p[2])).toBe(true);
  }
});

it("anchors each stage lantern's visible cord to the roof throughout milestone pop-in", () => {
  const context = { measureText: (text: string) => ({ width: text.length * 30 }), beginPath() {}, roundRect() {}, fill() {}, fillText() {} };
  vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
  const groups = Object.fromEntries(DISTRICT_IDS.map(id => [id, new THREE.Group()])) as Record<typeof DISTRICT_IDS[number], THREE.Group>;
  const decorations = createDecorations(groups), matrix = new THREE.Matrix4(), top = new THREE.Vector3();
  const check = () => {
    const matches = new Set<number>();
    groups.festival.traverse(object => {
      if (!(object instanceof THREE.InstancedMesh)) return;
      const positions = object.geometry.getAttribute("position");
      let cordTop = -Infinity;
      for (let i = 0; i < positions.count; i++) cordTop = Math.max(cordTop, positions.getY(i));
      if (Math.abs(cordTop) > 1e-7) return;
      for (let i = 0; i < object.count; i++) {
        object.getMatrixAt(i, matrix);
        const hook = STAGE_LANTERN_HOOKS.findIndex(p => Math.abs(p[0] - matrix.elements[12]) < 1e-5 && Math.abs(p[2] - matrix.elements[14]) < 1e-5);
        if (hook < 0) continue;
        top.set(0, cordTop, 0).applyMatrix4(matrix);
        expect(top.y).toBeCloseTo(stageRoofUnderside(top.x), 6);
        expect(Math.abs(top.x - STAGE_ROOF.x)).toBeLessThan(STAGE_ROOF.width / 2);
        matches.add(hook);
      }
    });
    expect(matches.size).toBe(6);
  };
  try {
    decorations.update(8, 0, 0);
    for (const dt of [0.1, 0.2, 0.3, 2]) { decorations.update(9, 1, dt); check(); }
  } finally { decorations.dispose(); }
});
