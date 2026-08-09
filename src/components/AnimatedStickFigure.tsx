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

/** Loops through the pose keyframes with eased interpolation — a living
 *  demo of the movement, generated from data instead of an uploaded GIF. */
export default function AnimatedStickFigure({
  frames,
  className,
}: {
  frames: StickFrame[];
  className?: string;
}) {
  // One shared bbox so the figure doesn't rescale between poses.
  const bbox = useMemo(() => framesBBox(frames), [frames]);
  const [current, setCurrent] = useState<StickFrame>(frames[0]);

  useEffect(() => {
    if (frames.length < 2) return;
    let raf = 0;
    const stepMs = HOLD_MS + MOVE_MS;
    const cycleMs = stepMs * frames.length;
    const start = performance.now();

    const tick = (now: number) => {
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
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [frames]);

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
