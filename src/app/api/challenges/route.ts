import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/authz";
import { handleRouteError } from "@/lib/api";

const createSchema = z.object({
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().max(500),
  exercise: z.enum(["PUSHUP", "SQUAT", "SITUP", "JUMPING_JACK"]),
  targetReps: z.number().int().min(1).max(1000),
  timeLimitSeconds: z.number().int().min(30).max(3600),
});

export async function GET() {
  try {
    const user = await requireUser();
    const challenges = await prisma.challenge.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { id: true, displayName: true } },
        completions: { where: { userId: user.id }, select: { id: true } },
        _count: { select: { completions: true } },
      },
    });
    return NextResponse.json(
      challenges.map(({ completions, ...challenge }) => ({
        ...challenge,
        completedByMe: completions.length > 0,
      })),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdmin();
    const data = createSchema.parse(await request.json());
    const challenge = await prisma.challenge.create({
      data: { ...data, createdById: user.id },
    });
    return NextResponse.json(challenge, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
