// Client-only lazy singleton for the MediaPipe Pose Landmarker.
// The library is imported dynamically so it never executes during SSR,
// and both the WASM runtime and the model are self-hosted under /public.
import type { NormalizedLandmark, PoseLandmarker } from "@mediapipe/tasks-vision";

let landmarkerPromise: Promise<PoseLandmarker> | null = null;

export function getPoseLandmarker(): Promise<PoseLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = create().catch((error) => {
      landmarkerPromise = null; // allow retry on failure
      throw error;
    });
  }
  return landmarkerPromise;
}

async function create(): Promise<PoseLandmarker> {
  const { FilesetResolver, PoseLandmarker } = await import(
    "@mediapipe/tasks-vision"
  );
  const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");

  const options = (delegate: "GPU" | "CPU") => ({
    baseOptions: {
      modelAssetPath: "/models/pose_landmarker_lite.task",
      delegate,
    },
    runningMode: "VIDEO" as const,
    numPoses: 1,
  });

  try {
    return await PoseLandmarker.createFromOptions(fileset, options("GPU"));
  } catch {
    return await PoseLandmarker.createFromOptions(fileset, options("CPU"));
  }
}

export async function drawSkeleton(
  canvas: HTMLCanvasElement,
  landmarks: NormalizedLandmark[],
) {
  const { DrawingUtils, PoseLandmarker } = await import(
    "@mediapipe/tasks-vision"
  );
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const utils = new DrawingUtils(ctx);
  utils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, {
    color: "rgba(34, 197, 94, 0.8)",
    lineWidth: 3,
  });
  utils.drawLandmarks(landmarks, {
    color: "#ffffff",
    fillColor: "#22c55e",
    lineWidth: 1,
    radius: 3,
  });
}
