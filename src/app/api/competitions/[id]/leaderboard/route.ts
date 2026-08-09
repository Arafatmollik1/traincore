import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { handleRouteError, jsonError } from "@/lib/api";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/competitions/[id]/leaderboard">,
) {
  try {
    await requireUser();
    const { id } = await params;
    const competition = await prisma.competition.findUnique({
      where: { id },
      select: { endsAt: true },
    });
    if (!competition) return jsonError(404, "Competition not found");

    const entries = await prisma.competitionEntry.findMany({
      where: { competitionId: id },
      orderBy: [
        { bestReps: "desc" },
        { bestAttemptAt: { sort: "asc", nulls: "last" } },
        { joinedAt: "asc" },
      ],
      include: {
        user: { select: { id: true, displayName: true, image: true } },
      },
    });

    const finished = competition.endsAt <= new Date();
    return NextResponse.json(
      {
        finished,
        entries: entries.map((entry, index) => ({
          rank: index + 1,
          userId: entry.user.id,
          displayName: entry.user.displayName ?? "unknown",
          image: entry.user.image,
          bestReps: entry.bestReps,
          bestAttemptAt: entry.bestAttemptAt,
        })),
      },
      {
        headers: {
          "Cache-Control": finished
            ? "public, s-maxage=86400"
            : "public, s-maxage=5",
        },
      },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
