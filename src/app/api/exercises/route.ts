import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { handleRouteError, jsonError } from "@/lib/api";
import { MAX_CUSTOM_EXERCISES } from "@/lib/limits";
import {
  ANGLE_KEYS,
  MAX_POSES,
  MIN_POSES,
  validatePoseSequence,
} from "@/ml/poseMatch";

const signatureSchema = z.object(
  Object.fromEntries(
    ANGLE_KEYS.map((key) => [key, z.number().min(0).max(200)]),
  ) as Record<(typeof ANGLE_KEYS)[number], z.ZodNumber>,
);

const createSchema = z.object({
  name: z.string().trim().min(3).max(40),
  emoji: z.string().trim().min(1).max(4),
  poses: z.array(signatureSchema).min(MIN_POSES).max(MAX_POSES),
});

export async function GET() {
  try {
    const user = await requireUser();
    const exercises = await prisma.customExercise.findMany({
      where: { createdById: user.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(exercises);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const count = await prisma.customExercise.count({
      where: { createdById: user.id },
    });
    if (count >= MAX_CUSTOM_EXERCISES) {
      return jsonError(409, `You can have at most ${MAX_CUSTOM_EXERCISES} custom exercises`);
    }
    const data = createSchema.parse(await request.json());
    const sequenceError = validatePoseSequence(data.poses);
    if (sequenceError) return jsonError(400, sequenceError);

    const exercise = await prisma.customExercise.create({
      data: { ...data, createdById: user.id },
    });
    return NextResponse.json(exercise, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
