import * as THREE from "three";
import { STAGE_ROOF, stageRoofUnderside } from "../../game/world/layout";

type V3 = [number, number, number];
export const STAGE_BUNTING = { from: [-60.5, stageRoofUnderside(-60.5), -5.2] as V3, to: [-60.5, stageRoofUnderside(-60.5), 5.2] as V3, sag: 0.48 };
export const STAGE_LANTERN_HOOKS: V3[] = Array.from({ length: 6 }, (_, i) => [-59.75, stageRoofUnderside(-59.75), -4.25 + i * 1.7]);

/** Sloped top cap, so the entire pillar meets the canopy's underside. */
export function stagePillarGeometry(x: number, rTop: number, rBottom: number): THREE.BufferGeometry {
  const height = stageRoofUnderside(x), geometry = new THREE.CylinderGeometry(rTop, rBottom, height, 8);
  const positions = geometry.getAttribute("position");
  for (let i = 0; i < positions.count; i++) if (positions.getY(i) > 0) {
    positions.setY(i, height / 2 + Math.tan(STAGE_ROOF.slope) * positions.getX(i));
  }
  geometry.computeVertexNormals();
  return geometry;
}
