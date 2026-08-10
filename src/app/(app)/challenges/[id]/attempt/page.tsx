import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { segmentExerciseInfo, EXERCISES } from "@/lib/exercises";
import type { PoseSignature } from "@/ml/poseMatch";
import { BUILTIN_KEYFRAMES, type StickFrame } from "@/lib/stick";
import AttemptSession, { type SegmentSpec } from "@/components/attempt/AttemptSession";
import { badgeSpriteUrl } from "@/lib/badges";

export const metadata = { title: "Attempt" };

export default async function ChallengeAttemptPage({
  params,
}: PageProps<"/challenges/[id]/attempt">) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const { id } = await params;

  const challenge = await prisma.challenge.findUnique({
    where: { id },
    include: {
      segments: {
        orderBy: { order: "asc" },
        include: { customExercise: true },
      },
    },
  });
  if (!challenge || challenge.segments.length === 0) notFound();
  if (challenge.archivedAt) redirect(`/challenges/${id}`);

  const done = await prisma.challengeCompletion.findUnique({
    where: { challengeId_userId: { challengeId: id, userId: session.user.id } },
  });
  if (done) redirect(`/challenges/${id}`);

  const segments: SegmentSpec[] = challenge.segments.map((segment) => {
    const info = segmentExerciseInfo(segment);
    return {
      counterSpec: segment.exercise
        ? { kind: "builtin" as const, exercise: segment.exercise }
        : {
            kind: "custom" as const,
            poses: segment.customExercise!.poses as unknown as PoseSignature[],
            minCycleMs: segment.customExercise!.minCycleMs,
          },
      label: info.label,
      emoji: info.emoji,
      description: segment.exercise
        ? EXERCISES[segment.exercise].description
        : "Hit each captured pose in order — the camera tracks your movement cycle.",
      keyframes: segment.exercise
        ? BUILTIN_KEYFRAMES[segment.exercise]
        : ((segment.customExercise?.keyframes as unknown as StickFrame[] | null) ??
          undefined),
      targetReps: segment.targetReps,
      timeLimitSeconds: segment.timeLimitSeconds,
      restAfterSeconds: segment.restAfterSeconds,
    };
  });

  return (
    <AttemptSession
      segments={segments}
      badgeImage={
        challenge.badgeSprite ? badgeSpriteUrl(challenge.badgeSprite) : undefined
      }
      startEndpoint={`/api/challenges/${id}/attempts/start`}
      finishEndpoint={`/api/challenges/${id}/attempts/finish`}
      backHref={`/challenges/${id}`}
      backLabel="Back to challenge"
    />
  );
}
