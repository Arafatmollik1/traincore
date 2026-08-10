"use client";

import { useCallback, useEffect, useState } from "react";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

type State =
  | "loading"
  | "unsupported" // no Notification/Push API in this browser context
  | "no-sw" // service worker not active (dev mode)
  | "denied" // permission permanently denied
  | "off"
  | "on"
  | "busy";

export default function NotificationsToggle() {
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function detect() {
      if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        setState("no-sw");
        return;
      }
      const subscription = await registration.pushManager.getSubscription();
      setState(subscription ? "on" : "off");
    }
    detect().catch(() => setState("unsupported"));
  }, []);

  const enable = useCallback(async () => {
    setState("busy");
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
        ),
      });
      const json = subscription.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      if (!res.ok) throw new Error("Couldn't save the subscription");
      setState("on");
    } catch (err) {
      console.error(err);
      setError("Couldn't enable notifications — try again.");
      setState("off");
    }
  }, []);

  const disable = useCallback(async () => {
    setState("busy");
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setState("off");
    } catch {
      setState("on");
    }
  }, []);

  if (state === "loading") return null;

  if (state === "unsupported") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4">
        <span className="text-2xl" aria-hidden>🔔</span>
        <p className="text-xs text-foreground/60">
          Notifications aren&apos;t available in this browser. On iPhone,
          install the app first (Share → Add to Home Screen), then enable them here.
        </p>
      </div>
    );
  }

  if (state === "no-sw") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4">
        <span className="text-2xl" aria-hidden>🔔</span>
        <p className="text-xs text-foreground/60">
          Notifications are available in the production app.
        </p>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4">
        <span className="text-2xl" aria-hidden>🔕</span>
        <p className="text-xs text-foreground/60">
          Notifications are blocked for traincore in your browser settings —
          re-enable them there, then come back.
        </p>
      </div>
    );
  }

  const on = state === "on";
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4">
      <span className="text-2xl" aria-hidden>🔔</span>
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
