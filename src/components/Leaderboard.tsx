"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type LeaderboardEntry = {
  rank: number;
  userId: string;
  displayName: string;
  image: string | null;
  bestReps: number;
};

const MEDALS = ["🥇", "🥈", "🥉"];

export default function Leaderboard({
  competitionId,
  myUserId,
  live,
}: {
  competitionId: string;
  myUserId: string;
  live: boolean;
}) {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/competitions/${competitionId}/leaderboard`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEntries(data.entries);
      setError(false);
    } catch {
      setError(true);
    }
  }, [competitionId]);

  useEffect(() => {
    void load();
    if (!live) return;
    const interval = setInterval(() => void load(), 10_000);
    return () => clearInterval(interval);
  }, [load, live]);

  if (entries === null) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
      </div>
    );
  }

  if (error && entries === null) {
    return <p className="py-4 text-center text-sm text-foreground/50">Couldn&apos;t load the leaderboard.</p>;
  }

  if (entries.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-foreground/20 p-6 text-center text-sm text-foreground/50">
        No one has entered yet — be the first!
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-1.5">
      {entries.map((entry) => {
        const isMe = entry.userId === myUserId;
        return (
          <li
            key={entry.userId}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
              isMe ? "border-accent/50 bg-accent/10" : "border-foreground/10"
            }`}
          >
            <span className="w-8 shrink-0 text-center text-sm font-bold">
              {MEDALS[entry.rank - 1] ?? `#${entry.rank}`}
            </span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-foreground/10 bg-foreground/5 text-xs font-semibold">
              {entry.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={entry.image} alt="" className="h-full w-full object-cover" />
              ) : (
                entry.displayName[0]?.toUpperCase()
              )}
            </div>
            <Link href={`/u/${entry.userId}`} className="min-w-0 flex-1 truncate text-sm font-medium">
              {entry.displayName}
              {isMe && <span className="text-foreground/50"> (you)</span>}
            </Link>
            <span className="shrink-0 text-sm font-bold tabular-nums">
              {entry.bestReps > 0 ? `${entry.bestReps} reps` : "—"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
