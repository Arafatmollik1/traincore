import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { challengeSummary } from "@/lib/exercises";
import { MAX_ACTIVE_CHALLENGES } from "@/lib/limits";
import { formatDuration } from "@/lib/format";
import type { Prisma } from "@prisma/client";

export const metadata = { title: "Challenges" };

const cardInclude = {
  createdBy: { select: { displayName: true } },
  segments: {
    orderBy: { order: "asc" as const },
    include: { customExercise: { select: { name: true, emoji: true } } },
  },
  _count: { select: { completions: true } },
} satisfies Prisma.ChallengeInclude;

type ChallengeCard = Prisma.ChallengeGetPayload<{ include: typeof cardInclude }>;

export default async function ChallengesPage({
  searchParams,
}: PageProps<"/challenges">) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const userId = session.user.id;
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";

  const myCompletions = await prisma.challengeCompletion.findMany({
    where: { userId },
    select: { challengeId: true },
  });
  const completedIds = new Set(myCompletions.map((c) => c.challengeId));

  if (query) {
    const results = await prisma.challenge.findMany({
      where: {
        archivedAt: null,
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: cardInclude,
    });
    return (
      <div className="flex flex-col gap-4">
        <Header />
        <SearchBox defaultValue={query} />
        <p className="text-sm text-foreground/50">
          {results.length} result{results.length === 1 ? "" : "s"} for “{query}”
        </p>
        <CardList challenges={results} completedIds={completedIds} />
      </div>
    );
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [featured, trendingGroups, newest, mine] = await Promise.all([
    prisma.challenge.findMany({
      where: { archivedAt: null, featuredAt: { not: null } },
      orderBy: { featuredAt: "desc" },
      take: 10,
      include: cardInclude,
    }),
    prisma.challengeCompletion.groupBy({
      by: ["challengeId"],
      where: { completedAt: { gte: weekAgo }, challenge: { archivedAt: null } },
      _count: { challengeId: true },
      orderBy: { _count: { challengeId: "desc" } },
      take: 10,
    }),
    prisma.challenge.findMany({
      where: { archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: cardInclude,
    }),
    prisma.challenge.findMany({
      where: { createdById: userId },
      orderBy: [{ archivedAt: "asc" }, { createdAt: "desc" }],
      include: cardInclude,
    }),
  ]);

  const trendingIds = trendingGroups.map((group) => group.challengeId);
  const trendingRows = trendingIds.length
    ? await prisma.challenge.findMany({
        where: { id: { in: trendingIds } },
        include: cardInclude,
      })
    : [];
  const trending = trendingIds
    .map((id) => trendingRows.find((row) => row.id === id))
    .filter((row): row is ChallengeCard => Boolean(row));
  const weeklyCounts = new Map(
    trendingGroups.map((group) => [group.challengeId, group._count.challengeId]),
  );

  const myActiveCount = mine.filter((c) => !c.archivedAt).length;

  return (
    <div className="flex flex-col gap-6">
      <Header />
      <SearchBox />

      {featured.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
            ⭐ Featured
          </h2>
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
            {featured.map((challenge) => (
              <FeaturedCard
                key={challenge.id}
                challenge={challenge}
                done={completedIds.has(challenge.id)}
              />
            ))}
          </div>
        </section>
      )}

      {trending.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
            🔥 Trending this week
          </h2>
          <CardList
            challenges={trending}
            completedIds={completedIds}
            weeklyCounts={weeklyCounts}
          />
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
          🆕 New
        </h2>
        {newest.length === 0 ? (
          <p className="rounded-xl border border-dashed border-foreground/20 p-8 text-center text-sm text-foreground/50">
            No challenges yet — create the first one!
          </p>
        ) : (
          <CardList challenges={newest} completedIds={completedIds} />
        )}
      </section>

      {mine.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
            My challenges · {myActiveCount}/{MAX_ACTIVE_CHALLENGES}
          </h2>
          <CardList challenges={mine} completedIds={completedIds} showArchived />
        </section>
      )}
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold">Challenges</h1>
      <Link
        href="/challenges/new"
        className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition active:scale-95"
      >
        + New
      </Link>
    </div>
  );
}

function SearchBox({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <form action="/challenges" className="flex gap-2">
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Search challenges…"
        className="min-w-0 flex-1 rounded-xl border border-foreground/15 bg-background px-4 py-2.5 text-sm outline-none transition focus:border-accent"
      />
      <button
        type="submit"
        className="rounded-xl border border-foreground/15 px-4 text-sm font-medium text-foreground/70 transition hover:bg-foreground/5"
      >
        Search
      </button>
    </form>
  );
}

function FeaturedCard({
  challenge,
  done,
}: {
  challenge: ChallengeCard;
  done: boolean;
}) {
  const summary = challengeSummary(challenge.segments);
  return (
    <Link
      href={`/challenges/${challenge.id}`}
      className="w-60 shrink-0 snap-start rounded-2xl border border-accent/40 bg-accent/5 p-4 transition hover:border-accent"
    >
      <p className="text-2xl">{summary.emoji}</p>
      <p className="mt-1 line-clamp-2 font-semibold leading-snug">{challenge.title}</p>
      <p className="mt-1 text-xs text-foreground/50">
        {summary.count > 1
          ? `${summary.count} exercises · ${summary.targetLabel}`
          : `${summary.targetLabel} · ${formatDuration(summary.totalSeconds)}`}
        {done && " · ✓ done"}
      </p>
    </Link>
  );
}

function CardList({
  challenges,
  completedIds,
  weeklyCounts,
  showArchived = false,
}: {
  challenges: ChallengeCard[];
  completedIds: Set<string>;
  weeklyCounts?: Map<string, number>;
  showArchived?: boolean;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {challenges.map((challenge) => {
        const summary = challengeSummary(challenge.segments);
        const done = completedIds.has(challenge.id);
        const archived = Boolean(challenge.archivedAt);
        const weekly = weeklyCounts?.get(challenge.id);
        return (
          <li key={challenge.id}>
            <Link
              href={`/challenges/${challenge.id}`}
              className={`flex items-center gap-4 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4 transition hover:border-foreground/25 ${
                archived ? "opacity-50" : ""
              }`}
            >
              <span className="text-3xl" aria-hidden>
                {summary.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-semibold">{challenge.title}</span>
                  {done && (
                    <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">
                      ✓ DONE
                    </span>
                  )}
                  {showArchived && archived && (
                    <span className="shrink-0 rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-bold text-foreground/50">
                      ARCHIVED
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-foreground/50">
                  {summary.count > 1
                    ? `${summary.count} exercises · ${summary.targetLabel}`
                    : `${summary.targetLabel} in ${formatDuration(summary.totalSeconds)}`}{" "}
                  · by {challenge.createdBy.displayName ?? "unknown"} ·{" "}
                  {weekly !== undefined
                    ? `${weekly} this week`
                    : `${challenge._count.completions} completed`}
                </span>
              </span>
              <span className="text-foreground/30">›</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
