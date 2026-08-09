import ExerciseBuilder from "./ExerciseBuilder";

export const metadata = { title: "New exercise" };

export default function NewExercisePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">New custom exercise</h1>
        <p className="mt-1 text-sm text-foreground/60">
          Show the camera your movement: capture its key poses (the app snaps
          automatically after a countdown, so you can step back), then prove it
          counts by doing a few test reps.
        </p>
      </div>
      <ExerciseBuilder />
    </div>
  );
}
