import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { EXERCISES } from "@/lib/exercises";
import { formatDateTime } from "@/lib/format";
import type { Competition } from "@prisma/client";

export const metadata = { title: "Competitions" };

type CompetitionWithCount = Competition & { _count: { entries: number } };

export default async function CompetitionsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const [me, competitions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true },
    }),
    prisma.competition.findMany({
      orderBy: { startsAt: "desc" },
      include: { _count: { select: { entries: true } } },
    }),
  ]);

  const now = new Date();
  const live = competitions.filter((c) => c.startsAt <= now && c.endsAt > now);
  const upcoming = competitions.filter((c) => c.startsAt > now);
  const past = competitions.filter((c) => c.endsAt <= now);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Competitions</h1>
        {me?.isAdmin && (
          <Link
            href="/competitions/new"
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition active:scale-95"
          >
            + New
          </Link>
        )}
      </div>

      {competitions.length === 0 && (
        <div className="rounded-xl border border-dashed border-foreground/20 p-8 text-center text-sm text-foreground/50">
          No competitions yet — check back soon!
        </div>
      )}

      <Section title="🔴 Live now" items={live} status="live" />
      <Section title="📅 Upcoming" items={upcoming} status="upcoming" />
      <Section title="🏁 Finished" items={past} status="past" />
    </div>
  );
}

function Section({
  title,
  items,
  status,
}: {
  title: string;
  items: CompetitionWithCount[];
  status: "live" | "upcoming" | "past";
}) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
        {title}
      </h2>
      <ul className="flex flex-col gap-3">
        {items.map((competition) => (
          <li key={competition.id}>
            <Link
              href={`/competitions/${competition.id}`}
              className={`flex items-center gap-4 rounded-2xl border p-4 transition hover:border-foreground/25 ${
                status === "live"
                  ? "border-accent/40 bg-accent/5"
                  : "border-foreground/10 bg-foreground/[0.02]"
              } ${status === "past" ? "opacity-70" : ""}`}
            >
              <span className="text-3xl" aria-hidden>
                {EXERCISES[competition.exercise].emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{competition.title}</span>
                <span className="mt-0.5 block text-xs text-foreground/50">
                  {status === "upcoming"
                    ? `Starts ${formatDateTime(competition.startsAt)}`
                    : status === "live"
                      ? `Ends ${formatDateTime(competition.endsAt)}`
                      : `Ended ${formatDateTime(competition.endsAt)}`}
                  {" · "}
                  {competition._count.entries} entered
                </span>
              </span>
              <span className="text-foreground/30">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
