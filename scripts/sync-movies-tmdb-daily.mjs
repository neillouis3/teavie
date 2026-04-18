/**
 * Upsert + refresh catalog movies from TMDB (see src/lib/syncMoviesTmdbDaily.js).
 *
 *   node scripts/sync-movies-tmdb-daily.mjs
 *   node scripts/sync-movies-tmdb-daily.mjs --dry-run
 *   node scripts/sync-movies-tmdb-daily.mjs --stale-cap=400 --missing-poster-cap=500 --max-discover-pages=50
 *
 * Env: MONGODB_URI, TMDB_BEARER (or NEXT_PUBLIC_TMDB_BEARER)
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { runDailyMovieSync } from "../src/lib/syncMoviesTmdbDaily.js";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { loadMongoEnv } = require(path.join(__dirname, "lib/mongoEnv.cjs"));

function argValue(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function parseIntArg(flag, def) {
  const raw = argValue(flag, String(def));
  const m = /^(\d+)$/.exec(String(raw));
  return m ? parseInt(m[1], 10) : def;
}

/** Supports `--flag=123` and `--flag 123`. */
function parseIntFlag(flag, def) {
  const prefix = `${flag}=`;
  const eqArg = process.argv.find((a) => a.startsWith(prefix));
  if (eqArg) {
    const m = /^(\d+)$/.exec(eqArg.slice(prefix.length));
    if (m) return parseInt(m[1], 10);
  }
  return parseIntArg(flag, def);
}

async function main() {
  loadMongoEnv();
  const dryRun = hasFlag("--dry-run");
  const staleCap = parseIntFlag("--stale-cap", 250);
  const missingPosterCap = parseIntFlag("--missing-poster-cap", 0);
  const maxDiscoverPages = parseIntFlag("--max-discover-pages", 40);
  const maxListPages = parseIntFlag("--max-list-pages", 5);

  await runDailyMovieSync({
    dryRun,
    staleCap,
    missingPosterCap,
    maxDiscoverPages,
    maxListPages,
    onLog: console.log,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
