import type { ExerciseType } from "@prisma/client";
import type { Landmark } from "./angles";
import type { PoseSignature } from "./poseMatch";
import {
  PlankHoldTracker,
  TemplateHoldTracker,
  WallSitHoldTracker,
} from "./exercises/holds";

// Hold (posture) exercises: keep one posture for a target time. All tuning
// lives here so real-camera threshold adjustments touch a single file.

/** Live pose counts as "in posture" below this distance (degrees, top-3 metric). */
export const HOLD_IN_THRESHOLD = 20;
/** Posture counts as broken above this — the 20-28 band is hysteresis, so
 *  breathing/tremor (3-8 deg) and weight shifts (10-15 deg) never flicker. */
export const HOLD_OUT_THRESHOLD = 28;
/** Must match continuously this long before the clock starts or resumes. */
export const HOLD_CONFIRM_MS = 500;
/** Break posture and you have this long to get back before failing. */
export const HOLD_GRACE_MS = 3000;
/** Camera losing the body is not the athlete's fault — longer grace. */
export const HOLD_VISIBILITY_GRACE_MS = 5000;

export type HoldState = "finding" | "holding" | "grace" | "done" | "failed";
export type PostureRead = "in" | "out" | "invisible";

export type HoldUpdate = {
  heldMs: number;
  state: HoldState;
  /** Remaining comeback time; 0 unless state is "grace". */
  graceLeftMs: number;
  formHint: string | null;
};

export interface HoldTracker {
  /** Pass null landmarks when detection found no body this frame. */
  update(landmarks: Landmark[] | null, tMs: number): HoldUpdate;
  reset(): void;
}

/** Serializable description of which hold to run — safe to pass from
 *  server components into the client attempt session. */
export type HoldSpec =
  | { kind: "builtin"; exercise: ExerciseType }
  | { kind: "custom"; pose: PoseSignature };

/**
 * The timing state machine shared by every hold tracker. Classifiers feed it
 * one PostureRead per frame; it accumulates in-posture time, pauses (never
 * resets) during the grace window, and settles into "done" or "failed".
 * The grace clock pauses while the athlete is back in posture re-confirming,
 * so returning at the buzzer is never punished.
 */
export class HoldEngine {
  private state: HoldState = "finding";
  private heldMs = 0;
  private lastTs: number | null = null;
  private inPoseSince: number | null = null;
  private graceLeftMs = 0;

  constructor(private targetMs: number) {}

  update(read: PostureRead, tMs: number): {
    state: HoldState;
    heldMs: number;
    graceLeftMs: number;
  } {
    // Clamp frame gaps (tab hidden, landmarker hiccup) so neither clock jumps.
    const dt = this.lastTs === null ? 0 : Math.min(Math.max(tMs - this.lastTs, 0), 250);
    this.lastTs = tMs;

    if (this.state === "done" || this.state === "failed") return this.snapshot();

    if (read === "in") {
      if (this.state === "holding") {
        this.heldMs += dt;
      } else {
        // finding or grace: confirm before (re)starting the clock.
        this.inPoseSince ??= tMs;
        if (tMs - this.inPoseSince >= HOLD_CONFIRM_MS) {
          this.heldMs += tMs - this.inPoseSince; // credit the confirm window
          this.inPoseSince = null;
          this.state = "holding";
          this.graceLeftMs = 0;
        }
      }
      if (this.state === "holding" && this.heldMs >= this.targetMs) {
        this.heldMs = this.targetMs;
        this.state = "done";
      }
    } else {
      this.inPoseSince = null;
      if (this.state === "holding") {
        this.state = "grace";
        this.graceLeftMs =
          read === "invisible" ? HOLD_VISIBILITY_GRACE_MS : HOLD_GRACE_MS;
      } else if (this.state === "grace") {
        this.graceLeftMs -= dt;
        if (this.graceLeftMs <= 0) {
          this.graceLeftMs = 0;
          this.state = "failed";
        }
      }
      // "finding" just waits — the segment time limit bounds it.
    }

    return this.snapshot();
  }

  private snapshot() {
    return {
      state: this.state,
      heldMs: this.heldMs,
      graceLeftMs: this.state === "grace" ? this.graceLeftMs : 0,
    };
  }

  reset() {
    this.state = "finding";
    this.heldMs = 0;
    this.lastTs = null;
    this.inPoseSince = null;
    this.graceLeftMs = 0;
  }
}

export function createHoldTracker(spec: HoldSpec, targetSeconds: number): HoldTracker {
  const targetMs = targetSeconds * 1000;
  if (spec.kind === "custom") return new TemplateHoldTracker(spec.pose, targetMs);
  switch (spec.exercise) {
    case "PLANK":
      return new PlankHoldTracker(targetMs);
    case "WALL_SIT":
      return new WallSitHoldTracker(targetMs);
    default:
      throw new Error(`${spec.exercise} is not a hold exercise`);
  }
}
