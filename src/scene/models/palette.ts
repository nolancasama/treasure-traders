import type { ItemId } from "../../game/content/ids";

/**
 * One source of colour for 3D models, SVG icons and portraits (SPEC §9), so
 * the backpack icon and the object in a character's hand can never drift.
 */
export const ITEM_COLORS: Record<ItemId, { main: string; dark: string; light: string; accent: string }> = {
  pen: { main: "#2f6fe4", dark: "#1d4fb0", light: "#7fa8f2", accent: "#c9ced6" },
  marker: { main: "#e5484d", dark: "#a92f34", light: "#f28d90", accent: "#ffffff" },
  ruler: { main: "#e9c46a", dark: "#b8943e", light: "#f6dd9c", accent: "#3b3226" },
  stapler: { main: "#3a3f4b", dark: "#23262e", light: "#6b7282", accent: "#c9cdd3" },
  calendar: { main: "#ffffff", dark: "#d9dce3", light: "#ffffff", accent: "#e5484d" },
  notebook: { main: "#3daa6b", dark: "#2a7d4e", light: "#79cf9c", accent: "#ffffff" },
  eraser: { main: "#ffffff", dark: "#d9dde2", light: "#ffffff", accent: "#6cc4f0" },
  pencil: { main: "#f6c945", dark: "#c99a1e", light: "#fbe08c", accent: "#f5a3b5" },
  pencilCase: { main: "#8e6cef", dark: "#6447c2", light: "#b9a2f6", accent: "#ffcf3f" }
};

/** Shared ink/outline colour for icons. */
export const INK = "#2b2d42";

export const WOOD = { light: "#c98a4b", main: "#b5651d", dark: "#7f4614", deep: "#5a3410" };
export const GOLD = { main: "#ffcf3f", dark: "#d9a521", light: "#ffe58a" };
export const IRON = { main: "#4a4e57", dark: "#2f3238" };

export const SKIN = {
  light: "#f6d2b0",
  fair: "#f0c39b",
  tan: "#d9a27a",
  brown: "#b57a52",
  deep: "#8a5a3c"
};
