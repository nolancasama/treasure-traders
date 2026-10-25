import * as THREE from "three";

/**
 * Shared materials (SPEC §9): vertex-coloured Lambert for every merged model,
 * a blob-shadow material (no real-time shadows on Chromebooks) and glow
 * sprites. Created lazily because Node tests import models without a GPU.
 */
let _flat: THREE.MeshLambertMaterial | null = null;
let _smooth: THREE.MeshLambertMaterial | null = null;
let _skinned: THREE.MeshLambertMaterial | null = null;

/** Faceted look for props and buildings. */
export function flatMat(): THREE.MeshLambertMaterial {
  return (_flat ??= new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
}

/** Soft look for characters and rounded items. */
export function smoothMat(): THREE.MeshLambertMaterial {
  return (_smooth ??= new THREE.MeshLambertMaterial({ vertexColors: true }));
}

/** Characters (skinned meshes share one material). */
export function skinnedMat(): THREE.MeshLambertMaterial {
  return (_skinned ??= new THREE.MeshLambertMaterial({ vertexColors: true }));
}

function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d")!, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let _blob: THREE.Texture | null = null;
export function blobTexture(): THREE.Texture {
  return (_blob ??= canvasTexture(64, (g, s) => {
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, "rgba(40,30,20,0.55)");
    grad.addColorStop(0.6, "rgba(40,30,20,0.25)");
    grad.addColorStop(1, "rgba(40,30,20,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
  }));
}

let _shadowMat: THREE.MeshBasicMaterial | null = null;
export function shadowMat(): THREE.MeshBasicMaterial {
  return (_shadowMat ??= new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.9 }));
}

/** A flat blob shadow of radius r, lying just above the ground. */
export function blobShadow(r: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), shadowMat());
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.012;
  m.renderOrder = 1;
  return m;
}

let _glow: THREE.Texture | null = null;
export function glowTexture(): THREE.Texture {
  return (_glow ??= canvasTexture(64, (g, s) => {
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.35, "rgba(255,255,255,0.55)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
  }));
}

/** Additive glow sprite material in a colour. */
export function glowMat(color: THREE.ColorRepresentation, opacity = 1): THREE.SpriteMaterial {
  return new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
}
