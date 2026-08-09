import { Ema, type Landmark } from "../angles";
import {
  ANGLE_KEYS,
  computeSignature,
  MATCH_THRESHOLD,
  signatureDistance,
  type AngleKey,
  type PoseSignature,
} from "../poseMatch";
import { VISIBILITY_HINT, type RepCounter, type RepUpdate } from "../repCounter";

/**
 * Counts reps against user-captured pose templates: the live pose must visit
 * every station in order and come back to station 0 for one rep. Consecutive
 * stations are guaranteed distinct at capture time, so the MATCH_THRESHOLD
 * neighborhoods can't overlap and double-fire.
 */
export class TemplatePoseCounter implements RepCounter {
  readonly exercise = "CUSTOM" as const;
  private emas = new Map<AngleKey, Ema>();
  private nextStation = 0;
  private armed = false; // becomes true once the start pose is first hit
  private lastAdvanceAt = 0;
  private lastRepAt = 0;
  reps = 0;

  constructor(
    private poses: PoseSignature[],
    private minCycleMs = 600,
  ) {
    for (const key of ANGLE_KEYS) this.emas.set(key, new Ema());
  }

  /** For UI: which pose the athlete needs to hit next, and progress. */
  get progress() {
    return { next: this.nextStation, total: this.poses.length, armed: this.armed };
  }

  update(landmarks: Landmark[], tMs: number): RepUpdate {
    const raw = computeSignature(landmarks);
    if (!raw) {
      return { reps: this.reps, phase: "unknown", formHint: VISIBILITY_HINT };
    }

    const smoothed = {} as PoseSignature;
    for (const key of ANGLE_KEYS) {
      smoothed[key] = this.emas.get(key)!.update(raw[key]);
    }

    const target = this.poses[this.nextStation];
    if (
      signatureDistance(smoothed, target) < MATCH_THRESHOLD &&
      tMs - this.lastAdvanceAt > 250
    ) {
      this.lastAdvanceAt = tMs;
      if (this.nextStation === 0) {
        if (this.armed && tMs - this.lastRepAt >= this.minCycleMs) {
          this.reps += 1;
          this.lastRepAt = tMs;
        }
        this.armed = true;
      }
      this.nextStation = (this.nextStation + 1) % this.poses.length;
    }

    return {
      reps: this.reps,
      phase: this.armed ? (this.nextStation === 0 ? "bottom" : "between") : "top",
      formHint: null,
    };
  }

  reset() {
    for (const ema of this.emas.values()) ema.reset();
    this.nextStation = 0;
    this.armed = false;
    this.lastAdvanceAt = 0;
    this.lastRepAt = 0;
    this.reps = 0;
  }
}
