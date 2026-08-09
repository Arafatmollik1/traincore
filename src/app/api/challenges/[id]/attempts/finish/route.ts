import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { handleRouteError, jsonError } from "@/lib/api";
import { assertPlausible, consumeToken, MAX_RPM } from "@/lib/anticheat";

const bodySchema = z.object({
  tokenId: z.string().min(1),
  reps: z.number().int().min(0).max(100_000),
  durationSeconds: z.number().int().min(0).max(100_000),
});

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/challenges/[id]/attempts/finish">,
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = bodySchema.parse(await request.json());

    const challenge = await prisma.challenge.findUnique({
      where: { id },
      include: { customExercise: { select: { maxRpm: true } } },
    });
    if (!challenge) return jsonError(404, "Challenge not found");

    const { elapsedSeconds } = await consumeToken({
      tokenId: body.tokenId,
      userId: user.id,
      kind: "CHALLENGE",
      challengeId: id,
    });

    // Never trust the client clock: use the smaller of claimed vs server time.
    const duration = Math.min(body.durationSeconds || elapsedSeconds, elapsedSeconds);
    const maxRpm = challenge.exercise
      ? MAX_RPM[challenge.exercise]
      : (challenge.customExercise?.maxRpm ?? 60);
    assertPlausible(maxRpm, body.reps, duration);

    const completed = body.reps >= challenge.targetReps;
    if (completed) {
      await prisma.challengeCompletion.upsert({
        where: {
          challengeId_userId: { challengeId: id, userId: user.id },
        },
        update: {},
        create: {
          challengeId: id,
          userId: user.id,
          reps: body.reps,
          durationSeconds: duration,
        },
      });
    }

    return NextResponse.json({
      completed,
      reps: body.reps,
      targetReps: challenge.targetReps,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
