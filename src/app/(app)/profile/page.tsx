import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { loadProfile } from "@/lib/profile";
import ProfileView from "@/components/ProfileView";
import CoffeeLink from "@/components/CoffeeLink";
import { InstallRow } from "@/components/InstallApp";
import NotificationsToggle from "@/components/NotificationsToggle";
import BroadcastComposer from "@/components/BroadcastComposer";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const profile = await loadProfile(session.user.id);
  if (!profile) redirect("/sign-in");

  const subscriberCount = profile.isAdmin
    ? await prisma.pushSubscription.count()
    : 0;

  return (
    <div className="flex flex-col gap-8">
      <ProfileView
        profile={profile}
        actions={
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/sign-in" });
          }}
        >
          <button
            type="submit"
            className="rounded-full border border-foreground/15 px-3 py-1.5 text-xs font-medium text-foreground/70 transition hover:bg-foreground/5"
          >
            Sign out
          </button>
        </form>
        }
      />
      <NotificationsToggle />
      {profile.isAdmin && <BroadcastComposer subscriberCount={subscriberCount} />}
      <InstallRow />
      <CoffeeLink />
    </div>
  );
}
