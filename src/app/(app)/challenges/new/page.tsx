import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MAX_ACTIVE_CHALLENGES } from "@/lib/limits";
import ChallengeForm from "./ChallengeForm";

export const metadata = { title: "New challenge" };

export default async function NewChallengePage({
  searchParams,
}: PageProps<"/challenges/new">) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const { exercise: preselect } = await searchParams;

  const [activeCount, customExercises] = await Promise.all([
    prisma.challenge.count({
      where: { createdById: session.user.id, archivedAt: null },
    }),
    prisma.customExercise.findMany({
      where: { createdById: session.user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, emoji: true },
    }),
  ]);

  if (activeCount >= MAX_ACTIVE_CHALLENGES) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <p className="text-3xl">🗄️</p>
        <h1 className="text-lg font-semibold">
          All {MAX_ACTIVE_CHALLENGES} challenge slots used
        </h1>
        <p className="max-w-xs text-sm text-foreground/60">
          Archive one of your existing challenges to make room for a new one.
        </p>
        <Link href="/challenges" className="mt-2 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground">
          Back to challenges
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">New challenge</h1>
        <span className="text-xs text-foreground/50">
          {activeCount}/{MAX_ACTIVE_CHALLENGES} slots used
        </span>
      </div>
      <ChallengeForm
        customExercises={customExercises}
        preselectCustomId={typeof preselect === "string" ? preselect : undefined}
      />
    </div>
  );
}
