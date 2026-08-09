import type { ExerciseType } from "@prisma/client";
import type { Landmark } from "./angles";
import { PushupCounter } from "./exercises/pushup";
import { SquatCounter } from "./exercises/squat";
import { SitupCounter } from "./exercises/situp";
import { JumpingJackCounter } from "./exercises/jumpingJack";

export type Phase = "top" | "bottom" | "between" | "unknown";

export type RepUpdate = {
  reps: number;
  phase: Phase;
  formHint: string | null;
};

export interface RepCounter {
  readonly exercise: ExerciseType;
  update(landmarks: Landmark[], tMs: number): RepUpdate;
  reset(): void;
}

export const VISIBILITY_HINT = "Make sure your whole body is in the frame";

/**
 * Shared hysteresis engine: a rep is one full bottom→top cycle. Transitions
 * only fire on the far thresholds ("top"/"bottom" classifications), so noise
 * in between can never double-count; a minimum cycle time debounces jitter.
 */
export class CycleTracker {
  reps = 0;
  state: Phase = "unknown";
  private lastRepAt = 0;
  private nearMiss = false;

  constructor(private minCycleMs = 400) {}

  update(classification: "top" | "bottom" | "between", tMs: number): {
    counted: boolean;
    nearMiss: boolean;
  } {
    let counted = false;
    let nearMiss = false;

    if (classification === "top") {
      if (this.state === "bottom") {
        if (tMs - this.lastRepAt >= this.minCycleMs) {
          this.reps += 1;
          this.lastRepAt = tMs;
          counted = true;
        }
      } else if (this.state === "between" && this.nearMiss) {
        // Went down part-way and came back up without a rep.
        nearMiss = true;
      }
      this.state = "top";
      this.nearMiss = false;
    } else if (classification === "bottom") {
      // Only count cycles that started from the top position.
      if (this.state === "top" || this.state === "between") this.state = "bottom";
      else if (this.state === "unknown") this.state = "bottom";
      this.nearMiss = false;
    } else {
      if (this.state === "top") this.nearMiss = true;
      if (this.state !== "bottom") this.state = "between";
    }

    return { counted, nearMiss };
  }

  reset() {
    this.reps = 0;
    this.state = "unknown";
    this.lastRepAt = 0;
    this.nearMiss = false;
  }
}

export function createRepCounter(exercise: ExerciseType): RepCounter {
  switch (exercise) {
    case "PUSHUP":
      return new PushupCounter();
    case "SQUAT":
      return new SquatCounter();
    case "SITUP":
      return new SitupCounter();
    case "JUMPING_JACK":
      return new JumpingJackCounter();
  }
}
