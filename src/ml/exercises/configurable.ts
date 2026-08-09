import type { Joint } from "@prisma/client";
import { angleDeg, Ema, LM, minVisibility, type Landmark } from "../angles";
import {
  CycleTracker,
  VISIBILITY_HINT,
  type RepCounter,
  type RepUpdate,
} from "../repCounter";

// Landmark triplets (a, vertex, c) per side for each supported joint.
const JOINT_TRIPLETS: Record<Joint, [number, number, number][]> = {
  ELBOW: [
    [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST],
    [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST],
  ],
  KNEE: [
    [LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE],
    [LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
  ],
  HIP: [
    [LM.LEFT_SHOULDER, LM.LEFT_HIP, LM.LEFT_KNEE],
    [LM.RIGHT_SHOULDER, LM.RIGHT_HIP, LM.RIGHT_KNEE],
  ],
  SHOULDER: [
    [LM.LEFT_HIP, LM.LEFT_SHOULDER, LM.LEFT_ELBOW],
    [LM.RIGHT_HIP, LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW],
  ],
};

export type CustomCounterConfig = {
  joint: Joint;
  downAngle: number;
  upAngle: number;
  minCycleMs: number;
};

/** Generic hysteresis rep counter over a single joint angle, driven by
 *  user-authored config instead of a hardcoded exercise definition. */
export class ConfigurableAngleCounter implements RepCounter {
  readonly exercise = "CUSTOM" as const;
  private ema = new Ema();
  private tracker: CycleTracker;
  private hint: string | null = null;
  /** Exposed for the builder's live calibration preview. */
  lastAngle: number | null = null;

  constructor(private config: CustomCounterConfig) {
    this.tracker = new CycleTracker(config.minCycleMs);
  }

  update(landmarks: Landmark[], tMs: number): RepUpdate {
    const triplets = JOINT_TRIPLETS[this.config.joint];
    const needed = triplets.flat();
    if (minVisibility(landmarks, needed) < 0.5) {
      return { reps: this.tracker.reps, phase: this.tracker.state, formHint: VISIBILITY_HINT };
    }

    const angles = triplets.map(([a, b, c]) =>
      angleDeg(landmarks[a], landmarks[b], landmarks[c]),
    );
    const angle = this.ema.update(
      angles.reduce((sum, value) => sum + value, 0) / angles.length,
    );
    this.lastAngle = angle;

    const classification =
      angle > this.config.upAngle
        ? "top"
        : angle < this.config.downAngle
          ? "bottom"
          : "between";
    const { counted, nearMiss } = this.tracker.update(classification, tMs);

    if (counted) this.hint = null;
    else if (nearMiss) this.hint = "Bigger range of motion!";

    return { reps: this.tracker.reps, phase: this.tracker.state, formHint: this.hint };
  }

  reset() {
    this.ema.reset();
    this.tracker.reset();
    this.hint = null;
    this.lastAngle = null;
  }
}
