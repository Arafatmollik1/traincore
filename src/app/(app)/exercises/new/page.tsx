import ExerciseBuilder from "./ExerciseBuilder";

export const metadata = { title: "New exercise" };

export default function NewExercisePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">New custom exercise</h1>
        <p className="mt-1 text-sm text-foreground/60">
          Pick the joint that moves, set the two angles, then test it live on
          camera until the counter feels right.
        </p>
      </div>
      <ExerciseBuilder />
    </div>
  );
}
