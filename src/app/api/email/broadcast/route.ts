import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/authz";
import { handleRouteError } from "@/lib/api";
import { sendPromoToAllUsers } from "@/lib/email";

const bodySchema = z.object({
  subject: z.string().trim().min(1).max(100),
  body: z.string().trim().min(1).max(3000),
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
    const result = await sendPromoToAllUsers(payload);
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
