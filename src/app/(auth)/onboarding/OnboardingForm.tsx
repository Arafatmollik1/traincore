"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const ROLES = [
  {
    value: "TRAINEE" as const,
    emoji: "🏃",
    title: "Trainee",
    blurb: "Take on challenges, earn badges, climb leaderboards.",
  },
  {
    value: "TRAINER" as const,
    emoji: "🏋️",
    title: "Trainer",
    blurb: "Create challenges for everyone to attempt.",
  },
];

export default function OnboardingForm({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(defaultName);
  const [role, setRole] = useState<"TRAINEE" | "TRAINER">("TRAINEE");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, role }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Something went wrong");
      }
      router.replace("/challenges");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Display name</span>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          minLength={2}
          maxLength={30}
          required
          placeholder="How should we call you?"
          className="rounded-xl border border-foreground/15 bg-background px-4 py-3 text-base outline-none transition focus:border-accent"
        />
      </label>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">I&apos;m joining as</legend>
        {ROLES.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setRole(option.value)}
            aria-pressed={role === option.value}
            className={`flex items-start gap-4 rounded-xl border p-4 text-left transition ${
              role === option.value
                ? "border-accent bg-accent/10"
                : "border-foreground/15 hover:border-foreground/30"
            }`}
          >
            <span className="text-2xl">{option.emoji}</span>
            <span>
              <span className="block font-semibold">{option.title}</span>
              <span className="block text-sm text-foreground/60">
                {option.blurb}
              </span>
            </span>
          </button>
        ))}
      </fieldset>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={submitting || displayName.trim().length < 2}
        className="rounded-xl bg-accent px-4 py-3 font-semibold text-accent-foreground transition active:scale-95 disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Start training"}
      </button>
    </form>
  );
}
