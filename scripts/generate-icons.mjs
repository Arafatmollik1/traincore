// Renders the traincore dumbbell icon (inline SVG) to the PNG sizes PWAs need.
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const outDir = path.join(path.dirname(new URL(import.meta.url).pathname), "../public/icons");
await mkdir(outDir, { recursive: true });

const svg = (bgRadius) => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${bgRadius}" fill="#16a34a"/>
  <g fill="#ffffff">
    <rect x="88" y="176" width="56" height="160" rx="20"/>
    <rect x="368" y="176" width="56" height="160" rx="20"/>
    <rect x="144" y="216" width="224" height="80" rx="16"/>
    <rect x="40" y="208" width="32" height="96" rx="14"/>
    <rect x="440" y="208" width="32" height="96" rx="14"/>
  </g>
</svg>`;

const rounded = Buffer.from(svg(115));
const square = Buffer.from(svg(0));

await sharp(rounded).resize(192, 192).png().toFile(path.join(outDir, "icon-192.png"));
await sharp(rounded).resize(512, 512).png().toFile(path.join(outDir, "icon-512.png"));
await sharp(square).resize(512, 512).png().toFile(path.join(outDir, "maskable-512.png"));
await sharp(square).resize(180, 180).png().toFile(path.join(outDir, "apple-touch-icon.png"));

// Browser-tab favicon — src/app/icon.png is auto-served by Next.js.
await sharp(rounded)
  .resize(48, 48)
  .png()
  .toFile(path.join(outDir, "../../src/app/icon.png"));

console.log("Icons written to public/icons/ and src/app/icon.png");
