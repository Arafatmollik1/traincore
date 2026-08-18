"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  computeSignature,
  MAX_POSES,
  MIN_POSES,
  MIN_POSE_DISTANCE,
  signatureDistance,
  type PoseSignature,
} from "@/ml/poseMatch";
import { TemplatePoseCounter } from "@/ml/exercises/template";
import { TemplateHoldTracker } from "@/ml/exercises/holds";
import type { HoldUpdate } from "@/ml/holdTracker";
import { drawSkeleton, getPoseLandmarker } from "@/ml/pose";
import { extractStickFrame, type StickFrame } from "@/lib/stick";
import StickFigure from "@/components/StickFigure";

const EMOJI_CHOICES = ["🎯", "💪", "🦵", "🔥", "⭐", "🏋️", "🤸", "🚀", "🧘", "⚡"];
const CAPTURE_SECONDS = 8;
const REQUIRED_TEST_REPS = 3;
const REQUIRED_TEST_HOLD_SECONDS = 5;

type Kind = "REPS" | "HOLD";
type Mode = "off" | "idle" | "countdown" | "testing";
type Capture = { signature: PoseSignature; frame: StickFrame };

export default function ExerciseBuilder() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🎯");
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const liveSignatureRef = useRef<PoseSignature | null>(null);
  const liveFrameRef = useRef<StickFrame | null>(null);
  const testCounterRef = useRef<TemplatePoseCounter | null>(null);
  const testHoldRef = useRef<TemplateHoldTracker | null>(null);
  const modeRef = useRef<Mode>("off");
  const kindRef = useRef<Kind>("REPS");

  const [kind, setKindState] = useState<Kind>("REPS");
  const [mode, setModeState] = useState<Mode>("off");
  const [countdown, setCountdown] = useState(CAPTURE_SECONDS);
  const [bodyVisible, setBodyVisible] = useState(false);
  const [captureNote, setCaptureNote] = useState<string | null>(null);
  const [testReps, setTestReps] = useState(0);
  const [testStation, setTestStation] = useState({ next: 0, total: 0, armed: false });
  const [testHold, setTestHold] = useState<HoldUpdate | null>(null);
  const [holdTested, setHoldTested] = useState(false);

  const setMode = useCallback((next: Mode) => {
    modeRef.current = next;
    setModeState(next);
  }, []);

  function switchKind(next: Kind) {
    if (next === kindRef.current) return;
    kindRef.current = next;
    setKindState(next);
    // Captures and test progress belong to the old kind — start over.
    setCaptures([]);
    setTestReps(0);
    setHoldTested(false);
    setTestHold(null);
    setCaptureNote(null);
    if (modeRef.current === "testing") setMode("idle");
  }

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setMode("off");
  }, [setMode]);

  useEffect(() => stopCamera, [stopCamera]);

  const runLoop = useCallback(() => {
    const tick = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || modeRef.current === "off") return;
      const landmarker = await getPoseLandmarker();
      if (video.readyState >= 2) {
        const tMs = performance.now();
        const detection = landmarker.detectForVideo(video, tMs);
        const landmarks = detection.landmarks?.[0];
        if (landmarks) {
          if (canvas) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            void drawSkeleton(canvas, landmarks);
          }
          liveSignatureRef.current = computeSignature(landmarks);
          liveFrameRef.current = liveSignatureRef.current
            ? extractStickFrame(landmarks)
            : null;
          setBodyVisible(liveSignatureRef.current !== null);
        } else {
          liveSignatureRef.current = null;
          liveFrameRef.current = null;
          setBodyVisible(false);
        }
        if (modeRef.current === "testing") {
          if (kindRef.current === "HOLD" && testHoldRef.current) {
            // Null landmarks still tick the tracker so its grace clock runs.
            const update = testHoldRef.current.update(landmarks ?? null, tMs);
            setTestHold(update);
            if (update.state === "done") setHoldTested(true);
          } else if (landmarks && testCounterRef.current) {
            const update = testCounterRef.current.update(landmarks, tMs);
            setTestReps(update.reps);
            setTestStation(testCounterRef.current.progress);
          }
        }
      }
      rafRef.current = requestAnimationFrame(() => void tick());
    };
    rafRef.current = requestAnimationFrame(() => void tick());
  }, []);

  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
      await getPoseLandmarker();
      setMode("idle");
      runLoop();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Camera access was denied — allow it to capture poses."
          : "Couldn't start the camera.",
      );
      stopCamera();
    }
  }

  async function captureWithCountdown() {
    setCaptureNote(null);
    setMode("countdown");
    for (let i = CAPTURE_SECONDS; i > 0; i--) {
      setCountdown(i);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (modeRef.current !== "countdown") return; // camera stopped mid-count
    }
    const signature = liveSignatureRef.current;
    const frame = liveFrameRef.current;
    if (!signature || !frame) {
      setCaptureNote("Couldn't see your whole body at the snap — try again.");
      setMode("idle");
      return;
    }
    const previous = captures[captures.length - 1];
    if (previous && signatureDistance(previous.signature, signature) < MIN_POSE_DISTANCE) {
      setCaptureNote(
        "That pose looks the same as the previous one — make it more distinct and recapture.",
      );
      setMode("idle");
      return;
    }
    setCaptures((current) => [...current, { signature, frame }]);
    setCaptureNote(`Pose ${captures.length + 1} captured ✓`);
    setMode("idle");
  }

  function startTest() {
    if (kind === "HOLD") {
      testHoldRef.current = new TemplateHoldTracker(
        captures[0].signature,
        REQUIRED_TEST_HOLD_SECONDS * 1000,
      );
      setTestHold(null);
      setHoldTested(false);
    } else {
      testCounterRef.current = new TemplatePoseCounter(
        captures.map((capture) => capture.signature),
      );
      setTestReps(0);
      setTestStation({ next: 0, total: captures.length, armed: false });
    }
    setMode("testing");
  }

  function removeLastPose() {
    setCaptures((current) => current.slice(0, -1));
    setTestReps(0);
    setHoldTested(false);
    setTestHold(null);
    setCaptureNote(null);
    if (modeRef.current === "testing") setMode("idle");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          emoji,
          kind,
          poses: captures.map((capture) => capture.signature),
          keyframes: captures.map((capture) => capture.frame),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Couldn't save the exercise");
      stopCamera();
      router.replace(`/challenges/new?exercise=${data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the exercise");
      setSubmitting(false);
    }
  }

  const inputClass =
    "rounded-xl border border-foreground/15 bg-background px-4 py-3 text-base outline-none transition focus:border-accent";
  const isHold = kind === "HOLD";
  const maxPoses = isHold ? 1 : MAX_POSES;
  const minPoses = isHold ? 1 : MIN_POSES;
  const canCaptureMore = captures.length < maxPoses;
  const enoughPoses = captures.length >= minPoses;
  const tested = isHold ? holdTested : testReps >= REQUIRED_TEST_REPS;

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["REPS", "🔁 Reps", "A movement cycle — poses hit in order"],
            ["HOLD", "⏱ Hold", "One pose kept for a target time"],
          ] as const
        ).map(([value, label, hint]) => (
          <button
            key={value}
            type="button"
            onClick={() => switchKind(value)}
            aria-pressed={kind === value}
            className={`flex flex-col gap-0.5 rounded-xl border p-3 text-left transition ${
              kind === value
                ? "border-accent bg-accent/10"
                : "border-foreground/15 hover:border-foreground/30"
            }`}
          >
            <span className="text-sm font-semibold">{label}</span>
            <span className="text-xs text-foreground/60">{hint}</span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={3}
            maxLength={40}
            placeholder="Burpees"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Icon</span>
          <select
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            className={`${inputClass} text-xl`}
          >
            {EMOJI_CHOICES.map((choice) => (
              <option key={choice} value={choice}>
                {choice}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Step guide */}
      <ol className="flex flex-col gap-1 rounded-2xl border border-foreground/10 p-4 text-sm text-foreground/70">
        <li className={captures.length > 0 ? "text-foreground/40 line-through" : ""}>
          1. Start the camera and step back so your whole body is visible
        </li>
        <li className={enoughPoses ? "text-foreground/40 line-through" : ""}>
          {isHold
            ? `2. Capture the one pose to hold — the tap gives you ${CAPTURE_SECONDS}s to get into position`
            : `2. Capture ${MIN_POSES}–${MAX_POSES} key poses of your movement — each tap gives you ${CAPTURE_SECONDS}s to get into position`}
        </li>
        <li className={tested ? "text-foreground/40 line-through" : ""}>
          {isHold
            ? `3. Test it: hold the pose for ${REQUIRED_TEST_HOLD_SECONDS}s straight`
            : `3. Test it: do ${REQUIRED_TEST_REPS} reps and watch them count`}
        </li>
      </ol>

      {/* Camera stage */}
      <div className="flex flex-col gap-3 rounded-2xl border border-foreground/10 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">
            {mode === "testing" ? "Test mode" : "Pose capture"}
          </span>
          {mode === "off" ? (
            <button
              type="button"
              onClick={() => void startCamera()}
              className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground"
            >
              Start camera
            </button>
          ) : (
            <button
              type="button"
              onClick={stopCamera}
              className="rounded-full border border-foreground/20 px-3 py-1 text-xs font-medium"
            >
              Stop camera
            </button>
          )}
        </div>

        <div
          className={`relative overflow-hidden rounded-xl bg-black ${
            mode === "off" ? "hidden" : "aspect-[4/3]"
          }`}
        >
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

          {mode === "countdown" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <p className="text-8xl font-black text-white drop-shadow-lg">{countdown}</p>
            </div>
          )}

          {mode !== "countdown" && (
            <p
              className={`absolute left-2 top-2 rounded-lg px-2.5 py-1 text-xs font-medium backdrop-blur ${
                bodyVisible ? "bg-accent/80 text-accent-foreground" : "bg-amber-500/90 text-black"
              }`}
            >
              {bodyVisible ? "Body visible ✓" : "Step back — full body not visible"}
            </p>
          )}

          {mode === "testing" && !isHold && (
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-3">
              <div className="rounded-lg bg-black/60 px-3 py-1.5 text-white backdrop-blur">
                <span className="text-3xl font-bold tabular-nums">{testReps}</span>
                <span className="ml-1.5 text-xs text-white/70">/ {REQUIRED_TEST_REPS} reps</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg bg-black/60 px-3 py-2 backdrop-blur">
                {captures.map((_, index) => (
                  <span
                    key={index}
                    className={`h-2.5 w-2.5 rounded-full ${
                      testStation.armed && testStation.next === index
                        ? "bg-amber-400"
                        : "bg-white/30"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {mode === "testing" && isHold && (
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-3">
              <div className="rounded-lg bg-black/60 px-3 py-1.5 text-white backdrop-blur">
                <span
                  className={`text-3xl font-bold tabular-nums ${
                    testHold?.state === "holding" || testHold?.state === "done"
                      ? "text-accent"
                      : testHold?.state === "grace"
                        ? "text-amber-400"
                        : ""
                  }`}
                >
                  {Math.min(
                    REQUIRED_TEST_HOLD_SECONDS,
                    Math.floor((testHold?.heldMs ?? 0) / 1000),
                  )}
                </span>
                <span className="ml-1.5 text-xs text-white/70">
                  / {REQUIRED_TEST_HOLD_SECONDS}s held
                </span>
              </div>
              <div className="rounded-lg bg-black/60 px-3 py-2 text-xs font-medium text-white backdrop-blur">
                {testHold?.state === "done"
                  ? "Held it ✓"
                  : testHold?.state === "holding"
                    ? "Holding…"
                    : testHold?.state === "grace"
                      ? "Get back in!"
                      : testHold?.state === "failed"
                        ? "Lost it — restart the test"
                        : "Get into your pose"}
              </div>
            </div>
          )}
        </div>

        {/* Capture controls */}
        {mode !== "off" && (
          <div className="flex flex-wrap items-center gap-2">
            {mode !== "testing" && canCaptureMore && (
              <button
                type="button"
                disabled={mode === "countdown"}
                onClick={() => void captureWithCountdown()}
                className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition active:scale-95 disabled:opacity-50"
              >
                {mode === "countdown"
                  ? isHold
                    ? "Get into your pose…"
                    : `Get into pose ${captures.length + 1}…`
                  : isHold
                    ? `Capture your pose (${CAPTURE_SECONDS}s timer)`
                    : `Capture pose ${captures.length + 1} (${CAPTURE_SECONDS}s timer)`}
              </button>
            )}
            {enoughPoses && mode !== "testing" && mode !== "countdown" && (
              <button
                type="button"
                onClick={startTest}
                className="rounded-xl border border-accent px-4 py-2.5 text-sm font-semibold text-accent transition active:scale-95"
              >
                {isHold
                  ? `▶ Test it (hold ${REQUIRED_TEST_HOLD_SECONDS}s)`
                  : `▶ Test it (${captures.length} poses)`}
              </button>
            )}
            {mode === "testing" && isHold && testHold?.state === "failed" && (
              <button
                type="button"
                onClick={startTest}
                className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition active:scale-95"
              >
                ↻ Restart test
              </button>
            )}
            {mode === "testing" && (
              <button
                type="button"
                onClick={() => {
                  testCounterRef.current?.reset();
                  testHoldRef.current = null;
                  setTestReps(0);
                  setTestHold(null);
                  setMode("idle");
                }}
                className="rounded-xl border border-foreground/20 px-4 py-2.5 text-sm font-medium transition"
              >
                Back to capturing
              </button>
            )}
            {captures.length > 0 && mode !== "countdown" && (
              <button
                type="button"
                onClick={removeLastPose}
                className="rounded-xl border border-foreground/20 px-4 py-2.5 text-sm font-medium text-foreground/60 transition"
              >
                Remove pose {captures.length}
              </button>
            )}
          </div>
        )}

        {/* Captured pose cards */}
        {captures.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {captures.map((capture, index) => (
              <div
                key={index}
                className="flex flex-col items-center rounded-xl border border-accent/30 bg-accent/5 p-1.5"
              >
                <StickFigure frame={capture.frame} className="h-14 w-14 text-foreground" />
                <span className="text-[10px] font-semibold text-accent">
                  Pose {index + 1}
                </span>
              </div>
            ))}
            {tested && (
              <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
                {isHold ? "Hold test passed ✓" : `Tested ${testReps} reps ✓`}
              </span>
            )}
          </div>
        )}

        {captureNote && <p className="text-xs text-foreground/60">{captureNote}</p>}
        {mode === "testing" && !tested && (
          <p className="text-xs text-foreground/50">
            {isHold
              ? `Get into your pose and keep it for ${REQUIRED_TEST_HOLD_SECONDS} seconds — small wobbles are fine, the clock pauses if you break and gives you time to get back.`
              : `Do ${REQUIRED_TEST_REPS} full reps — hit each pose in order. The yellow dot shows which pose the counter is waiting for.`}
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !enoughPoses || !tested || name.trim().length < 3}
        className="rounded-xl bg-accent px-4 py-3 font-semibold text-accent-foreground transition active:scale-95 disabled:opacity-50"
      >
        {submitting
          ? "Saving…"
          : !enoughPoses
            ? isHold
              ? "Capture your pose first"
              : `Capture ${minPoses - captures.length} more pose${minPoses - captures.length === 1 ? "" : "s"} first`
            : !tested
              ? isHold
                ? `Hold your pose ${REQUIRED_TEST_HOLD_SECONDS}s to unlock saving`
                : `Test ${REQUIRED_TEST_REPS} reps to unlock saving`
              : "Save exercise"}
      </button>
    </form>
  );
}
