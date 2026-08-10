"use client";

import { useEffect, useMemo, useState } from "react";
import {
  framesBBox,
  lerpFrame,
  stickGeometry,
  type StickFrame,
} from "@/lib/stick";

const HOLD_MS = 550;
const MOVE_MS = 500;
const WATCHDOG_MS = 1200;
const MAX_RESTARTS = 5;

/** Loops through the pose keyframes with eased interpolation — a living
 *  demo of the movement, generated from data instead of an uploaded GIF.
 *  A watchdog restarts the animation loop (up to 5 times) if it stalls;
 *  until the first frame renders, a pulsing placeholder is shown. */
export default function AnimatedStickFigure({
  frames,
  className,
}: {
  frames: StickFrame[];
  className?: string;
}) {
  // One shared bbox so the figure doesn't rescale between poses.
  const bbox = useMemo(() => framesBBox(frames), [frames]);
  const [current, setCurrent] = useState<StickFrame | null>(null);

  useEffect(() => {
    if (frames.length < 2) {
      setCurrent(frames[0] ?? null);
      return;
    }

    let raf = 0;
    let disposed = false;
    let restarts = 0;
    let start = performance.now();
    let lastTickAt = start;
    const stepMs = HOLD_MS + MOVE_MS;
    const cycleMs = stepMs * frames.length;

    const tick = (now: number) => {
      if (disposed) return;
      lastTickAt = now;
      const inCycle = (now - start) % cycleMs;
      const step = Math.floor(inCycle / stepMs);
      const inStep = inCycle - step * stepMs;
      const from = frames[step];
      const to = frames[(step + 1) % frames.length];
      if (inStep < HOLD_MS) {
        setCurrent(from);
      } else {
        const t = (inStep - HOLD_MS) / MOVE_MS;
        const eased = 0.5 - Math.cos(Math.PI * t) / 2;
        setCurrent(lerpFrame(from, to, eased));
      }
      raf = requestAnimationFrame(tick);
    };

    const begin = () => {
      start = performance.now();
      lastTickAt = start;
      raf = requestAnimationFrame(tick);
    };
    begin();

    // If the rAF loop never fires (or stalls), restart it a few times.
    const watchdog = setInterval(() => {
      if (disposed) return;
      if (performance.now() - lastTickAt > WATCHDOG_MS) {
        if (restarts < MAX_RESTARTS) {
          restarts += 1;
          cancelAnimationFrame(raf);
          begin();
        } else {
          clearInterval(watchdog);
          setCurrent((value) => value ?? frames[0]); // give up gracefully: static pose
        }
      }
    }, WATCHDOG_MS);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      clearInterval(watchdog);
    };
  }, [frames]);

  if (!current) {
    return (
      <div
        className={`${className ?? ""} animate-pulse rounded-xl bg-foreground/10`}
        aria-hidden
      />
    );
  }

  const { segments, head } = stickGeometry(current, bbox);
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      {segments.map(([x1, y1, x2, y2], index) => (
        <line
          key={index}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="currentColor"
          strokeWidth={5}
          strokeLinecap="round"
        />
      ))}
      <circle cx={head.cx} cy={head.cy} r={head.r} fill="currentColor" />
    </svg>
  );
}
