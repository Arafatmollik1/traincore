"use client";

import { useEffect, useState } from "react";

/** Registers the service worker (production only) and shows a one-time
 *  "Add to Home Screen" hint on iOS, where no install prompt exists. */
export default function PwaSetup() {
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    const dismissed = localStorage.getItem("traincore-ios-hint-dismissed");
    if (isIos && !standalone && !dismissed) setShowIosHint(true);
  }, []);

  if (!showIosHint) return null;

  return (
    <div className="fixed inset-x-3 bottom-20 z-30 flex items-start gap-3 rounded-2xl border border-foreground/10 bg-background p-4 shadow-lg">
      <span className="text-2xl">📲</span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">Install traincore</p>
        <p className="mt-0.5 text-foreground/60">
          Tap <span className="font-medium">Share</span> →{" "}
          <span className="font-medium">Add to Home Screen</span> to use it like an app.
        </p>
      </div>
      <button
        onClick={() => {
          localStorage.setItem("traincore-ios-hint-dismissed", "1");
          setShowIosHint(false);
        }}
        className="shrink-0 text-foreground/40"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
