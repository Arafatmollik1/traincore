// Stick-figure geometry shared by the static and animated SVG renderers.
// A StickFrame is 13 normalized [x, y] points in this fixed order:
// nose, L/R shoulder, L/R elbow, L/R wrist, L/R hip, L/R knee, L/R ankle.
import { LM } from "@/ml/angles";
import type { ExerciseType } from "@prisma/client";

export type StickFrame = [number, number][];

export const STICK_LANDMARKS = [
  LM.NOSE,
  LM.LEFT_SHOULDER,
  LM.RIGHT_SHOULDER,
  LM.LEFT_ELBOW,
  LM.RIGHT_ELBOW,
  LM.LEFT_WRIST,
  LM.RIGHT_WRIST,
  LM.LEFT_HIP,
  LM.RIGHT_HIP,
  LM.LEFT_KNEE,
  LM.RIGHT_KNEE,
  LM.LEFT_ANKLE,
  LM.RIGHT_ANKLE,
] as const;

const NOSE = 0;
const L_SHO = 1, R_SHO = 2, L_ELB = 3, R_ELB = 4, L_WRI = 5, R_WRI = 6;
const L_HIP = 7, R_HIP = 8, L_KNE = 9, R_KNE = 10, L_ANK = 11, R_ANK = 12;

const LIMBS: [number, number][] = [
  [L_SHO, R_SHO],
  [L_HIP, R_HIP],
  [L_SHO, L_ELB],
  [L_ELB, L_WRI],
  [R_SHO, R_ELB],
  [R_ELB, R_WRI],
  [L_HIP, L_KNE],
  [L_KNE, L_ANK],
  [R_HIP, R_KNE],
  [R_KNE, R_ANK],
];

export function extractStickFrame(
  landmarks: Array<{ x: number; y: number }>,
): StickFrame {
  return STICK_LANDMARKS.map((index) => {
    const point = landmarks[index];
    return [
      Math.round(Math.min(1.5, Math.max(-0.5, point.x)) * 1000) / 1000,
      Math.round(Math.min(1.5, Math.max(-0.5, point.y)) * 1000) / 1000,
    ] as [number, number];
  });
}

export type BBox = { minX: number; minY: number; maxX: number; maxY: number };

export function framesBBox(frames: StickFrame[]): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const frame of frames) {
    for (const [x, y] of frame) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, minY, maxX, maxY };
}

export type StickGeometry = {
  segments: Array<[number, number, number, number]>;
  head: { cx: number; cy: number; r: number };
};

/** Maps a frame into a 100×100 viewBox (bbox-fitted, aspect preserved). */
export function stickGeometry(frame: StickFrame, bbox?: BBox): StickGeometry {
  const box = bbox ?? framesBBox([frame]);
  const pad = 16;
  const width = Math.max(box.maxX - box.minX, 1e-6);
  const height = Math.max(box.maxY - box.minY, 1e-6);
  const scale = Math.min((100 - 2 * pad) / width, (100 - 2 * pad) / height);
  const offsetX = (100 - width * scale) / 2 - box.minX * scale;
  const offsetY = (100 - height * scale) / 2 - box.minY * scale;

  const points = frame.map(
    ([x, y]) => [x * scale + offsetX, y * scale + offsetY] as [number, number],
  );
  const midShoulder: [number, number] = [
    (points[L_SHO][0] + points[R_SHO][0]) / 2,
    (points[L_SHO][1] + points[R_SHO][1]) / 2,
  ];
  const midHip: [number, number] = [
    (points[L_HIP][0] + points[R_HIP][0]) / 2,
    (points[L_HIP][1] + points[R_HIP][1]) / 2,
  ];

  const segments: Array<[number, number, number, number]> = LIMBS.map(
    ([a, b]) => [points[a][0], points[a][1], points[b][0], points[b][1]],
  );
  segments.push([midShoulder[0], midShoulder[1], midHip[0], midHip[1]]);
  segments.push([points[NOSE][0], points[NOSE][1], midShoulder[0], midShoulder[1]]);

  return {
    segments,
    head: { cx: points[NOSE][0], cy: points[NOSE][1], r: 6 },
  };
}

export function lerpFrame(a: StickFrame, b: StickFrame, t: number): StickFrame {
  return a.map(([x, y], index) => [
    x + (b[index][0] - x) * t,
    y + (b[index][1] - y) * t,
  ]) as StickFrame;
}

