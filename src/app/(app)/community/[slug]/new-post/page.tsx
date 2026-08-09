import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import PostForm from "./PostForm";

export const metadata = { title: "New post" };

export default async function NewPostPage({
  params,
}: PageProps<"/community/[slug]/new-post">) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const { slug } = await params;

  const community = await prisma.community.findUnique({
    where: { slug },
    include: {
      memberships: { where: { userId: session.user.id }, select: { id: true } },
    },
  });
  if (!community) notFound();
  if (community.memberships.length === 0) redirect(`/community/${slug}`);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/community/${slug}`} className="text-sm text-foreground/50">
          ‹ {community.name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">New post</h1>
      </div>
      <PostForm slug={slug} />
    </div>
  );
}
