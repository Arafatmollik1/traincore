import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import BottomNav from "@/components/BottomNav";
import NotificationPrompt from "@/components/NotificationPrompt";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { displayName: true, image: true, onboardedAt: true },
  });
  if (!user) redirect("/sign-in");
  if (!user.onboardedAt) redirect("/onboarding");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-foreground/10 bg-background/90 px-4 py-3 backdrop-blur">
        <Link href="/challenges" className="text-lg font-bold tracking-tight">
          train<span className="text-accent">core</span>
        </Link>
        <Link
          href="/profile"
          className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-foreground/15 bg-foreground/5 text-sm font-semibold"
          aria-label="Profile"
        >
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" className="h-full w-full object-cover" />
          ) : (
            (user.displayName?.[0] ?? "?").toUpperCase()
          )}
        </Link>
      </header>

      <main className="flex-1 px-4 pb-28 pt-4">{children}</main>

      <BottomNav />
      <NotificationPrompt />
    </div>
  );
}
