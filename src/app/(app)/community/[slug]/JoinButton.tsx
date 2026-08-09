"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function JoinButton({
  slug,
  joined,
}: {
  slug: string;
  joined: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      await fetch(`/api/communities/${slug}/join`, {
        method: joined ? "DELETE" : "POST",
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={() => void toggle()}
      disabled={busy}
      className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition active:scale-95 disabled:opacity-50 ${
        joined
          ? "border border-foreground/20 text-foreground/70"
          : "bg-accent text-accent-foreground"
      }`}
    >
      {joined ? "Joined ✓" : "Join"}
    </button>
  );
}
