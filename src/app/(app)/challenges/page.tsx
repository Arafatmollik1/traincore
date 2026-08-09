import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { EXERCISES } from "@/lib/exercises";
import { formatDuration } from "@/lib/format";

export const metadata = { title: "Challenges" };

export default async function ChallengesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const userId = session.user.id;

  const [me, challenges] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    }),
    prisma.challenge.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { displayName: true } },
        completions: { where: { userId }, select: { id: true } },
        _count: { select: { completions: true } },
      },
    }),
  ]);
  const canCreate = me?.isAdmin;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Challenges</h1>
        {canCreate && (
          <Link
            href="/challenges/new"
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition active:scale-95"
          >
            + New
          </Link>
        )}
      </div>

      {challenges.length === 0 ? (
        <div className="rounded-xl border border-dashed border-foreground/20 p-8 text-center text-sm text-foreground/50">
          No challenges yet.
          {canCreate ? " Create the first one!" : " Check back soon!"}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {challenges.map((challenge) => {
            const done = challenge.completions.length > 0;
            return (
              <li key={challenge.id}>
                <Link
                  href={`/challenges/${challenge.id}`}
                  className="flex items-center gap-4 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4 transition hover:border-foreground/25"
                >
                  <span className="text-3xl" aria-hidden>
                    {EXERCISES[challenge.exercise].emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-semibold">{challenge.title}</span>
                      {done && (
                        <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">
                          ✓ DONE
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-foreground/50">
                      {challenge.targetReps} reps in {formatDuration(challenge.timeLimitSeconds)} ·{" "}
                      by {challenge.createdBy.displayName ?? "unknown"} ·{" "}
                      {challenge._count.completions} completed
                    </span>
                  </span>
                  <span className="text-foreground/30">›</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
