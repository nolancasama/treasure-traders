import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { Lighting } from "../scene/Lighting";
import { markGalleryReady } from "./ready";

/** Reports draw calls / triangles once a second and marks the gallery ready after a few frames. */
function Probe({ onInfo }: { onInfo: (s: string) => void }) {
  const gl = useThree((s) => s.gl);
  const frames = useRef(0);
  const acc = useRef(0);
  useFrame((_, dt) => {
    frames.current++;
    acc.current += dt;
    if (frames.current === 20) markGalleryReady();
    if (acc.current > 0.5) {
      acc.current = 0;
      onInfo(`draw calls ${gl.info.render.calls} · triangles ${(gl.info.render.triangles / 1000).toFixed(1)}k`);
    }
  });
  return null;
}

function Ground({ size = 30, color = "#e9dcb8" }: { size?: number; color?: string }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-0.001}>
      <circleGeometry args={[size, 48]} />
      <meshLambertMaterial color={color} />
    </mesh>
  );
}

export function GalleryCanvas({
  camera,
  target = [0, 0.6, 0],
  children,
  ground = true,
  fov = 40,
  overlay
}: {
  camera: [number, number, number];
  target?: [number, number, number];
  children: ReactNode;
  ground?: boolean;
  fov?: number;
  overlay?: ReactNode;
}) {
  const [info, setInfo] = useState("");
  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Canvas dpr={[1, 1.5]} gl={{ antialias: true }} camera={{ position: camera, fov, near: 0.05, far: 300 }}>
        <LookAt target={target} />
        <Lighting fogNear={60} fogFar={200} />
        {ground && <Ground />}
        {children}
        <Probe onInfo={setInfo} />
      </Canvas>
      <div className="gallery-info" style={{ position: "fixed", right: 12, bottom: 10, font: "600 14px system-ui", color: "#2b2d42", background: "rgba(255,255,255,.75)", padding: "4px 10px", borderRadius: 8 }}>
        {info}
      </div>
      {overlay}
    </div>
  );
}

function LookAt({ target }: { target: [number, number, number] }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    camera.lookAt(new THREE.Vector3(...target));
  }, [camera, target]);
  return null;
}

/** Runs `fn(dt)` every frame. */
export function Ticker({ fn }: { fn: (dt: number, t: number) => void }) {
  useFrame((s, dt) => fn(Math.min(dt, 0.05), s.clock.elapsedTime));
  return null;
}
