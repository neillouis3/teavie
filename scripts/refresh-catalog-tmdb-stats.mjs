/**
 * Refresh TMDB popularity + vote_count (does not overwrite IMDb ratings).
 *
 *   node scripts/refresh-catalog-tmdb-stats.mjs
 *   node scripts/refresh-catalog-tmdb-stats.mjs --type=tv --cap=2000
 *   node scripts/refresh-catalog-tmdb-stats.mjs --dry-run
 *
 * Pair with `node scripts/update-content-from-omdb.js` for IMDb ratings.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { runCatalogTmdbStatsRefresh } from "../src/lib/syncCatalogTmdbStats.js";

const require = createRequire(import.meta.url);
const { loadMongoEnv } = require(path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "lib/mongoEnv.cjs"
));

function argValue(flag, fallback = null) {
  const prefix = `${flag}=`;
  const eq = process.argv.find((a) => a.startsWith(prefix));
  if (eq) return eq.slice(prefix.length);
  const idx = process.argv.indexOf(flag);
  if (idx !== -1) return process.argv[idx + 1] ?? fallback;
  return fallback;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function parseIntFlag(flag, def) {
  const raw = argValue(flag, String(def));
  const m = /^(\d+)$/.exec(String(raw));
  return m ? parseInt(m[1], 10) : def;
}

async function main() {
  loadMongoEnv();
  const dryRun = hasFlag("--dry-run");
  const cap = parseIntFlag("--cap", 500);
  const typeArg = String(argValue("--type", "all") || "all").toLowerCase();
  const type =
    typeArg === "movie" || typeArg === "tv" || typeArg === "all" ? typeArg : "all";

  await runCatalogTmdbStatsRefresh({
    dryRun,
    cap,
    type,
    onLog: console.log,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
