import { EXERCISES } from "@/lib/exercises";
import type { ExerciseType } from "@prisma/client";

export type BadgeItem = {
  id: string;
  challengeTitle: string;
  exercise: ExerciseType;
  completedAt: Date;
};

export default function BadgeGrid({ badges }: { badges: BadgeItem[] }) {
  if (badges.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-foreground/20 p-6 text-center text-sm text-foreground/50">
        No badges yet — complete a challenge to earn your first one! 🏅
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-3 gap-3">
      {badges.map((badge) => (
        <li
          key={badge.id}
          className="flex flex-col items-center gap-1 rounded-xl border border-foreground/10 bg-foreground/[0.03] p-3 text-center"
        >
          <span className="text-3xl" aria-hidden>
            {EXERCISES[badge.exercise].emoji}
          </span>
          <span className="line-clamp-2 text-xs font-medium leading-tight">
            {badge.challengeTitle}
          </span>
          <span className="text-[10px] text-foreground/50">
            {badge.completedAt.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </li>
      ))}
    </ul>
  );
}
