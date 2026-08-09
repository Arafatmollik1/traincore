import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatRelativeTime } from "@/lib/format";
import CommentThread, { type CommentNode } from "@/components/CommentThread";

export const metadata = { title: "Post" };

export default async function PostPage({
  params,
}: PageProps<"/community/[slug]/post/[postId]">) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const { slug, postId } = await params;

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      author: { select: { id: true, displayName: true } },
      community: {
        select: {
          id: true,
          slug: true,
          name: true,
          memberships: {
            where: { userId: session.user.id },
            select: { id: true },
          },
        },
      },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, displayName: true } } },
      },
    },
  });
  if (!post || post.community.slug !== slug) notFound();

  // Nest the flat comment list by parentId.
  const nodes = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];
  for (const comment of post.comments) {
    nodes.set(comment.id, {
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      author: comment.author,
      replies: [],
    });
  }
  for (const comment of post.comments) {
    const node = nodes.get(comment.id)!;
    const parent = comment.parentId ? nodes.get(comment.parentId) : undefined;
    if (parent) parent.replies.push(node);
    else roots.push(node);
  }

  const isMember = post.community.memberships.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href={`/community/${slug}`} className="text-sm text-foreground/50">
          ‹ {post.community.name}
        </Link>
        <h1 className="mt-3 text-xl font-bold leading-snug">{post.title}</h1>
        <p className="mt-1 text-xs text-foreground/50">
          <Link href={`/u/${post.author.id}`} className="font-medium text-foreground/70">
            {post.author.displayName ?? "unknown"}
          </Link>{" "}
          · {formatRelativeTime(post.createdAt)}
        </p>
      </div>

      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/90">
        {post.body}
      </p>

      <hr className="border-foreground/10" />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
          Comments · {post.comments.length}
        </h2>
        <CommentThread postId={post.id} comments={roots} canComment={isMember} />
      </section>
    </div>
  );
}
