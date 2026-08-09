import { Ema, LM, minVisibility, type Landmark } from "../angles";
import {
  CycleTracker,
  VISIBILITY_HINT,
  type RepCounter,
  type RepUpdate,
} from "../repCounter";

const NEEDED = [
  LM.NOSE,
  LM.LEFT_SHOULDER,
  LM.RIGHT_SHOULDER,
  LM.LEFT_WRIST,
  LM.RIGHT_WRIST,
  LM.LEFT_ANKLE,
  LM.RIGHT_ANKLE,
];

const OPEN_SPREAD = 1.5; // ankles wider than 1.5× shoulder width
const CLOSED_SPREAD = 1.0;

export class JumpingJackCounter implements RepCounter {
  readonly exercise = "JUMPING_JACK" as const;
  private spreadEma = new Ema(0.5); // jacks are fast; smooth lightly
  private tracker = new CycleTracker(300);
  private hint: string | null = null;

  update(landmarks: Landmark[], tMs: number): RepUpdate {
    if (minVisibility(landmarks, NEEDED) < 0.5) {
      return { reps: this.tracker.reps, phase: this.tracker.state, formHint: VISIBILITY_HINT };
    }

    const nose = landmarks[LM.NOSE];
    const leftShoulder = landmarks[LM.LEFT_SHOULDER];
    const rightShoulder = landmarks[LM.RIGHT_SHOULDER];
    const leftWrist = landmarks[LM.LEFT_WRIST];
    const rightWrist = landmarks[LM.RIGHT_WRIST];

    const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
    if (shoulderWidth < 0.01) {
      return { reps: this.tracker.reps, phase: this.tracker.state, formHint: VISIBILITY_HINT };
    }
    const ankleSpread = Math.abs(
      landmarks[LM.LEFT_ANKLE].x - landmarks[LM.RIGHT_ANKLE].x,
    );
    const spread = this.spreadEma.update(ankleSpread / shoulderWidth);

    // y grows downward: "above" means smaller y.
    const armsUp = leftWrist.y < nose.y && rightWrist.y < nose.y;
    const armsDown =
      leftWrist.y > leftShoulder.y && rightWrist.y > rightShoulder.y;

    // "bottom" = open (arms up, feet wide), "top" = closed (arms down, feet together)
    const classification =
      armsUp && spread > OPEN_SPREAD
        ? "bottom"
        : armsDown && spread < CLOSED_SPREAD
          ? "top"
          : "between";
    const { counted, nearMiss } = this.tracker.update(classification, tMs);

    if (counted) this.hint = null;
    else if (nearMiss) this.hint = "Arms all the way up, feet wide";

    return { reps: this.tracker.reps, phase: this.tracker.state, formHint: this.hint };
  }

  reset() {
    this.spreadEma.reset();
    this.tracker.reset();
    this.hint = null;
  }
}
