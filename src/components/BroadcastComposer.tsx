"use client";

import { useState } from "react";

export default function BroadcastComposer({
  subscriberCount,
}: {
  subscriberCount: number;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/push/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, url: url.trim() || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Broadcast failed");
      setResult(
        `Delivered to ${data.sent} of ${data.total} device${data.total === 1 ? "" : "s"}` +
          (data.pruned > 0 ? ` (${data.pruned} dead subscription${data.pruned === 1 ? "" : "s"} cleaned up)` : ""),
      );
      setTitle("");
      setBody("");
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Broadcast failed");
    } finally {
      setSending(false);
      setConfirming(false);
    }
  }

  const inputClass =
    "rounded-xl border border-foreground/15 bg-background px-4 py-3 text-base outline-none transition focus:border-accent";
  const ready = title.trim().length > 0 && body.trim().length > 0;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-amber-500/25 bg-amber-500/[0.04] p-4">
      <div>
        <h2 className="text-sm font-bold">📣 Broadcast (admin)</h2>
        <p className="text-xs text-foreground/60">
          Sends a push notification to every subscribed device.
        </p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-foreground/60">Title</span>
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setConfirming(false);
          }}
          maxLength={60}
          placeholder="Last day of the pushup showdown!"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-foreground/60">Message</span>
        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setConfirming(false);
          }}
          maxLength={200}
          rows={3}
          placeholder="Leaderboard closes at midnight — current leader has 47 reps. Can you beat that? 💪"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-foreground/60">
          Link to (optional — where a tap takes them)
        </span>
        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setConfirming(false);
          }}
          maxLength={300}
          placeholder="/competitions/abc123"
          className={inputClass}
        />
      </label>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {result && <p className="text-sm font-medium text-accent">{result}</p>}

      <button
        onClick={() => (confirming ? void send() : setConfirming(true))}
        disabled={!ready || sending || subscriberCount === 0}
        className={`rounded-xl px-4 py-3 font-semibold transition active:scale-95 disabled:opacity-50 ${
          confirming
            ? "bg-red-500 text-white"
            : "bg-accent text-accent-foreground"
        }`}
      >
        {sending
          ? "Sending…"
          : subscriberCount === 0
            ? "No subscribers yet"
            : confirming
              ? `Tap again to send to ${subscriberCount} device${subscriberCount === 1 ? "" : "s"}`
              : `Send to ${subscriberCount} device${subscriberCount === 1 ? "" : "s"}`}
      </button>
    </section>
  );
}
