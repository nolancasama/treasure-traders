import type { NpcId } from "../../game/content/ids";
import type { CameraCommand, Position } from "../../game/world/types";
import type { CharacterRig } from "./people";
import { props } from "./props";

/** Shared by the rendered actor and full-cycle rig contact tests. */
export function equipPainter(rig: CharacterRig) {
  const brush = props.brush();
  brush.rotation.x = 3.8;
  brush.position.z = 0.02;
  brush.scale.setScalar(1.6);
  rig.setProp(brush);
  return brush;
}

/** Home painters resume their work as soon as their conversation ends. */
export function painterFacesPlayer(id: NpcId, atHome: boolean, camera: CameraCommand, placement: Position) {
  if ((id !== "ken" && id !== "leo") || !atHome) return true;
  return camera.mode === "conversation" && Math.hypot(camera.target.x - placement.x, camera.target.z - placement.z) < 0.01;
}
