import BadgeGrid, { type BadgeItem } from "@/components/BadgeGrid";
import { EXERCISES } from "@/lib/exercises";
import type { ExerciseType } from "@prisma/client";

export type CompetitionHistoryItem = {
  id: string;
  title: string;
  exercise: ExerciseType;
  endsAt: Date;
  bestReps: number;
  rank: number | null;
  finished: boolean;
};

export type ProfileData = {
  displayName: string;
  image: string | null;
  isAdmin: boolean;
  joinedAt: Date;
  badges: BadgeItem[];
  competitions: CompetitionHistoryItem[];
};

export default function ProfileView({
  profile,
  actions,
}: {
  profile: ProfileData;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-foreground/15 bg-foreground/5 text-xl font-bold">
          {profile.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.image} alt="" className="h-full w-full object-cover" />
          ) : (
            profile.displayName[0]?.toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold">{profile.displayName}</h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
            {profile.isAdmin && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-600 dark:text-amber-400">
                Admin
              </span>
            )}
            <span className="text-foreground/50">
              joined{" "}
              {profile.joinedAt.toLocaleDateString("en-GB", {
                month: "short",
                year: "numeric",
              })}
            </span>
          </p>
        </div>
        {actions}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
          Badges · {profile.badges.length}
        </h2>
        <BadgeGrid badges={profile.badges} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
          Competitions · {profile.competitions.length}
        </h2>
        {profile.competitions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-foreground/20 p-6 text-center text-sm text-foreground/50">
            No competitions yet.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {profile.competitions.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-foreground/10 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {EXERCISES[item.exercise].emoji} {item.title}
                  </p>
                  <p className="text-xs text-foreground/50">
                    {item.finished ? "Finished" : "Live"} ·{" "}
                    {item.bestReps} reps
                  </p>
                </div>
                {item.rank !== null && (
                  <span
                    className={`shrink-0 text-sm font-bold ${
                      item.finished && item.rank <= 3 ? "text-amber-500" : "text-foreground/60"
                    }`}
                  >
                    #{item.rank}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
