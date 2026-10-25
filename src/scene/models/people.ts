import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { ItemId, NpcId } from "../../game/content/ids";
import { skinnedMat, smoothMat } from "../materials";
import { ITEM_DISPLAY, buildItem, itemSize } from "./items";
import { LOOKS, type Build, type Look, type LookId } from "./looks";
import { RigBuilder, skinnedMesh, type BoneSpec, type V3 } from "./rig";

/* ------------------------------------------------------------ proportions */

interface Proportions {
  legLen: number;
  torsoH: number;
  girth: number;
  armLen: number;
  armR: number;
  headR: number;
  neck: number;
  legR: number;
}

const PROPS: Record<Build, Proportions> = {
  kid: { legLen: 0.4, torsoH: 0.36, girth: 0.165, armLen: 0.35, armR: 0.052, headR: 0.215, neck: 0.03, legR: 0.068 },
  adult: { legLen: 0.6, torsoH: 0.48, girth: 0.19, armLen: 0.47, armR: 0.058, headR: 0.2, neck: 0.04, legR: 0.08 },
  slim: { legLen: 0.62, torsoH: 0.47, girth: 0.165, armLen: 0.47, armR: 0.052, headR: 0.195, neck: 0.045, legR: 0.07 },
  round: { legLen: 0.5, torsoH: 0.48, girth: 0.27, armLen: 0.44, armR: 0.064, headR: 0.2, neck: 0.03, legR: 0.09 },
  big: { legLen: 0.62, torsoH: 0.54, girth: 0.25, armLen: 0.5, armR: 0.07, headR: 0.21, neck: 0.04, legR: 0.095 },
  small: { legLen: 0.48, torsoH: 0.42, girth: 0.18, armLen: 0.4, armR: 0.052, headR: 0.195, neck: 0.03, legR: 0.07 }
};

interface Frame {
  p: Proportions;
  hipY: number;
  shoulderY: number;
  shoulderX: number;
  neckY: number;
  headY: number;
  legX: number;
  kneeY: number;
  elbowY: number;
  handY: number;
  top: number;
}

function frameOf(look: Look): Frame {
  const p = PROPS[look.build];
  const hipY = p.legLen;
  const shoulderY = hipY + p.torsoH - 0.06;
  const neckY = hipY + p.torsoH;
  const headY = neckY + p.neck + p.headR * 0.92;
  return {
    p,
    hipY,
    shoulderY,
    shoulderX: p.girth * 0.9 + p.armR,
    neckY,
    headY,
    legX: p.girth * 0.5,
    kneeY: hipY * 0.5,
    elbowY: shoulderY - p.armLen * 0.5,
    handY: shoulderY - p.armLen,
    top: headY + p.headR * topFactor(look)
  };
}

/** How far above the head centre the silhouette reaches (hats and tall hair). */
function topFactor(look: Look): number {
  const hat: Record<string, number> = { top: 2.45, chef: 2.35, captain: 1.5, cap: 1.32, rainHat: 1.48, beret: 1.32, flowerCrown: 1.25, bandana: 1.15, headscarf: 1.2 };
  if (look.hat) return hat[look.hat.style] ?? 1.2;
  if (look.hair.style === "twinBuns" || look.hair.style === "bun" || look.hair.style === "spiky" || look.hair.style === "curly") return 1.32;
  return 1.12;
}

function boneSpecs(f: Frame): BoneSpec[] {
  return [
    { name: "root", parent: null, pos: [0, 0, 0] },
    { name: "hips", parent: "root", pos: [0, f.hipY, 0] },
    { name: "spine", parent: "hips", pos: [0, f.hipY + 0.06, 0] },
    { name: "head", parent: "spine", pos: [0, f.neckY, 0] },
    { name: "armL", parent: "spine", pos: [f.shoulderX, f.shoulderY, 0] },
    { name: "elbowL", parent: "armL", pos: [f.shoulderX, f.elbowY, 0] },
    { name: "armR", parent: "spine", pos: [-f.shoulderX, f.shoulderY, 0] },
    { name: "elbowR", parent: "armR", pos: [-f.shoulderX, f.elbowY, 0] },
    { name: "legL", parent: "hips", pos: [f.legX, f.hipY, 0] },
    { name: "kneeL", parent: "legL", pos: [f.legX, f.kneeY, 0] },
    { name: "legR", parent: "hips", pos: [-f.legX, f.hipY, 0] },
    { name: "kneeR", parent: "legR", pos: [-f.legX, f.kneeY, 0] }
  ];
}

/* ------------------------------------------------------------- the body */

const sph = (r: number, w = 12, h = 9) => new THREE.SphereGeometry(r, w, h);
const cyl = (rt: number, rb: number, h: number, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg);
const rbox = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 1, r);

