import { prisma } from "@/lib/prisma";
import type { ProfileData } from "@/components/ProfileView";

export async function loadProfile(userId: string): Promise<ProfileData | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      displayName: true,
      name: true,
      image: true,
      isAdmin: true,
      createdAt: true,
    },
  });
  if (!user) return null;

  const [completions, entries] = await Promise.all([
    prisma.challengeCompletion.findMany({
      where: { userId },
      orderBy: { completedAt: "desc" },
      include: { challenge: { select: { title: true, exercise: true } } },
    }),
    prisma.competitionEntry.findMany({
      where: { userId },
      orderBy: { joinedAt: "desc" },
      include: {
        competition: {
          select: { id: true, title: true, exercise: true, endsAt: true },
        },
      },
    }),
  ]);

  const now = new Date();
  const competitions = await Promise.all(
    entries.map(async (entry) => {
      const rank =
        entry.bestReps > 0
          ? 1 +
            (await prisma.competitionEntry.count({
              where: {
                competitionId: entry.competitionId,
                OR: [
                  { bestReps: { gt: entry.bestReps } },
                  {
                    bestReps: entry.bestReps,
                    bestAttemptAt: { lt: entry.bestAttemptAt ?? now },
                  },
                ],
              },
            }))
          : null;
      return {
        id: entry.competition.id,
        title: entry.competition.title,
        exercise: entry.competition.exercise,
        endsAt: entry.competition.endsAt,
        bestReps: entry.bestReps,
        rank,
        finished: entry.competition.endsAt <= now,
      };
    }),
  );

  return {
    displayName: user.displayName ?? user.name ?? "Anonymous",
    image: user.image,
    isAdmin: user.isAdmin,
    joinedAt: user.createdAt,
    badges: completions.map((completion) => ({
      id: completion.id,
      challengeTitle: completion.challenge.title,
      exercise: completion.challenge.exercise,
      completedAt: completion.completedAt,
    })),
    competitions,
  };
}
