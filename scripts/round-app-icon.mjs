/**
 * Circular tab icon: `src/app/favicon.ico` → `src/app/icon.png`, then remove favicon.ico
 * (Next will use `icon.png`; transparent corners read as a circle in the tab.)
 *
 * Run: `node scripts/round-app-icon.mjs`
 */
import sharp from "sharp";
import { readFile, writeFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const faviconPath = path.join(root, "src/app/favicon.ico");
const outPath = path.join(root, "src/app/icon.png");
const SIZE = 64;

async function rasterFromIco() {
  const buf = await readFile(faviconPath);
  try {
    return await sharp(buf).png().toBuffer();
  } catch {
    if (process.platform !== "darwin") {
      throw new Error(
        "Could not decode favicon.ico with sharp. On macOS, sips is used as a fallback; elsewhere convert ICO to PNG manually then run again."
      );
    }
    const tmp = path.join(root, "src/app/.tmp-favicon-decoded.png");
    execFileSync("sips", ["-s", "format", "png", faviconPath, "--out", tmp], {
      stdio: "ignore",
    });
    const png = await readFile(tmp);
    await unlink(tmp).catch(() => {});
    return png;
  }
}

async function main() {
  if (!existsSync(faviconPath)) {
    console.error("Missing src/app/favicon.ico — add a square icon first.");
    process.exit(1);
  }

  const raster = await rasterFromIco();
  const r = SIZE / 2;
  const circleSvg = Buffer.from(
    `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${r}" cy="${r}" r="${r}" fill="white"/>
    </svg>`
  );

  const png = await sharp(raster)
    .resize(SIZE, SIZE, { fit: "cover" })
    .composite([{ input: circleSvg, blend: "dest-in" }])
    .png()
    .toBuffer();

  await writeFile(outPath, png);
  await unlink(faviconPath);
  console.log(
    "Wrote src/app/icon.png (circular, transparent corners). Removed src/app/favicon.ico."
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
