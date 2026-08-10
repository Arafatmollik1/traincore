import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { handleRouteError, jsonError } from "@/lib/api";
import { issueToken } from "@/lib/anticheat";

export async function POST(
  _request: Request,
  { params }: RouteContext<"/api/challenges/[id]/attempts/start">,
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const challenge = await prisma.challenge.findUnique({
      where: { id },
      include: { segments: { select: { timeLimitSeconds: true, restAfterSeconds: true } } },
    });
    if (!challenge) return jsonError(404, "Challenge not found");
    if (challenge.archivedAt) return jsonError(410, "This challenge has been archived");

    const existing = await prisma.challengeCompletion.findUnique({
      where: { challengeId_userId: { challengeId: id, userId: user.id } },
    });
    if (existing) return jsonError(409, "You already completed this challenge");

    // Whole-circuit budget: every segment's limit + rests + transition buffer.
    const totalSeconds = challenge.segments.reduce(
      (sum, segment) => sum + segment.timeLimitSeconds + segment.restAfterSeconds,
      challenge.segments.length * 10,
    );
    const token = await issueToken({
      userId: user.id,
      kind: "CHALLENGE",
      challengeId: id,
      timeLimitSeconds: totalSeconds,
    });
    return NextResponse.json({ tokenId: token.id });
  } catch (error) {
    return handleRouteError(error);
  }
}
