"use client";

import { useState } from "react";

export default function ShareButton({
  path,
  title,
}: {
  path: string;
  title: string;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}${path}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // fall through to clipboard (user may have dismissed the sheet)
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt("Copy this link:", url);
    }
  }

  return (
    <button
      onClick={() => void share()}
      className="rounded-full border border-foreground/15 px-4 py-1.5 text-sm font-medium text-foreground/70 transition hover:bg-foreground/5 active:scale-95"
    >
      {copied ? "Copied ✓" : "Share ↗"}
    </button>
  );
}
