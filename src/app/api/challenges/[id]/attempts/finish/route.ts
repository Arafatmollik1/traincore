import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { handleRouteError, jsonError } from "@/lib/api";
import { assertPlausible, consumeToken, MAX_RPM } from "@/lib/anticheat";
import { MAX_SEGMENTS } from "@/lib/limits";

const bodySchema = z.object({
  tokenId: z.string().min(1),
  segments: z
    .array(
      z.object({
        reps: z.number().int().min(0).max(100_000),
        durationSeconds: z.number().int().min(0).max(100_000),
      }),
    )
    .min(1)
    .max(MAX_SEGMENTS),
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
      include: {
        segments: {
          orderBy: { order: "asc" },
          include: { customExercise: { select: { maxRpm: true } } },
        },
      },
    });
    if (!challenge) return jsonError(404, "Challenge not found");
    if (body.segments.length > challenge.segments.length) {
      return jsonError(400, "Too many segment results");
    }

    const { elapsedSeconds } = await consumeToken({
      tokenId: body.tokenId,
      userId: user.id,
      kind: "CHALLENGE",
      challengeId: id,
    });

    // Per-segment plausibility; total claimed time can never exceed the
    // server-measured elapsed time.
    let claimedTotal = 0;
    body.segments.forEach((result, index) => {
      const segment = challenge.segments[index];
      const duration = Math.min(
        result.durationSeconds || segment.timeLimitSeconds,
        segment.timeLimitSeconds,
      );
      claimedTotal += duration;
      const maxRpm = segment.exercise
        ? MAX_RPM[segment.exercise]
        : (segment.customExercise?.maxRpm ?? 60);
      assertPlausible(maxRpm, result.reps, duration);
    });
    if (claimedTotal > elapsedSeconds + 30) {
      return jsonError(422, "Reported segment times don't add up");
    }

    // All-or-nothing: every segment must exist and hit its target.
    const completed =
      body.segments.length === challenge.segments.length &&
      body.segments.every(
        (result, index) => result.reps >= challenge.segments[index].targetReps,
      );
    const totalReps = body.segments.reduce((sum, result) => sum + result.reps, 0);

    if (completed) {
      await prisma.challengeCompletion.upsert({
        where: {
          challengeId_userId: { challengeId: id, userId: user.id },
        },
        update: {},
        create: {
          challengeId: id,
          userId: user.id,
          reps: totalReps,
          durationSeconds: elapsedSeconds,
        },
      });
    }

    return NextResponse.json({
      completed,
      reps: totalReps,
      targetReps: challenge.segments.reduce((sum, s) => sum + s.targetReps, 0),
      segmentsCompleted: body.segments.filter(
        (result, index) => result.reps >= (challenge.segments[index]?.targetReps ?? Infinity),
      ).length,
      segmentsTotal: challenge.segments.length,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