function buildBody(look: Look, f: Frame): THREE.BufferGeometry {
  const b = new RigBuilder(boneSpecs(f), 0.42);
  const { p } = f;
  const skin = look.skin;
  const topC = look.top.color;
  const trim = look.top.trim;
  const inner = look.inner ?? trim;
  const bot = look.bottom;
  const longSkirt = bot.style === "longSkirt";
  const skirt = bot.style === "skirt" || longSkirt;
  const acc = new Set(look.accessories);

  /* legs: thigh on legX, shin + shoe on kneeX */
  for (const side of [1, -1] as const) {
    const leg = side === 1 ? "legL" : "legR";
    const knee = side === 1 ? "kneeL" : "kneeR";
    const x = side * f.legX;
    const thighColor = bot.style === "pants" ? bot.color : bot.style === "shorts" ? bot.color : skin;
    const shinColor = bot.style === "pants" ? bot.color : longSkirt ? "#6b6560" : skin;
    b.add(cyl(p.legR, p.legR * 0.94, f.hipY - f.kneeY + 0.02), thighColor, leg, [x, (f.hipY + f.kneeY) / 2, 0]);
    if (bot.style === "shorts") b.add(cyl(p.legR * 1.08, p.legR * 1.05, (f.hipY - f.kneeY) * 0.62), bot.color, leg, [x, f.hipY - (f.hipY - f.kneeY) * 0.3, 0]);
    b.add(sph(p.legR * 0.95, 8, 6), shinColor, knee, [x, f.kneeY, 0]);
    b.add(cyl(p.legR * 0.92, p.legR * 0.8, f.kneeY - 0.05), shinColor, knee, [x, (f.kneeY + 0.05) / 2 + 0.02, 0]);
    if (look.top.style === "tracksuit") b.add(cyl(p.legR * 0.96, p.legR * 0.96, 0.03), trim, knee, [x, f.kneeY * 0.35, 0]);
    b.add(rbox(p.legR * 2.25, 0.08, p.legR * 3.3, 0.028), look.shoes, knee, [x, 0.04, p.legR * 0.55]);
  }

  /* hips: pelvis, skirts, coat hems */
  if (!skirt) b.add(cyl(p.girth * 0.97, p.girth * 0.9, 0.16, 14), bot.style === "shorts" || bot.style === "pants" ? bot.color : topC, "hips", [0, f.hipY - 0.01, 0], [0, 0, 0], [1, 1, 0.86]);
  if (bot.style === "skirt") b.add(cyl(p.girth * 0.98, p.girth * 1.55, 0.3, 16), bot.color, "hips", [0, f.hipY - 0.1, 0], [0, 0, 0], [1, 1, 0.88]);
  if (longSkirt) {
    const h = f.hipY - 0.08;
    b.add(cyl(p.girth * 1.0, p.girth * 1.6, h, 16), bot.color, "hips", [0, f.hipY + 0.04 - h / 2, 0], [0, 0, 0], [1, 1, 0.9]);
  }
  const hem = (len: number, color: string) =>
    b.add(cyl(p.girth * 1.02, p.girth * 1.22, len, 16), color, "hips", [0, f.hipY + 0.02 - len / 2, 0], [0, 0, 0], [1, 1, 0.9]);
  if (look.top.style === "coat" || look.top.style === "raincoat") hem(0.26, topC);
  if (look.top.style === "smock") hem(0.34, topC);
  if (look.top.style === "happi") hem(0.14, topC);
  if (look.top.style === "suit") hem(0.12, topC);
  if (acc.has("apron")) b.add(rbox(p.girth * 1.5, 0.34, 0.03, 0.012), "#ffffff", "hips", [0, f.hipY - 0.1, p.girth * 0.88]);

  /* torso */
  const torsoLen = Math.max(0.02, p.torsoH + 0.06 - p.girth * 2);
  const torsoY = f.hipY + p.torsoH / 2 + 0.01;
  const openFront = ["cardigan", "vest", "overalls", "suit", "coat", "happi"].includes(look.top.style);
  b.add(new THREE.CapsuleGeometry(p.girth, torsoLen, 5, 14), look.top.style === "overalls" ? inner : topC, "spine", [0, torsoY, 0], [0, 0, 0], [1, 1, 0.86]);
  if (look.build === "round") b.add(sph(p.girth * 0.9, 12, 9), topC, "spine", [0, torsoY - 0.06, p.girth * 0.25], [0, 0, 0], [1, 0.95, 0.9]);
  const front = (w: number, h: number, y: number, color: string, z = p.girth * 0.86) => b.add(rbox(w, h, 0.03, 0.01), color, "spine", [0, y, z]);
  if (openFront) front(p.girth * 0.5, p.torsoH * 0.82, torsoY + 0.02, inner, p.girth * 0.84 + (look.build === "round" ? 0.08 : 0));
  if (look.top.style === "overalls") {
    front(p.girth * 1.15, p.torsoH * 0.55, torsoY - 0.05, topC);
    for (const s of [1, -1]) b.add(new THREE.BoxGeometry(0.04, p.torsoH * 0.62, 0.02), topC, "spine", [s * p.girth * 0.42, torsoY + p.torsoH * 0.12, p.girth * 0.8], [0.1, 0, 0]);
  }
  if (look.top.style === "vest") for (const s of [1, -1]) b.add(rbox(p.girth * 0.62, p.torsoH * 0.78, 0.035, 0.01), topC, "spine", [s * p.girth * 0.42, torsoY, p.girth * 0.8]);
  if (["cardigan", "coat", "raincoat", "suit"].includes(look.top.style)) {
    for (let i = 0; i < 3; i++) b.add(sph(0.016, 8, 6), trim, "spine", [look.top.style === "cardigan" ? p.girth * 0.3 : 0.0, torsoY + 0.1 - i * 0.09, p.girth * 0.9 + (look.build === "round" ? 0.09 : 0)]);
  }
  if (look.top.style === "striped") for (let i = 0; i < 4; i++) b.add(cyl(p.girth * 1.01, p.girth * 1.01, 0.035, 14), trim, "spine", [0, torsoY - p.torsoH * 0.3 + i * p.torsoH * 0.19, 0], [0, 0, 0], [1, 1, 0.87]);
  if (look.top.style === "tracksuit") b.add(new THREE.BoxGeometry(0.02, p.torsoH * 0.8, 0.02), trim, "spine", [0, torsoY, p.girth * 0.87]);
  if (look.top.style === "happi") for (const s of [1, -1]) b.add(new THREE.BoxGeometry(0.045, p.torsoH * 0.9, 0.02), trim, "spine", [s * 0.05, torsoY + 0.02, p.girth * 0.86], [0, 0, s * 0.18]);
  if (look.top.style === "shirt" || look.top.style === "dress" || look.top.style === "tshirt") b.add(new THREE.TorusGeometry(0.075, 0.018, 6, 14), trim, "spine", [0, f.neckY - 0.02, 0], [Math.PI / 2, 0, 0]);
  if (acc.has("apron")) {
    front(p.girth * 1.2, p.torsoH * 0.6, torsoY - 0.04, "#ffffff", p.girth * 0.9);
    b.add(new THREE.TorusGeometry(0.1, 0.012, 5, 14), "#ffffff", "spine", [0, f.neckY - 0.04, 0.02], [Math.PI / 2 - 0.4, 0, 0]);
  }
  if (acc.has("sash")) b.add(new THREE.TorusGeometry(p.girth * 1.0, 0.034, 5, 16), trim === "#ffcf3f" ? "#e5484d" : trim, "spine", [0, torsoY + 0.02, 0.0], [Math.PI / 2, 0.62, 0], [1, 0.9, 0.86]);
  if (acc.has("bowtie")) for (const s of [1, -1]) b.add(new THREE.ConeGeometry(0.035, 0.06, 4), "#e5484d", "spine", [s * 0.03, f.neckY - 0.05, p.girth * 0.9], [0, 0, s * Math.PI / 2]);
  if (acc.has("whistle")) {
    b.add(new THREE.TorusGeometry(0.11, 0.008, 4, 16), "#2b2d42", "spine", [0, f.neckY - 0.08, 0.04], [Math.PI / 2 - 0.55, 0, 0]);
    b.add(new THREE.CylinderGeometry(0.018, 0.018, 0.05, 8), "#c9cdd3", "spine", [0, f.neckY - 0.17, p.girth * 0.95], [0, 0, Math.PI / 2]);
  }
  if (acc.has("glassesChain")) b.add(new THREE.TorusGeometry(0.1, 0.005, 4, 18), "#c8a04a", "spine", [0, f.neckY - 0.07, 0.04], [Math.PI / 2 - 0.6, 0, 0]);
  if (acc.has("backpack")) {
    b.add(rbox(p.girth * 1.9, p.torsoH * 0.95, 0.17, 0.05), "#f6c945", "spine", [0, torsoY + 0.02, -p.girth * 0.92 - 0.06]);
    b.add(rbox(p.girth * 1.3, p.torsoH * 0.35, 0.06, 0.03), "#e0a800", "spine", [0, torsoY - 0.08, -p.girth * 0.92 - 0.17]);
    for (const s of [1, -1]) b.add(new THREE.BoxGeometry(0.035, p.torsoH * 0.7, 0.02), "#d9a521", "spine", [s * p.girth * 0.55, torsoY + 0.02, p.girth * 0.82], [0.12, 0, 0]);
  }
  if (acc.has("randoseru")) {
    b.add(rbox(p.girth * 1.85, p.torsoH * 0.9, 0.2, 0.04), "#d6343c", "spine", [0, torsoY + 0.04, -p.girth * 0.92 - 0.08]);
    b.add(rbox(p.girth * 1.88, p.torsoH * 0.5, 0.03, 0.02), "#b8282f", "spine", [0, torsoY + 0.12, -p.girth * 0.92 - 0.19]);
    b.add(sph(0.02, 8, 6), "#ffcf3f", "spine", [0, torsoY - 0.02, -p.girth * 0.92 - 0.21]);
  }
  if (acc.has("paintSpots")) {
    const spots: [number, number, string][] = [[0.07, 0.08, "#e5484d"], [-0.06, -0.02, "#ffcf3f"], [0.02, -0.1, "#3daa6b"], [-0.09, 0.12, "#2f6fe4"]];
    for (const [x, y, c] of spots) b.add(sph(0.022, 8, 6), c, "spine", [x, torsoY + y, p.girth * 0.86 + 0.012], [0, 0, 0], [1, 1, 0.3]);
  }

  /* arms: upper arm on arm bone, forearm + hand on elbow bone */
  const sleeve = look.top.style === "overalls" ? inner : topC;
  for (const side of [1, -1] as const) {
    const arm = side === 1 ? "armL" : "armR";
    const elbow = side === 1 ? "elbowL" : "elbowR";
    const x = side * f.shoulderX;
    b.add(sph(p.armR * 1.15, 8, 6), sleeve, arm, [x, f.shoulderY, 0]);
    const upperLen = f.shoulderY - f.elbowY;
    if (look.shortSleeves) {
      b.add(cyl(p.armR * 1.05, p.armR, upperLen * 0.6), sleeve, arm, [x, f.shoulderY - upperLen * 0.3, 0]);
      b.add(cyl(p.armR * 0.85, p.armR * 0.85, upperLen * 0.5), skin, arm, [x, f.elbowY + upperLen * 0.25, 0]);
    } else b.add(cyl(p.armR, p.armR * 0.95, upperLen + 0.02), sleeve, arm, [x, (f.shoulderY + f.elbowY) / 2, 0]);
    if (look.top.style === "tracksuit") b.add(cyl(p.armR * 1.03, p.armR * 1.03, upperLen, 8), trim, arm, [x + side * p.armR * 0.75, (f.shoulderY + f.elbowY) / 2, 0], [0, 0, 0], [0.25, 1, 0.6]);
    const foreLen = f.elbowY - f.handY;
    const foreColor = look.shortSleeves ? skin : sleeve;
    b.add(sph(p.armR * 0.95, 8, 6), foreColor, elbow, [x, f.elbowY, 0]);
    b.add(cyl(p.armR * 0.92, p.armR * 0.82, foreLen), foreColor, elbow, [x, (f.elbowY + f.handY) / 2 + 0.01, 0]);
    if (!look.shortSleeves) b.add(cyl(p.armR * 0.98, p.armR * 0.98, 0.03), trim, elbow, [x, f.handY + 0.05, 0]);
    b.add(sph(p.armR * 1.12, 8, 6), skin, elbow, [x, f.handY, 0.005], [0, 0, 0], [0.95, 1.05, 0.9]);
  }

  /* head */
  const hr = p.headR;
  const hy = f.headY;
  b.add(cyl(0.055, 0.062, p.neck + 0.08), skin, "head", [0, f.neckY + p.neck / 2, 0]);
  b.add(sph(hr, 16, 12), skin, "head", [0, hy, 0], [0, 0, 0], [1, 0.97, 0.96]);
  for (const s of [1, -1]) b.add(sph(hr * 0.22, 8, 6), skin, "head", [s * hr * 0.97, hy - hr * 0.08, -hr * 0.02], [0, 0, 0], [0.55, 1, 0.8]);
  b.add(sph(hr * 0.13, 8, 6), shade(skin, 0.94), "head", [0, hy - hr * 0.12, hr * 0.94]);
  for (const s of [1, -1]) b.add(sph(hr * 0.16, 8, 6), "#ff9c8c", "head", [s * hr * 0.55, hy - hr * 0.27, hr * 0.76], [0, s * 0.6, 0], [1, 0.6, 0.35]);
  hair(b, look, hr, hy);
  hat(b, look, hr, hy);
  if (acc.has("glasses")) {
    for (const s of [1, -1]) b.add(new THREE.TorusGeometry(hr * 0.21, hr * 0.035, 5, 14), "#3b3226", "head", [s * hr * 0.36, hy + hr * 0.06, hr * 0.94], [0, s * 0.35, 0]);
    b.add(new THREE.BoxGeometry(hr * 0.22, hr * 0.04, hr * 0.04), "#3b3226", "head", [0, hy + hr * 0.08, hr * 0.99]);
  }
  if (acc.has("mustache")) for (const s of [1, -1]) b.add(sph(hr * 0.17, 10, 6), look.hair.color, "head", [s * hr * 0.15, hy - hr * 0.24, hr * 0.92], [0, 0, s * -0.35], [1.4, 0.55, 0.6]);
  if (acc.has("beard")) {
    b.add(sph(hr * 0.55, 12, 8), look.hair.color, "head", [0, hy - hr * 0.55, hr * 0.42], [0, 0, 0], [1.05, 0.8, 0.75]);
    for (const s of [1, -1]) b.add(sph(hr * 0.34, 10, 8), look.hair.color, "head", [s * hr * 0.62, hy - hr * 0.38, hr * 0.3], [0, 0, 0], [0.7, 1.1, 0.8]);
  }
  return b.build();
}

