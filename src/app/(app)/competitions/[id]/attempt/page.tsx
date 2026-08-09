import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { EXERCISES } from "@/lib/exercises";
import AttemptSession from "@/components/attempt/AttemptSession";

export const metadata = { title: "Attempt" };

export default async function CompetitionAttemptPage({
  params,
}: PageProps<"/competitions/[id]/attempt">) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const { id } = await params;

  const competition = await prisma.competition.findUnique({ where: { id } });
  if (!competition) notFound();

  const now = new Date();
  if (competition.startsAt > now || competition.endsAt <= now) {
    redirect(`/competitions/${id}`);
  }

  const entry = await prisma.competitionEntry.findUnique({
    where: { competitionId_userId: { competitionId: id, userId: session.user.id } },
  });
  if (!entry) redirect(`/competitions/${id}`);

  const info = EXERCISES[competition.exercise];

  return (
    <AttemptSession
      counterSpec={{ kind: "builtin", exercise: competition.exercise }}
      label={info.label}
      emoji={info.emoji}
      description={info.description}
      timeLimitSeconds={competition.attemptTimeLimitSeconds}
      startEndpoint={`/api/competitions/${id}/attempts/start`}
      finishEndpoint={`/api/competitions/${id}/attempts/finish`}
      backHref={`/competitions/${id}`}
      backLabel="Back to leaderboard"
    />
  );
}
