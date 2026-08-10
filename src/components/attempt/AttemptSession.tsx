"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createRepCounter, type CounterSpec, type RepUpdate } from "@/ml/repCounter";
import { drawSkeleton, getPoseLandmarker } from "@/ml/pose";
import type { StickFrame } from "@/lib/stick";
import AnimatedStickFigure from "@/components/AnimatedStickFigure";

type Stage =
  | "setup" // camera + model loading
  | "ready" // everything loaded, waiting for user
  | "countdown" // 3s go-countdown (start or between segments)
  | "active"
  | "rest" // between segments
  | "submitting"
  | "result"
  | "error";

export type SegmentSpec = {
  counterSpec: CounterSpec;
  label: string;
  emoji: string;
  description: string;
  keyframes?: StickFrame[];
  /** Undefined = open-ended (competitions): count as many as possible. */
  targetReps?: number;
  timeLimitSeconds: number;
  restAfterSeconds: number;
};

export type AttemptResult = {
  completed?: boolean;
  reps: number;
  targetReps?: number;
  segmentsCompleted?: number;
  segmentsTotal?: number;
  bestReps?: number;
  isNewBest?: boolean;
  rank?: number;
};

type SegmentOutcome = { reps: number; durationSeconds: number };

type Props = {
  segments: SegmentSpec[];
  badgeImage?: string;
  startEndpoint: string;
  finishEndpoint: string;
  backHref: string;
  backLabel: string;
};