function shade(hex: string, k: number): string {
  return `#${new THREE.Color(hex).multiplyScalar(k).getHexString()}`;
}

/** Hair as offset spheres: the face stays clear because the volume sits behind and above it. */
function hair(b: RigBuilder, look: Look, hr: number, hy: number) {
  const c = look.hair.color;
  // Under a covering hat only the hair below the brim shows: no fringe, a smaller
  // and lower volume, so nothing pokes through the hat.
  const hatted = !!look.hat && ["top", "cap", "chef", "captain", "rainHat"].includes(look.hat.style);
  if (look.hat?.style === "headscarf") return;
  const cap = (scale: V3 = [1.03, 0.94, 1.0], dz = -0.15, dy = 0.12, r = 1.05) =>
    hatted
      ? b.add(sph(hr * 1.0, 16, 12), c, "head", [0, hy - hr * 0.05, -hr * 0.15], [0, 0, 0], [1.03, 0.94, 1.0])
      : b.add(sph(hr * r, 16, 12), c, "head", [0, hy + hr * dy, hr * dz], [0, 0, 0], scale);
  const fringe = () => {
    if (hatted) return;
    for (const [x, s] of [[-0.42, 0.9], [0, 1], [0.42, 0.9]] as const) b.add(sph(hr * 0.3 * s, 8, 6), c, "head", [x * hr, hy + hr * 0.62, hr * 0.62], [0.5, 0, 0], [1.25, 0.6, 0.8]);
  };
  switch (look.hair.style) {
    case "short":
      cap();
      fringe();
      break;
    case "spiky":
      cap();
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        b.add(new THREE.ConeGeometry(hr * 0.2, hr * 0.42, 6), c, "head", [Math.sin(a) * hr * 0.55, hy + hr * 0.82, Math.cos(a) * hr * 0.5 - hr * 0.08], [Math.cos(a) * 0.6, 0, -Math.sin(a) * 0.6]);
      }
      fringe();
      break;
    case "bob":
      cap([1.08, 1.02, 1.0], -0.2, -0.02, 1.1);
      fringe();
      break;
    case "long":
      cap([1.07, 1.0, 1.0], -0.18, 0.02, 1.08);
      fringe();
      b.add(rbox(hr * 1.7, hr * 1.9, hr * 0.5, hr * 0.2), c, "head", [0, hy - hr * 0.75, -hr * 0.62]);
      break;
    case "ponytail":
      cap();
      fringe();
      b.add(sph(hr * 0.16, 8, 6), "#e5484d", "head", [0, hy + hr * 0.3, -hr * 1.02]);
      b.add(new THREE.CapsuleGeometry(hr * 0.24, hr * 0.85, 4, 10), c, "head", [0, hy - hr * 0.25, -hr * 1.12], [0.25, 0, 0]);
      break;
    case "pigtails":
      cap();
      fringe();
      for (const s of [1, -1]) {
        b.add(sph(hr * 0.13, 8, 6), "#ff9cc0", "head", [s * hr * 0.9, hy - hr * 0.05, -hr * 0.35]);
        b.add(new THREE.CapsuleGeometry(hr * 0.2, hr * 0.55, 4, 10), c, "head", [s * hr * 1.02, hy - hr * 0.48, -hr * 0.38], [0, 0, s * 0.35]);
      }
      break;
    case "bun":
      cap();
      fringe();
      b.add(sph(hr * 0.4, 12, 10), c, "head", [0, hy + hr * 0.62, -hr * 0.7]);
      break;
    case "twinBuns":
      cap();
      fringe();
      for (const s of [1, -1]) {
        b.add(sph(hr * 0.33, 12, 10), c, "head", [s * hr * 0.62, hy + hr * 0.85, -hr * 0.25]);
        b.add(new THREE.TorusGeometry(hr * 0.24, hr * 0.06, 5, 12), "#e5484d", "head", [s * hr * 0.6, hy + hr * 0.72, -hr * 0.22], [Math.PI / 2, 0, 0]);
      }
      break;
    case "curly":
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        b.add(sph(hr * 0.34, 8, 6), c, "head", [Math.sin(a) * hr * 0.72, hy + hr * 0.5 + (i % 2) * hr * 0.14, Math.cos(a) * hr * 0.62 - hr * 0.18]);
      }
      b.add(sph(hr * 0.5, 12, 10), c, "head", [0, hy + hr * 0.8, -hr * 0.1]);
      break;
    case "sides":
      for (const s of [1, -1]) b.add(sph(hr * 0.42, 12, 8), c, "head", [s * hr * 0.82, hy + hr * 0.05, -hr * 0.25], [0, 0, 0], [0.6, 1.0, 1.1]);
      b.add(sph(hr * 0.6, 12, 8), c, "head", [0, hy + hr * 0.02, -hr * 0.62], [0, 0, 0], [1.3, 0.9, 0.6]);
      break;
    case "none":
      break;
  }
  if (look.accessories.includes("ribbons") && look.hair.style === "ponytail") {
    for (const s of [1, -1]) b.add(new THREE.ConeGeometry(hr * 0.16, hr * 0.3, 4), "#ff6fa5", "head", [s * hr * 0.15, hy + hr * 0.32, -hr * 1.02], [0, 0, s * Math.PI / 2]);
  }
}

