import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import AttemptSession from "@/components/attempt/AttemptSession";

export const metadata = { title: "Attempt" };

export default async function ChallengeAttemptPage({
  params,
}: PageProps<"/challenges/[id]/attempt">) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const { id } = await params;

  const challenge = await prisma.challenge.findUnique({ where: { id } });
  if (!challenge) notFound();

  const done = await prisma.challengeCompletion.findUnique({
    where: { challengeId_userId: { challengeId: id, userId: session.user.id } },
  });
  if (done) redirect(`/challenges/${id}`);

  return (
    <AttemptSession
      exercise={challenge.exercise}
      timeLimitSeconds={challenge.timeLimitSeconds}
      targetReps={challenge.targetReps}
      startEndpoint={`/api/challenges/${id}/attempts/start`}
      finishEndpoint={`/api/challenges/${id}/attempts/finish`}
      backHref={`/challenges/${id}`}
      backLabel="Back to challenge"
    />
  );
}
