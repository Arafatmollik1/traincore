import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { loadProfile } from "@/lib/profile";
import ProfileView from "@/components/ProfileView";
import CoffeeLink from "@/components/CoffeeLink";
import { InstallRow } from "@/components/InstallApp";
import NotificationsToggle from "@/components/NotificationsToggle";
import BroadcastComposer from "@/components/BroadcastComposer";
import EmailPrefToggle from "@/components/EmailPrefToggle";
import EmailBroadcastComposer from "@/components/EmailBroadcastComposer";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const profile = await loadProfile(session.user.id);
  if (!profile) redirect("/sign-in");

  const emailPref = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { marketingOptOutAt: true },
  });

  const [subscriberCount, recipientCount] = profile.isAdmin
    ? await Promise.all([
        prisma.pushSubscription.count(),
        prisma.user.count({ where: { marketingOptOutAt: null } }),
      ])
    : [0, 0];

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
      <EmailPrefToggle initialSubscribed={emailPref?.marketingOptOutAt == null} />
      {profile.isAdmin && <BroadcastComposer subscriberCount={subscriberCount} />}
      {profile.isAdmin && <EmailBroadcastComposer recipientCount={recipientCount} />}
      <InstallRow />
      <CoffeeLink />
    </div>
  );
}
