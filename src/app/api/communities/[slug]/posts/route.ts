import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMember, requireUser } from "@/lib/authz";
import { handleRouteError, jsonError } from "@/lib/api";

const createSchema = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(1).max(5000),
});

const PAGE_SIZE = 20;

export async function GET(
  request: Request,
  { params }: RouteContext<"/api/communities/[slug]/posts">,
) {
  try {
    await requireUser();
    const { slug } = await params;
    const community = await prisma.community.findUnique({ where: { slug } });
    if (!community) return jsonError(404, "Community not found");

    const cursor = new URL(request.url).searchParams.get("cursor");
    const posts = await prisma.post.findMany({
      where: { communityId: community.id },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        author: { select: { id: true, displayName: true } },
        _count: { select: { comments: true } },
      },
    });

    const hasMore = posts.length > PAGE_SIZE;
    const page = hasMore ? posts.slice(0, PAGE_SIZE) : posts;
    return NextResponse.json({
      posts: page,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/communities/[slug]/posts">,
) {
  try {
    const { slug } = await params;
    const community = await prisma.community.findUnique({ where: { slug } });
    if (!community) return jsonError(404, "Community not found");

    const user = await requireMember(community.id);
    const { title, body } = createSchema.parse(await request.json());
    const post = await prisma.post.create({
      data: { communityId: community.id, authorId: user.id, title, body },
    });
    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