function hat(b: RigBuilder, look: Look, hr: number, hy: number) {
  const h = look.hat;
  if (!h) return;
  const top = hy + hr * 0.92;
  switch (h.style) {
    case "top":
      b.add(cyl(hr * 1.32, hr * 1.32, 0.024, 14), h.color, "head", [0, top - 0.02, 0]);
      b.add(cyl(hr * 0.86, hr * 0.9, hr * 1.35, 14), h.color, "head", [0, top - 0.02 + hr * 0.67, 0]);
      b.add(cyl(hr * 0.92, hr * 0.92, hr * 0.26, 14), h.band ?? "#e5484d", "head", [0, top + hr * 0.12, 0]);
      break;
    case "cap":
      b.add(new THREE.SphereGeometry(hr * 1.08, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), h.color, "head", [0, hy + hr * 0.18, -hr * 0.04], [-0.12, 0, 0]);
      b.add(new THREE.CylinderGeometry(hr * 0.78, hr * 0.78, 0.022, 16, 1, false, Math.PI / 2, Math.PI), h.color, "head", [0, hy + hr * 0.42, hr * 0.62], [-0.15, 0, 0], [1, 1, 1.15]);
      b.add(sph(hr * 0.12, 8, 6), shade(h.color, 0.8), "head", [0, hy + hr * 1.26, -hr * 0.1]);
      break;
    case "chef":
      b.add(cyl(hr * 0.92, hr * 0.95, hr * 0.55, 16), h.color, "head", [0, top + hr * 0.08, 0]);
      for (const [x, z] of [[0, 0], [hr * 0.45, 0.02], [-hr * 0.45, 0.02], [0, hr * 0.4], [0, -hr * 0.4]] as const)
        b.add(sph(hr * 0.62, 10, 7), h.color, "head", [x, top + hr * 0.75, z]);
      break;
    case "captain":
      b.add(cyl(hr * 1.04, hr * 1.0, hr * 0.42, 18), h.color, "head", [0, top + hr * 0.02, 0], [0, 0, 0], [1, 1, 1]);
      b.add(cyl(hr * 1.14, hr * 1.14, hr * 0.12, 18), h.band ?? "#2b2d42", "head", [0, top - hr * 0.16, 0]);
      b.add(new THREE.CylinderGeometry(hr * 0.7, hr * 0.7, 0.022, 16, 1, false, Math.PI / 2, Math.PI), "#1d1f2b", "head", [0, top - hr * 0.2, hr * 0.62], [-0.2, 0, 0], [1, 1, 1.1]);
      b.add(sph(hr * 0.14, 8, 6), "#ffcf3f", "head", [0, top + hr * 0.05, hr * 1.02], [0, 0, 0], [1, 1, 0.4]);
      break;
    case "beret":
      b.add(sph(hr * 1.02, 16, 10), h.color, "head", [hr * 0.12, top - hr * 0.05, -hr * 0.05], [0, 0, -0.2], [1.12, 0.38, 1.08]);
      b.add(sph(hr * 0.08, 6, 4), h.color, "head", [hr * 0.15, top + hr * 0.32, 0]);
      break;
    case "bandana":
      b.add(new THREE.TorusGeometry(hr * 0.97, hr * 0.1, 6, 20), h.color, "head", [0, hy + hr * 0.45, -hr * 0.05], [Math.PI / 2 + 0.25, 0, 0]);
      b.add(sph(hr * 0.16, 8, 6), h.color, "head", [hr * 0.1, hy + hr * 0.3, -hr * 0.98]);
      break;
    case "headscarf":
      b.add(sph(hr * 1.09, 18, 14), h.color, "head", [0, hy + hr * 0.14, -hr * 0.17], [0, 0, 0], [1.04, 0.98, 1.0]);
      b.add(sph(hr * 0.22, 8, 6), shade(h.color, 0.85), "head", [0, hy - hr * 0.2, -hr * 1.02]);
      break;
    case "flowerCrown": {
      const colors = ["#ff8fb1", "#ffcf3f", "#ffffff", "#b39cf2"];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        b.add(sph(hr * 0.15, 8, 6), colors[i % colors.length], "head", [Math.sin(a) * hr * 0.92, hy + hr * 0.62 - Math.cos(a) * hr * 0.12, Math.cos(a) * hr * 0.86 - hr * 0.05]);
      }
      break;
    }
    case "rainHat":
      // Raised and tipped up at the front so the eyes stay visible.
      b.add(new THREE.SphereGeometry(hr * 1.06, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), h.color, "head", [0, hy + hr * 0.34, -hr * 0.02]);
      b.add(cyl(hr * 1.02, hr * 1.42, hr * 0.12, 18), h.color, "head", [0, hy + hr * 0.32, -hr * 0.1], [0.14, 0, 0]);
      break;
  }
}

