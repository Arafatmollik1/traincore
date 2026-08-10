import type { ExerciseType } from "@prisma/client";

export type ExerciseInfo = {
  label: string;
  emoji: string;
  description: string;
};

export const EXERCISES: Record<ExerciseType, ExerciseInfo> = {
  PUSHUP: {
    label: "Pushups",
    emoji: "💪",
    description: "Chest to the floor, arms fully extended at the top.",
  },
  SQUAT: {
    label: "Squats",
    emoji: "🦵",
    description: "Hips below parallel, stand all the way back up.",
  },
  SITUP: {
    label: "Sit-ups",
    emoji: "🔥",
    description: "Shoulders off the ground up to your knees and back down.",
  },
  JUMPING_JACK: {
    label: "Jumping jacks",
    emoji: "⭐",
    description: "Arms overhead and feet wide, then back together.",
  },
};

export const EXERCISE_TYPES = Object.keys(EXERCISES) as ExerciseType[];

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
  targetReps: number;
  timeLimitSeconds: number;
  restAfterSeconds: number;
};

/** Card-level summary of a challenge's segment list. */
export function challengeSummary(segments: SummarySegment[]): {
  emoji: string;
  label: string;
  totalReps: number;
  totalSeconds: number;
  count: number;
} {
  const first = segments[0];
  const info = first
    ? segmentExerciseInfo(first)
    : { label: "Workout", emoji: "🎯" };
  return {
    emoji: info.emoji,
    label: segments.length > 1 ? `${segments.length} exercises` : info.label,
    totalReps: segments.reduce((sum, s) => sum + s.targetReps, 0),
    totalSeconds: segments.reduce(
      (sum, s) => sum + s.timeLimitSeconds + s.restAfterSeconds,
      0,
    ),
    count: segments.length,
  };
}
