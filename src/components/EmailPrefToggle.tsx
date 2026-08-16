"use client";

import { useState } from "react";

export default function EmailPrefToggle({
  initialSubscribed,
}: {
  initialSubscribed: boolean;
}) {
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/email/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscribed: !subscribed }),
      });
      if (!res.ok) throw new Error();
      setSubscribed(!subscribed);
    } catch {
      setError("Couldn't save — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4">
      <span className="text-2xl" aria-hidden>
        ✉️
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Email updates</p>
        <p className="text-xs text-foreground/60">
          {subscribed
            ? "You'll get occasional news and announcements by email."
            : "Get occasional news and announcements by email."}
        </p>
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
      <button
        onClick={() => void toggle()}
        disabled={busy}
        aria-pressed={subscribed}
        className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition active:scale-95 disabled:opacity-50 ${
          subscribed
            ? "border border-foreground/20 text-foreground/70"
            : "bg-accent text-accent-foreground"
        }`}
      >
        {busy ? "…" : subscribed ? "On ✓" : "Enable"}
      </button>
    </div>
  );
}
