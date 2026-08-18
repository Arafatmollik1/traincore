import { angleDeg, Ema, LM, minVisibility, type Landmark } from "../angles";
import {
  ANGLE_KEYS,
  computeSignature,
  signatureDistance,
  type AngleKey,
  type PoseSignature,
} from "../poseMatch";
import { VISIBILITY_HINT } from "../repCounter";
import {
  HOLD_IN_THRESHOLD,
  HOLD_OUT_THRESHOLD,
  HoldEngine,
  type HoldTracker,
  type HoldUpdate,
  type PostureRead,
} from "../holdTracker";

/**
 * Classifiers turn a frame into strictIn/clearlyOut; between the two the zone
 * is sticky (hysteresis), so hovering at a boundary never flickers the clock.
 */
type Classification = { strictIn: boolean; clearlyOut: boolean } | null;

abstract class BaseHoldTracker implements HoldTracker {
  private engine: HoldEngine;
  private zone: "in" | "out" = "out";

  constructor(targetMs: number) {
    this.engine = new HoldEngine(targetMs);
  }

  protected abstract classify(landmarks: Landmark[]): Classification;
  protected abstract findingHint: string;
  protected resetSignals(): void {}

  update(landmarks: Landmark[] | null, tMs: number): HoldUpdate {
    let read: PostureRead = "invisible";
    if (landmarks) {
      const c = this.classify(landmarks);
      if (c) {
        if (c.strictIn) this.zone = "in";
        else if (c.clearlyOut) this.zone = "out";
        read = this.zone;
      }
    }
    const result = this.engine.update(read, tMs);
    return { ...result, formHint: this.hint(read, result.state) };
  }

  private hint(read: PostureRead, state: HoldUpdate["state"]): string | null {
    if (state === "done" || state === "failed") return null;
    if (read === "invisible") return VISIBILITY_HINT;
    if (state === "grace") return "Get back into position!";
    if (state === "finding" && read === "out") return this.findingHint;
    return null;
  }

  reset() {
    this.engine.reset();
    this.zone = "out";
    this.resetSignals();
  }
}

/** Custom hold: distance to the single captured pose signature. */
export class TemplateHoldTracker extends BaseHoldTracker {
  private emas = new Map<AngleKey, Ema>();
  protected findingHint = "Get into your captured pose";

  constructor(
    private pose: PoseSignature,
    targetMs: number,
  ) {
    super(targetMs);
    for (const key of ANGLE_KEYS) this.emas.set(key, new Ema());
  }

  protected classify(landmarks: Landmark[]): Classification {
    const raw = computeSignature(landmarks);
    if (!raw) return null;
    const smoothed = {} as PoseSignature;
    for (const key of ANGLE_KEYS) {
      smoothed[key] = this.emas.get(key)!.update(raw[key]);
    }
    const distance = signatureDistance(smoothed, this.pose);
    return {
      strictIn: distance <= HOLD_IN_THRESHOLD,
      clearlyOut: distance >= HOLD_OUT_THRESHOLD,
    };
  }

  protected resetSignals() {
    for (const ema of this.emas.values()) ema.reset();
  }
}

const mid = (a: Landmark, b: Landmark) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

const TORSO_LEG_LANDMARKS = [
  LM.LEFT_SHOULDER,
  LM.RIGHT_SHOULDER,
  LM.LEFT_HIP,
  LM.RIGHT_HIP,
  LM.LEFT_KNEE,
  LM.RIGHT_KNEE,
  LM.LEFT_ANKLE,
  LM.RIGHT_ANKLE,
];

/** Shared angle extraction for the builtin holds. Arms aren't needed — they're
 *  often cropped in a floor-level plank shot. */
abstract class BodyLineHoldTracker extends BaseHoldTracker {
  private hipEma = new Ema();
  private kneeEma = new Ema();
  private tiltEma = new Ema();

  protected signals(landmarks: Landmark[]) {
    if (minVisibility(landmarks, TORSO_LEG_LANDMARKS) < 0.5) return null;
    const hip =
      (angleDeg(landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_HIP], landmarks[LM.LEFT_KNEE]) +
        angleDeg(landmarks[LM.RIGHT_SHOULDER], landmarks[LM.RIGHT_HIP], landmarks[LM.RIGHT_KNEE])) / 2;
    const knee =
      (angleDeg(landmarks[LM.LEFT_HIP], landmarks[LM.LEFT_KNEE], landmarks[LM.LEFT_ANKLE]) +
        angleDeg(landmarks[LM.RIGHT_HIP], landmarks[LM.RIGHT_KNEE], landmarks[LM.RIGHT_ANKLE])) / 2;
    const shoulders = mid(landmarks[LM.LEFT_SHOULDER], landmarks[LM.RIGHT_SHOULDER]);
    const hips = mid(landmarks[LM.LEFT_HIP], landmarks[LM.RIGHT_HIP]);
    const ankles = mid(landmarks[LM.LEFT_ANKLE], landmarks[LM.RIGHT_ANKLE]);
    // 0 deg = horizontal body line (shoulders to ankles), 90 = vertical.
    const bodyTilt =
      (Math.atan2(Math.abs(ankles.y - shoulders.y), Math.abs(ankles.x - shoulders.x)) * 180) / Math.PI;
    // 0 deg = upright torso (shoulders over hips), 90 = horizontal.
    const torsoTilt =
      (Math.atan2(Math.abs(hips.x - shoulders.x), Math.abs(hips.y - shoulders.y)) * 180) / Math.PI;
    return {
      hip: this.hipEma.update(hip),
      knee: this.kneeEma.update(knee),
      bodyTilt: this.tiltEma.update(bodyTilt),
      torsoTilt,
    };
  }

  protected resetSignals() {
    this.hipEma.reset();
    this.kneeEma.reset();
    this.tiltEma.reset();
  }
}

/** Plank: straight body line held roughly horizontal, no sagging or piking. */
export class PlankHoldTracker extends BodyLineHoldTracker {
  protected findingHint = "Get into plank — body straight like a board";

  protected classify(landmarks: Landmark[]): Classification {
    const s = this.signals(landmarks);
    if (!s) return null;
    return {
      strictIn: s.hip >= 150 && s.knee >= 145 && s.bodyTilt <= 45,
      clearlyOut: s.hip < 140 || s.knee < 135 || s.bodyTilt > 55,
    };
  }
}

/** Wall-sit: hips and knees near 90 degrees, torso upright. */
export class WallSitHoldTracker extends BodyLineHoldTracker {
  protected findingHint = "Sit against the wall — thighs level, back upright";

  protected classify(landmarks: Landmark[]): Classification {
    const s = this.signals(landmarks);
    if (!s) return null;
    return {
      strictIn:
        s.knee >= 65 && s.knee <= 115 &&
        s.hip >= 60 && s.hip <= 120 &&
        s.torsoTilt <= 35,
      clearlyOut:
        s.knee < 55 || s.knee > 125 ||
        s.hip < 50 || s.hip > 130 ||
        s.torsoTilt > 45,
    };
  }
}
