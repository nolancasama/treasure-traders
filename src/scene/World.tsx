import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { festivalRevealed, type WorldAPI } from "../game/runtime";
import { Atmosphere } from "./Atmosphere";
import { Lighting } from "./Lighting";
import { Town } from "./town/Town";
import { WorldActors } from "./WorldActors";
import { WorldEffects } from "./fx/WorldEffects";
import { AdaptiveDpr, WorldCamera } from "./WorldCamera";
import { WorldController } from "./WorldController";

/** Mount inside an R3F Canvas; no UI, model transitions, audio or chapter flow. */
export function World({ world }: { world: WorldAPI }) {
  // The day deepens toward golden hour with each deposit, and dusk comes with the finale.
  const mood = useMemo(() => ({ gold: 0, dusk: 0 }), []);
  const started = useRef(false);
  useFrame((_, dt) => {
    const rt = world.runtime;
    const gold = Math.min(1, rt.state.chestCount / 8) * 0.85, dusk = festivalRevealed(rt) ? 1 : 0;
    const k = started.current ? 1 - Math.exp(-dt * 0.9) : 1;
    mood.gold += (gold - mood.gold) * k;
    mood.dusk += (dusk - mood.dusk) * k;
    started.current = true;
  }, -4);
  const read = useMemo(() => () => mood, [mood]);
  return <>
    <Lighting fogNear={40} fogFar={150} mood={read} />
    <Atmosphere mood={read} />
    <WorldController world={world} />
    <WorldCamera runtime={world.runtime} />
    <Town runtime={world.runtime} mood={read} />
    <WorldActors runtime={world.runtime} />
    <WorldEffects runtime={world.runtime} />
    <AdaptiveDpr />
  </>;
}
