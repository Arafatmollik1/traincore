"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getPushState,
  subscribeToPush,
  unsubscribeFromPush,
  type PushState,
} from "@/lib/pushClient";

type State = "loading" | PushState | "busy";

export default function NotificationsToggle() {
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPushState()
      .then(setState)
      .catch(() => setState("unsupported"));
  }, []);

  const enable = useCallback(async () => {
    setState("busy");
    setError(null);
    const outcome = await subscribeToPush();
    if (outcome === "subscribed") setState("subscribed");
    else if (outcome === "denied") setState("denied");
    else {
      if (outcome === "error") setError("Couldn't enable notifications — try again.");
      setState("unsubscribed");
    }
  }, []);

  const disable = useCallback(async () => {
    setState("busy");
    setError(null);
    try {
      await unsubscribeFromPush();
      setState("unsubscribed");
    } catch {
      setState("subscribed");
    }
  }, []);

  if (state === "loading") return null;

  if (state === "unsupported") {
    return (
      <Card emoji="🔔">
        Notifications aren&apos;t available in this browser. On iPhone, install
        the app first (Share → Add to Home Screen), then enable them here.
      </Card>
    );
  }

  if (state === "no-sw") {
    return <Card emoji="🔔">Notifications are available in the production app.</Card>;
  }

  if (state === "denied") {
    return (
      <Card emoji="🔕">
        Notifications are blocked for traincore in your browser settings —
        re-enable them there, then come back.
      </Card>
    );
  }

  const on = state === "subscribed";
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4">
      <span className="text-2xl" aria-hidden>
        🔔
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Notifications</p>
        <p className="text-xs text-foreground/60">
          {on
            ? "You'll get news and announcements on this device."
            : "Get competition news and announcements on this device."}
        </p>
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
      <button
        onClick={() => void (on ? disable() : enable())}
        disabled={state === "busy"}
        aria-pressed={on}
        className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition active:scale-95 disabled:opacity-50 ${
          on
            ? "border border-foreground/20 text-foreground/70"
            : "bg-accent text-accent-foreground"
        }`}
      >
        {state === "busy" ? "…" : on ? "On ✓" : "Enable"}
      </button>
    </div>
  );
}

function Card({ emoji, children }: { emoji: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4">
      <span className="text-2xl" aria-hidden>
        {emoji}
      </span>
      <p className="text-xs text-foreground/60">{children}</p>
    </div>
  );
}
