import { angleDeg, Ema, LM, minVisibility, type Landmark } from "../angles";
import {
  CycleTracker,
  VISIBILITY_HINT,
  type RepCounter,
  type RepUpdate,
} from "../repCounter";

const NEEDED = [
  LM.LEFT_HIP,
  LM.RIGHT_HIP,
  LM.LEFT_KNEE,
  LM.RIGHT_KNEE,
  LM.LEFT_ANKLE,
  LM.RIGHT_ANKLE,
];

const UP_ANGLE = 160; // standing tall
const DOWN_ANGLE = 100; // deep squat

export class SquatCounter implements RepCounter {
  readonly exercise = "SQUAT" as const;
  private ema = new Ema();
  private tracker = new CycleTracker();
  private hint: string | null = null;

  update(landmarks: Landmark[], tMs: number): RepUpdate {
    if (minVisibility(landmarks, NEEDED) < 0.5) {
      return { reps: this.tracker.reps, phase: this.tracker.state, formHint: VISIBILITY_HINT };
    }

    const left = angleDeg(
      landmarks[LM.LEFT_HIP],
      landmarks[LM.LEFT_KNEE],
      landmarks[LM.LEFT_ANKLE],
    );
    const right = angleDeg(
      landmarks[LM.RIGHT_HIP],
      landmarks[LM.RIGHT_KNEE],
      landmarks[LM.RIGHT_ANKLE],
    );
    const knee = this.ema.update((left + right) / 2);

    const classification =
      knee > UP_ANGLE ? "top" : knee < DOWN_ANGLE ? "bottom" : "between";
    const { counted, nearMiss } = this.tracker.update(classification, tMs);

    if (counted) this.hint = null;
    else if (nearMiss) this.hint = "Squat deeper — hips down";

    return { reps: this.tracker.reps, phase: this.tracker.state, formHint: this.hint };
  }

  reset() {
    this.ema.reset();
    this.tracker.reset();
    this.hint = null;
  }
}