/* -------------------------------------------------------------- the face */

export type Expression = "neutral" | "happy" | "sad" | "surprised";

/** Face pieces sit on the head sphere, built in head-bone space. */
function buildFace(look: Look, f: Frame, expr: Expression, blink: boolean): THREE.BufferGeometry {
  const hr = f.p.headR;
  const cy = f.headY - f.neckY;
  const b = new RigBuilder([{ name: "face", parent: null, pos: [0, 0, 0] }], 1e-6);
  const onHead = (x: number, y: number, lift = 0.004): { pos: V3; rot: V3 } => {
    const r = hr * 0.985;
    const z = Math.sqrt(Math.max(0, r * r - x * x - y * y)) * 0.96 + lift;
    return { pos: [x, cy + y, z], rot: [-Math.asin(y / r), Math.atan2(x, z), 0] };
  };
  const ink = "#1d1712";
  const brow = shade(look.hair.color === "#f2efe8" || look.hair.color === "#c9c6c2" || look.hair.color === "#bfbab3" ? "#8a8580" : look.hair.color, 0.85);
  const eyeY = hr * 0.07;
  const eyeX = hr * 0.36;
  for (const s of [1, -1]) {
    const e = onHead(s * eyeX, eyeY);
    if (blink) b.add(new THREE.BoxGeometry(hr * 0.2, hr * 0.03, hr * 0.03), ink, "face", e.pos, e.rot, [1, 1, 1], { flatAo: true });
    else if (expr === "happy") b.add(new THREE.TorusGeometry(hr * 0.1, hr * 0.03, 4, 10, Math.PI), ink, "face", e.pos, [e.rot[0], e.rot[1], 0], [1, 1, 0.6], { flatAo: true });
    else {
      const big = expr === "surprised" ? 1.25 : 1;
      b.add(sph(hr * 0.12 * big, 10, 8), ink, "face", e.pos, e.rot, [0.82, 1.12, 0.45], { flatAo: true });
      const hl = onHead(s * eyeX + hr * 0.04, eyeY + hr * 0.05, 0.012);
      b.add(sph(hr * 0.035 * big, 6, 4), "#ffffff", "face", hl.pos, hl.rot, [1, 1, 0.5], { flatAo: true });
    }
    const bw = onHead(s * eyeX, eyeY + hr * (expr === "surprised" ? 0.36 : 0.28), 0.006);
    const tilt = expr === "sad" ? s * 0.4 : expr === "surprised" ? 0 : s * -0.08;
    b.add(new THREE.BoxGeometry(hr * 0.24, hr * 0.05, hr * 0.03), brow, "face", bw.pos, [bw.rot[0], bw.rot[1], tilt], [1, 1, 1], { flatAo: true });
  }
  const m = onHead(0, -hr * 0.36, 0.004);
  if (expr === "happy") {
    b.add(new THREE.CircleGeometry(hr * 0.17, 14, Math.PI, Math.PI), "#7a2a2a", "face", m.pos, m.rot, [1.2, 1, 1], { flatAo: true });
    const t = onHead(0, -hr * 0.44, 0.006);
    b.add(new THREE.CircleGeometry(hr * 0.08, 10, Math.PI, Math.PI), "#ff7f8a", "face", t.pos, t.rot, [1.2, 0.8, 1], { flatAo: true });
  } else if (expr === "sad") b.add(new THREE.TorusGeometry(hr * 0.1, hr * 0.022, 4, 10, Math.PI), "#7a2a2a", "face", onHead(0, -hr * 0.42).pos, m.rot, [1, 0.7, 0.5], { flatAo: true });
  else if (expr === "surprised") b.add(sph(hr * 0.07, 10, 8), "#5a1f1f", "face", m.pos, m.rot, [0.9, 1.2, 0.3], { flatAo: true });
  else b.add(new THREE.TorusGeometry(hr * 0.11, hr * 0.022, 4, 10, Math.PI), "#7a2a2a", "face", onHead(0, -hr * 0.3).pos, [m.rot[0], m.rot[1], Math.PI], [1, 0.75, 0.5], { flatAo: true });
  return b.build();
}

