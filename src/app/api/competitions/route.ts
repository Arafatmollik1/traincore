import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/authz";
import { handleRouteError, jsonError } from "@/lib/api";

const createSchema = z
  .object({
    title: z.string().trim().min(3).max(80),
    description: z.string().trim().max(500),
    exercise: z.enum(["PUSHUP", "SQUAT", "SITUP", "JUMPING_JACK", "PLANK", "WALL_SIT"]),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    attemptTimeLimitSeconds: z.number().int().min(30).max(3600),
  })
  .refine((data) => data.endsAt > data.startsAt, {
    message: "End must be after start",
    path: ["endsAt"],
  });

export async function GET() {
  try {
    await requireUser();
    const competitions = await prisma.competition.findMany({
      orderBy: { startsAt: "desc" },
      include: { _count: { select: { entries: true } } },
    });
    return NextResponse.json(competitions);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdmin();
    const data = createSchema.parse(await request.json());
    if (data.endsAt <= new Date()) {
      return jsonError(400, "End time is already in the past");
    }
    const competition = await prisma.competition.create({
      data: { ...data, createdById: user.id },
    });
    return NextResponse.json(competition, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
