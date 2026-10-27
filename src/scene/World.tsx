import type { WorldAPI } from "../game/runtime";
import { Lighting } from "./Lighting";
import { Town } from "./town/Town";
import { WorldActors } from "./WorldActors";
import { WorldEffects } from "./fx/WorldEffects";
import { AdaptiveDpr, WorldCamera } from "./WorldCamera";
import { WorldController } from "./WorldController";

/** Mount inside an R3F Canvas; no UI, model transitions, audio or chapter flow. */
export function World({ world }: { world: WorldAPI }) {
  return <>
    <Lighting fogNear={34} fogFar={105} />
    <WorldController world={world} />
    <WorldCamera runtime={world.runtime} />
    <Town runtime={world.runtime} />
    <WorldActors runtime={world.runtime} />
    <WorldEffects runtime={world.runtime} />
    <AdaptiveDpr />
  </>;
}
