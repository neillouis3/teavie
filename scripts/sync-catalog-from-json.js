/* eslint-disable no-console */
/**
 * Upsert movies + TV from enriched TMDB JSON (default: ../test relative to repo).
 * TV: skips anime-like rows (canonical anime uses `anime_*` ids only; see scripts/lib/tvJpAnimePrune.cjs).
 *
 * Usage (from teavie/):
 *   node scripts/sync-catalog-from-json.js
 *   node scripts/sync-catalog-from-json.js --dry-run
 *   node scripts/sync-catalog-from-json.js --movies-file /path/to/tmdb-movies.json
 *
 * Requires MONGODB_URI in teavie/.env.local
 */
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");
const { shouldPruneTvAnimeWithoutAnilist } = require("./lib/tvJpAnimePrune.cjs");

const DB_NAME = "teavie";
const COLLECTION = "content";
const DEFAULT_BATCH = 250;

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const k = m[1].trim();
    const v = m[2].trim().replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

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

function mapMovieRow(row) {
  const id = row.id;
  if (typeof id !== "number" || !Number.isFinite(id)) return null;
  return {
    ...row,
    type: "movie",
    name: row.title ?? row.name ?? `Movie ${id}`,
    updatedAt: new Date(),
  };
}

function mapTvRow(row) {
  const id = row.id;
  const doc = {
    ...row,
    type: "tv",
    name: row.name ?? row.title ?? `TV ${id}`,
    updatedAt: new Date(),
  };
  if (shouldPruneTvAnimeWithoutAnilist(doc)) return null;
  return doc;
}

async function run() {
  loadEnvLocal();
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI missing. Set it in teavie/.env.local");
    process.exit(1);
  }

  const repoRoot = path.join(__dirname, "..", "..");
  const defaultMovies = path.join(repoRoot, "test", "tmdb-movies.json");
  const defaultTv = path.join(repoRoot, "test", "tmdb-tvshows.json");

  const moviesFile = argValue("--movies-file", defaultMovies);
  const tvFile = argValue("--tv-file", defaultTv);
  const batchSize = Math.max(
    50,
    parseInt(argValue("--batch", String(DEFAULT_BATCH)), 10) || DEFAULT_BATCH
  );
  const dryRun = hasFlag("--dry-run");

  const ops = [];

  if (fs.existsSync(moviesFile)) {
    const data = loadJson(moviesFile);
    const movies = data.movies ?? [];
    let skipped = 0;
    for (const row of movies) {
      const doc = mapMovieRow(row);
      if (!doc) {
        skipped++;
        continue;
      }
      ops.push({
        updateOne: {
          filter: { type: "movie", id: doc.id },
          update: { $set: doc },
          upsert: true,
        },
      });
    }
    console.log(`movies: ${movies.length} rows from ${moviesFile} (${skipped} skipped id)`);
  } else {
    console.warn(`skip movies (file missing): ${moviesFile}`);
  }

  if (fs.existsSync(tvFile)) {
    const data = loadJson(tvFile);
    const shows = data.shows ?? [];
    let skippedId = 0;
    let skippedJpAnime = 0;
    for (const row of shows) {
      const id = row.id;
      if (typeof id !== "number" || !Number.isFinite(id)) {
        skippedId++;
        continue;
      }
      const doc = mapTvRow(row);
      if (!doc) {
        skippedJpAnime++;
        continue;
      }
      ops.push({
        updateOne: {
          filter: { type: "tv", id: doc.id },
          update: { $set: doc },
          upsert: true,
        },
      });
    }
    console.log(
      `tv: ${shows.length} rows from ${tvFile} (${skippedId} bad id, ${skippedJpAnime} anime-like w/o AniList skipped)`
    );
  } else {
    console.warn(`skip tv (file missing): ${tvFile}`);
  }

  if (ops.length === 0) {
    console.log("Nothing to write.");
    return;
  }

  console.log(`total operations: ${ops.length}, dry_run=${dryRun}`);

  if (dryRun) {
    console.log("Dry run — no DB writes.");
    return;
  }

  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db(DB_NAME).collection(COLLECTION);

  try {
    let upserted = 0;
    let modified = 0;
    let matched = 0;
    for (let i = 0; i < ops.length; i += batchSize) {
      const chunk = ops.slice(i, i + batchSize);
      const r = await col.bulkWrite(chunk, { ordered: false });
      upserted += r.upsertedCount;
      modified += r.modifiedCount;
      matched += r.matchedCount;
      console.log(
        `bulk ${Math.min(i + chunk.length, ops.length)}/${ops.length}: upserted=${r.upsertedCount}, modified=${r.modifiedCount}, matched=${r.matchedCount}`
      );
    }
    console.log(`done: upserted=${upserted}, modified=${modified}, matched=${matched}`);
  } finally {
    await client.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
