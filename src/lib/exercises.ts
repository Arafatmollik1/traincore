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

type ChallengeExerciseFields = {
  exercise: ExerciseType | null;
  customExercise?: { name: string; emoji: string } | null;
};

/** Display info for a challenge's exercise, built-in or custom. */
export function challengeExerciseInfo(challenge: ChallengeExerciseFields): {
  label: string;
  emoji: string;
} {
  if (challenge.exercise) return EXERCISES[challenge.exercise];
  if (challenge.customExercise) {
    return {
      label: challenge.customExercise.name,
      emoji: challenge.customExercise.emoji,
    };
  }
  return { label: "Exercise", emoji: "🎯" };
}
