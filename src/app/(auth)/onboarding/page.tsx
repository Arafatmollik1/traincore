import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import OnboardingForm from "./OnboardingForm";

export const metadata = { title: "Welcome" };

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) redirect("/sign-in");
  if (user.onboardedAt) redirect("/challenges");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-6 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome 👋</h1>
        <p className="mt-2 text-sm text-foreground/60">
          One quick step before you start training.
        </p>
      </div>
      <OnboardingForm defaultName={user.name ?? ""} />
    </main>
  );
}
