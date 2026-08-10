import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { handleRouteError, jsonError } from "@/lib/api";
import { MAX_ACTIVE_CHALLENGES, MAX_SEGMENTS } from "@/lib/limits";

const segmentSchema = z
  .object({
    exercise: z.enum(["PUSHUP", "SQUAT", "SITUP", "JUMPING_JACK"]).optional(),
    customExerciseId: z.string().optional(),
    targetReps: z.number().int().min(1).max(1000),
    timeLimitSeconds: z.number().int().min(30).max(3600),
    restAfterSeconds: z.number().int().min(0).max(600),
  })
  .refine((data) => Boolean(data.exercise) !== Boolean(data.customExerciseId), {
    message: "Each segment needs exactly one exercise",
    path: ["exercise"],
  });

const createSchema = z.object({
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().max(500),
  segments: z.array(segmentSchema).min(1).max(MAX_SEGMENTS),
});

export async function GET() {
  try {
    const user = await requireUser();
    const challenges = await prisma.challenge.findMany({
      where: { archivedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { id: true, displayName: true } },
        segments: {
          orderBy: { order: "asc" },
          include: { customExercise: { select: { name: true, emoji: true } } },
        },
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
    const user = await requireUser();
    const data = createSchema.parse(await request.json());

    const activeCount = await prisma.challenge.count({
      where: { createdById: user.id, archivedAt: null },
    });
    if (activeCount >= MAX_ACTIVE_CHALLENGES) {
      return jsonError(
        409,
        `You already have ${MAX_ACTIVE_CHALLENGES} active challenges — archive one to make room`,
      );
    }

    const customIds = [
      ...new Set(
        data.segments
          .map((segment) => segment.customExerciseId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (customIds.length > 0) {
      const owned = await prisma.customExercise.count({
        where: { id: { in: customIds }, createdById: user.id },
      });
      if (owned !== customIds.length) {
        return jsonError(400, "Unknown custom exercise");
      }
    }

    const challenge = await prisma.challenge.create({
      data: {
        title: data.title,
        description: data.description,
        createdById: user.id,
        segments: {
          create: data.segments.map((segment, index) => ({
            order: index,
            exercise: segment.exercise,
            customExerciseId: segment.customExerciseId,
            targetReps: segment.targetReps,
            timeLimitSeconds: segment.timeLimitSeconds,
            restAfterSeconds: segment.restAfterSeconds,
          })),
        },
      },
    });
    return NextResponse.json(challenge, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
