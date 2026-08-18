import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { competitionScore, EXERCISES } from "@/lib/exercises";
import { formatDateTime, formatDuration } from "@/lib/format";
import { BUILTIN_KEYFRAMES } from "@/lib/stick";
import AnimatedStickFigure from "@/components/AnimatedStickFigure";
import CoffeeLink from "@/components/CoffeeLink";

export const metadata = { title: "Competition invite" };

const MEDALS = ["🥇", "🥈", "🥉"];

export default async function PublicCompetitionPage({
  params,
}: PageProps<"/comp/[id]">) {
  const { id } = await params;

  // Signed-in visitors go straight to the real page.
  const session = await auth();
  if (session?.user?.id) {
    const exists = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true },
    });
    if (exists) redirect(`/competitions/${id}`);
  }

  const competition = await prisma.competition.findUnique({
    where: { id },
    include: {
      _count: { select: { entries: true } },
      entries: {
        where: { bestReps: { gt: 0 } },
        orderBy: [{ bestReps: "desc" }, { bestAttemptAt: "asc" }],
        take: 3,
        include: { user: { select: { displayName: true } } },
      },
    },
  });
  if (!competition) notFound();

  const info = EXERCISES[competition.exercise];
  const now = new Date();
  const upcoming = competition.startsAt > now;
  const live = competition.startsAt <= now && competition.endsAt > now;
  const finished = competition.endsAt <= now;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-8 px-6 py-10 text-center">
      <p className="text-lg font-bold tracking-tight">
        train<span className="text-accent">core</span>
      </p>

      <div className="flex w-full flex-col items-center gap-3 rounded-3xl border border-foreground/10 bg-foreground/[0.02] p-8">
        <AnimatedStickFigure
          frames={BUILTIN_KEYFRAMES[competition.exercise]}
          className="h-32 w-32 text-accent"
        />
        <h1 className="text-2xl font-bold leading-tight">{competition.title}</h1>
        <p className="text-sm text-foreground/50">
          {info.label} ·{" "}
          {upcoming && `starts ${formatDateTime(competition.startsAt)}`}
          {live && (
            <>
              <span className="font-semibold text-red-500">● live</span>
              {` · ends ${formatDateTime(competition.endsAt)}`}
            </>
          )}
          {finished && `ended ${formatDateTime(competition.endsAt)}`}
        </p>
        {competition.description && (
          <p className="text-sm leading-relaxed text-foreground/70">
            {competition.description}
          </p>
        )}

        <div className="mt-2 flex gap-6 text-sm">
          <div>
            <p className="text-lg font-bold">{competition._count.entries}</p>
            <p className="text-xs text-foreground/50">entered</p>
          </div>
          <div>
            <p className="text-lg font-bold">
              {formatDuration(competition.attemptTimeLimitSeconds)}
            </p>
            <p className="text-xs text-foreground/50">per attempt</p>
          </div>
        </div>

        {competition.entries.length > 0 && (
          <div className="mt-2 w-full">
            <p className="mb-1 text-left text-xs font-semibold uppercase tracking-wide text-foreground/40">
              {finished ? "Final top 3" : "Current top 3"}
            </p>
            <ul className="flex flex-col gap-1 text-left">
              {competition.entries.map((entry, index) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between rounded-lg border border-foreground/10 px-3 py-1.5 text-sm"
                >
                  <span className="font-medium">
                    {MEDALS[index]} {entry.user.displayName ?? "unknown"}
                  </span>
                  <span className="text-xs text-foreground/50">
                    {competitionScore(competition.exercise, entry.bestReps)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex w-full flex-col gap-2">
        <Link
          href={`/sign-in?callbackUrl=/competitions/${competition.id}`}
          className="rounded-xl bg-accent px-4 py-4 text-lg font-bold text-accent-foreground transition active:scale-95"
        >
          {finished ? "Sign in to see full results" : "Sign in to compete 📷"}
        </Link>
        <p className="text-xs text-foreground/50">
          Free · the camera counts your reps on-device, no video ever leaves your phone
        </p>
        <CoffeeLink />
      </div>
    </main>
  );
}
