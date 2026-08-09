"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Joint } from "@prisma/client";
import { JOINTS, JOINT_TYPES } from "@/lib/exercises";
import { ConfigurableAngleCounter } from "@/ml/exercises/configurable";
import { drawSkeleton, getPoseLandmarker } from "@/ml/pose";

const EMOJI_CHOICES = ["🎯", "💪", "🦵", "🔥", "⭐", "🏋️", "🤸", "🚀", "🧘", "⚡"];

export default function ExerciseBuilder() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🎯");
  const [joint, setJoint] = useState<Joint>("ELBOW");
  const [downAngle, setDownAngle] = useState(90);
  const [upAngle, setUpAngle] = useState(150);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live preview state
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const counterRef = useRef<ConfigurableAngleCounter | null>(null);
  const [previewOn, setPreviewOn] = useState(false);
  const [previewReps, setPreviewReps] = useState(0);
  const [liveAngle, setLiveAngle] = useState<number | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Rebuild the counter whenever config changes so tests use fresh settings.
  useEffect(() => {
    counterRef.current = new ConfigurableAngleCounter({
      joint,
      downAngle,
      upAngle,
      minCycleMs: 400,
    });
    setPreviewReps(0);
  }, [joint, downAngle, upAngle]);

  const stopPreview = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setPreviewOn(false);
    setLiveAngle(null);
  }, []);

  useEffect(() => stopPreview, [stopPreview]);

  async function startPreview() {
    setPreviewError(null);
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
      setPreviewOn(true);
      loop();
    } catch (err) {
      console.error(err);
      setPreviewError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Camera access was denied — allow it to test your exercise."
          : "Couldn't start the camera preview.",
      );
      stopPreview();
    }
  }

  function loop() {
    const tick = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const counter = counterRef.current;
      if (!video || !counter) return;
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
          const update = counter.update(landmarks, tMs);
          setPreviewReps(update.reps);
          setLiveAngle(counter.lastAngle === null ? null : Math.round(counter.lastAngle));
        }
      }
      rafRef.current = requestAnimationFrame(() => void tick());
    };
    rafRef.current = requestAnimationFrame(() => void tick());
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, emoji, joint, downAngle, upAngle }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Couldn't save the exercise");
      stopPreview();
      router.replace(`/challenges/new?exercise=${data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the exercise");
      setSubmitting(false);
    }
  }

  const inputClass =
    "rounded-xl border border-foreground/15 bg-background px-4 py-3 text-base outline-none transition focus:border-accent";
  const gapOk = upAngle >= downAngle + 20;

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <div className="grid grid-cols-[1fr_auto] gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={3}
            maxLength={40}
            placeholder="Lunges"
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

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Which joint does the work?</legend>
        <div className="grid grid-cols-2 gap-2">
          {JOINT_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setJoint(type)}
              aria-pressed={joint === type}
              className={`rounded-xl border p-3 text-left transition ${
                joint === type
                  ? "border-accent bg-accent/10"
                  : "border-foreground/15 hover:border-foreground/30"
              }`}
            >
              <span className="block text-sm font-semibold">{JOINTS[type].label}</span>
              <span className="block text-xs text-foreground/50">{JOINTS[type].hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-4 rounded-2xl border border-foreground/10 p-4">
        <label className="flex flex-col gap-1">
          <span className="flex justify-between text-sm">
            <span className="font-medium">Down angle (bottom of the rep)</span>
            <span className="tabular-nums text-foreground/60">{downAngle}°</span>
          </span>
          <input
            type="range"
            min={20}
            max={160}
            value={downAngle}
            onChange={(e) => setDownAngle(Number(e.target.value))}
            className="accent-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="flex justify-between text-sm">
            <span className="font-medium">Up angle (back to the top)</span>
            <span className="tabular-nums text-foreground/60">{upAngle}°</span>
          </span>
          <input
            type="range"
            min={40}
            max={180}
            value={upAngle}
            onChange={(e) => setUpAngle(Number(e.target.value))}
            className="accent-accent"
          />
        </label>
        {!gapOk && (
          <p className="text-xs text-red-500">
            Up angle must be at least 20° above the down angle.
          </p>
        )}
        <p className="text-xs text-foreground/50">
          One rep = the {JOINTS[joint].label.toLowerCase()} angle dropping below{" "}
          {downAngle}° and coming back above {upAngle}°.
        </p>
      </div>

      {/* Live calibration preview */}
      <div className="flex flex-col gap-3 rounded-2xl border border-foreground/10 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Test it live</span>
          {previewOn ? (
            <button
              type="button"
              onClick={stopPreview}
              className="rounded-full border border-foreground/20 px-3 py-1 text-xs font-medium"
            >
              Stop camera
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void startPreview()}
              className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground"
            >
              Start camera
            </button>
          )}
        </div>
        <div className={`relative overflow-hidden rounded-xl bg-black ${previewOn ? "aspect-[4/3]" : "hidden"}`}>
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
          <div className="absolute bottom-2 left-2 rounded-lg bg-black/60 px-3 py-1.5 text-white backdrop-blur">
            <span className="text-2xl font-bold tabular-nums">{previewReps}</span>
            <span className="ml-2 text-xs text-white/70">
              {liveAngle !== null ? `${liveAngle}°` : "—"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              counterRef.current?.reset();
              setPreviewReps(0);
            }}
            className="absolute bottom-2 right-2 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur"
          >
            Reset count
          </button>
        </div>
        {!previewOn && (
          <p className="text-xs text-foreground/50">
            Do a few reps in front of the camera and watch the counter — adjust
            the sliders until every clean rep counts exactly once.
          </p>
        )}
        {previewError && <p className="text-xs text-red-500">{previewError}</p>}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !gapOk || name.trim().length < 3}
        className="rounded-xl bg-accent px-4 py-3 font-semibold text-accent-foreground transition active:scale-95 disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Save exercise"}
      </button>
    </form>
  );
}
