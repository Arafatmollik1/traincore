import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { handleRouteError, jsonError } from "@/lib/api";
import { MAX_CUSTOM_EXERCISES } from "@/lib/limits";

const createSchema = z
  .object({
    name: z.string().trim().min(3).max(40),
    emoji: z.string().trim().min(1).max(4),
    joint: z.enum(["ELBOW", "KNEE", "HIP", "SHOULDER"]),
    downAngle: z.number().int().min(20).max(160),
    upAngle: z.number().int().min(40).max(180),
  })
  .refine((data) => data.upAngle >= data.downAngle + 20, {
    message: "Up angle must be at least 20° above the down angle",
    path: ["upAngle"],
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
    const exercise = await prisma.customExercise.create({
      data: { ...data, createdById: user.id },
    });
    return NextResponse.json(exercise, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
