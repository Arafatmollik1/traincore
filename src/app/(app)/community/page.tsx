import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Community" };

export default async function CommunityListPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const userId = session.user.id;

  const communities = await prisma.community.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { memberships: true, posts: true } },
      memberships: { where: { userId }, select: { id: true } },
    },
  });

  const mine = communities.filter((c) => c.memberships.length > 0);
  const discover = communities.filter((c) => c.memberships.length === 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Community</h1>
        <Link
          href="/community/new"
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition active:scale-95"
        >
          + New
        </Link>
      </div>

      {communities.length === 0 && (
        <div className="rounded-xl border border-dashed border-foreground/20 p-8 text-center text-sm text-foreground/50">
          No communities yet — start the first one!
        </div>
      )}

      {mine.length > 0 && <Section title="My communities" items={mine} />}
      {discover.length > 0 && <Section title="Discover" items={discover} />}
    </div>
  );
}

function Section({
  title,
  items,
}: {
  title: string;
  items: Array<{
    id: string;
    slug: string;
    name: string;
    description: string;
    _count: { memberships: number; posts: number };
  }>;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
        {title}
      </h2>
      <ul className="flex flex-col gap-3">
        {items.map((community) => (
          <li key={community.id}>
            <Link
              href={`/community/${community.slug}`}
              className="flex items-center gap-4 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4 transition hover:border-foreground/25"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/15 text-lg font-bold text-accent">
                {community.name[0]?.toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{community.name}</span>
                <span className="mt-0.5 line-clamp-1 block text-xs text-foreground/50">
                  {community.description}
                </span>
                <span className="mt-0.5 block text-xs text-foreground/40">
                  {community._count.memberships} members · {community._count.posts} posts
                </span>
              </span>
              <span className="text-foreground/30">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
