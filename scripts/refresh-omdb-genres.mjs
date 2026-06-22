/**
 * Refresh `imdb_genres` from OMDb for all movie/TV rows with an IMDb id.
 * OMDb genres are the canonical source (same taxonomy for movies and TV).
 *
 *   node scripts/refresh-omdb-genres.mjs
 *   node scripts/refresh-omdb-genres.mjs --exclude-kdrama --concurrency=16
 *   node scripts/refresh-omdb-genres.mjs --dry-run --limit=100
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { MongoClient } from "mongodb";
import { applyImdbGenresToCatalogDoc } from "../src/lib/imdbGenres.js";
import { fetchOmdbGenreRaw } from "../src/lib/omdbGenre.js";

const require = createRequire(import.meta.url);
const { loadMongoEnv, mongoHostHint } = require(path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "lib/mongoEnv.cjs"
));

const DB_NAME = "teavie";
const COLLECTION = "content";
const DEFAULT_DELAY_MS = 0;
const DEFAULT_BULK_SIZE = 200;
const DEFAULT_CONCURRENCY = 16;
const PROGRESS_EVERY = 200;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function hasOmdbGenre(doc) {
  return (
    typeof doc.omdb?.genre === "string" &&
    doc.omdb.genre.trim() &&
    doc.omdb.genre !== "N/A"
  );
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function parseIntFlag(name, def) {
  const prefix = `${name}=`;
  const eq = process.argv.find((a) => a.startsWith(prefix));
  if (eq) {
    const n = parseInt(eq.slice(prefix.length), 10);
    if (Number.isFinite(n)) return n;
  }
  return def;
}

async function main() {
  loadMongoEnv();
  const dryRun = hasFlag("--dry-run");
  const force = hasFlag("--force");
  const excludeKdrama = hasFlag("--exclude-kdrama");
  const verbose = hasFlag("--verbose");
  const limit = parseIntFlag("--limit", 0);
  const delayMs = Math.max(0, parseIntFlag("--delay", DEFAULT_DELAY_MS));
  const bulkSize = parseIntFlag("--bulk-size", DEFAULT_BULK_SIZE);
  const concurrency = Math.min(32, Math.max(1, parseIntFlag("--concurrency", DEFAULT_CONCURRENCY)));
  const startedAt = Date.now();

  const uri = String(process.env.MONGODB_URI ?? "").trim();
  if (!uri) {
    console.error("Missing MONGODB_URI");
    process.exit(1);
  }

  const filter = {
    type: { $in: ["movie", "tv"] },
    imdb_id: { $type: "string", $regex: /^tt/i },
    ...(excludeKdrama
      ? { $nor: [{ catalog_categories: "kdrama" }, { is_kdrama: true }] }
      : {}),
    ...(force
      ? {}
      : {
          $or: [
            { "omdb.genre": { $exists: false } },
            { "omdb.genre": null },
            { "omdb.genre": "N/A" },
            { genres: { $exists: true } },
            { genre_ids: { $exists: true } },
          ],
        }),
  };

  console.log(
    `refresh omdb genres | mongo=${mongoHostHint(uri)} dryRun=${dryRun} force=${force} excludeKdrama=${excludeKdrama} limit=${limit || "all"} concurrency=${concurrency} delay=${delayMs}ms bulk=${bulkSize}`
  );

  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db(DB_NAME).collection(COLLECTION);

  const total = await col.countDocuments(filter);
  console.log(`queue=${total} rows${force ? " (force — re-fetch all)" : " (skip rows with omdb.genre)"}`);

  let query = col.find(filter, {
    projection: {
      type: 1,
      id: 1,
      title: 1,
      name: 1,
      imdb_id: 1,
      imdb_genres: 1,
      omdb: 1,
      genres: 1,
      genre_ids: 1,
      is_anime: 1,
      anilist: 1,
    },
  });
  if (limit > 0) query = query.limit(limit);
  const docs = await query.toArray();
  const scanTotal = docs.length;

  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  let omdbFetched = 0;
  let idx = 0;
  let rateLimited = false;
  /** @type {import('mongodb').AnyBulkWriteOperation[]} */
  const ops = [];
  let flushChain = Promise.resolve();

  function triggerFlush() {
    if (ops.length < bulkSize) return;
    flushChain = flushChain.then(async () => {
      while (!dryRun && ops.length >= bulkSize) {
        const batch = ops.splice(0, bulkSize);
        await col.bulkWrite(batch, { ordered: false });
      }
    });
  }

  async function flushOps() {
    await flushChain;
    if (!dryRun && ops.length > 0) {
      await col.bulkWrite(ops.splice(0, ops.length), { ordered: false });
    }
  }

  function logProgress() {
    const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
    const rate = elapsedSec > 0 ? (scanned / elapsedSec).toFixed(1) : "?";
    const etaSec =
      scanTotal > 0 && scanned > 0 && elapsedSec > 0
        ? Math.round(((scanTotal - scanned) / scanned) * elapsedSec)
        : null;
    const eta = etaSec != null ? ` eta~${Math.ceil(etaSec / 60)}m` : "";
    console.log(
      `progress ${scanned}/${scanTotal} updated=${updated} skipped=${skipped} omdb_fetched=${omdbFetched} rate=${rate}/s${eta} elapsed=${elapsedSec}s`
    );
  }

  async function worker() {
    while (idx < docs.length && !rateLimited) {
      const i = idx;
      idx += 1;
      const doc = docs[i];
      const imdbId = String(doc.imdb_id ?? "").trim();
      let genreRaw = hasOmdbGenre(doc) ? doc.omdb.genre.trim() : null;

      try {
        if (!genreRaw) {
          genreRaw = await fetchOmdbGenreRaw(imdbId, doc.type);
          omdbFetched += 1;
          if (delayMs > 0) await sleep(delayMs);
        }
      } catch (e) {
        scanned += 1;
        if (e instanceof Error && e.code === "OMDB_RATE_LIMIT") {
          rateLimited = true;
          console.error(`${e.message} — stopping early (scanned=${scanned}). Retry after daily reset.`);
          break;
        }
        throw e;
      }

      scanned += 1;

      if (!genreRaw) {
        skipped += 1;
        if (scanned % PROGRESS_EVERY === 0) logProgress();
        continue;
      }

      const enriched = {
        ...doc,
        omdb: { ...(doc.omdb ?? {}), genre: genreRaw },
      };
      const normalized = applyImdbGenresToCatalogDoc(enriched);
      const nextGenres = normalized.imdb_genres ?? [];
      const prevGenres = Array.isArray(doc.imdb_genres) ? doc.imdb_genres : [];
      const needsOmdbSave = !hasOmdbGenre(doc) && Boolean(genreRaw);
      const changed =
        needsOmdbSave ||
        JSON.stringify(prevGenres) !== JSON.stringify(nextGenres) ||
        doc.genres != null ||
        doc.genre_ids != null;

      if (!changed) {
        skipped += 1;
        if (scanned % PROGRESS_EVERY === 0) logProgress();
        continue;
      }

      updated += 1;
      if (verbose) {
        const label = doc.title ?? doc.name ?? doc.id;
        console.log(
          `${dryRun ? "[dry-run] " : ""}${doc.type} ${doc.id} ${label}: ${nextGenres.join(", ")}`
        );
      }

      if (!dryRun) {
        ops.push({
          updateOne: {
            filter: { _id: doc._id },
            update: {
              $set: {
                imdb_genres: nextGenres,
                omdb: enriched.omdb,
              },
              $unset: { genre_ids: "", genres: "", mal_genre_names: "" },
            },
          },
        });

        triggerFlush();
      }

      if (scanned % PROGRESS_EVERY === 0) logProgress();
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  await flushOps();
  await client.close();

  const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
  console.log(
    `done scanned=${scanned} updated=${updated} skipped=${skipped} omdb_fetched=${omdbFetched} elapsed=${elapsedSec}s`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
