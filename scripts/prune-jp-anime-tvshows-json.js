/* eslint-disable no-console */
/**
 * Rewrite tmdb-tvshows.json without JP+animation rows that lack AniList ids
 * (same rules as cleanup-tv-jp-anime-mongo.js / sync-catalog-from-json).
 *
 *   node scripts/prune-jp-anime-tvshows-json.js --dry-run
 *   node scripts/prune-jp-anime-tvshows-json.js --write
 *
 * Default input: ../../test/tmdb-tvshows.json (from teavie/scripts)
 */
const fs = require("fs");
const path = require("path");
const { shouldPruneTvJpAnimeWithoutAnilist } = require("./lib/tvJpAnimePrune.cjs");

function argValue(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const cleaned = raw.replace(/[\u0000-\u001f]/g, " ");
  return JSON.parse(cleaned);
}

function run() {
  const repoRoot = path.join(__dirname, "..", "..");
  const defaultFile = path.join(repoRoot, "test", "tmdb-tvshows.json");
  const tvFile = argValue("--file", defaultFile);
  const dryRun = hasFlag("--dry-run") || !hasFlag("--write");

  if (!fs.existsSync(tvFile)) {
    console.error(`File not found: ${tvFile}`);
    process.exit(1);
  }

  const data = loadJson(tvFile);
  const shows = data.shows ?? [];
  const kept = [];
  let pruned = 0;

  for (const row of shows) {
    const doc = { ...row, type: "tv" };
    if (shouldPruneTvJpAnimeWithoutAnilist(doc)) {
      pruned++;
      continue;
    }
    kept.push(row);
  }

  console.log(`shows: ${shows.length} → ${kept.length} (pruned ${pruned}), dry_run=${dryRun}`);

  if (dryRun) {
    return;
  }

  const out = { ...data, count: kept.length, shows: kept };
  const outPath = tvFile;
  const backup = `${tvFile}.bak-${Date.now()}`;
  fs.copyFileSync(tvFile, backup);
  console.log(`backup: ${backup}`);
  fs.writeFileSync(outPath, JSON.stringify(out));
  console.log(`wrote: ${outPath}`);
}

run();
