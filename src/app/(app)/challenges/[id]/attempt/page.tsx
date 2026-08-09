import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { challengeExerciseInfo, EXERCISES } from "@/lib/exercises";
import type { CounterSpec } from "@/ml/repCounter";
import AttemptSession from "@/components/attempt/AttemptSession";

export const metadata = { title: "Attempt" };

export default async function ChallengeAttemptPage({
  params,
}: PageProps<"/challenges/[id]/attempt">) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const { id } = await params;

  const challenge = await prisma.challenge.findUnique({
    where: { id },
    include: { customExercise: true },
  });
  if (!challenge) notFound();
  if (challenge.archivedAt) redirect(`/challenges/${id}`);

  const done = await prisma.challengeCompletion.findUnique({
    where: { challengeId_userId: { challengeId: id, userId: session.user.id } },
  });
  if (done) redirect(`/challenges/${id}`);

  const counterSpec: CounterSpec = challenge.exercise
    ? { kind: "builtin", exercise: challenge.exercise }
    : {
        kind: "custom",
        joint: challenge.customExercise!.joint,
        downAngle: challenge.customExercise!.downAngle,
        upAngle: challenge.customExercise!.upAngle,
        minCycleMs: challenge.customExercise!.minCycleMs,
      };
  const info = challengeExerciseInfo(challenge);
  const description = challenge.exercise
    ? EXERCISES[challenge.exercise].description
    : "Full range of motion — the camera tracks your joint angle.";

  return (
    <AttemptSession
      counterSpec={counterSpec}
      label={info.label}
      emoji={info.emoji}
      description={description}
      timeLimitSeconds={challenge.timeLimitSeconds}
      targetReps={challenge.targetReps}
      startEndpoint={`/api/challenges/${id}/attempts/start`}
      finishEndpoint={`/api/challenges/${id}/attempts/finish`}
      backHref={`/challenges/${id}`}
      backLabel="Back to challenge"
    />
  );
}
