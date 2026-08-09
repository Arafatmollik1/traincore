export type Landmark = {
  x: number;
  y: number;
  z: number;
  visibility?: number;
};

// MediaPipe Pose landmark indices (33-point model)
export const LM = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;

/** Angle in degrees at point b formed by segments b→a and b→c (2D). */
export function angleDeg(a: Landmark, b: Landmark, c: Landmark): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const magAb = Math.hypot(abx, aby);
  const magCb = Math.hypot(cbx, cby);
  if (magAb === 0 || magCb === 0) return 180;
  const cos = Math.min(1, Math.max(-1, dot / (magAb * magCb)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Exponential moving average smoother for a noisy per-frame signal. */
export class Ema {
  private value: number | null = null;
  constructor(private alpha = 0.3) {}

  update(sample: number): number {
    this.value =
      this.value === null
        ? sample
        : this.alpha * sample + (1 - this.alpha) * this.value;
    return this.value;
  }

  reset() {
    this.value = null;
  }
}

/** Lowest visibility among the given landmark indices (1 when unreported). */
export function minVisibility(landmarks: Landmark[], indices: number[]): number {
  let min = 1;
  for (const index of indices) {
    const v = landmarks[index]?.visibility ?? 0;
    if (v < min) min = v;
  }
  return min;
}
