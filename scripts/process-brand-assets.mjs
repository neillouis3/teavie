/**
 * Crop Teavie logos, write public brand assets, and regenerate favicons.
 * Run: node scripts/process-brand-assets.mjs
 */
import sharp from "sharp";
import { writeFile, unlink } from "fs/promises";
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

async function extractIcon(logoBuf) {
  const meta = await sharp(logoBuf).metadata();
  const cropW = Math.min(meta.height, Math.round(meta.width * 0.22));
  return sharp(logoBuf)
    .extract({ left: 0, top: 0, width: cropW, height: meta.height })
    .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function writeFavicons(iconBuf) {
  const sizes = [
    ["favicon-16x16.png", 16],
    ["favicon-32x32.png", 32],
    ["apple-touch-icon.png", 180],
    ["android-chrome-192x192.png", 192],
    ["android-chrome-512x512.png", 512],
  ];
  for (const [name, size] of sizes) {
    await sharp(iconBuf)
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(publicDir, name));
  }
  await sharp(iconBuf)
    .resize(32, 32, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(publicDir, "favicon.ico"));
}

async function main() {
  const lightSrc = path.join(publicDir, SOURCES.light);
  const darkSrc = path.join(publicDir, SOURCES.dark);
  if (!existsSync(lightSrc) || !existsSync(darkSrc)) {
    console.error("Missing source logo screenshots in public/");
    process.exit(1);
  }

  const lightBuf = await trimLogo(lightSrc);
  const darkBuf = await trimLogo(darkSrc);
  const iconBuf = await extractIcon(darkBuf);

  await writeFile(path.join(publicDir, OUTPUTS.light), lightBuf);
  await writeFile(path.join(publicDir, OUTPUTS.dark), darkBuf);
  await writeFile(path.join(publicDir, OUTPUTS.icon), iconBuf);
  await writeFavicons(iconBuf);

  const appIcon = path.join(__dirname, "..", "src", "app", "icon.png");
  await writeFile(appIcon, await sharp(iconBuf).resize(512, 512).png().toBuffer());

  for (const src of Object.values(SOURCES)) {
    const p = path.join(publicDir, src);
    if (existsSync(p)) await unlink(p);
  }

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
  console.log(`Wrote ${OUTPUTS.icon} + favicons + src/app/icon.png`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
