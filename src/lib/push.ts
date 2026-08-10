import webpush from "web-push";
import { prisma } from "@/lib/prisma";

let configured = false;

function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    `mailto:${process.env.ADMIN_EMAIL ?? "admin@traincore.fun"}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
    process.env.VAPID_PRIVATE_KEY ?? "",
  );
  configured = true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

/** Sends a payload to every stored subscription; prunes dead ones (404/410).
 *  Returns delivery counts. */
export async function sendToAllSubscribers(payload: PushPayload) {
  configure();
  const subscriptions = await prisma.pushSubscription.findMany();
  const json = JSON.stringify(payload);

  let sent = 0;
  let failed = 0;
  const dead: string[] = [];

  await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          json,
          { TTL: 24 * 60 * 60 },
        );
        sent += 1;
      } catch (error) {
        failed += 1;
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          dead.push(subscription.id); // uninstalled / expired — clean up
        }
      }
    }),
  );

  if (dead.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: dead } } });
  }

  return { total: subscriptions.length, sent, failed, pruned: dead.length };
}
