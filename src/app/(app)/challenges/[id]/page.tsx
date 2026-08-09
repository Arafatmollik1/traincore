import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { EXERCISES } from "@/lib/exercises";
import { formatDuration, formatRelativeTime } from "@/lib/format";

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
  const canDelete = challenge.createdBy.id === userId || me?.isAdmin;
  const info = EXERCISES[challenge.exercise];

  async function deleteChallenge() {
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
    await prisma.challenge.delete({ where: { id } });
    redirect("/challenges");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/challenges" className="text-sm text-foreground/50">
          ‹ Challenges
        </Link>
        <div className="mt-3 flex items-start gap-4">
          <span className="text-4xl" aria-hidden>
            {info.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold leading-tight">{challenge.title}</h1>
            <p className="mt-1 text-sm text-foreground/50">
              by{" "}
              <Link href={`/u/${challenge.createdBy.id}`} className="underline">
                {challenge.createdBy.displayName ?? "unknown"}
              </Link>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl border border-foreground/10 p-3">
          <p className="text-lg font-bold">{challenge.targetReps}</p>
          <p className="text-xs text-foreground/50">target reps</p>
        </div>
        <div className="rounded-xl border border-foreground/10 p-3">
          <p className="text-lg font-bold">{formatDuration(challenge.timeLimitSeconds)}</p>
          <p className="text-xs text-foreground/50">time limit</p>
        </div>
        <div className="rounded-xl border border-foreground/10 p-3">
          <p className="text-lg font-bold">{challenge._count.completions}</p>
          <p className="text-xs text-foreground/50">completed</p>
        </div>
      </div>

      {challenge.description && (
        <p className="text-sm leading-relaxed text-foreground/80">{challenge.description}</p>
      )}

      {myCompletion ? (
        <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4 text-center">
          <p className="text-2xl">🏅</p>
          <p className="mt-1 font-semibold">Badge earned!</p>
          <p className="text-sm text-foreground/60">
            You did {myCompletion.reps} reps {formatRelativeTime(myCompletion.completedAt)}.
          </p>
        </div>
      ) : (
        <Link
          href={`/challenges/${challenge.id}/attempt`}
          className="rounded-xl bg-accent px-4 py-4 text-center text-lg font-bold text-accent-foreground transition active:scale-95"
        >
          Attempt with camera 📷
        </Link>
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

      {canDelete && (
        <form action={deleteChallenge} className="mt-4">
          <button
            type="submit"
            className="w-full rounded-xl border border-red-500/30 px-4 py-3 text-sm font-medium text-red-500 transition hover:bg-red-500/10"
          >
            Delete challenge
          </button>
        </form>
      )}
    </div>
  );
}
