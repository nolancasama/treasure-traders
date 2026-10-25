import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";

export const SKY = "#9fd6f5";
export const FOG = "#cfe7f2";

/**
 * The game's fixed light set (SPEC §9): a warm late-afternoon sun plus a
 * sky/ground hemisphere, soft fog, no real-time shadows.
 */
export function Lighting({ fogNear = 45, fogFar = 140 }: { fogNear?: number; fogFar?: number }) {
  const { scene } = useThree();
  useEffect(() => {
    scene.background = new THREE.Color(SKY);
    scene.fog = new THREE.Fog(FOG, fogNear, fogFar);
    return () => {
      scene.fog = null;
    };
  }, [scene, fogNear, fogFar]);
  return (
    <>
      <hemisphereLight args={["#dff1ff", "#d9b98a", 1.15]} />
      <directionalLight position={[-14, 22, 12]} intensity={1.55} color="#fff0d8" />
      <ambientLight intensity={0.12} />
    </>
  );
}
