import * as THREE from "three";

/**
 * Shared materials (SPEC §9): vertex-coloured Lambert for every merged model,
 * a blob-shadow material (no real-time shadows on Chromebooks) and glow
 * sprites. Created lazily because Node tests import models without a GPU.
 */
let _flat: THREE.MeshLambertMaterial | null = null;
let _smooth: THREE.MeshLambertMaterial | null = null;
let _skinned: THREE.MeshLambertMaterial | null = null;
let _sway: THREE.MeshLambertMaterial | null = null;
let _scenery: THREE.MeshLambertMaterial | null = null;

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

/**
 * Per-frame values shared by every scenery shader. Holding them here means a
 * single write reaches all merged district meshes with no per-object work.
 * A focus is (x px, y px, depth threshold, 1 / radius² px); depth -1 is off.
 */
export const sceneUniforms = {
  ttTime: { value: 0 },
  ttFocus: { value: [new THREE.Vector4(0, 0, -1, 0), new THREE.Vector4(0, 0, -1, 0), new THREE.Vector4(0, 0, -1, 0)] },
  ttNear: { value: new THREE.Vector2(0, 0.001) }
};

const SWAY_VERTEX = /* glsl */ `
  #ifdef USE_INSTANCING
    vec3 ttRoot = instanceMatrix[3].xyz;
  #else
    vec3 ttRoot = position;
  #endif
  float ttPhase = ttRoot.x * 0.31 + ttRoot.z * 0.23;
  float ttGust = 0.6 + 0.4 * sin(ttTime * 0.37 + ttRoot.x * 0.05);
  transformed.x += sin(ttTime * 1.5 + ttPhase) * 0.09 * uv.x * ttGust;
  transformed.z += cos(ttTime * 1.15 + ttPhase * 1.3) * 0.06 * uv.x * ttGust;
`;

const OCCLUDE_FRAGMENT = /* glsl */ `
  float ttKeep = clamp((gl_FragCoord.z - ttNear.x) / (ttNear.y - ttNear.x), 0.0, 1.0);
  for (int i = 0; i < 3; i++) {
    if (gl_FragCoord.z < ttFocus[i].z) {
      vec2 ttD = gl_FragCoord.xy - ttFocus[i].xy;
      ttKeep = min(ttKeep, mix(0.16, 1.0, smoothstep(0.42, 1.0, dot(ttD, ttD) * ttFocus[i].w)));
    }
  }
  if (ttKeep < 0.999) {
    vec2 ttA = floor(gl_FragCoord.xy);
    vec2 ttB = floor(ttA * 0.5);
    float ttDither = fract(ttB.x * 0.5 + ttB.y * ttB.y * 0.75) * 0.25 + fract(ttA.x * 0.5 + ttA.y * ttA.y * 0.75);
    if (ttKeep <= ttDither) discard;
  }
`;

/**
 * Adds gentle wind (uv.x is the weight) and/or a dithered see-through hole
 * around the characters. Dither instead of alpha: no draw-order problems, no
 * extra draw call and it works on one merged mesh holding a whole district.
 */
function sceneShader<T extends THREE.Material>(material: T, sway: boolean, occlude: boolean): T {
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, sceneUniforms);
    if (sway) {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float ttTime;")
        .replace("#include <begin_vertex>", `#include <begin_vertex>\n${SWAY_VERTEX}`);
    }
    if (occlude) {
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform vec4 ttFocus[3];\nuniform vec2 ttNear;")
        .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>\n${OCCLUDE_FRAGMENT}`);
    }
  };
  material.customProgramCacheKey = () => `tt:${sway}:${occlude}`;
  return material;
}

/** Low, swaying scenery that never needs to be seen through (flowers, flags). */
export function swayMat(): THREE.MeshLambertMaterial {
  return (_sway ??= sceneShader(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), true, false));
}

/** Anything tall enough to hide a character: trees, walls, awnings, poles. */
export function sceneryMat(): THREE.MeshLambertMaterial {
  return (_scenery ??= sceneShader(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), true, true));
}

/** Same see-through rule for another material (signs on a faded wall). */
export function occluding<T extends THREE.Material>(material: T): T {
  return sceneShader(material, false, true);
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
    grad.addColorStop(0, "rgba(66,48,62,0.46)");
    grad.addColorStop(0.55, "rgba(66,48,62,0.24)");
    grad.addColorStop(1, "rgba(66,48,62,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
  }));
}

let _shadowMat: THREE.MeshBasicMaterial | null = null;
export function shadowMat(): THREE.MeshBasicMaterial {
  return (_shadowMat ??= new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.9 }));
}

let _softBox: THREE.Texture | null = null;
let _softBoxMat: THREE.MeshBasicMaterial | null = null;
/** Soft rectangle for building and stall contact shadows; shared with shadowMat's tint. */
export function softBoxMat(): THREE.MeshBasicMaterial {
  _softBox ??= canvasTexture(64, (g, s) => {
    g.filter = "blur(7px)";
    g.fillStyle = "rgba(66,48,62,0.42)";
    g.fillRect(s * 0.18, s * 0.18, s * 0.64, s * 0.64);
  });
  return (_softBoxMat ??= new THREE.MeshBasicMaterial({ map: _softBox, transparent: true, depthWrite: false }));
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

let _star: THREE.Texture | null = null;
/** A soft four-point twinkle used by item highlights and celebration sparkles. */
export function starTexture(): THREE.Texture {
  return (_star ??= canvasTexture(64, (g, s) => {
    const c = s / 2;
    const halo = g.createRadialGradient(c, c, 0, c, c, c);
    halo.addColorStop(0, "rgba(255,255,255,0.75)");
    halo.addColorStop(0.3, "rgba(255,255,255,0.22)");
    halo.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = halo;
    g.fillRect(0, 0, s, s);
    g.fillStyle = "#ffffff";
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? s * 0.09 : s * 0.48, a = i / 8 * Math.PI * 2;
      g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
  }));
}
