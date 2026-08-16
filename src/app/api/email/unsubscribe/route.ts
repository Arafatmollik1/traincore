import { prisma } from "@/lib/prisma";
import { verifyUnsubscribeToken } from "@/lib/email";

// Email-link unsubscribe: GET shows a confirm button (so link-prefetching mail
// scanners don't unsubscribe people), POST performs it (also serves Gmail's
// one-click List-Unsubscribe-Post). No sign-in required — the token is the proof.

function page(title: string, body: string, status = 200) {
  return new Response(
    `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title} · traincore</title>
  </head>
  <body style="margin:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#171717;">
    <div style="max-width:420px;margin:15vh auto 0;padding:0 16px;">
      <div style="background:#ffffff;border-radius:16px;padding:32px 28px;text-align:center;">
        <p style="margin:0 0 16px;font-size:20px;font-weight:800;">💪 traincore</p>
        <h1 style="margin:0 0 12px;font-size:18px;">${title}</h1>
        ${body}
      </div>
    </div>
  </body>
</html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

function parseParams(request: Request) {
  const { searchParams } = new URL(request.url);
  const uid = searchParams.get("uid");
  const token = searchParams.get("token");
  if (!uid || !token || !verifyUnsubscribeToken(uid, token)) return null;
  return { uid, token };
}

const invalid = () =>
  page(
    "This link isn't valid",
    `<p style="margin:0;color:#71717a;font-size:14px;line-height:1.6;">The unsubscribe link is incomplete or has been tampered with. You can also turn off promotional emails from your profile in the app.</p>`,
    400,
  );

export async function GET(request: Request) {
  const params = parseParams(request);
  if (!params) return invalid();
  return page(
    "Unsubscribe from promotional emails?",
    `<p style="margin:0 0 20px;color:#71717a;font-size:14px;line-height:1.6;">You'll stop getting news and announcement emails from traincore. Your account is unaffected.</p>
     <form method="post" action="/api/email/unsubscribe?uid=${encodeURIComponent(params.uid)}&amp;token=${params.token}">
       <button type="submit" style="background:#16a34a;color:#ffffff;border:0;font-size:15px;font-weight:600;padding:12px 24px;border-radius:12px;cursor:pointer;">Unsubscribe</button>
     </form>`,
  );
}

export async function POST(request: Request) {
  const params = parseParams(request);
  if (!params) return invalid();
  await prisma.user.updateMany({
    where: { id: params.uid, marketingOptOutAt: null },
    data: { marketingOptOutAt: new Date() },
  });
  return page(
    "You're unsubscribed",
    `<p style="margin:0;color:#71717a;font-size:14px;line-height:1.6;">You won't get promotional emails anymore. Changed your mind? Turn them back on from your profile in the app.</p>`,
  );
}
