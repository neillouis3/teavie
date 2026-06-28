/**
 * Replace anime catalog posters with IMDb/OMDb `Poster` URLs.
 *
 *   node scripts/backfill-anime-posters-omdb.mjs --dry-run
 *   node scripts/backfill-anime-posters-omdb.mjs
 *   node scripts/backfill-anime-posters-omdb.mjs --cap=100
 *   node scripts/backfill-anime-posters-omdb.mjs --concurrency=200
 *   node scripts/backfill-anime-posters-omdb.mjs --concurrency=0   # unlimited (all rows in parallel)
 *
 * Env: MONGODB_URI, OMDB_API_KEY
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { MongoClient } from "mongodb";
import { omdbApiKey, omdbQueryWithKey } from "../src/lib/omdbAuth.js";
import { resolveOmdbImdbIdForDoc } from "../src/lib/omdbResolve.js";
import { pickImdbIdFromDoc } from "../src/lib/omdbEpisodes.js";
import { kometaImdbIdForMal } from "../src/lib/kometaAnimeIds.js";

const require = createRequire(import.meta.url);
const { loadMongoEnv, mongoHostHint } = require(path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "lib/mongoEnv.cjs"
));

const DB_NAME = "teavie";
const COLLECTION = "content";
const OMDB_BASE = "https://www.omdbapi.com/";
const BULK_WRITE_BATCH = 200;
const PROGRESS_EVERY = 100;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function intFlag(name, def) {
  const prefix = `${name}=`;
  const eq = process.argv.find((a) => a.startsWith(prefix));
  if (eq) {
    const n = parseInt(eq.slice(prefix.length), 10);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  const idx = process.argv.indexOf(name);
  if (idx !== -1) {
    const n = parseInt(process.argv[idx + 1] ?? "", 10);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return def;
}

function animeFilter() {
  return {
    type: "tv",
    $or: [{ is_anime: true }, { id: { $regex: /^anime_/ } }],
  };
}

function posterFromOmdb(payload) {
  const raw = typeof payload?.Poster === "string" ? payload.Poster.trim() : "";
  if (!raw || raw === "N/A") return null;
  return /^https?:\/\//i.test(raw) ? raw : null;
}

async function fetchOmdbByImdbId(imdbId, { maxRetries = 5 } = {}) {
  const id = String(imdbId ?? "").trim();
  if (!/^tt\d+$/i.test(id)) return null;

  const qs = omdbQueryWithKey({ i: id, type: "series", plot: "short", r: "json" });
  if (!qs.includes("apikey=")) return null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(`${OMDB_BASE}?${qs}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      if (attempt < maxRetries) {
        await sleep(400 * 2 ** attempt);
        continue;
      }
      return null;
    }

    const data = await res.json();
    if (data?.Response !== "True") {
      const err = String(data?.Error ?? "");
      if (/limit reached/i.test(err)) {
        if (attempt < maxRetries) {
          await sleep(600 * 2 ** attempt);
          continue;
        }
        const e = new Error(`OMDb rate limit: ${err}`);
        e.code = "OMDB_RATE_LIMIT";
        throw e;
      }
      return null;
    }
    return data;
  }

  return null;
}

async function resolveImdbId(doc) {
  const fromDoc = pickImdbIdFromDoc(doc);
  if (fromDoc) return fromDoc;

  const mal =
    typeof doc.mal_id === "number" && doc.mal_id > 0
      ? doc.mal_id
      : (() => {
          const m = /^anime_(\d+)$/i.exec(String(doc?.id ?? "").trim());
          return m ? parseInt(m[1], 10) : null;
        })();
  if (mal != null) {
    const fromKometa = await kometaImdbIdForMal(mal);
    if (fromKometa) return fromKometa;
  }

  return resolveOmdbImdbIdForDoc(doc, "tv");
}

async function resolveDoc(doc) {
  try {
    const imdbId = await resolveImdbId(doc);
    if (!imdbId) return { status: "skipped", reason: "no_imdb" };

    const omdb = await fetchOmdbByImdbId(imdbId);
    if (!omdb) return { status: "skipped", reason: "omdb_miss" };

    const poster = posterFromOmdb(omdb);
    if (!poster) return { status: "skipped", reason: "no_poster" };

    if (doc.poster_path === poster) return { status: "unchanged" };

    const $set = {
      poster_path: poster,
      updated_at: new Date().toISOString(),
      last_poster_source: "omdb",
    };

    if (!pickImdbIdFromDoc(doc)) {
      $set.imdb_id = imdbId;
      $set.external_ids = {
        ...(doc.external_ids && typeof doc.external_ids === "object" ? doc.external_ids : {}),
        imdb_id: imdbId,
      };
    }

    const omdbMeta =
      doc.omdb && typeof doc.omdb === "object" ? { ...doc.omdb } : {};
    omdbMeta.poster = poster;
    omdbMeta.source = "omdb";
    $set.omdb = omdbMeta;

    return {
      status: "pending_update",
      id: doc.id,
      title: doc.title ?? doc.name ?? "",
      filter: { _id: doc._id },
      $set,
    };
  } catch (err) {
    if (err?.code === "OMDB_RATE_LIMIT") throw err;
    return { status: "skipped", reason: "error" };
  }
}

async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  let done = 0;

  async function workerLoop() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
      done++;
      if (done % PROGRESS_EVERY === 0 || done === items.length) {
        console.log(`progress ${done}/${items.length}`);
      }
    }
  }

  const workers = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workers }, () => workerLoop()));
  return results;
}

async function flushBulkWrites(col, ops) {
  let modified = 0;
  let upserted = 0;
  for (let i = 0; i < ops.length; i += BULK_WRITE_BATCH) {
    const chunk = ops.slice(i, i + BULK_WRITE_BATCH);
    const r = await col.bulkWrite(chunk, { ordered: false });
    modified += r.modifiedCount;
    upserted += r.upsertedCount;
  }
  return { modified, upserted };
}

async function main() {
  loadMongoEnv();
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Missing MONGODB_URI");
    process.exit(1);
  }
  if (!omdbApiKey()) {
    console.error("Missing OMDB_API_KEY");
    process.exit(1);
  }

  const dryRun = hasFlag("--dry-run");
  const cap = intFlag("--cap", 0);
  const concurrencyFlag = intFlag("--concurrency", 0);

  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db(DB_NAME).collection(COLLECTION);

  try {
    const filter = animeFilter();
    const animeTotal = await col.countDocuments(filter);

    let query = col.find(filter, {
      projection: {
        _id: 1,
        id: 1,
        mal_id: 1,
        imdb_id: 1,
        external_ids: 1,
        title: 1,
        name: 1,
        first_air_date: 1,
        release_date: 1,
        anilist: 1,
        poster_path: 1,
        omdb: 1,
      },
    });

    if (cap > 0) query = query.limit(cap);

    const docs = await query.toArray();
    const concurrency =
      concurrencyFlag === 0 ? Math.max(1, docs.length) : Math.max(1, concurrencyFlag);

    console.log(
      `mongo=${mongoHostHint(uri)} anime_rows=${animeTotal} scan=${docs.length} dry_run=${dryRun} cap=${cap || "none"} concurrency=${concurrency}`
    );

    const started = Date.now();
    const results = await runPool(docs, concurrency, (doc) => resolveDoc(doc));

    const counts = {
      updated: 0,
      would_update: 0,
      unchanged: 0,
      skipped: 0,
    };
    const skipReasons = {};
    const bulkOps = [];

    for (const r of results) {
      if (r.status === "pending_update") {
        if (dryRun) {
          counts.would_update++;
          console.log(`would_update id=${r.id} ${r.title}`);
        } else {
          bulkOps.push({ updateOne: { filter: r.filter, update: { $set: r.$set } } });
        }
        continue;
      }
      counts[r.status] = (counts[r.status] ?? 0) + 1;
      if (r.reason) skipReasons[r.reason] = (skipReasons[r.reason] ?? 0) + 1;
    }

    if (!dryRun && bulkOps.length) {
      const write = await flushBulkWrites(col, bulkOps);
      counts.updated = write.modified + write.upserted;
      console.log(`bulk_write ops=${bulkOps.length} modified=${write.modified}`);
    }

    const elapsedSec = ((Date.now() - started) / 1000).toFixed(1);
    console.log(
      `done: scanned=${docs.length} updated=${counts.updated ?? 0} would_update=${counts.would_update ?? 0} unchanged=${counts.unchanged ?? 0} skipped=${counts.skipped ?? 0} elapsed_s=${elapsedSec}`
    );
    if (Object.keys(skipReasons).length) {
      console.log("skip_reasons:", skipReasons);
    }
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
