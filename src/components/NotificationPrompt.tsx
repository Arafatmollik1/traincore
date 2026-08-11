"use client";

import { useEffect, useState } from "react";
import { getPushState, subscribeToPush } from "@/lib/pushClient";

const SNOOZE_KEY = "traincore-notif-prompt-snoozed-until";
const SNOOZE_DAYS = 14;

/** One-time notification opt-in popup — shown ONLY in the installed PWA,
 *  only while permission hasn't been decided yet. Mounted in the authed
 *  app shell so the subscribe API always has a session. */
export default function NotificationPrompt() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!standalone) return;
    if (Date.now() < Number(localStorage.getItem(SNOOZE_KEY) ?? 0)) return;

    let cancelled = false;
    // Small delay so it never fights the page's own content for attention.
    const timer = setTimeout(() => {
      getPushState()
        .then((state) => {
          if (!cancelled && state === "unsubscribed" && Notification.permission === "default") {
            setOpen(true);
          }
        })
        .catch(() => undefined);
    }, 2500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  function snooze() {
    localStorage.setItem(
      SNOOZE_KEY,
      String(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000),
    );
    setOpen(false);
  }

  async function enable() {
    setBusy(true);
    await subscribeToPush();
    setBusy(false);
    setOpen(false); // whatever the outcome, don't nag — profile toggle remains
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={snooze}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl bg-background p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-foreground/20" />
        <div className="flex items-start gap-3">
          <span className="text-3xl" aria-hidden>
            🔔
          </span>
          <div>
            <h2 className="text-lg font-bold">Never miss a competition</h2>
            <p className="mt-1 text-sm text-foreground/60">
              Get a heads-up when new competitions drop and news lands — a few
              notifications a week, no spam.
            </p>
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <button
            onClick={snooze}
            className="flex-1 rounded-xl border border-foreground/15 py-3 text-sm font-semibold text-foreground/70"
          >
            Not now
          </button>
          <button
            onClick={() => void enable()}
            disabled={busy}
            className="flex-1 rounded-xl bg-accent py-3 text-sm font-bold text-accent-foreground disabled:opacity-50"
          >
            {busy ? "…" : "Enable"}
          </button>
        </div>
      </div>
    </div>
  );
}
