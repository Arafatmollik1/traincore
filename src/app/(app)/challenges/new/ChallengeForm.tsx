"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ExerciseType } from "@prisma/client";
import { EXERCISES, EXERCISE_TYPES } from "@/lib/exercises";
import { MAX_SEGMENTS } from "@/lib/limits";

type CustomExerciseOption = { id: string; name: string; emoji: string };

type SegmentDraft = {
  selection:
    | { kind: "builtin"; exercise: ExerciseType }
    | { kind: "custom"; id: string };
  targetReps: number;
  timeLimitMinutes: number;
  restAfterSeconds: number;
};

const DEFAULT_SEGMENT: SegmentDraft = {
  selection: { kind: "builtin", exercise: "PUSHUP" },
  targetReps: 20,
  timeLimitMinutes: 5,
  restAfterSeconds: 30,
};

export default function ChallengeForm({
  customExercises,
  preselectCustomId,
}: {
  customExercises: CustomExerciseOption[];
  preselectCustomId?: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [segments, setSegments] = useState<SegmentDraft[]>([
    preselectCustomId && customExercises.some((e) => e.id === preselectCustomId)
      ? { ...DEFAULT_SEGMENT, selection: { kind: "custom", id: preselectCustomId } }
      : DEFAULT_SEGMENT,
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateSegment(index: number, patch: Partial<SegmentDraft>) {
    setSegments((current) =>
      current.map((segment, i) => (i === index ? { ...segment, ...patch } : segment)),
    );
  }

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
          segments: segments.map((segment) => ({
            ...(segment.selection.kind === "builtin"
              ? { exercise: segment.selection.exercise }
              : { customExerciseId: segment.selection.id }),
            targetReps: segment.targetReps,
            timeLimitSeconds: segment.timeLimitMinutes * 60,
            restAfterSeconds: segment.restAfterSeconds,
          })),
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
    "rounded-xl border border-foreground/15 bg-background px-3 py-2.5 text-sm outline-none transition focus:border-accent";

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
          placeholder="Full-body blast"
          className="rounded-xl border border-foreground/15 bg-background px-4 py-3 text-base outline-none transition focus:border-accent"
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="What should people know? Form cues, pacing tips…"
          className="rounded-xl border border-foreground/15 bg-background px-4 py-3 text-base outline-none transition focus:border-accent"
        />
      </label>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">
          Exercises · {segments.length}/{MAX_SEGMENTS}
        </legend>

        {segments.map((segment, index) => (
          <div
            key={index}
            className="flex flex-col gap-3 rounded-2xl border border-foreground/10 p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-foreground/40">
                Exercise {index + 1}
              </span>
              {segments.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setSegments((current) => current.filter((_, i) => i !== index))
                  }
                  className="text-xs font-medium text-red-500"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {EXERCISE_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() =>
                    updateSegment(index, {
                      selection: { kind: "builtin", exercise: type },
                    })
                  }
                  aria-pressed={
                    segment.selection.kind === "builtin" &&
                    segment.selection.exercise === type
                  }
                  className={`flex items-center gap-2 rounded-xl border p-2.5 text-left text-sm font-medium transition ${
                    segment.selection.kind === "builtin" &&
                    segment.selection.exercise === type
                      ? "border-accent bg-accent/10"
                      : "border-foreground/15 hover:border-foreground/30"
                  }`}
                >
                  <span className="text-lg">{EXERCISES[type].emoji}</span>
                  {EXERCISES[type].label}
                </button>
              ))}
              {customExercises.map((exercise) => (
                <button
                  key={exercise.id}
                  type="button"
                  onClick={() =>
                    updateSegment(index, {
                      selection: { kind: "custom", id: exercise.id },
                    })
                  }
                  aria-pressed={
                    segment.selection.kind === "custom" &&
                    segment.selection.id === exercise.id
                  }
                  className={`flex items-center gap-2 rounded-xl border p-2.5 text-left text-sm font-medium transition ${
                    segment.selection.kind === "custom" &&
                    segment.selection.id === exercise.id
                      ? "border-accent bg-accent/10"
                      : "border-foreground/15 hover:border-foreground/30"
                  }`}
                >
                  <span className="text-lg">{exercise.emoji}</span>
                  <span className="min-w-0 truncate">{exercise.name}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-foreground/60">Reps</span>
                <input
                  type="number"
                  value={segment.targetReps}
                  onChange={(e) =>
                    updateSegment(index, { targetReps: Number(e.target.value) })
                  }
                  min={1}
                  max={1000}
                  required
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-foreground/60">Limit (min)</span>
                <input
                  type="number"
                  value={segment.timeLimitMinutes}
                  onChange={(e) =>
                    updateSegment(index, { timeLimitMinutes: Number(e.target.value) })
                  }
                  min={1}
                  max={60}
                  required
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-foreground/60">Rest after (s)</span>
                <input
                  type="number"
                  value={segment.restAfterSeconds}
                  onChange={(e) =>
                    updateSegment(index, { restAfterSeconds: Number(e.target.value) })
                  }
                  min={0}
                  max={600}
                  step={5}
                  required
                  className={inputClass}
                />
              </label>
            </div>
          </div>
        ))}

        <div className="flex gap-2">
          {segments.length < MAX_SEGMENTS && (
            <button
              type="button"
              onClick={() =>
                setSegments((current) => [...current, { ...DEFAULT_SEGMENT }])
              }
              className="flex-1 rounded-xl border border-dashed border-foreground/25 p-3 text-sm font-medium text-foreground/60 transition hover:border-foreground/50 hover:text-foreground"
            >
              ＋ Add exercise
            </button>
          )}
          <Link
            href="/exercises/new"
            className="flex-1 rounded-xl border border-dashed border-foreground/25 p-3 text-center text-sm font-medium text-foreground/60 transition hover:border-foreground/50 hover:text-foreground"
          >
            ＋ Custom exercise
          </Link>
        </div>
      </fieldset>

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
