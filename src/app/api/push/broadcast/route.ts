import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/authz";
import { handleRouteError } from "@/lib/api";
import { sendToAllSubscribers } from "@/lib/push";

const bodySchema = z.object({
  title: z.string().trim().min(1).max(60),
  body: z.string().trim().min(1).max(200),
  url: z
    .string()
    .trim()
    .regex(/^\/(?!\/)/, "Must be a relative path like /competitions/abc")
    .max(300)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const payload = bodySchema.parse(await request.json());
    const result = await sendToAllSubscribers(payload);
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
