import type { ExerciseKind, ExerciseType } from "@prisma/client";

export type ExerciseInfo = {
  label: string;
  emoji: string;
  description: string;
  kind: ExerciseKind;
};

export const EXERCISES: Record<ExerciseType, ExerciseInfo> = {
  PUSHUP: {
    label: "Pushups",
    emoji: "💪",
    description: "Chest to the floor, arms fully extended at the top.",
    kind: "REPS",
  },
  SQUAT: {
    label: "Squats",
    emoji: "🦵",
    description: "Hips below parallel, stand all the way back up.",
    kind: "REPS",
  },
  SITUP: {
    label: "Sit-ups",
    emoji: "🔥",
    description: "Shoulders off the ground up to your knees and back down.",
    kind: "REPS",
  },
  JUMPING_JACK: {
    label: "Jumping jacks",
    emoji: "⭐",
    description: "Arms overhead and feet wide, then back together.",
    kind: "REPS",
  },
  PLANK: {
    label: "Plank",
    emoji: "🪵",
    description: "Forearms down, body straight like a board — hold it.",
    kind: "HOLD",
  },
  WALL_SIT: {
    label: "Wall-sit",
    emoji: "🪑",
    description: "Back on the wall, thighs level — hold it.",
    kind: "HOLD",
  },
};

export const EXERCISE_TYPES = Object.keys(EXERCISES) as ExerciseType[];
/** Rep-based builtins only — competitions don't support holds. */
export const REP_EXERCISE_TYPES = EXERCISE_TYPES.filter(
  (type) => EXERCISES[type].kind === "REPS",
);

export function builtinKind(type: ExerciseType): ExerciseKind {
  return EXERCISES[type].kind;
}

type SegmentExerciseFields = {
  exercise: ExerciseType | null;
  customExercise?: { name: string; emoji: string } | null;
};

/** Display info for one segment's exercise, built-in or custom. */
export function segmentExerciseInfo(segment: SegmentExerciseFields): {
  label: string;
  emoji: string;
} {
  if (segment.exercise) return EXERCISES[segment.exercise];
  if (segment.customExercise) {
    return {
      label: segment.customExercise.name,
      emoji: segment.customExercise.emoji,
    };
  }
  return { label: "Exercise", emoji: "🎯" };
}

type SummarySegment = SegmentExerciseFields & {
  targetReps: number | null;
  holdSeconds?: number | null;
  timeLimitSeconds: number;
  restAfterSeconds: number;
};

/** "12 reps", "30s hold", or the target of a single segment. */
export function segmentTarget(segment: {
  targetReps: number | null;
  holdSeconds?: number | null;
}): string {
  if (segment.holdSeconds != null) return `${segment.holdSeconds}s hold`;
  return `${segment.targetReps ?? 0} reps`;
}

/** Card-level summary of a challenge's segment list. */
export function challengeSummary(segments: SummarySegment[]): {
  emoji: string;
  label: string;
  totalReps: number;
  totalHoldSeconds: number;
  /** "40 reps", "60s holds", or "40 reps + 60s holds". */
  targetLabel: string;
  totalSeconds: number;
  count: number;
} {
  const first = segments[0];
  const info = first
    ? segmentExerciseInfo(first)
    : { label: "Workout", emoji: "🎯" };
  const totalReps = segments.reduce((sum, s) => sum + (s.targetReps ?? 0), 0);
  const totalHoldSeconds = segments.reduce(
    (sum, s) => sum + (s.holdSeconds ?? 0),
    0,
  );
  const parts = [];
  if (totalReps > 0) parts.push(`${totalReps} reps`);
  if (totalHoldSeconds > 0) parts.push(`${totalHoldSeconds}s holds`);
  return {
    emoji: info.emoji,
    label: segments.length > 1 ? `${segments.length} exercises` : info.label,
    totalReps,
    totalHoldSeconds,
    targetLabel: parts.join(" + ") || "0 reps",
    totalSeconds: segments.reduce(
      (sum, s) => sum + s.timeLimitSeconds + s.restAfterSeconds,
      0,
    ),
    count: segments.length,
  };
}
