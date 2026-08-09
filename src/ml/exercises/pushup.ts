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
  LM.LEFT_ELBOW,
  LM.RIGHT_ELBOW,
  LM.LEFT_WRIST,
  LM.RIGHT_WRIST,
];

const UP_ANGLE = 150; // arms extended
const DOWN_ANGLE = 95; // chest lowered

export class PushupCounter implements RepCounter {
  readonly exercise = "PUSHUP" as const;
  private ema = new Ema();
  private tracker = new CycleTracker();
  private hint: string | null = null;

  update(landmarks: Landmark[], tMs: number): RepUpdate {
    if (minVisibility(landmarks, NEEDED) < 0.5) {
      return { reps: this.tracker.reps, phase: this.tracker.state, formHint: VISIBILITY_HINT };
    }

    const left = angleDeg(
      landmarks[LM.LEFT_SHOULDER],
      landmarks[LM.LEFT_ELBOW],
      landmarks[LM.LEFT_WRIST],
    );
    const right = angleDeg(
      landmarks[LM.RIGHT_SHOULDER],
      landmarks[LM.RIGHT_ELBOW],
      landmarks[LM.RIGHT_WRIST],
    );
    const elbow = this.ema.update((left + right) / 2);

    const classification =
      elbow > UP_ANGLE ? "top" : elbow < DOWN_ANGLE ? "bottom" : "between";
    const { counted, nearMiss } = this.tracker.update(classification, tMs);

    if (counted) this.hint = null;
    else if (nearMiss) this.hint = "Go lower — bend your elbows more";

    return { reps: this.tracker.reps, phase: this.tracker.state, formHint: this.hint };
  }

  reset() {
    this.ema.reset();
    this.tracker.reset();
    this.hint = null;
  }
}