/* --------------------------------------------------------------- the rig */

/** Looping states. "present" holds an item up until the flow changes state (a line may outlast any timer). */
export type RigState = "idle" | "walk" | "run" | "talk" | "sit" | "sad" | "think" | "present";
export type RigGesture = "nod" | "shake" | "cheer" | "give" | "show";
const GESTURE_TIME: Record<RigGesture, number> = { nod: 0.9, shake: 1.0, cheer: 1.4, give: 1.3, show: 1.6 };
const EXPRESSIONS: Expression[] = ["neutral", "happy", "sad", "surprised"];

let phaseSeed = 0;

/**
 * An animated character: one skinned mesh + a face mesh (geometry swapped for
 * expressions and blinks) + a right-hand socket for held items.
 */
export class CharacterRig {
  readonly group = new THREE.Group();
  readonly mesh: THREE.SkinnedMesh;
  readonly bones: Record<string, THREE.Bone>;
  readonly face: THREE.Mesh;
  readonly hand = new THREE.Group();
  /** Shoulder anchor for Kiwi (player only matters). */
  readonly shoulder = new THREE.Group();
  readonly height: number;
  readonly radius: number;
  /** Head centre and radius in the group's local (unscaled) space, for framing. */
  readonly headCenterY: number;
  readonly headR: number;
  private faces: Record<Expression, [THREE.BufferGeometry, THREE.BufferGeometry]>;
  private base: RigState = "idle";
  private gesture: { kind: RigGesture; t: number } | null = null;
  private expr: Expression = "neutral";
  private t = 0;
  private walkPhase = 0;
  private walkSpeed = 0;
  private blinkT = 2;
  private lookTarget: THREE.Vector3 | null = null;
  private headYaw = 0;
  private headPitch = 0;
  private readonly phase: number;
  private readonly hunch: number;
  private readonly hipY0: number;
  private held: ItemId | null = null;

