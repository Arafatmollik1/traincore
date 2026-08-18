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

const frameSchema = z
  .array(z.tuple([z.number().min(-0.5).max(1.5), z.number().min(-0.5).max(1.5)]))
  .length(13);

const createSchema = z
  .object({
    name: z.string().trim().min(3).max(40),
    emoji: z.string().trim().min(1).max(4),
    kind: z.enum(["REPS", "HOLD"]).default("REPS"),
    // HOLD = exactly one pose; REPS = 2-4 (checked below per kind).
    poses: z.array(signatureSchema).min(1).max(MAX_POSES),
    keyframes: z.array(frameSchema).min(1).max(MAX_POSES),
  })
  .refine((data) => data.keyframes.length === data.poses.length, {
    message: "keyframes must match poses",
    path: ["keyframes"],
  })
  .refine((data) => data.kind !== "HOLD" || data.poses.length === 1, {
    message: "A hold exercise is a single pose",
    path: ["poses"],
  })
  .refine((data) => data.kind !== "REPS" || data.poses.length >= MIN_POSES, {
    message: `A rep exercise needs at least ${MIN_POSES} poses`,
    path: ["poses"],
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
    if (data.kind === "REPS") {
      const sequenceError = validatePoseSequence(data.poses);
      if (sequenceError) return jsonError(400, sequenceError);
    }

    const exercise = await prisma.customExercise.create({
      data: { ...data, createdById: user.id },
    });
    return NextResponse.json(exercise, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
