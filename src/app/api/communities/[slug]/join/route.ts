import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { handleRouteError, jsonError } from "@/lib/api";

export async function POST(
  _request: Request,
  { params }: RouteContext<"/api/communities/[slug]/join">,
) {
  try {
    const user = await requireUser();
    const { slug } = await params;
    const community = await prisma.community.findUnique({ where: { slug } });
    if (!community) return jsonError(404, "Community not found");

    await prisma.membership.upsert({
      where: {
        communityId_userId: { communityId: community.id, userId: user.id },
      },
      update: {},
      create: { communityId: community.id, userId: user.id },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: RouteContext<"/api/communities/[slug]/join">,
) {
  try {
    const user = await requireUser();
    const { slug } = await params;
    const community = await prisma.community.findUnique({ where: { slug } });
    if (!community) return jsonError(404, "Community not found");

    await prisma.membership.deleteMany({
      where: { communityId: community.id, userId: user.id },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
