"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ExerciseType } from "@prisma/client";
import { EXERCISES, EXERCISE_TYPES } from "@/lib/exercises";

export default function ChallengeForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [exercise, setExercise] = useState<ExerciseType>("PUSHUP");
  const [targetReps, setTargetReps] = useState(20);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          exercise,
          targetReps,
          timeLimitSeconds: timeLimitMinutes * 60,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Couldn't create the challenge");
      router.replace(`/challenges/${data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the challenge");
      setSubmitting(false);
    }
  }

  const inputClass =
    "rounded-xl border border-foreground/15 bg-background px-4 py-3 text-base outline-none transition focus:border-accent";

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          minLength={3}
          maxLength={80}
          placeholder="50 pushups in 5 minutes"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="What should trainees know? Form cues, pacing tips…"
          className={inputClass}
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Exercise</legend>
        <div className="grid grid-cols-2 gap-2">
          {EXERCISE_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setExercise(type)}
              aria-pressed={exercise === type}
              className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm font-medium transition ${
                exercise === type
                  ? "border-accent bg-accent/10"
                  : "border-foreground/15 hover:border-foreground/30"
              }`}
            >
              <span className="text-xl">{EXERCISES[type].emoji}</span>
              {EXERCISES[type].label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Target reps</span>
          <input
            type="number"
            value={targetReps}
            onChange={(e) => setTargetReps(Number(e.target.value))}
            min={1}
            max={1000}
            required
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Time limit (min)</span>
          <input
            type="number"
            value={timeLimitMinutes}
            onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
            min={1}
            max={60}
            required
            className={inputClass}
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-xl bg-accent px-4 py-3 font-semibold text-accent-foreground transition active:scale-95 disabled:opacity-50"
      >
        {submitting ? "Creating…" : "Create challenge"}
      </button>
    </form>
  );
}
