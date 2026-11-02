import * as THREE from "three";

/**
 * Proper firework shells: a rocket climbs, the shell bursts into radial sparks
 * with short trails, and they hang and fall. Every point's whole flight is in
 * its vertex data and the GPU evaluates it, so a salvo is a single draw call
 * with no per-frame work beyond one uniform, however many sparks are in the air.
 */
const SHELL_COLORS: [string, string][] = [["#ff4d5e", "#ffd25c"], ["#42c8ff", "#ffffff"], ["#ffd23f", "#ff8a3c"], ["#ff62c4", "#ffe08a"], ["#64e86b", "#fff6b0"], ["#a97bff", "#6fdcff"]];

export const SALVO_SECONDS = 4.5;

const VERTEX = /* glsl */ `
  attribute vec3 aOrigin;
  attribute vec3 aVelocity;
  attribute vec3 aColor;
  attribute vec4 aFlight; // burst time, lifetime, trail lag, size in metres
  attribute float aKind;  // 0 spark, 1 rocket, 2 flash
  uniform float age, pixelScale;
  varying vec3 vColor;
  varying float vFade;
  void main() {
    float t = age - aFlight.x - aFlight.z;
    vec3 at = aOrigin;
    float fade = 0.0;
    float size = aFlight.w;
    if (t > 0.0 && t < aFlight.y) {
      float u = t / aFlight.y;
      if (aKind < 0.5) {
        // Fast out, hanging on the air, then a slow fall: why real bursts hold their shape.
        at += aVelocity * (1.0 - exp(-2.4 * t)) / 2.4;
        at.y -= 1.7 * t * t;
        fade = (1.0 - u) * (1.0 - u) * (u > 0.72 ? step(0.45, fract(t * 11.0 + aOrigin.x)) : 1.0);
        size *= 1.0 - u * 0.55;
      } else if (aKind < 1.5) {
        // aVelocity carries the rocket's launch point here.
        float e = 1.0 - (1.0 - u) * (1.0 - u);
        at = mix(aVelocity, aOrigin, e);
        fade = 1.0 - u * 0.3;
      } else {
        fade = (1.0 - u) * (1.0 - u);
        size *= 0.6 + u * 0.6;
      }
    }
    vColor = aColor;
    vFade = fade;
    vec4 view = modelViewMatrix * vec4(at, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = fade > 0.0 ? max(1.0, size * pixelScale / -view.z) : 0.0;
  }
`;
const FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vFade;
  void main() {
    if (vFade <= 0.0) discard;
    vec2 p = gl_PointCoord - 0.5;
    float d = dot(p, p) * 4.0;
    if (d > 1.0) discard;
    float core = smoothstep(0.32, 0.0, d), soft = (1.0 - d) * (1.0 - d);
    // Mostly additive, with enough coverage to keep its colour on a pale sky.
    vec3 color = mix(vColor, vec3(1.0), core * 0.55);
    gl_FragColor = vec4(color * soft * vFade * 1.25, soft * vFade * 0.5);
  }
`;

function material(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true, depthWrite: false, fog: false,
    uniforms: { age: { value: 0 }, pixelScale: { value: 800 } },
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor
  });
}

/** A salvo of shells launched from `at`. `seed` varies the pattern, colours and timing. */
export function createSalvo(at: { x: number; y: number; z: number }, seed: number): THREE.Points {
  let s = (Math.abs(Math.floor(seed)) * 2654435761 + 12345) >>> 0;
  const rand = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const origin: number[] = [], velocity: number[] = [], color: number[] = [], flight: number[] = [], kind: number[] = [];
  const push = (o: number[], v: number[], c: THREE.Color, burst: number, life: number, lag: number, size: number, k: number) => {
    origin.push(...o); velocity.push(...v); color.push(c.r, c.g, c.b); flight.push(burst, life, lag, size); kind.push(k);
  };
  const shells = 4, main = new THREE.Color(), second = new THREE.Color();
  const toSRGB = (c: THREE.Color) => c.convertLinearToSRGB();
  for (let shell = 0; shell < shells; shell++) {
    const burst = 0.7 + shell * 0.62 + rand() * 0.14;
    const apex = [at.x + (rand() - 0.5) * 12, at.y + 10 + rand() * 6, at.z + (rand() - 0.5) * 22];
    const [a, b] = SHELL_COLORS[(Math.floor(seed) + shell * 2) % SHELL_COLORS.length];
    toSRGB(main.set(a)); toSRGB(second.set(b));
    const style = shell % 3, sparks = 72, speed = 15 + rand() * 5;
    for (let i = 0; i < sparks; i++) {
      // A Fibonacci sphere spreads sparks evenly: bursts look round, not clumped.
      const y = 1 - (i + 0.5) / sparks * 2, r = Math.sqrt(1 - y * y), angle = i * 2.399963;
      let dx = Math.cos(angle) * r, dy = y, dz = Math.sin(angle) * r, sp = speed;
      if (style === 1) { dy *= 0.12; sp = speed * 1.08; }
      if (style === 2) sp = speed * (i % 2 ? 1 : 0.55);
      const v = [dx * sp, dy * sp, dz * sp];
      const c = style === 2 ? (i % 2 ? main : second) : (i % 3 ? main : second);
      // The spark, then fainter copies just behind it along the same path: a short glowing trail.
      push(apex, v, c, burst, 1.55 + rand() * 0.25, 0, 0.72, 0);
      push(apex, v, c, burst, 1.4, 0.028, 0.56, 0);
      push(apex, v, c, burst, 1.28, 0.056, 0.42, 0);
      push(apex, v, c, burst, 1.16, 0.09, 0.28, 0);
    }
    const rocket = new THREE.Color("#ffe6b0");
    toSRGB(rocket);
    for (let i = 0; i < 9; i++) push(apex, [at.x, at.y, at.z], rocket, burst - 0.7, 0.7, i * 0.02, 0.34 - i * 0.025, 1);
    const flash = new THREE.Color("#fff7dc");
    toSRGB(flash);
    push(apex, [0, 0, 0], flash, burst, 0.28, 0, 8, 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(kind.length * 3), 3));
  g.setAttribute("aOrigin", new THREE.Float32BufferAttribute(origin, 3));
  g.setAttribute("aVelocity", new THREE.Float32BufferAttribute(velocity, 3));
  g.setAttribute("aColor", new THREE.Float32BufferAttribute(color, 3));
  g.setAttribute("aFlight", new THREE.Float32BufferAttribute(flight, 4));
  g.setAttribute("aKind", new THREE.Float32BufferAttribute(kind, 1));
  const points = new THREE.Points(g, material());
  points.frustumCulled = false;
  points.renderOrder = 6;
  points.raycast = () => {};
  return points;
}
