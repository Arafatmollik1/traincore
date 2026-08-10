import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { challengeSummary, segmentExerciseInfo } from "@/lib/exercises";
import { formatDuration } from "@/lib/format";
import { BUILTIN_KEYFRAMES, type StickFrame } from "@/lib/stick";
import AnimatedStickFigure from "@/components/AnimatedStickFigure";

export const metadata = { title: "Challenge invite" };

export default async function PublicChallengePage({
  params,
}: PageProps<"/c/[id]">) {
  const { id } = await params;

  // Signed-in visitors go straight to the real page.
  const session = await auth();
  if (session?.user?.id) {
    const exists = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true },
    });
    if (exists) redirect(`/challenges/${id}`);
  }

  const challenge = await prisma.challenge.findUnique({
    where: { id },
    include: {
      createdBy: { select: { displayName: true } },
      segments: {
        orderBy: { order: "asc" },
        include: {
          customExercise: { select: { name: true, emoji: true, keyframes: true } },
        },
      },
      _count: { select: { completions: true } },
    },
  });
  if (!challenge || challenge.segments.length === 0) notFound();

  const summary = challengeSummary(challenge.segments);
  const first = challenge.segments[0];
  const keyframes: StickFrame[] | null = first.exercise
    ? BUILTIN_KEYFRAMES[first.exercise]
    : ((first.customExercise?.keyframes as unknown as StickFrame[] | null) ?? null);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-8 px-6 py-10 text-center">
      <p className="text-lg font-bold tracking-tight">
        train<span className="text-accent">core</span>
      </p>

      <div className="flex w-full flex-col items-center gap-3 rounded-3xl border border-foreground/10 bg-foreground/[0.02] p-8">
        {keyframes && keyframes.length >= 2 ? (
          <AnimatedStickFigure frames={keyframes} className="h-32 w-32 text-accent" />
        ) : (
          <span className="text-5xl" aria-hidden>
            {summary.emoji}
          </span>
        )}
        <h1 className="text-2xl font-bold leading-tight">{challenge.title}</h1>
        <p className="text-sm text-foreground/50">
          {summary.label} · by {challenge.createdBy.displayName ?? "unknown"}
        </p>
        {challenge.description && (
          <p className="text-sm leading-relaxed text-foreground/70">
            {challenge.description}
          </p>
        )}

        {challenge.segments.length > 1 && (
          <ul className="mt-1 w-full text-left text-sm text-foreground/70">
            {challenge.segments.map((segment, index) => {
              const info = segmentExerciseInfo(segment);
              return (
                <li key={segment.id} className="flex items-center gap-2 py-1">
                  <span className="w-4 text-xs font-bold text-foreground/40">
                    {index + 1}
                  </span>
                  <span>{info.emoji}</span>
                  <span className="min-w-0 flex-1 truncate">{info.label}</span>
                  <span className="text-xs text-foreground/50">
                    {segment.targetReps} reps
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-2 flex gap-6 text-sm">
          <div>
            <p className="text-lg font-bold">{summary.totalReps}</p>
            <p className="text-xs text-foreground/50">total reps</p>
          </div>
          <div>
            <p className="text-lg font-bold">{formatDuration(summary.totalSeconds)}</p>
            <p className="text-xs text-foreground/50">
              {summary.count > 1 ? "incl. rests" : "time limit"}
            </p>
          </div>
          <div>
            <p className="text-lg font-bold">{challenge._count.completions}</p>
            <p className="text-xs text-foreground/50">completed</p>
          </div>
        </div>
        {challenge.archivedAt && (
          <p className="mt-1 text-xs text-foreground/50">
            🗄️ This challenge has been archived — you can view it, but attempts are closed.
          </p>
        )}
      </div>

      <div className="flex w-full flex-col gap-2">
        <Link
          href={`/sign-in?callbackUrl=/challenges/${challenge.id}`}
          className="rounded-xl bg-accent px-4 py-4 text-lg font-bold text-accent-foreground transition active:scale-95"
        >
          Sign in to attempt 📷
        </Link>
        <p className="text-xs text-foreground/50">
          Free · the camera counts your reps on-device, no video ever leaves your phone
        </p>
      </div>
    </main>
  );
}
