/**
 * Backfill K-Drama rows with IMDb ids (TMDB external_ids) and OMDb genre labels.
 *
 *   node scripts/backfill-kdrama-imdb-genres.mjs
 *   node scripts/backfill-kdrama-imdb-genres.mjs --concurrency=10 --delay=15
 *   node scripts/backfill-kdrama-imdb-genres.mjs --dry-run --limit=50
 *   node scripts/backfill-kdrama-imdb-genres.mjs --skip-omdb   # only resolve imdb_id
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { MongoClient } from "mongodb";
import { tmdbBearerToken } from "../src/lib/tmdbAuth.js";
import { fetchOmdbGenreRaw } from "../src/lib/omdbGenre.js";
import { applyImdbGenresToCatalogDoc } from "../src/lib/imdbGenres.js";

const require = createRequire(import.meta.url);
const { loadMongoEnv, mongoHostHint } = require(path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "lib/mongoEnv.cjs"
));

const DB_NAME = "teavie";
const COLLECTION = "content";
const TMDB_BASE = "https://api.themoviedb.org/3";
const DEFAULT_CONCURRENCY = 16;
const DEFAULT_OMDB_DELAY_MS = 0;
const DEFAULT_TMDB_DELAY_MS = 0;
const BULK_SIZE = 100;
const PROGRESS_EVERY = 100;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

function kdramaFilter() {
  return {
    $or: [{ catalog_categories: "kdrama" }, { is_kdrama: true }],
  };
}

function needsWorkFilter({ skipOmdb = false, all = false, imdbOnly = false } = {}) {
  if (all) return kdramaFilter();
  const missingOmdb = {
    $or: [
      { "omdb.genre": { $exists: false } },
      { "omdb.genre": null },
      { "omdb.genre": "N/A" },
    ],
  };
  if (imdbOnly) {
    return {
      $and: [
        kdramaFilter(),
        { imdb_id: { $type: "string", $regex: /^tt/i } },
        missingOmdb,
      ],
    };
  }
  if (skipOmdb) {
    return {
      $and: [
        kdramaFilter(),
        {
          $or: [
            { imdb_id: { $exists: false } },
            { imdb_id: null },
            { imdb_id: { $not: { $regex: /^tt/i } } },
          ],
        },
      ],
    };
  }
  return {
    $and: [
      kdramaFilter(),
      {
        $or: [
          missingOmdb,
          { imdb_id: { $exists: false } },
          { imdb_id: null },
          { imdb_id: { $not: { $regex: /^tt/i } } },
          { genres: { $exists: true } },
          { genre_ids: { $exists: true } },
        ],
      },
    ],
  };
}

function tmdbIdFromDoc(doc) {
  const tid = typeof doc.tmdb_id === "number" ? doc.tmdb_id : Number(doc.tmdb_id);
  if (Number.isFinite(tid) && tid > 0) return tid;
  const idNum = typeof doc.id === "number" ? doc.id : Number(doc.id);
  if (Number.isFinite(idNum) && idNum > 0) return idNum;
  return null;
}

async function tmdbExternalImdbId(tmdbId, token) {
  const res = await fetch(`${TMDB_BASE}/tv/${tmdbId}/external_ids`, {
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const imdbId = data?.imdb_id;
  return typeof imdbId === "string" && /^tt/i.test(imdbId) ? imdbId.trim() : null;
}

async function enrichKdramaDoc(doc, token, { skipOmdb = false, omdbDelayMs = 0, tmdbDelayMs = 0 } = {}) {
  /** @type {Record<string, unknown>} */
  let merged = { ...doc };
  let imdbId =
    typeof merged.imdb_id === "string" && /^tt/i.test(merged.imdb_id)
      ? merged.imdb_id.trim()
      : null;

  if (!imdbId) {
    const ext = merged.external_ids;
    if (ext && typeof ext === "object" && typeof ext.imdb_id === "string") {
      imdbId = /^tt/i.test(ext.imdb_id) ? ext.imdb_id.trim() : null;
    }
  }

  if (!imdbId) {
    const tmdbId = tmdbIdFromDoc(doc);
    if (tmdbId != null && token) {
      imdbId = await tmdbExternalImdbId(tmdbId, token);
      if (tmdbDelayMs > 0) await sleep(tmdbDelayMs);
      if (imdbId) {
        merged.imdb_id = imdbId;
        merged.external_ids = {
          ...(typeof merged.external_ids === "object" ? merged.external_ids : {}),
          imdb_id: imdbId,
          tmdb_id: tmdbId,
        };
      }
    }
  }

  const omdb =
    merged.omdb && typeof merged.omdb === "object"
      ? { ...merged.omdb }
      : {};

  const hasOmdbGenre =
    typeof omdb.genre === "string" && omdb.genre.trim() && omdb.genre !== "N/A";

  if (!skipOmdb && imdbId && !hasOmdbGenre) {
    const genreRaw = await fetchOmdbGenreRaw(imdbId, "tv");
    if (omdbDelayMs > 0) await sleep(omdbDelayMs);
    if (genreRaw) {
      omdb.genre = genreRaw;
      merged = { ...merged, imdb_id: imdbId, omdb };
    }
  }

  const normalized = applyImdbGenresToCatalogDoc(merged);
  return { merged, normalized };
}

