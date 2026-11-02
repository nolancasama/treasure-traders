import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PartBuilder } from "./partBuilder";
import { blendMood, SUN_DIRECTION } from "./Lighting";

const SKY_VERTEX = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 zenith, horizon, glow, sunDirection;
  uniform float fall;
  varying vec3 vDirection;
  void main() {
    vec3 d = normalize(vDirection);
    vec3 color = mix(horizon, zenith, pow(clamp(d.y, 0.0, 1.0), fall));
    float sun = max(dot(d, sunDirection), 0.0);
    color += glow * (pow(sun, 7.0) * 0.28 + pow(sun, 90.0) * 0.5);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

const forward = new THREE.Vector3();

/** Far blue-green ranges, the only thing past the fog line in low shots. */
function hillsGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // The south stays open: that side of the horizon is sea.
  for (let i = 0; i < 26; i++) {
    const a = Math.PI * (0.92 + i / 25 * 1.16);
    const r = 215 + rand() * 90, w = 46 + rand() * 46;
    b.add(new THREE.IcosahedronGeometry(1, 1), i % 3 ? "#9fc4a4" : "#b4cfa8", [Math.cos(a) * r, -5, Math.sin(a) * r], [0, rand() * 6, 0], [w, 14 + rand() * 20, w * 0.8], { flatAo: true });
  }
  for (let i = 0; i < 11; i++) {
    const a = Math.PI * (1 + i / 10);
    const r = 330 + rand() * 40;
    b.add(new THREE.ConeGeometry(1, 1, 6), "#a9bfd4", [Math.cos(a) * r, 18, Math.sin(a) * r], [0, rand() * 3, 0], [70 + rand() * 50, 62 + rand() * 40, 60], { flatAo: true });
  }
  return b.build();
}

function cloudGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  for (const [x, y, r] of [[0, 0, 5], [-5, -0.8, 3.6], [5.2, -0.9, 3.8], [1.8, 2, 3.4], [-2.4, 1.4, 3]] as const) {
    b.add(new THREE.IcosahedronGeometry(r, y > 0 ? 1 : 0), "#ffffff", [x, y, 0], [x, y, 0], [1.25, 0.72, 1], { flatAo: true });
  }
  return b.build();
}

/** Sky dome, ranges and clouds: all past the fog line, unfogged and out of frame in play. */
export function Atmosphere({ mood }: { mood: () => { gold: number; dusk: number } }) {
  const sky = useMemo(() => {
    const root = new THREE.Group();
    const skyMaterial = new THREE.ShaderMaterial({
      vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT, side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { zenith: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, glow: { value: new THREE.Color() }, sunDirection: { value: SUN_DIRECTION }, fall: { value: 0.52 } }
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(390, 20, 12), skyMaterial);
    // Drawn after opaque scenery: only the pixels that can see the sky pay for it.
    dome.renderOrder = 10;
    dome.frustumCulled = false;
    const hillTint = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false });
    const hills = new THREE.Mesh(hillsGeometry(), hillTint);
    const cloudTint = new THREE.MeshBasicMaterial({ color: "#ffffff", vertexColors: true, fog: false, toneMapped: false });
    const clouds = new THREE.InstancedMesh(cloudGeometry(), cloudTint, 9);
    const place = new THREE.Object3D();
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (1.05 + i / 8 * 0.95);
      place.position.set(Math.cos(a) * (150 + i % 3 * 42), 58 + (i * 7) % 26, Math.sin(a) * (150 + i % 3 * 42));
      place.rotation.y = i * 1.3;
      place.scale.setScalar(1.3 + (i % 4) * 0.42);
      place.updateMatrix();
      clouds.setMatrixAt(i, place.matrix);
    }
    for (const mesh of [dome, hills, clouds]) mesh.raycast = () => {};
    root.add(hills, clouds, dome);
    return { root, dome, hills, clouds, skyMaterial, hillTint, cloudTint };
  }, []);
  useEffect(() => () => {
    sky.dome.geometry.dispose(); sky.hills.geometry.dispose(); sky.clouds.geometry.dispose(); sky.clouds.dispose();
    sky.skyMaterial.dispose(); sky.hillTint.dispose(); sky.cloudTint.dispose();
  }, [sky]);
  useFrame(({ camera, size }, dt) => {
    // In play the camera looks down past the horizon: skip all of this when no sky is in frame.
    const lens = camera as THREE.PerspectiveCamera;
    camera.getWorldDirection(forward);
    const pitch = THREE.MathUtils.radToDeg(Math.asin(forward.y));
    const shifted = lens.view ? lens.view.offsetY / size.height * lens.fov : 0;
    sky.root.visible = pitch + lens.fov / 2 + shifted > -3;
    if (!sky.root.visible) return;
    const { gold, dusk } = mood();
    const colors = blendMood(gold, dusk), uniforms = sky.skyMaterial.uniforms;
    uniforms.zenith.value.copy(colors.zenith);
    uniforms.horizon.value.copy(colors.horizon);
    uniforms.glow.value.copy(colors.glow);
    // At dusk the dark climbs quickly from the horizon, the backdrop fireworks need.
    uniforms.fall.value = THREE.MathUtils.lerp(0.52, 0.26, dusk);
    sky.dome.position.copy(camera.position);
    sky.hillTint.color.set("#ffffff").lerp(colors.horizon, 0.3).multiplyScalar(1 - dusk * 0.55);
    sky.cloudTint.color.set("#ffffff").lerp(colors.horizon, 0.28 + dusk * 0.4).multiplyScalar(1 - dusk * 0.28);
    sky.clouds.position.x = (sky.clouds.position.x + dt * 0.5) % 80;
  });
  return <primitive object={sky.root} dispose={null} />;
}
