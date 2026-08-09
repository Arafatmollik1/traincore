import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { challengeExerciseInfo } from "@/lib/exercises";
import { formatDuration } from "@/lib/format";

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
      customExercise: { select: { name: true, emoji: true } },
      _count: { select: { completions: true } },
    },
  });
  if (!challenge) notFound();
  const info = challengeExerciseInfo(challenge);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-8 px-6 py-10 text-center">
      <p className="text-lg font-bold tracking-tight">
        train<span className="text-accent">core</span>
      </p>

      <div className="flex w-full flex-col items-center gap-3 rounded-3xl border border-foreground/10 bg-foreground/[0.02] p-8">
        <span className="text-5xl" aria-hidden>
          {info.emoji}
        </span>
        <h1 className="text-2xl font-bold leading-tight">{challenge.title}</h1>
        <p className="text-sm text-foreground/50">
          {info.label} · by {challenge.createdBy.displayName ?? "unknown"}
        </p>
        {challenge.description && (
          <p className="text-sm leading-relaxed text-foreground/70">
            {challenge.description}
          </p>
        )}
        <div className="mt-2 flex gap-6 text-sm">
          <div>
            <p className="text-lg font-bold">{challenge.targetReps}</p>
            <p className="text-xs text-foreground/50">target reps</p>
          </div>
          <div>
            <p className="text-lg font-bold">{formatDuration(challenge.timeLimitSeconds)}</p>
            <p className="text-xs text-foreground/50">time limit</p>
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
