import type { AttemptKind, AttemptToken, ExerciseType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuthzError } from "@/lib/authz";

/** Generous ceilings on humanly-plausible reps per minute, per exercise. */
export const MAX_RPM: Record<ExerciseType, number> = {
  PUSHUP: 90,
  SQUAT: 80,
  SITUP: 60,
  JUMPING_JACK: 110,
};

export const TOKEN_GRACE_SECONDS = 60;
const MAX_TOKENS_PER_HOUR = 30;

export function assertPlausible(
  exercise: ExerciseType,
  reps: number,
  elapsedSeconds: number,
) {
  const cap = Math.ceil((MAX_RPM[exercise] * Math.max(elapsedSeconds, 10)) / 60) + 5;
  if (reps > cap) {
    throw new AuthzError(422, "That rep count doesn't look humanly possible");
  }
}

export async function assertUnderRateLimit(userId: string) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.attemptToken.count({
    where: { userId, issuedAt: { gte: oneHourAgo } },
  });
  if (recent >= MAX_TOKENS_PER_HOUR) {
    throw new AuthzError(429, "Too many attempts — take a breather and try again later");
  }
}

export async function issueToken(params: {
  userId: string;
  kind: AttemptKind;
  challengeId?: string;
  competitionId?: string;
  timeLimitSeconds: number;
}): Promise<AttemptToken> {
  await assertUnderRateLimit(params.userId);
  return prisma.attemptToken.create({
    data: {
      userId: params.userId,
      kind: params.kind,
      challengeId: params.challengeId,
      competitionId: params.competitionId,
      expiresAt: new Date(
        Date.now() + (params.timeLimitSeconds + TOKEN_GRACE_SECONDS) * 1000,
      ),
    },
  });
}

/**
 * Atomically consume a single-use attempt token. Returns the token with
 * server-side elapsed seconds; throws if missing, foreign, replayed or expired.
 */
export async function consumeToken(params: {
  tokenId: string;
  userId: string;
  kind: AttemptKind;
  challengeId?: string;
  competitionId?: string;
}): Promise<{ token: AttemptToken; elapsedSeconds: number }> {
  const now = new Date();
  const token = await prisma.attemptToken.findUnique({
    where: { id: params.tokenId },
  });
  if (
    !token ||
    token.userId !== params.userId ||
    token.kind !== params.kind ||
    (params.challengeId && token.challengeId !== params.challengeId) ||
    (params.competitionId && token.competitionId !== params.competitionId)
  ) {
    throw new AuthzError(400, "Invalid attempt token");
  }
  if (token.expiresAt < now) {
    throw new AuthzError(410, "This attempt expired — start a new one");
  }

  const consumed = await prisma.attemptToken.updateMany({
    where: { id: token.id, consumedAt: null },
    data: { consumedAt: now },
  });
  if (consumed.count === 0) {
    throw new AuthzError(409, "This attempt was already submitted");
  }

  const elapsedSeconds = Math.max(
    1,
    Math.round((now.getTime() - token.issuedAt.getTime()) / 1000),
  );
  return { token, elapsedSeconds };
}
