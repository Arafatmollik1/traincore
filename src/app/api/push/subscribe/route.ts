import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { handleRouteError } from "@/lib/api";

const subscribeSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(500),
    auth: z.string().min(1).max(500),
  }),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url().max(1000),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { endpoint, keys } = subscribeSchema.parse(await request.json());
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth },
      create: {
        userId: user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    const { endpoint } = unsubscribeSchema.parse(await request.json());
    await prisma.pushSubscription.deleteMany({
      where: { endpoint, userId: user.id },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
