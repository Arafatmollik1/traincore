import type { User } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export class AuthzError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Signed-in user, onboarded or not. Used by the onboarding endpoint itself. */
export async function requireSession(): Promise<User> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new AuthzError(401, "Not signed in");
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AuthzError(401, "Not signed in");
  return user;
}

/** Signed-in AND onboarded user — the baseline for every app endpoint. */
export async function requireUser(): Promise<User> {
  const user = await requireSession();
  if (!user.onboardedAt) throw new AuthzError(403, "Complete onboarding first");
  return user;
}

export async function requireTrainer(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "TRAINER" && !user.isAdmin) {
    throw new AuthzError(403, "Only trainers can do this");
  }
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (!user.isAdmin) throw new AuthzError(403, "Only the admin can do this");
  return user;
}

export async function requireMember(communityId: string): Promise<User> {
  const user = await requireUser();
  const membership = await prisma.membership.findUnique({
    where: { communityId_userId: { communityId, userId: user.id } },
  });
  if (!membership) throw new AuthzError(403, "Join this community first");
  return user;
}
