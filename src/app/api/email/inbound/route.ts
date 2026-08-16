import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
import { resendClient } from "@/lib/email";

// Resend calls this for every email received on the domain (email.received
// webhook) and we forward it to the personal inbox. The svix signature is the
// auth — there is no session. Non-2xx responses make Resend retry, so only
// return errors for failures that a retry could fix.

const TOLERANCE_SECONDS = 5 * 60;

const eventSchema = z.object({
  type: z.string(),
  data: z.object({ email_id: z.string() }),
});

function verifySvixSignature(
  secret: string,
  id: string,
  timestamp: string,
  signatureHeader: string,
  payload: string,
) {
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = Buffer.from(
    createHmac("sha256", key).update(`${id}.${timestamp}.${payload}`).digest("base64"),
  );

  // Header holds space-separated "v1,<base64>" entries (one per active secret).
  return signatureHeader.split(" ").some((entry) => {
    const [version, signature] = entry.split(",");
    if (version !== "v1" || !signature) return false;
    const given = Buffer.from(signature);
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const forwardTo = process.env.INBOUND_FORWARD_TO ?? process.env.ADMIN_EMAIL;
  if (!secret || !forwardTo) {
    console.error("Inbound webhook misconfigured: RESEND_WEBHOOK_SECRET or forward address missing");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const payload = await request.text();
  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");
  if (!id || !timestamp || !signature || !verifySvixSignature(secret, id, timestamp, signature, payload)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event;
  try {
    event = eventSchema.parse(JSON.parse(payload));
  } catch {
    return NextResponse.json({ ok: true }); // signed but not a shape we handle
  }
  if (event.type !== "email.received") return NextResponse.json({ ok: true });

  const { error } = await resendClient().emails.receiving.forward({
    emailId: event.data.email_id,
    to: forwardTo,
    from: process.env.EMAIL_FROM ?? "traincore <arafat@traincore.fun>",
  });
  if (error) {
    console.error("Inbound forward failed:", error);
    return NextResponse.json({ error: "Forward failed" }, { status: 500 });
  }

  return NextResponse.json({ forwarded: true });
}
