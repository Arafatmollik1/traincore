import { angleDeg, Ema, LM, minVisibility, type Landmark } from "../angles";
import {
  CycleTracker,
  VISIBILITY_HINT,
  type RepCounter,
  type RepUpdate,
} from "../repCounter";

const NEEDED = [
  LM.LEFT_SHOULDER,
  LM.RIGHT_SHOULDER,
  LM.LEFT_HIP,
  LM.RIGHT_HIP,
  LM.LEFT_KNEE,
  LM.RIGHT_KNEE,
];

// Torso-to-thigh angle at the hip: large when lying flat, small when crunched.
const LYING_ANGLE = 130; // "top" = starting position, lying back
const CRUNCHED_ANGLE = 70; // "bottom" = sat up towards the knees

export class SitupCounter implements RepCounter {
  readonly exercise = "SITUP" as const;
  private ema = new Ema();
  private tracker = new CycleTracker(600); // sit-ups are slower than pushups
  private hint: string | null = null;

  update(landmarks: Landmark[], tMs: number): RepUpdate {
    if (minVisibility(landmarks, NEEDED) < 0.5) {
      return { reps: this.tracker.reps, phase: this.tracker.state, formHint: VISIBILITY_HINT };
    }

    const left = angleDeg(
      landmarks[LM.LEFT_SHOULDER],
      landmarks[LM.LEFT_HIP],
      landmarks[LM.LEFT_KNEE],
    );
    const right = angleDeg(
      landmarks[LM.RIGHT_SHOULDER],
      landmarks[LM.RIGHT_HIP],
      landmarks[LM.RIGHT_KNEE],
    );
    const torso = this.ema.update((left + right) / 2);

    const classification =
      torso > LYING_ANGLE ? "top" : torso < CRUNCHED_ANGLE ? "bottom" : "between";
    const { counted, nearMiss } = this.tracker.update(classification, tMs);

    if (counted) this.hint = null;
    else if (nearMiss) this.hint = "Crunch all the way up to your knees";

    return { reps: this.tracker.reps, phase: this.tracker.state, formHint: this.hint };
  }

  reset() {
    this.ema.reset();
    this.tracker.reset();
    this.hint = null;
  }
}
