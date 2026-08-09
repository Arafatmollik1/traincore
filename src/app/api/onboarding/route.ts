import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/authz";
import { handleRouteError, jsonError } from "@/lib/api";

const bodySchema = z.object({
  displayName: z.string().trim().min(2).max(30),
  role: z.enum(["TRAINEE", "TRAINER"]),
});

export async function POST(request: Request) {
  try {
    const user = await requireSession();
    if (user.onboardedAt) {
      return jsonError(409, "Already onboarded");
    }
    const { displayName, role } = bodySchema.parse(await request.json());

    await prisma.user.update({
      where: { id: user.id },
      data: { displayName, role, onboardedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
