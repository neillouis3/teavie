/**
 * Backfill `imdb_id` on anime catalog rows (MAL/Jikan imports missing IMDb).
 *
 * Resolution order:
 *   1. existing `external_ids.imdb_id`
 *   2. TMDB `external_ids` when `tmdb_id` is set
 *   3. TMDB title search → external_ids
 *   4. OMDb title search
 *
 *   node scripts/backfill-anime-imdb-ids.mjs --dry-run
 *   node scripts/backfill-anime-imdb-ids.mjs --concurrency=12
 *   node scripts/backfill-anime-imdb-ids.mjs --cap=100 --delay=50
 *
 *   node scripts/backfill-anime-imdb-ids.mjs --tmdb-only
 *
 * Env: MONGODB_URI, TMDB_BEARER or TMDB_API_KEY, OMDB_API_KEY
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { MongoClient } from "mongodb";
import { hasTmdbAuth, tmdbAuth, tmdbFetchJson } from "../src/lib/tmdbAuth.js";
import { omdbApiKey } from "../src/lib/omdbAuth.js";
import { resolveOmdbImdbIdForDoc } from "../src/lib/omdbResolve.js";
import { resolveTmdbTvFromDoc } from "../src/lib/tmdbResolveFromTitle.js";

const require = createRequire(import.meta.url);
const { loadMongoEnv, mongoHostHint } = require(path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "lib/mongoEnv.cjs"
));

const DB_NAME = "teavie";
const COLLECTION = "content";
const TMDB_BASE = "https://api.themoviedb.org/3";
const DEFAULT_CONCURRENCY = 12;
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
    if (Number.isFinite(n) && n > 0) return n;
  }
  return def;
}

function tmdbIdFromDoc(doc) {
  const tid = typeof doc.tmdb_id === "number" ? doc.tmdb_id : Number(doc.tmdb_id);
  if (Number.isFinite(tid) && tid > 0) return tid;
  const ext = doc?.external_ids?.tmdb_id;
  const extNum = typeof ext === "number" ? ext : Number(ext);
  if (Number.isFinite(extNum) && extNum > 0) return extNum;
  return null;
}

function animeFilter() {
  return {
    type: "tv",
    $or: [{ is_anime: true }, { id: { $regex: /^anime_/ } }],
  };
}

function missingImdbFilter() {
  return {
    $and: [
      animeFilter(),
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

async function tmdbExternalImdbId(tmdbId, auth) {
  if (!auth) return null;
  try {
    const data = await tmdbFetchJson(`${TMDB_BASE}/tv/${tmdbId}/external_ids`, auth);
    const imdbId = data?.imdb_id;
    return typeof imdbId === "string" && /^tt/i.test(imdbId) ? imdbId.trim() : null;
  } catch {
    return null;
  }
}

async function resolveImdbForDoc(doc, auth, { delayMs = 0, tmdbOnly = false } = {}) {
  const topLevel =
    typeof doc?.imdb_id === "string" && /^tt/i.test(doc.imdb_id) ? doc.imdb_id.trim() : "";
  if (topLevel) return { imdbId: topLevel, source: "existing", tmdbId: null };

  const extOnly = doc?.external_ids?.imdb_id;
  if (typeof extOnly === "string" && /^tt/i.test(extOnly)) {
    return { imdbId: extOnly.trim(), source: "external_ids", tmdbId: null };
  }

  const tmdbId = tmdbIdFromDoc(doc);
  if (tmdbId != null && auth) {
    const imdbId = await tmdbExternalImdbId(tmdbId, auth);
    if (delayMs > 0) await sleep(delayMs);
    if (imdbId) return { imdbId, source: "tmdb_ext", tmdbId };
  }

  if (auth) {
    const hit = await resolveTmdbTvFromDoc(doc, auth);
    if (delayMs > 0) await sleep(delayMs);
    if (hit?.imdbId && /^tt/i.test(hit.imdbId)) {
      return {
        imdbId: hit.imdbId.trim(),
        source: "tmdb_search",
        tmdbId: Number.isFinite(Number(hit.tmdbId)) ? Number(hit.tmdbId) : null,
      };
    }
  }

  if (!tmdbOnly && omdbApiKey()) {
    const imdbId = await resolveOmdbImdbIdForDoc(doc, "tv");
    if (delayMs > 0) await sleep(delayMs);
    if (imdbId) return { imdbId, source: "omdb", tmdbId: null };
  }

  return { imdbId: null, source: null, tmdbId: null };
}

function buildUpdate(doc, resolved) {
  const { imdbId, source, tmdbId } = resolved;
  if (!imdbId) return { status: "skipped", reason: "not_found" };

  const malId =
    typeof doc.mal_id === "number"
      ? doc.mal_id
      : (() => {
          const m = /^anime_(\d+)$/i.exec(String(doc?.id ?? "").trim());
          return m ? parseInt(m[1], 10) : null;
        })();

  const $set = {
    imdb_id: imdbId,
    external_ids: {
      ...(doc.external_ids && typeof doc.external_ids === "object" ? doc.external_ids : {}),
      imdb_id: imdbId,
      ...(malId != null ? { mal_id: malId } : {}),
    },
    last_imdb_enriched_at: new Date().toISOString(),
    last_imdb_source: source,
  };

  if (tmdbId != null && !doc.tmdb_id) {
    $set.tmdb_id = tmdbId;
    $set.external_ids.tmdb_id = tmdbId;
  }

  return {
    status: "pending_update",
    id: doc.id,
    title: doc.title ?? doc.name ?? "",
    source,
    filter: { _id: doc._id },
    $set,
  };
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

  const auth = tmdbAuth();
  const hasTmdb = hasTmdbAuth();
  const hasOmdb = Boolean(omdbApiKey());
  const tmdbOnly = hasFlag("--tmdb-only");
  if (!hasTmdb && !hasOmdb) {
    console.error("Need TMDB_BEARER/TMDB_API_KEY and/or OMDB_API_KEY");
    process.exit(1);
  }
  if (tmdbOnly && !hasTmdb) {
    console.error("--tmdb-only requires TMDB_BEARER or TMDB_API_KEY");
    process.exit(1);
  }

  const dryRun = hasFlag("--dry-run");
  const cap = intFlag("--cap", 0);
  const concurrency = Math.min(32, Math.max(1, intFlag("--concurrency", DEFAULT_CONCURRENCY)));
  const delayMs = Math.max(0, intFlag("--delay", 25));

  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db(DB_NAME).collection(COLLECTION);

  try {
    const filter = missingImdbFilter();
    const [animeTotal, queueTotal] = await Promise.all([
      col.countDocuments(animeFilter()),
      col.countDocuments(filter),
    ]);

    let query = col.find(filter, {
      projection: {
        _id: 1,
        id: 1,
        mal_id: 1,
        tmdb_id: 1,
        imdb_id: 1,
        external_ids: 1,
        title: 1,
        name: 1,
        title_aliases: 1,
        anilist: 1,
        first_air_date: 1,
        release_date: 1,
      },
    });

    if (cap > 0) query = query.limit(cap);

    const docs = await query.toArray();
    console.log(
      `mongo=${mongoHostHint(uri)} anime_rows=${animeTotal} missing_imdb=${queueTotal} scan=${docs.length} dry_run=${dryRun} cap=${cap || "none"} concurrency=${concurrency} delay_ms=${delayMs} tmdb=${hasTmdb} omdb=${hasOmdb && !tmdbOnly} tmdb_only=${tmdbOnly}`
    );

    const started = Date.now();
    const results = await runPool(docs, concurrency, (doc) =>
      resolveImdbForDoc(doc, auth, { delayMs, tmdbOnly }).then((resolved) =>
        buildUpdate(doc, resolved)
      )
    );

    const counts = {
      updated: 0,
      would_update: 0,
      skipped: 0,
    };
    const skipReasons = {};
    const sources = {};
    const bulkOps = [];

    for (const r of results) {
      if (r.status === "pending_update") {
        sources[r.source] = (sources[r.source] ?? 0) + 1;
        if (dryRun) {
          counts.would_update++;
          console.log(`would_update id=${r.id} source=${r.source} ${r.title}`);
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
    } else if (dryRun) {
      counts.updated = 0;
    } else {
      counts.updated = bulkOps.length;
    }

    const elapsedSec = ((Date.now() - started) / 1000).toFixed(1);
    const rate = elapsedSec > 0 ? (docs.length / Number(elapsedSec)).toFixed(1) : "?";
    console.log(
      `done: scanned=${docs.length} updated=${counts.updated ?? 0} would_update=${counts.would_update ?? 0} skipped=${counts.skipped ?? 0} rate=${rate}/s elapsed_s=${elapsedSec}`
    );
    if (Object.keys(sources).length) console.log("sources:", sources);
    if (Object.keys(skipReasons).length) console.log("skip_reasons:", skipReasons);
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