async function main() {
  loadMongoEnv();
  const dryRun = hasFlag("--dry-run");
  const skipOmdb = hasFlag("--skip-omdb");
  const allRows = hasFlag("--all");
  const imdbOnly = hasFlag("--imdb-only");
  const verbose = hasFlag("--verbose");
  const limit = parseIntFlag("--limit", 0);
  const concurrency = Math.min(16, Math.max(1, parseIntFlag("--concurrency", DEFAULT_CONCURRENCY)));
  const omdbDelayMs = Math.max(0, parseIntFlag("--delay", DEFAULT_OMDB_DELAY_MS));
  const tmdbDelayMs = Math.max(0, parseIntFlag("--tmdb-delay", DEFAULT_TMDB_DELAY_MS));

  const uri = String(process.env.MONGODB_URI ?? "").trim();
  const token = tmdbBearerToken().trim();
  if (!uri) {
    console.error("Missing MONGODB_URI");
    process.exit(1);
  }
  if (!token) {
    console.error("Missing TMDB_BEARER");
    process.exit(1);
  }

  console.log(
    `backfill kdrama imdb genres | mongo=${mongoHostHint(uri)} dryRun=${dryRun} skipOmdb=${skipOmdb} limit=${limit || "all"} concurrency=${concurrency} delay=${omdbDelayMs}ms`
  );

  const startedAt = Date.now();
  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db(DB_NAME).collection(COLLECTION);

  const base = kdramaFilter();
  const workFilter = needsWorkFilter({ skipOmdb, all: allRows, imdbOnly });
  const [total, missingOmdb, queueCount] = await Promise.all([
    col.countDocuments(base),
    col.countDocuments({
      $and: [
        base,
        {
          $or: [
            { "omdb.genre": { $exists: false } },
            { "omdb.genre": null },
            { "omdb.genre": "N/A" },
          ],
        },
      ],
    }),
    col.countDocuments(workFilter),
  ]);
  const scanTotal = limit > 0 ? Math.min(limit, queueCount) : queueCount;
  console.log(`kdrama rows=${total} missing_omdb_genre=${missingOmdb} queue=${scanTotal}`);

  let query = col.find(workFilter, {
    projection: {
      id: 1,
      tmdb_id: 1,
      imdb_id: 1,
      external_ids: 1,
      title: 1,
      name: 1,
      imdb_genres: 1,
      omdb: 1,
      genres: 1,
      genre_ids: 1,
      is_kdrama: 1,
      catalog_categories: 1,
    },
  });
  if (limit > 0) query = query.limit(limit);
  const docs = await query.toArray();

  let scanned = 0;
  let updated = 0;
  let imdbResolved = 0;
  let omdbFilled = 0;
  let unchanged = 0;
  let idx = 0;
  let rateLimited = false;
  /** @type {import('mongodb').AnyBulkWriteOperation[]} */
  const ops = [];
  let flushChain = Promise.resolve();

  function triggerFlush() {
    if (ops.length < BULK_SIZE) return;
    flushChain = flushChain.then(async () => {
      while (!dryRun && ops.length >= BULK_SIZE) {
        const batch = ops.splice(0, BULK_SIZE);
        await col.bulkWrite(batch, { ordered: false });
      }
    });
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
      `progress ${scanned}/${scanTotal} updated=${updated} imdb_new=${imdbResolved} omdb_new=${omdbFilled} rate=${rate}/s${eta} elapsed=${elapsedSec}s`
    );
  }

  async function worker() {
    while (idx < docs.length && !rateLimited) {
      const i = idx;
      idx += 1;
      const doc = docs[i];
      const hadImdb = typeof doc.imdb_id === "string" && /^tt/i.test(doc.imdb_id);
      const hadOmdb =
        typeof doc.omdb?.genre === "string" &&
        doc.omdb.genre.trim() &&
        doc.omdb.genre !== "N/A";

      try {
        const { merged, normalized } = await enrichKdramaDoc(doc, token, {
          skipOmdb,
          omdbDelayMs,
          tmdbDelayMs,
        });
        const nextGenres = normalized.imdb_genres ?? [];
        const prevGenres = Array.isArray(doc.imdb_genres) ? doc.imdb_genres : [];

        const gotImdb =
          !hadImdb &&
          typeof merged.imdb_id === "string" &&
          /^tt/i.test(merged.imdb_id);
        const gotOmdb =
          !hadOmdb &&
          typeof merged.omdb?.genre === "string" &&
          merged.omdb.genre.trim() &&
          merged.omdb.genre !== "N/A";

        const changed =
          gotImdb ||
          gotOmdb ||
          JSON.stringify(prevGenres) !== JSON.stringify(nextGenres) ||
          doc.genres != null ||
          doc.genre_ids != null;

        scanned += 1;

        if (!changed) {
          unchanged += 1;
        } else {
          if (gotImdb) imdbResolved += 1;
          if (gotOmdb) omdbFilled += 1;
          updated += 1;

          if (verbose) {
            const label = doc.title ?? doc.name ?? doc.id;
            console.log(
              `${dryRun ? "[dry-run] " : ""}${doc.id} ${label}: ${nextGenres.join(", ")}`
            );
          }

          if (!dryRun) {
            /** @type {Record<string, unknown>} */
            const set = {
              imdb_genres: nextGenres,
              is_kdrama: normalized.is_kdrama ?? true,
              catalog_categories: normalized.catalog_categories ?? ["kdrama"],
            };
            if (merged.imdb_id) set.imdb_id = merged.imdb_id;
            if (merged.external_ids) set.external_ids = merged.external_ids;
            if (merged.omdb) set.omdb = merged.omdb;

            ops.push({
              updateOne: {
                filter: { _id: doc._id },
                update: {
                  $set: set,
                  $unset: { genre_ids: "", genres: "", mal_genre_names: "" },
                },
              },
            });

            triggerFlush();
          }
        }
      } catch (e) {
        scanned += 1;
        if (e instanceof Error && e.code === "OMDB_RATE_LIMIT") {
          rateLimited = true;
          console.error(`${e.message} — stopping early (scanned=${scanned}). Retry after daily reset.`);
          break;
        }
        console.warn(`doc ${doc.id}: ${e instanceof Error ? e.message : e}`);
      }

      if (scanned % PROGRESS_EVERY === 0) logProgress();
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  await flushChain;
  if (!dryRun && ops.length > 0) {
    await col.bulkWrite(ops.splice(0, ops.length), { ordered: false });
  }

  const withOmdb = await col.countDocuments({
    $and: [base, { "omdb.genre": { $exists: true, $ne: null, $ne: "N/A" } }],
  });
  const withGenres = await col.countDocuments({
    $and: [base, { imdb_genres: { $exists: true, $not: { $size: 0 } } }],
  });

  console.log(
    `done scanned=${scanned} updated=${updated} unchanged=${unchanged} imdb_resolved=${imdbResolved} omdb_filled=${omdbFilled} kdrama_with_omdb=${withOmdb} kdrama_with_genres=${withGenres} elapsed=${Math.round((Date.now() - startedAt) / 1000)}s`
  );
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
