// Pose-template matching: a captured pose is reduced to a signature of 8
// joint angles (camera-distance and position invariant). A custom exercise
// is 2-4 signatures; a rep = the live pose visiting them in order and
// returning to the first. Pure math — safe to import on server and client.
import { angleDeg, LM, minVisibility, type Landmark } from "./angles";

export const ANGLE_KEYS = [
  "leftElbow",
  "rightElbow",
  "leftShoulder",
  "rightShoulder",
  "leftHip",
  "rightHip",
  "leftKnee",
  "rightKnee",
] as const;

export type AngleKey = (typeof ANGLE_KEYS)[number];
export type PoseSignature = Record<AngleKey, number>;

export const ANGLE_TRIPLETS: Record<AngleKey, [number, number, number]> = {
  leftElbow: [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST],
  rightElbow: [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST],
  leftShoulder: [LM.LEFT_HIP, LM.LEFT_SHOULDER, LM.LEFT_ELBOW],
  rightShoulder: [LM.RIGHT_HIP, LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW],
  leftHip: [LM.LEFT_SHOULDER, LM.LEFT_HIP, LM.LEFT_KNEE],
  rightHip: [LM.RIGHT_SHOULDER, LM.RIGHT_HIP, LM.RIGHT_KNEE],
  leftKnee: [LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE],
  rightKnee: [LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
};

const NEEDED_LANDMARKS = [
  ...new Set(Object.values(ANGLE_TRIPLETS).flat()),
];

/** Live pose is "at" a template below this mean angle difference (degrees). */
export const MATCH_THRESHOLD = 25;
/** Consecutive captured poses must differ by at least this much. */
export const MIN_POSE_DISTANCE = 30;
export const MIN_POSES = 2;
export const MAX_POSES = 4;

/** Signature of the current frame, or null when the body isn't fully visible. */
export function computeSignature(landmarks: Landmark[]): PoseSignature | null {
  if (minVisibility(landmarks, NEEDED_LANDMARKS) < 0.5) return null;
  const signature = {} as PoseSignature;
  for (const key of ANGLE_KEYS) {
    const [a, b, c] = ANGLE_TRIPLETS[key];
    signature[key] = angleDeg(landmarks[a], landmarks[b], landmarks[c]);
  }
  return signature;
}

/** Mean absolute angle difference between two signatures, in degrees. */
export function signatureDistance(a: PoseSignature, b: PoseSignature): number {
  let sum = 0;
  for (const key of ANGLE_KEYS) sum += Math.abs(a[key] - b[key]);
  return sum / ANGLE_KEYS.length;
}

/**
 * Validates a captured sequence: 2-4 poses, and every consecutive pair in the
 * rep cycle (including last→first) distinct enough to be told apart.
 * Returns an error message or null when valid.
 */
export function validatePoseSequence(poses: PoseSignature[]): string | null {
  if (poses.length < MIN_POSES) return `Capture at least ${MIN_POSES} poses`;
  if (poses.length > MAX_POSES) return `At most ${MAX_POSES} poses`;
  const pairs = poses.length === 2 ? 1 : poses.length;
  for (let i = 0; i < pairs; i++) {
    const j = (i + 1) % poses.length;
    if (signatureDistance(poses[i], poses[j]) < MIN_POSE_DISTANCE) {
      return `Pose ${i + 1} and pose ${j + 1} look too similar — make them more distinct`;
    }
  }
  return null;
}
