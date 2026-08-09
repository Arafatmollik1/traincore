"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function EnterButton({ competitionId }: { competitionId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enter() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/competitions/${competitionId}/enter`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Couldn't enter");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't enter");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => void enter()}
        disabled={busy}
        className="rounded-xl bg-accent px-4 py-4 text-lg font-bold text-accent-foreground transition active:scale-95 disabled:opacity-50"
      >
        {busy ? "Entering…" : "Enter competition"}
      </button>
      {error && <p className="text-center text-sm text-red-500">{error}</p>}
    </div>
  );
}
