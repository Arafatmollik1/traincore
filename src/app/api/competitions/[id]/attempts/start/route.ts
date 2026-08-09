import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { handleRouteError, jsonError } from "@/lib/api";
import { issueToken } from "@/lib/anticheat";

export async function POST(
  _request: Request,
  { params }: RouteContext<"/api/competitions/[id]/attempts/start">,
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const competition = await prisma.competition.findUnique({ where: { id } });
    if (!competition) return jsonError(404, "Competition not found");

    const now = new Date();
    if (now < competition.startsAt) return jsonError(400, "Hasn't started yet");
    if (now >= competition.endsAt) return jsonError(400, "This competition has ended");

    const entry = await prisma.competitionEntry.findUnique({
      where: { competitionId_userId: { competitionId: id, userId: user.id } },
    });
    if (!entry) return jsonError(403, "Enter the competition first");

    const token = await issueToken({
      userId: user.id,
      kind: "COMPETITION",
      competitionId: id,
      timeLimitSeconds: competition.attemptTimeLimitSeconds,
    });
    return NextResponse.json({ tokenId: token.id });
  } catch (error) {
    return handleRouteError(error);
  }
}
