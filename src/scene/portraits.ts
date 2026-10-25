import * as THREE from "three";
import type { CharacterId } from "../game/content/ids";
import { buildCharacter, type Expression } from "./models/people";
import { KiwiRig } from "./models/kiwi";
import { SeaChest } from "./models/seaChest";

/**
 * Portraits for the DOM HUD (SPEC §10), rendered once from the real 3D rigs
 * with a small offscreen renderer and cached as data URLs. Rendering from the
 * models (rather than separate drawings) guarantees the journal face matches
 * the person in the world.
 */
export type PortraitId = CharacterId | "seaChest";

const cache = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();
let renderer: THREE.WebGLRenderer | null = null;
let failed = false;
const SIZE = 192;

function getRenderer(): THREE.WebGLRenderer | null {
  if (failed) return null;
  if (renderer) return renderer;
  try {
    const canvas = document.createElement("canvas");
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(SIZE, SIZE, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    return renderer;
  } catch {
    failed = true;
    return null;
  }
}

function lights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight("#eef7ff", "#d9b98a", 1.2));
  const sun = new THREE.DirectionalLight("#fff0d8", 1.5);
  sun.position.set(-2, 3, 4);
  scene.add(sun);
}

function render(id: PortraitId, mood: Expression): string | null {
  const r = getRenderer();
  if (!r) return null;
  const scene = new THREE.Scene();
  lights(scene);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 20);
  if (id === "kiwi") {
    const k = new KiwiRig();
    k.group.rotation.y = -0.35;
    scene.add(k.group);
    camera.position.set(0.16, 0.3, 0.62);
    camera.lookAt(0, 0.21, 0);
  } else if (id === "seaChest") {
    const c = new SeaChest(["stapler", "pen", "ruler"]);
    c.group.rotation.y = -0.4;
    scene.add(c.group);
    camera.position.set(0.9, 1.2, 1.9);
    camera.lookAt(0, 0.3, 0);
  } else {
    const rig = buildCharacter(id);
    rig.setExpression(mood);
    rig.group.rotation.y = -0.3;
    rig.update(0);
    scene.add(rig.group);
    // Frame from the chin to the top of the hat.
    const s = rig.group.scale.x;
    const top = rig.height;
    const chin = (rig.headCenterY - rig.headR * 1.25) * s;
    const centerY = (top + chin) / 2;
    const frameH = (top - chin) * 1.22;
    const dist = frameH / (2 * Math.tan(THREE.MathUtils.degToRad(15)));
    camera.position.set(dist * 0.22, centerY + 0.04, dist);
    camera.lookAt(0, centerY, 0);
  }
  r.setClearColor(0x000000, 0);
  r.render(scene, camera);
  const url = r.domElement.toDataURL("image/png");
  scene.traverse((o) => {
    if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose();
  });
  return url;
}

/** A cached portrait data URL, rendered on first request (null without WebGL). */
export function portrait(id: PortraitId, mood: Expression = "neutral"): Promise<string | null> {
  const key = `${id}:${mood}`;
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  let p = pending.get(key);
  if (!p) {
    p = new Promise((resolve) => {
      // Yield so a burst of requests never blocks a frame for long.
      setTimeout(() => {
        try {
          const url = render(id, mood);
          if (url) cache.set(key, url);
          resolve(url);
        } catch {
          resolve(null);
        }
      }, 0);
    });
    pending.set(key, p);
  }
  return p;
}

export function cachedPortrait(id: PortraitId, mood: Expression = "neutral"): string | null {
  return cache.get(`${id}:${mood}`) ?? null;
}
