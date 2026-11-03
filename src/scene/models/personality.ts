import type { LookId } from "./looks";

/** Joint targets for one frame; the rig blends toward them, so nothing here ever snaps. */
export interface Pose {
  spineX: number; spineY: number; spineZ: number;
  headX: number; headY: number; headZ: number;
  armLX: number; armLZ: number; armRX: number; armRZ: number;
  elbowLX: number; elbowRX: number;
  legLX: number; legRX: number; kneeLX: number; kneeRX: number;
  bob: number;
}

/** Ms Page carries the book on her right palm; the other arm can still gesture. */
export const PAGE_BOOK_POSE = { armRX: -0.35, armRZ: 0, elbowRX: -1.2 } as const;

/** 0 outside a moment that repeats every `period` seconds; eases in and out over `length` seconds inside it. */
const moment = (t: number, period: number, start: number, length: number): number => {
  const u = ((t % period) + period) % period - start;
  if (u < 0 || u > length) return 0;
  return Math.min(1, u / 0.3, (length - u) / 0.3);
};
const blend = (a: number, b: number, k: number) => a + (b - a) * k;

/** Both hands raised in front of the chest, for reading, knitting and so on. */
function handsFront(p: Pose, k: number, height = 0.75, bend = 1.3) {
  p.armLX = blend(p.armLX, -height, k); p.armRX = blend(p.armRX, -height, k);
  p.elbowLX = blend(p.elbowLX, -bend, k); p.elbowRX = blend(p.elbowRX, -bend, k);
  p.armLZ = blend(p.armLZ, 0.16, k); p.armRZ = blend(p.armRZ, -0.16, k);
}
function handsOnHips(p: Pose, k: number) {
  p.armLZ = blend(p.armLZ, 0.62, k); p.armRZ = blend(p.armRZ, -0.62, k);
  p.armLX = blend(p.armLX, 0.1, k); p.armRX = blend(p.armRX, 0.1, k);
  p.elbowLX = blend(p.elbowLX, -1.5, k); p.elbowRX = blend(p.elbowRX, -1.5, k);
}
function wave(p: Pose, t: number, k: number) {
  p.armRX = blend(p.armRX, -2.65, k); p.armRZ = blend(p.armRZ, -0.3 + Math.sin(t * 9) * 0.3, k);
  p.elbowRX = blend(p.elbowRX, -0.35, k);
}
function lookAround(p: Pose, t: number, amount = 0.4) {
  p.headY += Math.sin(t * 0.43) * amount * (Math.sin(t * 0.17) > 0 ? 1 : 0.35);
}

/**
 * What each person does when nobody is talking to them (SPEC §8's personality
 * column). Short, cheap and offset by each rig's own phase, so no two stay in step.
 */
