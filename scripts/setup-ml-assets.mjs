// Copies MediaPipe WASM runtime from node_modules and downloads the pose
// model into public/ so the app can self-host both (no CDN at runtime).
import { cp, mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.dirname(new URL(import.meta.url).pathname);
const project = path.join(root, "..");
const wasmSrc = path.join(project, "node_modules/@mediapipe/tasks-vision/wasm");
const wasmDest = path.join(project, "public/mediapipe/wasm");
const modelDest = path.join(project, "public/models/pose_landmarker_lite.task");
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

await mkdir(wasmDest, { recursive: true });
await cp(wasmSrc, wasmDest, { recursive: true });
console.log("Copied MediaPipe WASM runtime to public/mediapipe/wasm");

const exists = await stat(modelDest).then(
  (s) => s.size > 1_000_000,
  () => false,
);
if (exists) {
  console.log("Pose model already present, skipping download");
} else {
  await mkdir(path.dirname(modelDest), { recursive: true });
  console.log("Downloading pose landmarker model (~5.5 MB)…");
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`Model download failed: ${res.status}`);
  await writeFile(modelDest, Buffer.from(await res.arrayBuffer()));
  console.log("Saved public/models/pose_landmarker_lite.task");
}
