import type { NpcId } from "../../game/content/ids";
import { SKIN } from "./palette";

/** Body proportions (SPEC §8: rounded, toy-like; adults taller than kids). */
export type Build = "kid" | "adult" | "slim" | "round" | "big" | "small";

export type HairStyle = "short" | "spiky" | "bob" | "ponytail" | "pigtails" | "bun" | "long" | "curly" | "sides" | "twinBuns" | "none";
export type TopStyle =
  | "tshirt"
  | "shirt"
  | "cardigan"
  | "coat"
  | "suit"
  | "overalls"
  | "raincoat"
  | "striped"
  | "tracksuit"
  | "happi"
  | "vest"
  | "smock"
  | "dress";
export type BottomStyle = "pants" | "shorts" | "skirt" | "longSkirt";
export type HatStyle = "top" | "cap" | "chef" | "captain" | "beret" | "bandana" | "headscarf" | "flowerCrown" | "rainHat";
export type Accessory =
  | "glasses"
  | "glassesChain"
  | "mustache"
  | "beard"
  | "sash"
  | "bowtie"
  | "whistle"
  | "backpack"
  | "randoseru"
  | "apron"
  | "paintSpots"
  | "ribbons";

export interface Look {
  build: Build;
  /** Overall scale on top of the build. */
  scale: number;
  skin: string;
  hair: { style: HairStyle; color: string };
  top: { style: TopStyle; color: string; trim: string };
  /** Colour under an open top (cardigan, vest, overalls, apron). */
  inner?: string;
  bottom: { style: BottomStyle; color: string };
  shoes: string;
  hat?: { style: HatStyle; color: string; band?: string };
  accessories: Accessory[];
  /** Short sleeves show skin on the forearm. */
  shortSleeves?: boolean;
  /** Small forward hunch (Grandma). */
  hunch?: number;
}

export type LookId = NpcId | "player";

