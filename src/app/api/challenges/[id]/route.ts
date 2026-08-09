import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { handleRouteError, jsonError } from "@/lib/api";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/challenges/[id]">,
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const challenge = await prisma.challenge.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, displayName: true } },
        completions: { where: { userId: user.id }, select: { id: true } },
        _count: { select: { completions: true } },
      },
    });
    if (!challenge) return jsonError(404, "Challenge not found");
    const { completions, ...rest } = challenge;
    return NextResponse.json({ ...rest, completedByMe: completions.length > 0 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: RouteContext<"/api/challenges/[id]">,
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const challenge = await prisma.challenge.findUnique({ where: { id } });
    if (!challenge) return jsonError(404, "Challenge not found");
    if (challenge.createdById !== user.id && !user.isAdmin) {
      return jsonError(403, "Only the creator can delete this challenge");
    }
    await prisma.challenge.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
