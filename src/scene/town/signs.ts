import * as THREE from "three";
import { occluding } from "../materials";

/**
 * All painted lettering lives on one small canvas (SPEC §9: canvas textures
 * only where needed), so a district's signs are a single mesh attached to the
 * boards that carry them instead of floating billboards.
 */
const STYLES = {
  wood: { bg: "#fff4d4", edge: "#8a5a3a", fg: "#5a3d28" },
  red: { bg: "#e8604c", edge: "#fff4d4", fg: "#fffaf0" },
  green: { bg: "#e7f7dc", edge: "#5fa564", fg: "#2f6b3f" },
  blue: { bg: "#ffe680", edge: "#3f83c9", fg: "#2a5f9e" },
  orange: { bg: "#ffa94d", edge: "#3f8f55", fg: "#3f3016" },
  gold: { bg: "#ffcc4d", edge: "#b5572f", fg: "#8a3a22" },
  plain: { bg: "#fff4d4", edge: "#fff4d4", fg: "#c0432f" }
};
const SIGNS = {
  square: { text: "Village Square", style: "wood" },
  market: { text: "Market", style: "wood" },
  school: { text: "Schoolhouse", style: "wood" },
  library: { text: "Library", style: "wood" },
  harbor: { text: "Riverside & Harbor", style: "wood" },
  arch: { text: "F E S T I V A L", style: "plain" },
  soon: { text: "Coming soon!", style: "gold" },
  bakery: { text: "Bakery", style: "red" },
  flowers: { text: "Flowers", style: "green" },
  toys: { text: "Toys", style: "blue" },
  fruit: { text: "Fruit", style: "orange" },
  lostFound: { text: "Lost & Found", style: "gold" },
  prizes: { text: "Prizes", style: "gold" },
  draw: { text: "Draw!", style: "blue" },
  snacks: { text: "Snacks", style: "red" },
  games: { text: "Games", style: "green" },
  stage: { text: "School Festival", style: "red" },
  today: { text: "TODAY!", style: "red" }
} as const;
export type SignId = keyof typeof SIGNS;

interface Rect { u0: number; v0: number; u1: number; v1: number; aspect: number }
let atlas: { texture: THREE.CanvasTexture; rects: Record<SignId, Rect>; material: THREE.MeshLambertMaterial } | null = null;

function getAtlas() {
  if (atlas) return atlas;
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  const h = 84, font = `bold 54px "Hiragino Maru Gothic ProN", "Arial Rounded MT Bold", "Segoe UI", system-ui, sans-serif`;
  const ids = Object.keys(SIGNS) as SignId[];
  // Lay out first: the atlas has to be tall enough, or the last rows smear off its edge.
  const measure = canvas.getContext("2d")!;
  measure.font = font;
  const widths = ids.map(id => Math.ceil(measure.measureText(SIGNS[id].text).width) + 56);
  let rows = 1, run = 4;
  for (const w of widths) { if (run + w > canvas.width - 4) { rows++; run = 4; } run += w + 6; }
  canvas.height = rows * (h + 6) + 8;
  const g = canvas.getContext("2d")!;
  const rects = {} as Record<SignId, Rect>;
  let x = 4, y = 4;
  ids.forEach((id, index) => {
    const { text, style } = SIGNS[id], colors = STYLES[style], w = widths[index];
    g.font = font;
    if (x + w > canvas.width - 4) { x = 4; y += h + 6; }
    g.fillStyle = colors.edge;
    g.beginPath(); g.roundRect(x, y, w, h, 16); g.fill();
    g.fillStyle = colors.bg;
    g.beginPath(); g.roundRect(x + 6, y + 6, w - 12, h - 12, 11); g.fill();
    g.fillStyle = colors.fg;
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, x + w / 2, y + h / 2 + 3);
    rects[id] = { u0: x / canvas.width, u1: (x + w) / canvas.width, v0: 1 - (y + h) / canvas.height, v1: 1 - y / canvas.height, aspect: w / h };
    x += w + 6;
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  atlas = { texture, rects, material: occluding(new THREE.MeshLambertMaterial({ map: texture, alphaTest: 0.5 })) };
  return atlas;
}

export const signMat = () => getAtlas().material;

/** Quads placed on boards; `y` is the sign's centre, `height` its size in metres. */
export class SignBatch {
  private positions: number[] = [];
  private normals: number[] = [];
  private uvs: number[] = [];

  add(id: SignId, x: number, y: number, z: number, height: number, yaw = 0): this {
    const r = getAtlas().rects[id], hw = height * r.aspect / 2, hh = height / 2;
    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    const corner = (u: number, v: number) => [x + u * cos, y + v, z - u * sin];
    const a = corner(-hw, -hh), b = corner(hw, -hh), c = corner(hw, hh), d = corner(-hw, hh);
    this.positions.push(...a, ...b, ...c, ...a, ...c, ...d);
    for (let i = 0; i < 6; i++) this.normals.push(sin, 0, cos);
    this.uvs.push(r.u0, r.v0, r.u1, r.v0, r.u1, r.v1, r.u0, r.v0, r.u1, r.v1, r.u0, r.v1);
    return this;
  }

  /** Width the sign will have at this height, for sizing its backing board. */
  static width(id: SignId, height: number): number {
    return height * getAtlas().rects[id].aspect;
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.normals, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uvs, 2));
    g.computeBoundingSphere();
    return g;
  }
}
