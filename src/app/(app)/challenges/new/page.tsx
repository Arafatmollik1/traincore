import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ChallengeForm from "./ChallengeForm";

export const metadata = { title: "New challenge" };

export default async function NewChallengePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!me?.isAdmin) redirect("/challenges");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">New challenge</h1>
      <ChallengeForm />
    </div>
  );
}