export default function AttemptSession({
  segments,
  badgeImage,
  startEndpoint,
  finishEndpoint,
  backHref,
  backLabel,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const tokenRef = useRef<string | null>(null);
  const segmentIndexRef = useRef(0);
  const counterRef = useRef(createRepCounter(segments[0].counterSpec));
  const segmentStartedAtRef = useRef(0);
  const repsRef = useRef(0);
  const outcomesRef = useRef<SegmentOutcome[]>([]);
  const stageRef = useRef<Stage>("setup");
  const finishingRef = useRef(false);

  const [stage, setStageState] = useState<Stage>("setup");
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [statusNote, setStatusNote] = useState("Requesting camera…");
  const [countdown, setCountdown] = useState(3);
  const [restLeft, setRestLeft] = useState(0);
  const [live, setLive] = useState<RepUpdate>({ reps: 0, phase: "unknown", formHint: null });
  const [timeLeft, setTimeLeft] = useState(segments[0].timeLimitSeconds);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setStage = useCallback((next: Stage) => {
    stageRef.current = next;
    setStageState(next);
  }, []);

  const segment = segments[segmentIndex];
  const multi = segments.length > 1;

  // Camera + model warmup on mount.
  useEffect(() => {
    let cancelled = false;

    async function setup() {
      try {
        setStatusNote("Requesting camera…");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        setStatusNote("Loading the AI counter…");
        await getPoseLandmarker();
        if (cancelled) return;
        setStage("ready");
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setError(
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "Camera access was denied. Allow camera access and reload to attempt this."
            : "Couldn't start the camera or load the AI counter. Reload to try again.",
        );
        setStage("error");
      }
    }

    setup();
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitAll = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setStage("submitting");
    try {
      const outcomes = outcomesRef.current;
      const totals = outcomes.reduce(
        (acc, outcome) => ({
          reps: acc.reps + outcome.reps,
          durationSeconds: acc.durationSeconds + outcome.durationSeconds,
        }),
        { reps: 0, durationSeconds: 0 },
      );
      const res = await fetch(finishEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenId: tokenRef.current,
          reps: totals.reps,
          durationSeconds: totals.durationSeconds,
          segments: outcomes,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Couldn't submit your attempt");
      setResult({ reps: totals.reps, ...data });
      setStage("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't submit your attempt");
      setStage("error");
    }
  }, [finishEndpoint, setStage]);

  /** Records the current segment's outcome; returns true if it hit target. */
  const recordCurrentSegment = useCallback(() => {
    const index = segmentIndexRef.current;
    const durationSeconds = Math.round(
      (performance.now() - segmentStartedAtRef.current) / 1000,
    );
    outcomesRef.current[index] = { reps: repsRef.current, durationSeconds };
    const target = segments[index].targetReps;
    return target === undefined || repsRef.current >= target;
  }, [segments]);

  const beginSegment = useCallback(
    (index: number) => {
      segmentIndexRef.current = index;
      setSegmentIndex(index);
      counterRef.current = createRepCounter(segments[index].counterSpec);
      repsRef.current = 0;
      setLive({ reps: 0, phase: "unknown", formHint: null });
      setTimeLeft(segments[index].timeLimitSeconds);
      segmentStartedAtRef.current = performance.now();
      setStage("active");
    },
    [segments, setStage],
  );

  const goCountdown = useCallback(
    async (thenSegment: number) => {
      setStage("countdown");
      for (let i = 3; i > 0; i--) {
        setCountdown(i);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (finishingRef.current) return;
      }
      beginSegment(thenSegment);
    },
    [beginSegment, setStage],
  );

  const advanceFromSegment = useCallback(
    async (hitTarget: boolean) => {
      const index = segmentIndexRef.current;
      const isLast = index === segments.length - 1;

      // All-or-nothing: a missed target ends the whole attempt.
      if (!hitTarget || isLast) {
        void submitAll();
        return;
      }

      const rest = segments[index].restAfterSeconds;
      if (rest > 0) {
        setStage("rest");
        for (let left = rest; left > 0; left--) {
          setRestLeft(left);
          await new Promise((resolve) => setTimeout(resolve, 1000));
          if (finishingRef.current || stageRef.current !== "rest") return;
        }
      }
      void goCountdown(index + 1);
    },
    [segments, goCountdown, setStage, submitAll],
  );

  // Detection loop — runs continuously; only counts while a segment is active.
  const runDetectionLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video) return;

    const tick = async () => {
      const landmarker = await getPoseLandmarker();
      if (video.readyState >= 2 && stageRef.current === "active") {
        const tMs = performance.now();
        const detection = landmarker.detectForVideo(video, tMs);
        const landmarks = detection.landmarks?.[0];
        if (landmarks && canvas) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          void drawSkeleton(canvas, landmarks);
        }
        const update = landmarks
          ? counterRef.current.update(landmarks, tMs)
          : {
              reps: repsRef.current,
              phase: "unknown" as const,
              formHint: "Step back so the camera can see you",
            };
        repsRef.current = update.reps;
        setLive(update);

        const target = segments[segmentIndexRef.current].targetReps;
        if (target !== undefined && update.reps >= target) {
          const hit = recordCurrentSegment();
          void advanceFromSegment(hit);
          if (stageRef.current !== "active") {
            rafRef.current = requestAnimationFrame(() => void tick());
            return;
          }
        }
      }
      if (!finishingRef.current) {
        rafRef.current = requestAnimationFrame(() => void tick());
      }
    };
    rafRef.current = requestAnimationFrame(() => void tick());
  }, [segments, recordCurrentSegment, advanceFromSegment]);

  const start = useCallback(async () => {
    try {
      setStage("countdown");
      const res = await fetch(startEndpoint, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Couldn't start the attempt");
      tokenRef.current = data.tokenId;
      outcomesRef.current = [];
      finishingRef.current = false;
      runDetectionLoop();
      await goCountdown(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start the attempt");
      setStage("error");
    }
  }, [goCountdown, runDetectionLoop, setStage, startEndpoint]);

  // Per-segment timer.
  useEffect(() => {
    if (stage !== "active") return;
    const interval = setInterval(() => {
      const limit = segments[segmentIndexRef.current].timeLimitSeconds;
      const elapsed = (performance.now() - segmentStartedAtRef.current) / 1000;
      const left = Math.max(0, Math.ceil(limit - elapsed));
      setTimeLeft(left);
      if (left <= 0) {
        clearInterval(interval);
        const hit = recordCurrentSegment();
        void advanceFromSegment(hit);
      }
    }, 250);
    return () => clearInterval(interval);
  }, [stage, segments, recordCurrentSegment, advanceFromSegment]);

  function stopEarly() {
    recordCurrentSegment();
    void submitAll();
  }

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const nextSegment = segments[Math.min(segmentIndex + 1, segments.length - 1)];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
        />

        {stage === "setup" && (
          <Overlay>
            <Spinner />
            <p className="text-sm text-white/80">{statusNote}</p>
          </Overlay>
        )}

        {stage === "ready" && (
          <Overlay>
            {segment.keyframes && segment.keyframes.length >= 2 ? (
              <AnimatedStickFigure frames={segment.keyframes} className="h-28 w-28 text-white" />
            ) : (
              <p className="text-4xl">{segment.emoji}</p>
            )}
            <h2 className="text-xl font-bold">
              {multi ? `${segments.length}-exercise circuit` : segment.label}
            </h2>
            <p className="max-w-xs text-center text-sm text-white/70">
              {multi
                ? `Starts with ${segment.label.toLowerCase()}. Complete every exercise to finish.`
                : segment.description}
            </p>
            <p className="text-sm text-white/70">
              {segment.targetReps
                ? `First target: ${segment.targetReps} reps · `
                : "As many reps as you can · "}
              {Math.floor(segment.timeLimitSeconds / 60)}:
              {String(segment.timeLimitSeconds % 60).padStart(2, "0")} limit
            </p>
            <button
              onClick={() => void start()}
              className="mt-2 rounded-full bg-accent px-10 py-4 text-lg font-bold text-accent-foreground transition active:scale-95"
            >
              Start
            </button>
          </Overlay>
        )}

        {stage === "countdown" && (
          <Overlay transparent>
            {multi && (
              <p className="text-lg font-semibold text-white/90 drop-shadow">
                {segment.emoji} {segment.label}
              </p>
            )}
            <p className="text-8xl font-black tabular-nums drop-shadow-lg">{countdown}</p>
          </Overlay>
        )}

        {stage === "rest" && (
          <Overlay>
            <p className="text-sm uppercase tracking-wide text-white/60">Rest</p>
            <p className="text-7xl font-black tabular-nums">{restLeft}</p>
            <div className="mt-2 flex flex-col items-center gap-2">
              <p className="text-sm text-white/70">Next up</p>
              {nextSegment.keyframes && nextSegment.keyframes.length >= 2 ? (
                <AnimatedStickFigure
                  frames={nextSegment.keyframes}
                  className="h-20 w-20 text-white"
                />
              ) : (
                <p className="text-3xl">{nextSegment.emoji}</p>
              )}
              <p className="text-sm font-semibold">
                {nextSegment.label} · {nextSegment.targetReps} reps
              </p>
            </div>
            <button
              onClick={() => void goCountdown(segmentIndexRef.current + 1)}
              className="mt-3 rounded-full bg-white/15 px-6 py-2 text-sm font-semibold backdrop-blur transition active:scale-95"
            >
              Skip rest
            </button>
          </Overlay>
        )}

        {stage === "active" && (
          <>
            <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <div className="rounded-2xl bg-black/50 px-4 py-2 backdrop-blur">
                <p className="text-xs uppercase tracking-wide text-white/60">
                  {multi ? `${segmentIndex + 1}/${segments.length} · ${segment.label}` : "Time"}
                </p>
                <p className={`text-2xl font-bold tabular-nums ${timeLeft <= 10 ? "text-red-400" : ""}`}>
                  {minutes}:{String(seconds).padStart(2, "0")}
                </p>
              </div>
              <button
                onClick={stopEarly}
                className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur transition active:scale-95"
              >
                Stop
              </button>
            </div>

            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              {live.formHint && (
                <p className="rounded-full bg-amber-500/90 px-4 py-1.5 text-center text-sm font-medium text-black">
                  {live.formHint}
                </p>
              )}
              <p className="text-8xl font-black tabular-nums drop-shadow-lg">{live.reps}</p>
              <p className="text-sm text-white/70">
                {segment.targetReps ? `of ${segment.targetReps} reps` : "reps"}
              </p>
            </div>
          </>
        )}

        {stage === "submitting" && (
          <Overlay>
            <Spinner />
            <p className="text-sm text-white/80">Saving your attempt…</p>
          </Overlay>
        )}

        {stage === "result" && result && (
          <Overlay>
            {result.completed !== undefined ? (
              result.completed ? (
                <>
                  {badgeImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={badgeImage}
                      alt=""
                      className="h-32 w-32 animate-bounce object-contain"
                    />
                  ) : (
                    <p className="animate-bounce text-6xl">🏅</p>
                  )}
                  <h2 className="text-2xl font-bold">Badge earned!</h2>
                  <p className="text-center text-white/70">
                    {multi
                      ? `All ${result.segmentsTotal} exercises done — ${result.reps} total reps.`
                      : `${result.reps} reps — challenge complete.`}{" "}
                    It&apos;s on your profile now.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-6xl">💪</p>
                  <h2 className="text-2xl font-bold">
                    {multi
                      ? `${result.segmentsCompleted} of ${result.segmentsTotal} exercises`
                      : `${result.reps} of ${result.targetReps} reps`}
                  </h2>
                  <p className="text-white/70">Not this time — rest up and go again.</p>
                </>
              )
            ) : (
              <>
                <p className="text-6xl">{result.isNewBest ? "🎉" : "💪"}</p>
                <h2 className="text-2xl font-bold">
                  {result.reps} reps{result.isNewBest ? " — new personal best!" : ""}
                </h2>
                {result.rank !== undefined && (
                  <p className="text-white/70">You&apos;re currently ranked #{result.rank}</p>
                )}
              </>
            )}
            <Link
              href={backHref}
              className="mt-4 rounded-full bg-white px-8 py-3 font-semibold text-black transition active:scale-95"
            >
              {backLabel}
            </Link>
          </Overlay>
        )}

        {stage === "error" && (
          <Overlay>
            <p className="text-4xl">😕</p>
            <p className="max-w-xs text-center text-sm text-white/80">{error}</p>
            <Link
              href={backHref}
              className="mt-4 rounded-full bg-white px-8 py-3 font-semibold text-black transition active:scale-95"
            >
              {backLabel}
            </Link>
          </Overlay>
        )}
      </div>
    </div>
  );
}

function Overlay({
  children,
  transparent = false,
}: {
  children: React.ReactNode;
  transparent?: boolean;
}) {
  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 ${
        transparent ? "" : "bg-black/70 backdrop-blur-sm"
      }`}
    >
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
  );
}
