import * as THREE from "three";

/** A camera-facing text label as a sprite (canvas texture, system font). */
export function textSprite(
  text: string,
  opts: { height?: number; color?: string; background?: string; fontPx?: number; bold?: boolean } = {}
): THREE.Sprite {
  const fontPx = opts.fontPx ?? 48;
  const font = `${opts.bold === false ? "" : "bold "}${fontPx}px "Hiragino Maru Gothic ProN", "Arial Rounded MT Bold", "Segoe UI", system-ui, sans-serif`;
  const c = document.createElement("canvas");
  const g = c.getContext("2d")!;
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + fontPx;
  c.width = w;
  c.height = Math.ceil(fontPx * 1.5);
  g.font = font;
  if (opts.background) {
    g.fillStyle = opts.background;
    const r = c.height / 2;
    g.beginPath();
    g.roundRect(0, 0, c.width, c.height, r);
    g.fill();
  }
  g.fillStyle = opts.color ?? "#2b2d42";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, c.width / 2, c.height / 2 + fontPx * 0.04);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const s = new THREE.Sprite(mat);
  const h = opts.height ?? 0.3;
  s.scale.set((h * c.width) / c.height, h, 1);
  return s;
}
