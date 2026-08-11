import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { EXERCISES } from "@/lib/exercises";
import { formatDateTime, formatDuration } from "@/lib/format";
import Leaderboard from "@/components/Leaderboard";
import ShareButton from "@/components/ShareButton";
import EnterButton from "./EnterButton";

export const metadata = { title: "Competition" };

export default async function CompetitionDetailPage({
  params,
}: PageProps<"/competitions/[id]">) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const userId = session.user.id;
  const { id } = await params;

  const competition = await prisma.competition.findUnique({
    where: { id },
    include: {
      _count: { select: { entries: true } },
      entries: { where: { userId }, select: { id: true, bestReps: true } },
    },
  });
  if (!competition) notFound();

  const now = new Date();
  const upcoming = competition.startsAt > now;
  const live = competition.startsAt <= now && competition.endsAt > now;
  const finished = competition.endsAt <= now;
  const myEntry = competition.entries[0];
  const info = EXERCISES[competition.exercise];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center justify-between">
          <Link href="/competitions" className="text-sm text-foreground/50">
            ‹ Competitions
          </Link>
          <ShareButton path={`/comp/${competition.id}`} title={competition.title} />
        </div>
        <div className="mt-3 flex items-start gap-4">
          <span className="text-4xl" aria-hidden>
            {info.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold leading-tight">{competition.title}</h1>
            </div>
            <p className="mt-1 text-sm text-foreground/50">
              {upcoming && `Starts ${formatDateTime(competition.startsAt)}`}
              {live && (
                <>
                  <span className="font-semibold text-red-500">● Live</span>
                  {` · ends ${formatDateTime(competition.endsAt)}`}
                </>
              )}
              {finished && `Ended ${formatDateTime(competition.endsAt)}`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl border border-foreground/10 p-3">
          <p className="text-lg font-bold">{info.label}</p>
          <p className="text-xs text-foreground/50">exercise</p>
        </div>
        <div className="rounded-xl border border-foreground/10 p-3">
          <p className="text-lg font-bold">{formatDuration(competition.attemptTimeLimitSeconds)}</p>
          <p className="text-xs text-foreground/50">per attempt</p>
        </div>
        <div className="rounded-xl border border-foreground/10 p-3">
          <p className="text-lg font-bold">{competition._count.entries}</p>
          <p className="text-xs text-foreground/50">entered</p>
        </div>
      </div>

      {competition.description && (
        <p className="text-sm leading-relaxed text-foreground/80">{competition.description}</p>
      )}

      {live &&
        (myEntry ? (
          <Link
            href={`/competitions/${competition.id}/attempt`}
            className="rounded-xl bg-accent px-4 py-4 text-center text-lg font-bold text-accent-foreground transition active:scale-95"
          >
            {myEntry.bestReps > 0
              ? `Beat your ${myEntry.bestReps} reps 📷`
              : "Attempt with camera 📷"}
          </Link>
        ) : (
          <EnterButton competitionId={competition.id} />
        ))}

      {upcoming && (
        <p className="rounded-xl border border-foreground/15 bg-foreground/5 p-4 text-center text-sm text-foreground/60">
          Not open yet — come back when it starts!
        </p>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
          {finished ? "Final results" : "Leaderboard"}
        </h2>
        <Leaderboard competitionId={competition.id} myUserId={userId} live={live} />
      </section>
    </div>
  );
}
