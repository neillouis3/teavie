/**
 * Crop Teavie logos, write public brand assets, and regenerate favicons.
 * Run: node scripts/process-brand-assets.mjs
 */
import sharp from "sharp";
import { writeFile, unlink, readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

const SOURCES = {
  light: "Screenshot_2026-06-30_at_8.20.18_PM-removebg-preview.png",
  dark: "Screenshot_2026-06-30_at_8.20.49_PM-removebg-preview.png",
};

const OUTPUTS = {
  light: "teavie-logo-light.png",
  dark: "teavie-logo-dark.png",
  icon: "teavie-icon.png",
};

async function trimLogo(srcPath) {
  return sharp(srcPath).trim({ threshold: 40 }).png().toBuffer();
}

async function iconBoundsFromLogo(logoBuf) {
  const { data, info } = await sharp(logoBuf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  const columnFill = new Array(width).fill(0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * channels + 3] > 30) {
        columnFill[x] += 1;
      }
    }
  }

  const denseThreshold = height * 0.15;
  const gapThreshold = height * 0.05;
  let inBlock = false;
  let cutX = Math.min(width - 1, Math.round(width * 0.35));

  for (let x = 0; x < Math.round(width * 0.55); x++) {
    const dense = columnFill[x] > denseThreshold;
    if (dense) {
      inBlock = true;
      cutX = x;
    } else if (inBlock && columnFill[x] < gapThreshold) {
      cutX = x;
      break;
    }
  }

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x <= cutX; x++) {
      const alpha = data[(y * width + x) * channels + 3];
      if (alpha > 30) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX <= minX || maxY <= minY) {
    const side = Math.min(height, Math.round(width * 0.3));
    return { left: 0, top: 0, width: side, height };
  }

  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.08);
  return {
    left: Math.max(0, minX - pad),
    top: Math.max(0, minY - pad),
    width: Math.min(width - Math.max(0, minX - pad), maxX - minX + 1 + pad * 2),
    height: Math.min(height - Math.max(0, minY - pad), maxY - minY + 1 + pad * 2),
  };
}

async function extractIcon(logoBuf) {
  const bounds = await iconBoundsFromLogo(logoBuf);
  const cropped = await sharp(logoBuf).extract(bounds).png().toBuffer();
  const side = Math.max(bounds.width, bounds.height);
  return sharp(cropped)
    .resize(side, side, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .resize(512, 512, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

async function writeFavicons(iconBuf) {
  /** Inset so circular browser tab masks do not clip the tea bag. */
  const padRatio = 0.84;
  const sizes = [
    ["favicon-16x16.png", 16],
    ["favicon-32x32.png", 32],
    ["apple-touch-icon.png", 180],
    ["android-chrome-192x192.png", 192],
    ["android-chrome-512x512.png", 512],
  ];

  for (const [name, size] of sizes) {
    const inner = Math.max(1, Math.round(size * padRatio));
    const pad = size - inner;
    const padL = Math.floor(pad / 2);
    const padR = pad - padL;
    const padT = Math.floor(pad / 2);
    const padB = pad - padT;

    await sharp(iconBuf)
      .resize(inner, inner, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .extend({
        top: padT,
        bottom: padB,
        left: padL,
        right: padR,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(path.join(publicDir, name));
  }

  // Standard shortcut icon name used by layout metadata.
  await sharp(path.join(publicDir, "favicon-32x32.png"))
    .toFile(path.join(publicDir, "favicon.ico"));
}

async function main() {
  const lightSrc = path.join(publicDir, SOURCES.light);
  const darkSrc = path.join(publicDir, SOURCES.dark);
  const existingLight = path.join(publicDir, OUTPUTS.light);
  const existingDark = path.join(publicDir, OUTPUTS.dark);

  let lightBuf;
  let darkBuf;

  if (existsSync(lightSrc) && existsSync(darkSrc)) {
    lightBuf = await trimLogo(lightSrc);
    darkBuf = await trimLogo(darkSrc);
    await writeFile(path.join(publicDir, OUTPUTS.light), lightBuf);
    await writeFile(path.join(publicDir, OUTPUTS.dark), darkBuf);
    for (const src of Object.values(SOURCES)) {
      const p = path.join(publicDir, src);
      if (existsSync(p)) await unlink(p);
    }
  } else if (existsSync(existingLight) && existsSync(existingDark)) {
    lightBuf = await readFile(existingLight);
    darkBuf = await readFile(existingDark);
    console.log("Using existing trimmed logos");
  } else {
    console.error("Missing source screenshots and trimmed logos in public/");
    process.exit(1);
  }

  const iconBuf = await extractIcon(darkBuf);
  await writeFile(path.join(publicDir, OUTPUTS.icon), iconBuf);
  await writeFavicons(iconBuf);

  const appIcon = path.join(__dirname, "..", "src", "app", "icon.png");
  await writeFile(appIcon, await sharp(iconBuf).resize(512, 512).png().toBuffer());

  const obsolete = [
    "darkLogo.png",
    "lightLogo.png",
    "compLOGO.png",
    "verLogo.png",
    "qw.png",
    "Screenshot 2025-09-11 at 10.02.31\u202fPM.png",
    "Screenshot 2025-09-11 at 10.02.45\u202fPM.png",
    "globe.svg",
    "next.svg",
  ];
  for (const name of obsolete) {
    const p = path.join(publicDir, name);
    if (existsSync(p)) {
      await unlink(p);
      console.log("removed", name);
    }
  }

  const lm = await sharp(lightBuf).metadata();
  const dm = await sharp(darkBuf).metadata();
  console.log(`Wrote ${OUTPUTS.light} (${lm.width}x${lm.height})`);
  console.log(`Wrote ${OUTPUTS.dark} (${dm.width}x${dm.height})`);
  console.log(`Wrote ${OUTPUTS.icon}`);
  console.log(
    "Wrote favicon.ico, favicon-16x16.png, favicon-32x32.png, apple-touch-icon.png, android-chrome icons, src/app/icon.png"
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