export const IDLES: Partial<Record<LookId, (p: Pose, t: number) => void>> = {
  player(p, t) {
    lookAround(p, t, 0.34);
    p.bob += moment(t, 9, 4, 0.7) * Math.abs(Math.sin(t * 8)) * 0.05;
  },
  pom(p, t) {
    // Rocks on his heels, thumbs in his sash, and now and then waves to the town.
    p.spineX -= 0.04 + Math.sin(t * 1.1) * 0.03;
    handsFront(p, 1 - moment(t, 12, 8, 2), 0.42, 1.25);
    lookAround(p, t, 0.3);
    wave(p, t, moment(t, 12, 8, 2));
  },
  ume(p, t) {
    // Knitting: small alternating movements, eyes on the work, an occasional glance up.
    handsFront(p, 1, 0.7, 1.28);
    p.elbowLX += Math.sin(t * 5.5) * 0.09;
    p.elbowRX += Math.sin(t * 5.5 + 2) * 0.09;
    p.headX += 0.2 * (1 - moment(t, 8, 5, 1.6));
    p.headY += moment(t, 8, 5, 1.6) * 0.35;
  },
  ken(p, t) {
    // Painting his poster with big strokes, stepping back to check it.
    const checking = moment(t, 7, 4.8, 1.6);
    p.armRX = blend(-1.75 + Math.sin(t * 3.2) * 0.3, -0.25, checking);
    p.armRZ = blend(-0.25 + Math.sin(t * 1.6) * 0.2, -0.07, checking);
    p.elbowRX = blend(-0.5, -0.2, checking);
    p.headZ += checking * 0.18;
    p.spineX -= checking * 0.05;
  },
  bruno(p, t) {
    // Kneading dough at his belly, then a wave or a wipe of the brow.
    handsFront(p, 1 - moment(t, 10, 6, 2.2), 0.72 + Math.sin(t * 3) * 0.1, 1.05 + Math.sin(t * 3) * 0.14);
    p.spineX += Math.max(0, Math.sin(t * 3)) * 0.05;
    wave(p, t, moment(t, 10, 6, 2.2));
    lookAround(p, t, 0.32);
  },
  lily(p, t) {
    // Sways gently and leans in to smell her flowers.
    p.spineZ += Math.sin(t * 0.9) * 0.05;
    const smell = moment(t, 8, 3, 2.2);
    p.spineX += smell * 0.22;
    p.headX += smell * 0.25;
    p.armRX = blend(p.armRX, -0.95, smell);
    p.elbowRX = blend(p.elbowRX, -1.1, smell);
  },
  max(p, t) {
    // Bouncing on his toes and pushing up his glasses.
    p.bob += Math.abs(Math.sin(t * 3.4)) * 0.022;
    lookAround(p, t, 0.42);
    const glasses = moment(t, 7, 2, 1.1);
    p.armRX = blend(p.armRX, -2.45, glasses);
    p.armRZ = blend(p.armRZ, 0.12, glasses);
    p.elbowRX = blend(p.elbowRX, -2.1, glasses);
  },
  sara(p, t) {
    // Hands on hips, brisk looks up and down the street.
    handsOnHips(p, 1 - moment(t, 9, 6, 2));
    p.headY += Math.sin(t * 1.25) * 0.44;
    wave(p, t, moment(t, 9, 6, 2));
  },
  green(p, t) {
    // Holding her class list, with a nod now and then.
    p.armLX = -0.85; p.elbowLX = -1.5; p.armLZ = 0.2;
    p.headX += 0.12 + moment(t, 6, 3, 0.9) * Math.sin(t * 6) * 0.08;
    lookAround(p, t, 0.3);
  },
  page(p, t) {
    // Read with one supporting hand, leaving the other relaxed beside the book.
    Object.assign(p, PAGE_BOOK_POSE);
    p.armLX = -0.25; p.armLZ = 0.08; p.elbowLX = -0.55;
    p.headX += 0.26;
    p.headY += Math.sin(t * 1.4) * 0.09;
  },
  yuki(p, t) {
    // Shy: hands together, chin down, sometimes a peek around.
    p.armLX = -0.42; p.armRX = -0.42; p.armLZ = -0.2; p.armRZ = 0.2; p.elbowLX = -0.55; p.elbowRX = -0.55;
    p.headX += 0.18 - moment(t, 7, 3, 1.5) * 0.2;
    p.headY += moment(t, 7, 3, 1.5) * 0.4;
    p.spineZ += Math.sin(t * 0.8) * 0.035;
  },
  tom(p, t) {
    // Sporty: on his toes, and a jump for no reason at all.
    p.bob += Math.abs(Math.sin(t * 2.6)) * 0.016;
    const jump = moment(t, 6, 2, 0.8);
    p.bob += jump * Math.abs(Math.sin(t * 4)) * 0.2;
    p.armLX = blend(p.armLX, -1.2, jump); p.armRX = blend(p.armRX, -1.2, jump);
    p.kneeLX += jump * 0.4; p.kneeRX += jump * 0.4; p.legLX -= jump * 0.2; p.legRX -= jump * 0.2;
  },
  emma(p, t) {
    // Curious: tilts her head, peers about, hand to chin.
    p.headZ += Math.sin(t * 0.65) * 0.16;
    lookAround(p, t, 0.46);
    const chin = moment(t, 9, 5, 2.2);
    p.armRX = blend(p.armRX, -2.25, chin); p.armRZ = blend(p.armRZ, 0.32, chin); p.elbowRX = blend(p.elbowRX, -1.95, chin);
  },
  bo(p, t) {
    // Hands behind his back, chest out, surveying his harbor; a salute now and then.
    p.spineX -= 0.06;
    p.armLX = 0.38; p.armRX = 0.38; p.elbowLX = -0.42; p.elbowRX = -0.42;
    p.headY += Math.sin(t * 0.32) * 0.5;
    const salute = moment(t, 13, 7, 1.5);
    p.armRX = blend(p.armRX, -2.5, salute); p.armRZ = blend(p.armRZ, -0.55, salute); p.elbowRX = blend(p.elbowRX, -2.1, salute);
  },
  finn(p, t) {
    // Holding the rod out, nodding off, and waking with a jerk.
    p.armRX = -0.95; p.elbowRX = -0.35; p.armRZ = -0.05;
    const dozing = ((t % 9) + 9) % 9;
    p.headX += dozing < 7 ? dozing / 7 * 0.34 : Math.max(-0.1, 0.34 - (dozing - 7) * 1.4);
  },
  mia(p, t) {
    // Shading her eyes to look out to sea, hands on hips between looks.
    const shade = moment(t, 8, 1, 3);
    handsOnHips(p, 1 - shade);
    p.armRX = blend(p.armRX, -2.5, shade); p.armRZ = blend(p.armRZ, 0.1, shade); p.elbowRX = blend(p.elbowRX, -1.8, shade);
    p.headY += Math.sin(t * 0.5) * 0.3 * shade;
    p.headX -= shade * 0.08;
  },
  leo(p, t) {
    // A dab at the canvas, then a long look with his head on one side.
    const looking = moment(t, 8, 4, 3);
    p.armRX = blend(-1.55 + Math.sin(t * 2.2) * 0.18, -0.55, looking);
    p.elbowRX = blend(-0.5, -1.15, looking);
    p.headZ += looking * 0.22;
    p.spineX -= looking * 0.05;
  },
  dan(p, t) {
    // Jogs on the spot and claps everyone on.
    p.bob += Math.abs(Math.sin(t * 3.2)) * 0.03;
    p.legLX += Math.sin(t * 3.2) * 0.12; p.legRX -= Math.sin(t * 3.2) * 0.12;
    const clap = moment(t, 6, 2.5, 2);
    p.armLX = blend(p.armLX, -1.2, clap); p.armRX = blend(p.armRX, -1.2, clap);
    p.armLZ = blend(p.armLZ, -0.12 + Math.sin(t * 13) * 0.14, clap); p.armRZ = blend(p.armRZ, 0.12 - Math.sin(t * 13) * 0.14, clap);
    p.elbowLX = blend(p.elbowLX, -0.65, clap); p.elbowRX = blend(p.elbowRX, -0.65, clap);
  },
  aya(p, t) {
    // Reaches up to hang a lantern, and waves whenever she catches someone's eye.
    p.spineZ += Math.sin(t * 1.3) * 0.04;
    const reach = moment(t, 9, 1, 3);
    p.armLX = blend(p.armLX, -2.75, reach); p.armRX = blend(p.armRX, -2.75, reach);
    p.elbowLX = blend(p.elbowLX, -0.5 + Math.sin(t * 4) * 0.2, reach); p.elbowRX = blend(p.elbowRX, -0.5 - Math.sin(t * 4) * 0.2, reach);
    p.headX -= reach * 0.3;
    wave(p, t, moment(t, 9, 6, 1.5));
  }
};
