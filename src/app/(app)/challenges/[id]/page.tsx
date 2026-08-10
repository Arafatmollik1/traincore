import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { challengeSummary, segmentExerciseInfo } from "@/lib/exercises";
import { MAX_ACTIVE_CHALLENGES } from "@/lib/limits";
import { formatDuration, formatRelativeTime } from "@/lib/format";
import { BUILTIN_KEYFRAMES, type StickFrame } from "@/lib/stick";
import ShareButton from "@/components/ShareButton";
import AnimatedStickFigure from "@/components/AnimatedStickFigure";
import { badgeSpriteUrl } from "@/lib/badges";

export const metadata = { title: "Challenge" };

export default async function ChallengeDetailPage({
  params,
}: PageProps<"/challenges/[id]">) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const userId = session.user.id;
  const { id } = await params;

  const [me, challenge] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    }),
    prisma.challenge.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, displayName: true } },
        segments: {
          orderBy: { order: "asc" },
          include: {
            customExercise: { select: { name: true, emoji: true, keyframes: true } },
          },
        },
        completions: {
          orderBy: { completedAt: "desc" },
          take: 10,
          include: { user: { select: { id: true, displayName: true } } },
        },
        _count: { select: { completions: true } },
      },
    }),
  ]);
  if (!challenge) notFound();

  const myCompletion = challenge.completions.find((c) => c.user.id === userId) ??
    (await prisma.challengeCompletion.findUnique({
      where: { challengeId_userId: { challengeId: id, userId } },
    }));
  const isCreator = challenge.createdBy.id === userId;
  const isAdmin = Boolean(me?.isAdmin);
  const archived = Boolean(challenge.archivedAt);
  const featured = Boolean(challenge.featuredAt);
  const summary = challengeSummary(challenge.segments);
  const segmentFrames = challenge.segments.map((segment): StickFrame[] | null =>
    segment.exercise
      ? BUILTIN_KEYFRAMES[segment.exercise]
      : ((segment.customExercise?.keyframes as unknown as StickFrame[] | null) ?? null),
  );

  async function toggleFeature() {
    "use server";
    const session = await auth();
    if (!session?.user?.id) redirect("/sign-in");
    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true },
    });
    if (!me?.isAdmin) redirect(`/challenges/${id}`);
    const target = await prisma.challenge.findUnique({ where: { id } });
    if (!target) redirect("/challenges");
    await prisma.challenge.update({
      where: { id },
      data: { featuredAt: target.featuredAt ? null : new Date() },
    });
    revalidatePath(`/challenges/${id}`);
    revalidatePath("/challenges");
  }

  async function toggleArchive() {
    "use server";
    const session = await auth();
    if (!session?.user?.id) redirect("/sign-in");
    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true },
    });
    const target = await prisma.challenge.findUnique({ where: { id } });
    if (!target) redirect("/challenges");
    if (target.createdById !== session.user.id && !me?.isAdmin) {
      redirect(`/challenges/${id}`);
    }
    if (target.archivedAt) {
      const activeCount = await prisma.challenge.count({
        where: { createdById: target.createdById, archivedAt: null },
      });
      if (activeCount >= MAX_ACTIVE_CHALLENGES) redirect(`/challenges/${id}`);
      await prisma.challenge.update({ where: { id }, data: { archivedAt: null } });
    } else {
      await prisma.challenge.update({
        where: { id },
        data: { archivedAt: new Date(), featuredAt: null },
      });
    }
    revalidatePath(`/challenges/${id}`);
    revalidatePath("/challenges");
  }

  async function deleteChallenge() {
    "use server";
    const session = await auth();
    if (!session?.user?.id) redirect("/sign-in");
    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true },
    });
    if (!me?.isAdmin) redirect(`/challenges/${id}`);
    await prisma.challenge.delete({ where: { id } });
    redirect("/challenges");
  }

  const actionButton =
    "w-full rounded-xl border px-4 py-3 text-sm font-medium transition";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center justify-between">
          <Link href="/challenges" className="text-sm text-foreground/50">
            ‹ Challenges
          </Link>
          <ShareButton path={`/c/${challenge.id}`} title={challenge.title} />
        </div>
        {archived && (
          <p className="mt-3 rounded-xl border border-foreground/15 bg-foreground/5 p-3 text-center text-xs font-medium text-foreground/60">
            🗄️ This challenge is archived — earned badges remain, but new attempts are closed.
          </p>
        )}
        <div className="mt-3 flex items-start gap-4">
          <span className="text-4xl" aria-hidden>
            {summary.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold leading-tight">{challenge.title}</h1>
              {featured && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                  ⭐ FEATURED
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-foreground/50">
              {summary.label} · by{" "}
              <Link href={`/u/${challenge.createdBy.id}`} className="underline">
                {challenge.createdBy.displayName ?? "unknown"}
              </Link>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl border border-foreground/10 p-3">
          <p className="text-lg font-bold">{summary.totalReps}</p>
          <p className="text-xs text-foreground/50">total reps</p>
        </div>
        <div className="rounded-xl border border-foreground/10 p-3">
          <p className="text-lg font-bold">{formatDuration(summary.totalSeconds)}</p>
          <p className="text-xs text-foreground/50">
            {summary.count > 1 ? "incl. rests" : "time limit"}
          </p>
        </div>
        <div className="rounded-xl border border-foreground/10 p-3">
          <p className="text-lg font-bold">{challenge._count.completions}</p>
          <p className="text-xs text-foreground/50">completed</p>
        </div>
      </div>

      {challenge.description && (
        <p className="text-sm leading-relaxed text-foreground/80">{challenge.description}</p>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
          The workout
        </h2>
        <ul className="flex flex-col gap-2">
          {challenge.segments.map((segment, index) => {
            const segmentInfo = segmentExerciseInfo(segment);
            const frames = segmentFrames[index];
            return (
              <li
                key={segment.id}
                className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-3"
              >
                {challenge.segments.length > 1 && (
                  <span className="w-5 shrink-0 text-center text-xs font-bold text-foreground/40">
                    {index + 1}
                  </span>
                )}
                {frames && frames.length >= 2 ? (
                  <AnimatedStickFigure
                    frames={frames}
                    className="h-16 w-16 shrink-0 text-accent"
                  />
                ) : (
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center text-3xl">
                    {segmentInfo.emoji}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{segmentInfo.label}</p>
                  <p className="text-xs text-foreground/50">
                    {segment.targetReps} reps · {formatDuration(segment.timeLimitSeconds)} limit
                    {segment.restAfterSeconds > 0 &&
                      index < challenge.segments.length - 1 &&
                      ` · then ${segment.restAfterSeconds}s rest`}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
        {summary.count > 1 && (
          <p className="text-xs text-foreground/40">
            All-or-nothing: complete every exercise in one session to earn the badge.
          </p>
        )}
      </section>

      {myCompletion ? (
        <div className="flex flex-col items-center rounded-2xl border border-accent/40 bg-accent/10 p-4 text-center">
          {challenge.badgeSprite ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={badgeSpriteUrl(challenge.badgeSprite)}
              alt=""
              className="h-24 w-24 object-contain"
            />
          ) : (
            <p className="text-2xl">🏅</p>
          )}
          <p className="mt-1 font-semibold">Badge earned!</p>
          <p className="text-sm text-foreground/60">
            You did {myCompletion.reps} reps {formatRelativeTime(myCompletion.completedAt)}.
          </p>
        </div>
      ) : archived ? null : (
        <div className="flex flex-col gap-3">
          {challenge.badgeSprite && (
            <div className="flex items-center justify-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={badgeSpriteUrl(challenge.badgeSprite)}
                alt=""
                className="h-16 w-16 object-contain"
              />
              <p className="text-sm text-foreground/60">
                Finish this challenge to earn the badge
              </p>
            </div>
          )}
          <Link
            href={`/challenges/${challenge.id}/attempt`}
            className="rounded-xl bg-accent px-4 py-4 text-center text-lg font-bold text-accent-foreground transition active:scale-95"
          >
            Attempt with camera 📷
          </Link>
        </div>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
          Recent finishers
        </h2>
        {challenge.completions.length === 0 ? (
          <p className="text-sm text-foreground/50">No one yet — be the first!</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {challenge.completions.map((completion) => (
              <li
                key={completion.id}
                className="flex items-center justify-between rounded-lg border border-foreground/10 px-3 py-2 text-sm"
              >
                <Link href={`/u/${completion.user.id}`} className="font-medium">
                  {completion.user.displayName ?? "unknown"}
                </Link>
                <span className="text-foreground/50">
                  {completion.reps} reps · {formatRelativeTime(completion.completedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(isCreator || isAdmin) && (
        <div className="mt-2 flex flex-col gap-2">
          {isAdmin && !archived && (
            <form action={toggleFeature}>
              <button
                type="submit"
                className={`${actionButton} border-amber-500/30 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400`}
              >
                {featured ? "Remove from Featured" : "⭐ Feature this challenge"}
              </button>
            </form>
          )}
          <form action={toggleArchive}>
            <button
              type="submit"
              className={`${actionButton} border-foreground/20 text-foreground/70 hover:bg-foreground/5`}
            >
              {archived ? "Restore challenge" : "Archive challenge"}
            </button>
          </form>
          {isAdmin && (
            <form action={deleteChallenge}>
              <button
                type="submit"
                className={`${actionButton} border-red-500/30 text-red-500 hover:bg-red-500/10`}
              >
                Delete permanently (admin)
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
