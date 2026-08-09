import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { handleRouteError, jsonError } from "@/lib/api";

export async function POST(
  _request: Request,
  { params }: RouteContext<"/api/competitions/[id]/enter">,
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const competition = await prisma.competition.findUnique({ where: { id } });
    if (!competition) return jsonError(404, "Competition not found");

    const now = new Date();
    if (now < competition.startsAt) return jsonError(400, "Hasn't started yet");
    if (now >= competition.endsAt) return jsonError(400, "This competition has ended");

    const entry = await prisma.competitionEntry.upsert({
      where: { competitionId_userId: { competitionId: id, userId: user.id } },
      update: {},
      create: { competitionId: id, userId: user.id },
    });
    return NextResponse.json({ entryId: entry.id });
  } catch (error) {
    return handleRouteError(error);
  }
}
