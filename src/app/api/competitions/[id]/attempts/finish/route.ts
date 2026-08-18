import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { handleRouteError, jsonError } from "@/lib/api";
import { assertPlausible, consumeToken, MAX_RPM } from "@/lib/anticheat";
import { builtinKind } from "@/lib/exercises";

const bodySchema = z.object({
  tokenId: z.string().min(1),
  reps: z.number().int().min(0).max(100_000),
  durationSeconds: z.number().int().min(0).max(100_000),
});

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/competitions/[id]/attempts/finish">,
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = bodySchema.parse(await request.json());

    const competition = await prisma.competition.findUnique({ where: { id } });
    if (!competition) return jsonError(404, "Competition not found");

    const entry = await prisma.competitionEntry.findUnique({
      where: { competitionId_userId: { competitionId: id, userId: user.id } },
    });
    if (!entry) return jsonError(403, "Enter the competition first");

    // The window must still be open (the token's grace period covers attempts
    // that started right before the deadline).
    const { token, elapsedSeconds } = await consumeToken({
      tokenId: body.tokenId,
      userId: user.id,
      kind: "COMPETITION",
      competitionId: id,
    });
    if (token.issuedAt >= competition.endsAt) {
      return jsonError(400, "This competition has ended");
    }

    const duration = Math.min(body.durationSeconds || elapsedSeconds, elapsedSeconds);
    if (builtinKind(competition.exercise) === "HOLD") {
      // Score is seconds held — it can't exceed the server-timed attempt.
      if (body.reps > elapsedSeconds) {
        return jsonError(422, "That hold time doesn't look possible");
      }
    } else {
      assertPlausible(MAX_RPM[competition.exercise], body.reps, duration);
    }

    const now = new Date();
    const isNewBest = body.reps > entry.bestReps;
    await prisma.$transaction([
      prisma.competitionAttempt.create({
        data: {
          competitionId: id,
          userId: user.id,
          reps: body.reps,
          durationSeconds: duration,
        },
      }),
      ...(isNewBest
        ? [
            prisma.competitionEntry.update({
              where: { id: entry.id },
              data: { bestReps: body.reps, bestAttemptAt: now },
            }),
          ]
        : []),
    ]);

    const bestReps = isNewBest ? body.reps : entry.bestReps;
    const bestAttemptAt = isNewBest ? now : (entry.bestAttemptAt ?? now);
    const rank =
      1 +
      (await prisma.competitionEntry.count({
        where: {
          competitionId: id,
          OR: [
            { bestReps: { gt: bestReps } },
            { bestReps, bestAttemptAt: { lt: bestAttemptAt } },
          ],
        },
      }));

    return NextResponse.json({ reps: body.reps, bestReps, isNewBest, rank });
  } catch (error) {
    return handleRouteError(error);
  }
}
