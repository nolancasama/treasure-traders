import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

export const SKY = "#8fc8f0";
export const FOG = "#f6e7cf";

/** A sky-and-sun palette; the world moves between these as the festival nears. */
export interface LightMood {
  skyLight: string; groundLight: string; hemi: number; sun: string; sunPower: number;
  fog: string; zenith: string; horizon: string; sunGlow: string;
}
export const AFTERNOON: LightMood = { skyLight: "#dcedff", groundLight: "#e6c896", hemi: 1.62, sun: "#ffe9c6", sunPower: 2.05, fog: FOG, zenith: "#5fb0ee", horizon: "#fdebcf", sunGlow: "#fff0c8" };
export const GOLDEN: LightMood = { skyLight: "#f4e0cc", groundLight: "#e2ae78", hemi: 1.56, sun: "#ffcf96", sunPower: 2.2, fog: "#f8d9ae", zenith: "#6c9fdc", horizon: "#fcd09a", sunGlow: "#ffd48a" };
export const DUSK: LightMood = { skyLight: "#c4bbe6", groundLight: "#d8a381", hemi: 1.62, sun: "#ffb27c", sunPower: 1.25, fog: "#7d6a92", zenith: "#1b2058", horizon: "#ef8f6c", sunGlow: "#ff9a62" };

/** Where the low sun sits; the directional light and the sky glow both use it. */
export const SUN_DIRECTION = new THREE.Vector3(-16, 20, 14).normalize();

const middle = new THREE.Color(), last = new THREE.Color();
const mix = (out: THREE.Color, a: string, b: string, c: string, gold: number, dusk: number) =>
  out.set(a).lerp(middle.set(b), gold).lerp(last.set(c), dusk);

const blended = { zenith: new THREE.Color(), horizon: new THREE.Color(), glow: new THREE.Color() };
/** Writes the blended mood colours for the sky dome and the far hills. */
export function blendMood(gold: number, dusk: number) {
  mix(blended.zenith, AFTERNOON.zenith, GOLDEN.zenith, DUSK.zenith, gold, dusk);
  mix(blended.horizon, AFTERNOON.horizon, GOLDEN.horizon, DUSK.horizon, gold, dusk);
  mix(blended.glow, AFTERNOON.sunGlow, GOLDEN.sunGlow, DUSK.sunGlow, gold, dusk);
  return blended;
}

/**
 * The game's fixed light set (SPEC §9): a warm late-afternoon sun plus a
 * sky/ground hemisphere, soft fog, no real-time shadows. `mood` lets the world
 * drift toward golden hour and dusk without adding any lights.
 */
export function Lighting({ fogNear = 45, fogFar = 140, mood }: { fogNear?: number; fogFar?: number; mood?: () => { gold: number; dusk: number } }) {
  const { scene } = useThree();
  const hemi = useRef<THREE.HemisphereLight>(null), sun = useRef<THREE.DirectionalLight>(null);
  const fog = useMemo(() => new THREE.Fog(FOG, fogNear, fogFar), [fogNear, fogFar]);
  useEffect(() => {
    scene.background = new THREE.Color(SKY);
    scene.fog = fog;
    return () => {
      scene.fog = null;
    };
  }, [scene, fog]);
  useFrame(() => {
    if (!mood || !hemi.current || !sun.current) return;
    const { gold, dusk } = mood();
    mix(hemi.current.color, AFTERNOON.skyLight, GOLDEN.skyLight, DUSK.skyLight, gold, dusk);
    mix(hemi.current.groundColor, AFTERNOON.groundLight, GOLDEN.groundLight, DUSK.groundLight, gold, dusk);
    mix(sun.current.color, AFTERNOON.sun, GOLDEN.sun, DUSK.sun, gold, dusk);
    mix(fog.color, AFTERNOON.fog, GOLDEN.fog, DUSK.fog, gold, dusk);
    hemi.current.intensity = THREE.MathUtils.lerp(THREE.MathUtils.lerp(AFTERNOON.hemi, GOLDEN.hemi, gold), DUSK.hemi, dusk);
    sun.current.intensity = THREE.MathUtils.lerp(THREE.MathUtils.lerp(AFTERNOON.sunPower, GOLDEN.sunPower, gold), DUSK.sunPower, dusk);
  });
  return (
    <>
      <hemisphereLight ref={hemi} args={[AFTERNOON.skyLight, AFTERNOON.groundLight, AFTERNOON.hemi]} />
      <directionalLight ref={sun} position={SUN_DIRECTION.clone().multiplyScalar(30).toArray()} intensity={AFTERNOON.sunPower} color={AFTERNOON.sun} />
    </>
  );
}
