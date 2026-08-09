import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/authz";
import { handleRouteError, jsonError } from "@/lib/api";

const createSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  parentId: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/posts/[postId]/comments">,
) {
  try {
    const { postId } = await params;
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { communityId: true },
    });
    if (!post) return jsonError(404, "Post not found");

    const user = await requireMember(post.communityId);
    const { body, parentId } = createSchema.parse(await request.json());

    if (parentId) {
      const parent = await prisma.comment.findUnique({
        where: { id: parentId },
        select: { postId: true },
      });
      if (!parent || parent.postId !== postId) {
        return jsonError(400, "Invalid parent comment");
      }
    }

    const comment = await prisma.comment.create({
      data: { postId, authorId: user.id, parentId, body },
    });
    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
