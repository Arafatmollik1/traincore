"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createRepCounter, type CounterSpec, type RepUpdate } from "@/ml/repCounter";
import { drawSkeleton, getPoseLandmarker } from "@/ml/pose";

type Stage =
  | "setup" // camera + model loading
  | "ready" // everything loaded, waiting for user
  | "countdown"
  | "active"
  | "submitting"
  | "result"
  | "error";

export type AttemptResult = {
  completed?: boolean;
  reps: number;
  targetReps?: number;
  bestReps?: number;
  isNewBest?: boolean;
  rank?: number;
};

type Props = {
  counterSpec: CounterSpec;
  label: string;
  emoji: string;
  description: string;
  timeLimitSeconds: number;
  targetReps?: number;
  startEndpoint: string;
  finishEndpoint: string;
  backHref: string;
  backLabel: string;
};

export default function AttemptSession({
  counterSpec,
  label,
  emoji,
  description,
  timeLimitSeconds,
  targetReps,
  startEndpoint,
  finishEndpoint,
  backHref,
  backLabel,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const counterRef = useRef(createRepCounter(counterSpec));
  const tokenRef = useRef<string | null>(null);
  const startedAtRef = useRef(0);
  const repsRef = useRef(0);
  const finishingRef = useRef(false);

  const [stage, setStage] = useState<Stage>("setup");
  const [statusNote, setStatusNote] = useState("Requesting camera…");
  const [countdown, setCountdown] = useState(3);
  const [live, setLive] = useState<RepUpdate>({ reps: 0, phase: "unknown", formHint: null });
  const [timeLeft, setTimeLeft] = useState(timeLimitSeconds);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  }, []);

  const finish = useCallback(
    async (finalReps: number) => {
      if (finishingRef.current) return;
      finishingRef.current = true;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setStage("submitting");
      try {
        const durationSeconds = Math.round((performance.now() - startedAtRef.current) / 1000);
        const res = await fetch(finishEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tokenId: tokenRef.current,
            reps: finalReps,
            durationSeconds,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? "Couldn't submit your attempt");
        setResult({ reps: finalReps, ...data });
        setStage("result");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't submit your attempt");
        setStage("error");
      }
    },
    [finishEndpoint],
  );

  const runDetectionLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video) return;

    const tick = async () => {
      const landmarker = await getPoseLandmarker();
      if (video.readyState >= 2) {
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
        if (targetReps && update.reps >= targetReps) {
          void finish(update.reps);
          return;
        }
      }
      rafRef.current = requestAnimationFrame(() => void tick());
    };
    rafRef.current = requestAnimationFrame(() => void tick());
  }, [finish, targetReps]);

  const start = useCallback(async () => {
    try {
      setStage("countdown");
      const res = await fetch(startEndpoint, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Couldn't start the attempt");
      tokenRef.current = data.tokenId;

      for (let i = 3; i > 0; i--) {
        setCountdown(i);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      counterRef.current.reset();
      repsRef.current = 0;
      finishingRef.current = false;
      startedAtRef.current = performance.now();
      setLive({ reps: 0, phase: "unknown", formHint: null });
      setTimeLeft(timeLimitSeconds);
      setStage("active");
      runDetectionLoop();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start the attempt");
      setStage("error");
    }
  }, [runDetectionLoop, startEndpoint, timeLimitSeconds]);

  // Countdown timer while active.
  useEffect(() => {
    if (stage !== "active") return;
    const interval = setInterval(() => {
      const elapsed = (performance.now() - startedAtRef.current) / 1000;
      const left = Math.max(0, Math.ceil(timeLimitSeconds - elapsed));
      setTimeLeft(left);
      if (left <= 0) {
        clearInterval(interval);
        void finish(repsRef.current);
      }
    }, 250);
    return () => clearInterval(interval);
  }, [stage, finish, timeLimitSeconds]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      {/* Camera stage */}
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

        {/* Overlays per stage */}
        {stage === "setup" && (
          <Overlay>
            <Spinner />
            <p className="text-sm text-white/80">{statusNote}</p>
          </Overlay>
        )}

        {stage === "ready" && (
          <Overlay>
            <p className="text-4xl">{emoji}</p>
            <h2 className="text-xl font-bold">{label}</h2>
            <p className="max-w-xs text-center text-sm text-white/70">{description}</p>
            <p className="text-sm text-white/70">
              {targetReps ? `Target: ${targetReps} reps · ` : "As many reps as you can · "}
              {Math.floor(timeLimitSeconds / 60)}:{String(timeLimitSeconds % 60).padStart(2, "0")} limit
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
            <p className="text-8xl font-black tabular-nums drop-shadow-lg">{countdown}</p>
          </Overlay>
        )}

        {stage === "active" && (
          <>
            <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <div className="rounded-2xl bg-black/50 px-4 py-2 backdrop-blur">
                <p className="text-xs uppercase tracking-wide text-white/60">Time</p>
                <p className={`text-2xl font-bold tabular-nums ${timeLeft <= 10 ? "text-red-400" : ""}`}>
                  {minutes}:{String(seconds).padStart(2, "0")}
                </p>
              </div>
              <button
                onClick={() => void finish(repsRef.current)}
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
                {targetReps ? `of ${targetReps} reps` : "reps"}
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
                  <p className="animate-bounce text-6xl">🏅</p>
                  <h2 className="text-2xl font-bold">Badge earned!</h2>
                  <p className="text-white/70">
                    {result.reps} reps — challenge complete. It&apos;s on your profile now.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-6xl">💪</p>
                  <h2 className="text-2xl font-bold">
                    {result.reps} of {result.targetReps} reps
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
