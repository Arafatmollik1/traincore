import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import CompetitionForm from "./CompetitionForm";

export const metadata = { title: "New competition" };

export default async function NewCompetitionPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!me?.isAdmin) redirect("/competitions");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">New competition</h1>
      <CompetitionForm />
    </div>
  );
}