  constructor(
    readonly id: LookId,
    look: Look = LOOKS[id]
  ) {
    const f = frameOf(look);
    const specs = boneSpecs(f);
    const geo = buildBody(look, f);
    const { mesh, bones } = skinnedMesh(geo, specs, skinnedMat(), new THREE.Sphere(new THREE.Vector3(0, f.top / 2, 0), f.top * 0.85));
    this.mesh = mesh;
    this.bones = bones;
    this.faces = Object.fromEntries(EXPRESSIONS.map((e) => [e, [buildFace(look, f, e, false), buildFace(look, f, e, true)]])) as CharacterRig["faces"];
    this.face = new THREE.Mesh(this.faces.neutral[0], smoothMat());
    bones.head.add(this.face);
    // Hand socket at the right hand (elbowR bone space).
    this.hand.position.set(0, f.handY - f.elbowY - 0.02, 0.06);
    bones.elbowR.add(this.hand);
    this.shoulder.position.set(f.shoulderX * 0.9, f.shoulderY - (f.hipY + 0.06) + 0.1, -0.02);
    bones.spine.add(this.shoulder);
    this.group.add(mesh);
    this.group.scale.setScalar(look.scale);
    this.group.name = `character:${id}`;
    this.height = f.top * look.scale;
    this.radius = (PROPS[look.build].girth + 0.12) * look.scale;
    this.headCenterY = f.headY;
    this.headR = f.p.headR;
    this.phase = (phaseSeed++ * 1.7) % (Math.PI * 2);
    this.hunch = look.hunch ?? 0;
    this.hipY0 = bones.hips.position.y;
    this.update(0);
  }

  get state(): RigState {
    return this.base;
  }

  /** Looping states, or a one-shot gesture that returns to the current state. */
  setState(s: RigState | RigGesture): void {
    if (s === "nod" || s === "shake" || s === "cheer" || s === "give" || s === "show") this.gesture = { kind: s, t: 0 };
    else this.base = s;
  }

  get gesturing(): boolean {
    return this.gesture !== null;
  }

  setWalkSpeed(v: number): void {
    this.walkSpeed = v;
  }

  setExpression(e: Expression): void {
    this.expr = e;
    this.face.geometry = this.faces[e][0];
  }

  /** Shows an item in the right hand (null empties it). */
  hold(item: ItemId | null): void {
    if (item === this.held) return;
    this.hand.clear();
    this.held = item;
    if (!item) return;
    const m = buildItem(item);
    const d = ITEM_DISPLAY[item];
    const size = itemSize(item);
    m.scale.setScalar(d.hand / this.group.scale.x);
    m.position.y = (-size.y / 2) * m.scale.y;
    const pivot = new THREE.Group();
    pivot.rotation.set(...d.holdRot);
    pivot.add(m);
    this.hand.add(pivot);
  }

  get holding(): ItemId | null {
    return this.held;
  }

  /** Turns the head toward a world point (null: look ahead). */
  lookAt(point: THREE.Vector3 | null): void {
    this.lookTarget = point ? point.clone() : null;
  }