// Hand-authored keyframes for the built-in exercises (same look everywhere).
const JACK_CLOSED: StickFrame = [
  [0.50, 0.10],
  [0.42, 0.22], [0.58, 0.22],
  [0.40, 0.34], [0.60, 0.34],
  [0.39, 0.46], [0.61, 0.46],
  [0.45, 0.48], [0.55, 0.48],
  [0.45, 0.66], [0.55, 0.66],
  [0.45, 0.84], [0.55, 0.84],
];

const JACK_OPEN: StickFrame = [
  [0.50, 0.12],
  [0.42, 0.24], [0.58, 0.24],
  [0.32, 0.14], [0.68, 0.14],
  [0.40, 0.02], [0.60, 0.02],
  [0.45, 0.50], [0.55, 0.50],
  [0.36, 0.66], [0.64, 0.66],
  [0.28, 0.82], [0.72, 0.82],
];

const SQUAT_DEEP: StickFrame = [
  [0.50, 0.40],
  [0.42, 0.50], [0.58, 0.50],
  [0.30, 0.52], [0.70, 0.52],
  [0.22, 0.50], [0.78, 0.50],
  [0.46, 0.66], [0.54, 0.66],
  [0.38, 0.68], [0.62, 0.68],
  [0.42, 0.86], [0.58, 0.86],
];

const PUSHUP_TOP: StickFrame = [
  [0.16, 0.28],
  [0.25, 0.38], [0.25, 0.38],
  [0.25, 0.52], [0.25, 0.52],
  [0.25, 0.66], [0.25, 0.66],
  [0.55, 0.50], [0.55, 0.50],
  [0.72, 0.57], [0.72, 0.57],
  [0.88, 0.65], [0.88, 0.65],
];

const PUSHUP_BOTTOM: StickFrame = [
  [0.14, 0.52],
  [0.23, 0.58], [0.23, 0.58],
  [0.29, 0.65], [0.29, 0.65],
  [0.25, 0.70], [0.25, 0.70],
  [0.55, 0.62], [0.55, 0.62],
  [0.72, 0.65], [0.72, 0.65],
  [0.88, 0.68], [0.88, 0.68],
];

const SITUP_LYING: StickFrame = [
  [0.13, 0.60],
  [0.22, 0.68], [0.22, 0.68],
  [0.25, 0.60], [0.25, 0.60],
  [0.20, 0.56], [0.20, 0.56],
  [0.50, 0.72], [0.50, 0.72],
  [0.63, 0.54], [0.63, 0.54],
  [0.73, 0.72], [0.73, 0.72],
];

const SITUP_CRUNCHED: StickFrame = [
  [0.37, 0.36],
  [0.41, 0.46], [0.41, 0.46],
  [0.46, 0.51], [0.46, 0.51],
  [0.50, 0.45], [0.50, 0.45],
  [0.50, 0.70], [0.50, 0.70],
  [0.63, 0.54], [0.63, 0.54],
  [0.73, 0.70], [0.73, 0.70],
];

// Holds are a single frame — renderers fall back to the static figure.
const PLANK_HOLD: StickFrame = [
  [0.14, 0.40],
  [0.24, 0.48], [0.24, 0.48],
  [0.24, 0.62], [0.24, 0.62],
  [0.34, 0.66], [0.34, 0.66],
  [0.52, 0.50], [0.52, 0.50],
  [0.70, 0.56], [0.70, 0.56],
  [0.87, 0.62], [0.87, 0.62],
];

const WALL_SIT_HOLD: StickFrame = [
  [0.55, 0.16],
  [0.58, 0.28], [0.58, 0.28],
  [0.56, 0.42], [0.56, 0.42],
  [0.52, 0.52], [0.52, 0.52],
  [0.58, 0.52], [0.58, 0.52],
  [0.38, 0.52], [0.38, 0.52],
  [0.38, 0.78], [0.38, 0.78],
];

export const BUILTIN_KEYFRAMES: Record<ExerciseType, StickFrame[]> = {
  PUSHUP: [PUSHUP_TOP, PUSHUP_BOTTOM],
  SQUAT: [JACK_CLOSED, SQUAT_DEEP],
  SITUP: [SITUP_LYING, SITUP_CRUNCHED],
  JUMPING_JACK: [JACK_CLOSED, JACK_OPEN],
  PLANK: [PLANK_HOLD],
  WALL_SIT: [WALL_SIT_HOLD],
};
