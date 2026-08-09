import { stickGeometry, type BBox, type StickFrame } from "@/lib/stick";

/** Static stick-figure SVG for one pose. Inherits color via currentColor. */
export default function StickFigure({
  frame,
  bbox,
  className,
}: {
  frame: StickFrame;
  bbox?: BBox;
  className?: string;
}) {
  const { segments, head } = stickGeometry(frame, bbox);
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
