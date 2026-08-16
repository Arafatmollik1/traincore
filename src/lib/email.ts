import { createHmac, timingSafeEqual } from "crypto";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

const APP_URL = process.env.APP_URL ?? "https://traincore.fun";
const FROM = process.env.EMAIL_FROM ?? "traincore <arafat@traincore.fun>";
const BATCH_SIZE = 100; // Resend batch endpoint maximum

let resend: Resend | null = null;

export function resendClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set");
  }
  resend ??= new Resend(process.env.RESEND_API_KEY);
  return resend;
}

/** Deterministic per-user unsubscribe token — no DB column needed. */
export function unsubscribeToken(userId: string) {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "")
    .update(`unsubscribe:${userId}`)
    .digest("hex")
    .slice(0, 32);
}

export function verifyUnsubscribeToken(userId: string, token: string) {
  const expected = Buffer.from(unsubscribeToken(userId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

function unsubscribeUrl(userId: string) {
  return `${APP_URL}/api/email/unsubscribe?uid=${encodeURIComponent(userId)}&token=${unsubscribeToken(userId)}`;
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type PromoEmail = {
  subject: string;
  body: string;
  /** Relative path the CTA button links to, e.g. /competitions/abc */
  url?: string;
};

function renderHtml(email: PromoEmail, recipientName: string | null, userId: string) {
  const paragraphs = email.body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6;">${escapeHtml(p.trim()).replace(/\n/g, "<br />")}</p>`)
    .join("");
  const greeting = recipientName ? `<p style="margin:0 0 16px;line-height:1.6;">Hey ${escapeHtml(recipientName)},</p>` : "";
  const cta = email.url
    ? `<a href="${APP_URL}${escapeHtml(email.url)}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:12px;margin:8px 0 16px;">Open traincore</a>`
    : "";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#171717;">
    <div style="max-width:520px;margin:0 auto;padding:24px 16px;">
      <div style="background:#ffffff;border-radius:16px;padding:32px 28px;">
        <p style="margin:0 0 24px;font-size:20px;font-weight:800;">train<span style="color:#16a34a;">core</span></p>
        ${greeting}
        ${paragraphs}
        ${cta}
      </div>
      <p style="margin:16px 8px;font-size:12px;color:#71717a;line-height:1.5;">
        Questions or feedback? You can reply directly to this email — it reaches a real person.
        <br />
        You're receiving this because you have a traincore account.
        <a href="${unsubscribeUrl(userId)}" style="color:#71717a;">Unsubscribe</a>
      </p>
    </div>
  </body>
</html>`;
}

function renderText(email: PromoEmail, userId: string) {
  const link = email.url ? `\n\n${APP_URL}${email.url}` : "";
  return `${email.body}${link}\n\n—\nQuestions or feedback? You can reply directly to this email — it reaches a real person.\nYou're receiving this because you have a traincore account.\nUnsubscribe: ${unsubscribeUrl(userId)}`;
}

/** Sends a promotional email to every user who hasn't opted out.
 *  Returns delivery counts. */
export async function sendPromoToAllUsers(email: PromoEmail) {
  const rs = resendClient();
  const users = await prisma.user.findMany({
    where: { marketingOptOutAt: null },
    select: { id: true, email: true, displayName: true },
  });

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const chunk = users.slice(i, i + BATCH_SIZE);
    if (i > 0) await new Promise((r) => setTimeout(r, 600)); // stay under Resend's 2 req/s
    const { data, error } = await rs.batch.send(
      chunk.map((user) => ({
        from: FROM,
        to: user.email,
        subject: email.subject,
        html: renderHtml(email, user.displayName, user.id),
        text: renderText(email, user.id),
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl(user.id)}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      })),
    );
    if (error) {
      console.error("Resend batch failed:", error);
      failed += chunk.length;
    } else {
      sent += data?.data.length ?? chunk.length;
    }
  }

  return { total: users.length, sent, failed };
}