  update(dt: number): void {
    this.t += dt;
    const t = this.t + this.phase;
    const B = this.bones;
    for (const k of Object.keys(B)) B[k].rotation.set(0, 0, 0);
    B.root.position.y = 0;
    let headX = 0;
    let headY = 0;
    let headZ = 0;
    let spineX = this.hunch;
    let armLX = 0.02, armLZ = 0.07, armRX = 0.02, armRZ = -0.07, elbowLX = -0.12, elbowRX = -0.12;
    let legLX = 0, legRX = 0, kneeLX = 0, kneeRX = 0;
    let bob = 0;

    switch (this.base) {
      case "walk":
      case "run": {
        const run = this.base === "run" ? 1 : 0;
        const speed = Math.max(this.walkSpeed, 0.8);
        this.walkPhase += dt * speed * (run ? 2.6 : 3.1);
        const s = Math.sin(this.walkPhase);
        const amp = run ? 0.75 : 0.5;
        legLX = s * amp;
        legRX = -s * amp;
        kneeLX = Math.max(0, -Math.cos(this.walkPhase)) * amp * 1.1;
        kneeRX = Math.max(0, Math.cos(this.walkPhase)) * amp * 1.1;
        armLX = -s * amp * 0.85;
        armRX = s * amp * 0.85;
        elbowLX = elbowRX = -0.35 - run * 0.6;
        bob = Math.abs(Math.cos(this.walkPhase)) * (run ? 0.06 : 0.035);
        spineX += 0.05 + run * 0.12;
        break;
      }
      case "talk":
        headX = Math.sin(t * 5.2) * 0.04;
        armRX = -0.45 - Math.max(0, Math.sin(t * 2.4)) * 0.35;
        elbowRX = -0.7;
        armRZ = -0.15;
        spineX += Math.sin(t * 1.6) * 0.015;
        break;
      case "sit":
        legLX = legRX = -1.45;
        kneeLX = kneeRX = 1.45;
        B.root.position.y = -0.02;
        armLX = armRX = -0.5;
        elbowLX = elbowRX = -0.9;
        armLZ = 0.12;
        armRZ = -0.12;
        spineX += Math.sin(t * 1.4) * 0.012;
        break;
      case "sad":
        headX = 0.38;
        spineX += 0.14;
        armLZ = 0.02;
        armRZ = -0.02;
        break;
      case "think":
        armRX = -2.2;
        armRZ = 0.35;
        elbowRX = -1.9;
        headZ = 0.14;
        headX = -0.08;
        break;
      case "present":
        armRX = -1.7 + Math.sin(t * 2.2) * 0.04;
        armRZ = -0.1;
        elbowRX = -0.35;
        headX = 0.06;
        spineX += Math.sin(t * 1.6) * 0.012;
        break;
      default:
        spineX += Math.sin(t * 1.6) * 0.018;
        armLZ += Math.sin(t * 1.6) * 0.02;
        armRZ -= Math.sin(t * 1.6) * 0.02;
        headY = Math.sin(t * 0.45) * 0.12;
        headX = Math.sin(t * 0.7) * 0.03;
        break;
    }

    if (this.gesture) {
      const g = this.gesture;
      g.t += dt;
      const p = Math.min(1, g.t / GESTURE_TIME[g.kind]);
      const env = Math.sin(Math.PI * p);
      switch (g.kind) {
        case "nod":
          headX = 0.32 * Math.abs(Math.sin(p * Math.PI * 2));
          headY *= 0.2;
          break;
        case "shake":
          headY = 0.5 * Math.sin(p * Math.PI * 6) * (1 - p * 0.4);
          headX = 0.05;
          break;
        case "cheer": {
          const up = Math.min(1, env * 3);
          armLX = armRX = -2.7 * up;
          armLZ = 0.35 * up;
          armRZ = -0.35 * up;
          elbowLX = elbowRX = -0.2;
          bob += Math.abs(Math.sin(p * Math.PI * 2)) * 0.12;
          headX = -0.15 * up;
          break;
        }
        case "give":
        case "show": {
          const k = Math.min(1, env * 2.2);
          armRX = (g.kind === "show" ? -1.75 : -1.25) * k;
          armRZ = -0.1;
          elbowRX = (g.kind === "show" ? -0.35 : -0.25) * k;
          headX = 0.08 * k;
          break;
        }
      }
      if (p >= 1) this.gesture = null;
    }

    // Head turn toward a target, eased.
    let wantYaw = headY;
    let wantPitch = 0;
    if (this.lookTarget && this.group.parent) {
      const local = this.group.worldToLocal(this.lookTarget.clone());
      const yaw = Math.atan2(local.x, local.z);
      wantYaw = THREE.MathUtils.clamp(yaw, -0.9, 0.9);
      wantPitch = THREE.MathUtils.clamp(-Math.atan2(local.y - this.height * 0.85 / this.group.scale.x, Math.hypot(local.x, local.z)) * 0.5, -0.3, 0.3);
    }
    const ease = 1 - Math.exp(-dt * 8);
    this.headYaw += (wantYaw - this.headYaw) * ease;
    this.headPitch += (wantPitch - this.headPitch) * ease;

    B.hips.position.y = this.hipY0 + bob;
    B.spine.rotation.x = spineX;
    B.head.rotation.set(headX + this.headPitch, this.gesture?.kind === "shake" ? headY : this.headYaw, headZ);
    B.armL.rotation.set(armLX, 0, armLZ);
    B.armR.rotation.set(armRX, 0, armRZ);
    B.elbowL.rotation.x = elbowLX;
    B.elbowR.rotation.x = elbowRX;
    B.legL.rotation.x = legLX;
    B.legR.rotation.x = legRX;
    B.kneeL.rotation.x = kneeLX;
    B.kneeR.rotation.x = kneeRX;

    // Blinking.
    this.blinkT -= dt;
    const blinking = this.blinkT < 0.12;
    if (this.blinkT < 0) this.blinkT = 2.4 + ((Math.sin(t * 13.7) + 1) / 2) * 2.6;
    this.face.geometry = this.faces[this.expr][blinking && this.expr !== "happy" ? 1 : 0];
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    for (const [a, bb] of Object.values(this.faces)) {
      a.dispose();
      bb.dispose();
    }
  }
}

/** Builds a character rig for a person (or the player). */
export function buildCharacter(id: LookId): CharacterRig {
  return new CharacterRig(id);
}

export const ALL_LOOK_IDS = Object.keys(LOOKS) as LookId[];

/** For tests: triangle count of a character's body geometry. */
export function characterTriangles(id: LookId): number {
  const look = LOOKS[id];
  const geo = buildBody(look, frameOf(look));
  const n = geo.attributes.position.count / 3;
  geo.dispose();
  return n;
}

export type { NpcId };
