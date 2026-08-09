import { notFound } from "next/navigation";
import { loadProfile } from "@/lib/profile";
import ProfileView from "@/components/ProfileView";

export const metadata = { title: "Profile" };

export default async function PublicProfilePage({
  params,
}: PageProps<"/u/[userId]">) {
  const { userId } = await params;
  const profile = await loadProfile(userId);
  if (!profile) notFound();

  return <ProfileView profile={profile} />;
}
