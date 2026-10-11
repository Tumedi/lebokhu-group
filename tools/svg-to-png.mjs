// ============================================================
// LeKhuBo Connect — SVG → PNG converter
// ------------------------------------------------------------
// Generates PNGs from the brand SVGs (logos + the social profile
// picture) at useful sizes. Run locally — a build sandbox usually
// has no image libraries / network to do this.
//
// USAGE (from the repo root):
//   npm install sharp          # one-time (installs the renderer)
//   node tools/svg-to-png.mjs  # writes PNGs into assets/png/
//
// Output you'll care about for a social profile picture:
//   assets/png/profile-1024.png   (1024x1024, square — upload this)
// ============================================================

import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "assets", "png");
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error(
    "\nMissing dependency 'sharp'. Install it first:\n  npm install sharp\n"
  );
  process.exit(1);
}

// [source svg, output name, width px]  (height auto-scales to aspect ratio)
const jobs = [
  ["assets/profile-1024.svg", "profile-1024.png", 1024], // ← social profile pic
  ["assets/profile-1024.svg", "profile-512.png", 512],
  ["assets/icon-512.svg", "icon-512.png", 512],
  ["assets/icon-192.svg", "icon-192.png", 192],
  ["assets/logo.svg", "logo-600.png", 600], // horizontal wordmark (transparent)
  ["assets/logo-white.svg", "logo-white-600.png", 600],
];

for (const [src, outName, width] of jobs) {
  const svg = readFileSync(join(root, src));
  await sharp(svg, { density: 384 })
    .resize({ width })
    .png()
    .toFile(join(outDir, outName));
  console.log("✓", outName, `(${width}px)  from ${src}`);
}

console.log("\nDone. PNGs are in assets/png/");
console.log("For your social profile picture, upload: assets/png/profile-1024.png");
