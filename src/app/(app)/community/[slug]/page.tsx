import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatRelativeTime } from "@/lib/format";
import JoinButton from "./JoinButton";

export const metadata = { title: "Community" };

export default async function CommunityPage({
  params,
}: PageProps<"/community/[slug]">) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const userId = session.user.id;
  const { slug } = await params;

  const community = await prisma.community.findUnique({
    where: { slug },
    include: {
      _count: { select: { memberships: true } },
      memberships: { where: { userId }, select: { id: true } },
      posts: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          author: { select: { id: true, displayName: true } },
          _count: { select: { comments: true } },
        },
      },
    },
  });
  if (!community) notFound();
  const joined = community.memberships.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/community" className="text-sm text-foreground/50">
          ‹ Community
        </Link>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold leading-tight">{community.name}</h1>
            <p className="mt-1 text-sm text-foreground/60">{community.description}</p>
            <p className="mt-1 text-xs text-foreground/40">
              {community._count.memberships} members
            </p>
          </div>
          <JoinButton slug={community.slug} joined={joined} />
        </div>
      </div>

      {joined && (
        <Link
          href={`/community/${community.slug}/new-post`}
          className="rounded-xl border border-foreground/15 px-4 py-3 text-sm text-foreground/50 transition hover:border-foreground/30"
        >
          Share your thoughts…
        </Link>
      )}

      {community.posts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-foreground/20 p-8 text-center text-sm text-foreground/50">
          No posts yet.{joined ? " Start the conversation!" : " Join to post the first one!"}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {community.posts.map((post) => (
            <li key={post.id}>
              <Link
                href={`/community/${community.slug}/post/${post.id}`}
                className="block rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4 transition hover:border-foreground/25"
              >
                <p className="text-xs text-foreground/50">
                  {post.author.displayName ?? "unknown"} · {formatRelativeTime(post.createdAt)}
                </p>
                <h2 className="mt-1 font-semibold leading-snug">{post.title}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-foreground/70">{post.body}</p>
                <p className="mt-2 text-xs text-foreground/50">
                  💬 {post._count.comments}{" "}
                  {post._count.comments === 1 ? "comment" : "comments"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
