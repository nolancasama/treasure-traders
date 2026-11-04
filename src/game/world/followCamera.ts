/** District follow frames; authored conversation and cinematic angles are separate. */
export const FOLLOW_CAMERA = {
  radius: 12, height: 8, targetHeight: 0.8, blendDistance: 6,
  yaw: { default: 0, market: -Math.PI / 2, festival: Math.PI / 2 }
} as const;
