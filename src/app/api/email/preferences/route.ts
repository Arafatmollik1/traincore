import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/authz";
import { handleRouteError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({ subscribed: z.boolean() });

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { subscribed } = bodySchema.parse(await request.json());
    await prisma.user.update({
      where: { id: user.id },
      data: { marketingOptOutAt: subscribed ? null : new Date() },
    });
    return NextResponse.json({ subscribed });
  } catch (error) {
    return handleRouteError(error);
  }
}