export const LOOKS: Record<LookId, Look> = {
  player: {
    build: "kid", scale: 1, skin: SKIN.fair,
    hair: { style: "short", color: "#3a261a" },
    top: { style: "tshirt", color: "#3f9fe0", trim: "#ffffff" },
    bottom: { style: "shorts", color: "#d8b77a" }, shoes: "#e8483f",
    hat: { style: "cap", color: "#e5484d" }, accessories: ["backpack"], shortSleeves: true
  },
  pom: {
    build: "round", scale: 1.04, skin: SKIN.light,
    hair: { style: "sides", color: "#f2efe8" },
    top: { style: "suit", color: "#2e3f73", trim: "#ffcf3f" }, inner: "#ffffff",
    bottom: { style: "pants", color: "#2a3866" }, shoes: "#2b2d42",
    hat: { style: "top", color: "#2b2d42", band: "#e5484d" }, accessories: ["mustache", "sash"]
  },
  ume: {
    build: "small", scale: 0.92, skin: SKIN.light,
    hair: { style: "bun", color: "#c9c6c2" },
    top: { style: "cardigan", color: "#8a5bb8", trim: "#6c4392" }, inner: "#f4e9d8",
    bottom: { style: "longSkirt", color: "#6e5a48" }, shoes: "#4a3a2e",
    accessories: ["glasses"], hunch: 0.18
  },
  ken: {
    build: "kid", scale: 0.98, skin: SKIN.tan,
    hair: { style: "short", color: "#2a1d14" },
    top: { style: "overalls", color: "#3d6fb6", trim: "#2c568f" }, inner: "#ffffff",
    bottom: { style: "pants", color: "#3d6fb6" }, shoes: "#f4f4f4",
    hat: { style: "cap", color: "#2f6fe4" }, accessories: ["paintSpots"], shortSleeves: true
  },
  bruno: {
    build: "big", scale: 1.05, skin: SKIN.light,
    hair: { style: "short", color: "#6b4228" },
    top: { style: "shirt", color: "#e8c9a0", trim: "#d0ab7c" },
    bottom: { style: "pants", color: "#4a3b33" }, shoes: "#3a2a20",
    hat: { style: "chef", color: "#ffffff" }, accessories: ["apron", "mustache"]
  },
  lily: {
    build: "slim", scale: 1, skin: SKIN.fair,
    hair: { style: "long", color: "#a8552a" },
    top: { style: "dress", color: "#5bb77a", trim: "#3f9a5d" },
    bottom: { style: "skirt", color: "#5bb77a" }, shoes: "#f4d06f",
    hat: { style: "flowerCrown", color: "#ff8fb1" }, accessories: [], shortSleeves: true
  },
  max: {
    build: "adult", scale: 1, skin: SKIN.brown,
    hair: { style: "curly", color: "#23180f" },
    top: { style: "vest", color: "#f2b632", trim: "#cf9214" }, inner: "#ffffff",
    bottom: { style: "pants", color: "#6b4f3a" }, shoes: "#2b2d42",
    accessories: ["glasses", "bowtie"]
  },
  sara: {
    build: "adult", scale: 0.98, skin: SKIN.tan,
    hair: { style: "bob", color: "#2b1d14" },
    top: { style: "shirt", color: "#f08a3c", trim: "#d06c22" },
    bottom: { style: "longSkirt", color: "#3e7d8c" }, shoes: "#5a3a26",
    hat: { style: "headscarf", color: "#1fa2b8" }, accessories: [], shortSleeves: true
  },
  green: {
    build: "slim", scale: 1.02, skin: SKIN.fair,
    hair: { style: "bob", color: "#6a4630" },
    top: { style: "cardigan", color: "#3daa6b", trim: "#2a7d4e" }, inner: "#fbf6ee",
    bottom: { style: "skirt", color: "#7d8594" }, shoes: "#3a3d48",
    accessories: ["glasses"]
  },
  page: {
    build: "slim", scale: 1.03, skin: SKIN.light,
    hair: { style: "bun", color: "#1d1a1f" },
    top: { style: "shirt", color: "#f3e7d3", trim: "#d9c6a6" },
    bottom: { style: "longSkirt", color: "#7a3f6e" }, shoes: "#3a2a30",
    accessories: ["glasses", "glassesChain"]
  },
  yuki: {
    build: "kid", scale: 0.95, skin: SKIN.light,
    hair: { style: "pigtails", color: "#1b1418" },
    top: { style: "shirt", color: "#ff9cc0", trim: "#ffffff" },
    bottom: { style: "skirt", color: "#2e3f73" }, shoes: "#e5484d",
    accessories: ["randoseru"]
  },
  tom: {
    build: "kid", scale: 1.0, skin: SKIN.fair,
    hair: { style: "spiky", color: "#8a5a2b" },
    top: { style: "tshirt", color: "#ffd23f", trim: "#e0a800" },
    bottom: { style: "shorts", color: "#2f6fe4" }, shoes: "#f4f4f4",
    accessories: [], shortSleeves: true
  },
  emma: {
    build: "kid", scale: 0.97, skin: SKIN.light,
    hair: { style: "ponytail", color: "#e8c26a" },
    top: { style: "dress", color: "#5b8def", trim: "#ffffff" },
    bottom: { style: "skirt", color: "#5b8def" }, shoes: "#ffffff",
    accessories: ["ribbons"], shortSleeves: true
  },
  bo: {
    build: "big", scale: 1.06, skin: SKIN.light,
    hair: { style: "short", color: "#bfbab3" },
    top: { style: "coat", color: "#263a6b", trim: "#ffcf3f" }, inner: "#ffffff",
    bottom: { style: "pants", color: "#1f2f57" }, shoes: "#2b2d42",
    hat: { style: "captain", color: "#ffffff", band: "#2b2d42" }, accessories: ["beard"]
  },
  finn: {
    build: "adult", scale: 1.0, skin: SKIN.tan,
    hair: { style: "short", color: "#4a3324" },
    top: { style: "raincoat", color: "#f6c945", trim: "#d9a521" },
    bottom: { style: "pants", color: "#3a5a4a" }, shoes: "#2f5a3a",
    hat: { style: "rainHat", color: "#f6c945" }, accessories: ["beard"]
  },
  mia: {
    build: "slim", scale: 0.98, skin: SKIN.brown,
    hair: { style: "ponytail", color: "#1c120c" },
    top: { style: "striped", color: "#ffffff", trim: "#2e3f73" },
    bottom: { style: "pants", color: "#2e3f73" }, shoes: "#ffffff",
    hat: { style: "bandana", color: "#e5484d" }, accessories: [], shortSleeves: true
  },
  leo: {
    build: "slim", scale: 1.04, skin: SKIN.fair,
    hair: { style: "short", color: "#3a2a22" },
    top: { style: "smock", color: "#f3f1ea", trim: "#d8d4c8" },
    bottom: { style: "pants", color: "#3a3d48" }, shoes: "#5a3a26",
    hat: { style: "beret", color: "#9b2f3f" }, accessories: ["paintSpots", "beard"]
  },
  dan: {
    build: "big", scale: 1.04, skin: SKIN.deep,
    hair: { style: "short", color: "#151010" },
    top: { style: "tracksuit", color: "#e5484d", trim: "#ffffff" },
    bottom: { style: "pants", color: "#e5484d" }, shoes: "#ffffff",
    accessories: ["whistle"]
  },
  aya: {
    build: "slim", scale: 0.97, skin: SKIN.light,
    hair: { style: "twinBuns", color: "#24171c" },
    top: { style: "happi", color: "#2f4f9e", trim: "#e5484d" }, inner: "#ffffff",
    bottom: { style: "shorts", color: "#2b2d42" }, shoes: "#e8483f",
    accessories: ["ribbons"]
  }
};
