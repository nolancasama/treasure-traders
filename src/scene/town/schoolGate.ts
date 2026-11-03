/** Shared measurements for the panel, track, rollers and the real unlock shot. */
export const SCHOOL_GATE_TRAVEL = 8.05;
export const SCHOOL_GATE_SECONDS = 3;
export const SCHOOL_GATE_WHEEL_RADIUS = 0.25;
export const SCHOOL_GATE_TRACK_TOP = 0.04;
export const SCHOOL_GATE_WHEEL_Y = SCHOOL_GATE_TRACK_TOP + SCHOOL_GATE_WHEEL_RADIUS;
export const SCHOOL_GATE_SLOT = { north: -0.16, south: 0.33, top: 2.2 } as const;

export interface SchoolGateAnimation { target: number; from: number; elapsed: number }

/** Finite-duration easing keeps navigation closed until the exact final frame. */
export function advanceSchoolGate(progress: number, target: number, delta: number, animation: SchoolGateAnimation): number {
  if (progress === target) {
    animation.target = target; animation.from = target; animation.elapsed = SCHOOL_GATE_SECONDS;
    return target;
  }
  if (animation.target !== target) {
    animation.target = target; animation.from = progress; animation.elapsed = 0;
  }
  animation.elapsed = Math.min(SCHOOL_GATE_SECONDS, animation.elapsed + Math.max(0, delta));
  if (animation.elapsed >= SCHOOL_GATE_SECONDS - 1e-9) return target;
  const t = animation.elapsed / SCHOOL_GATE_SECONDS, eased = t * t * (3 - 2 * t);
  return animation.from + (target - animation.from) * eased;
}
