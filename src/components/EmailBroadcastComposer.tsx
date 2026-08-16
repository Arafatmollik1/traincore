"use client";

import { useState } from "react";

export default function EmailBroadcastComposer({
  recipientCount,
}: {
  recipientCount: number;
}) {
  const [subject, setSubject] = useState("");
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
      const res = await fetch("/api/email/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, url: url.trim() || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Send failed");
      setResult(
        `Emailed ${data.sent} of ${data.total} user${data.total === 1 ? "" : "s"}` +
          (data.failed > 0 ? ` (${data.failed} failed)` : ""),
      );
      setSubject("");
      setBody("");
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
      setConfirming(false);
    }
  }

  const inputClass =
    "rounded-xl border border-foreground/15 bg-background px-4 py-3 text-base outline-none transition focus:border-accent";
  const ready = subject.trim().length > 0 && body.trim().length > 0;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-sky-500/25 bg-sky-500/[0.04] p-4">
      <div>
        <h2 className="text-sm font-bold">✉️ Email blast (admin)</h2>
        <p className="text-xs text-foreground/60">
          Sends a promotional email to every user who hasn&apos;t unsubscribed.
        </p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-foreground/60">Subject</span>
        <input
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            setConfirming(false);
          }}
          maxLength={100}
          placeholder="New challenge: the 100-squat gauntlet 🏆"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-foreground/60">
          Message (blank line starts a new paragraph)
        </span>
        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setConfirming(false);
          }}
          maxLength={3000}
          rows={6}
          placeholder="We just launched something big…"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-foreground/60">
          Button link (optional — relative path)
        </span>
        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setConfirming(false);
          }}
          maxLength={300}
          placeholder="/challenges/abc123"
          className={inputClass}
        />
      </label>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {result && <p className="text-sm font-medium text-accent">{result}</p>}

      <button
        onClick={() => (confirming ? void send() : setConfirming(true))}
        disabled={!ready || sending || recipientCount === 0}
        className={`rounded-xl px-4 py-3 font-semibold transition active:scale-95 disabled:opacity-50 ${
          confirming
            ? "bg-red-500 text-white"
            : "bg-accent text-accent-foreground"
        }`}
      >
        {sending
          ? "Sending…"
          : recipientCount === 0
            ? "No subscribed users"
            : confirming
              ? `Tap again to email ${recipientCount} user${recipientCount === 1 ? "" : "s"}`
              : `Email ${recipientCount} user${recipientCount === 1 ? "" : "s"}`}
      </button>
    </section>
  );
}
