/**
 * Backfill anime catalog posters/backdrops from AniList cover + banner art.
 * Each MAL season gets its own AniList media entry and unique artwork.
 *
 *   node scripts/backfill-anime-posters.mjs --dry-run
 *   node scripts/backfill-anime-posters.mjs
 *   node scripts/backfill-anime-posters.mjs --concurrency=3
 *   node scripts/backfill-anime-posters.mjs --multi-season  # split-cour franchises only
 *   node scripts/backfill-anime-posters.mjs --multi-season --jikan-only
 *   node scripts/backfill-anime-posters.mjs --anilist-per-min=25
 *
 * AniList is rate-limited (degraded ~30/min, normal 90/min). AniList is tried first per MAL id
 * for per-season artwork; Jikan is fallback when AniList misses. Default AniList cap: 25 req/min.
 *
 * Env: MONGODB_URI, optional ANILIST_UA
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { MongoClient } from "mongodb";
import { anilistPost } from "../src/lib/anilistFetch.js";
import { isSharedOmdbAnimePoster } from "../src/lib/animePoster.js";
import { jikanGet, jikanPosterFromEntry } from "../src/lib/jikanFetch.js";
import { lookupKometaByMalId, loadMultiSeasonFranchiseMalSet } from "../src/lib/kometaAnimeIds.js";

const require = createRequire(import.meta.url);
const { loadMongoEnv, mongoHostHint } = require(path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "lib/mongoEnv.cjs"
));

const DB_NAME = "teavie";
const COLLECTION = "content";
const DEFAULT_CONCURRENCY = 1;
/** AniList degraded state ~30/min — stay safely under. */
const DEFAULT_ANILIST_PER_MIN = 25;
/** Jikan ~60/min unauthenticated. */
const DEFAULT_JIKAN_PER_MIN = 55;
const DEFAULT_MAX_RETRIES = 8;
const BULK_WRITE_BATCH = 200;
const PROGRESS_EVERY = 50;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Sliding-window limiter: max N requests per 60s window. */
function createRateLimiterPerMin(maxPerMin) {
  const windowMs = 60_000;
  const times = [];
  let gate = Promise.resolve();

  function acquireSlot() {
    gate = gate.then(async () => {
      while (true) {
        const now = Date.now();
        while (times.length && times[0] <= now - windowMs) times.shift();
        if (times.length < maxPerMin) {
          times.push(Date.now());
          return;
        }
        const wait = times[0] + windowMs - now + 50;
        await sleep(Math.max(wait, 1));
      }
    });
    return gate;
  }

  return acquireSlot;
}

let acquireAnilistSlot = createRateLimiterPerMin(DEFAULT_ANILIST_PER_MIN);
let acquireJikanSlot = createRateLimiterPerMin(DEFAULT_JIKAN_PER_MIN);
let retryCount = 0;

function isRateLimitStatus(status) {
  return status === 429 || status === 503;
}

function isRateLimitPayload(payload) {
  const msg = String(payload?.errors?.[0]?.message ?? "").toLowerCase();
  return msg.includes("rate") || msg.includes("too many");
}

async function anilistPostWithRetry(body, { maxRetries = DEFAULT_MAX_RETRIES } = {}) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    await acquireAnilistSlot();
    const res = await anilistPost(body);
    const payload = await res.clone().json().catch(() => null);

    const rateLimited =
      isRateLimitStatus(res.status) || (res.ok && isRateLimitPayload(payload));

    if (rateLimited && attempt < maxRetries) {
      retryCount += 1;
      const retryAfter = parseInt(res.headers.get("retry-after") || "", 10);
      const backoff =
        retryAfter > 0
          ? retryAfter * 1000
          : Math.min(120_000, 15_000 * 2 ** attempt + Math.floor(Math.random() * 2000));
      if (retryCount <= 5 || retryCount % 25 === 0) {
        console.warn(`anilist rate_limit retry ${attempt + 1}/${maxRetries} wait=${backoff}ms`);
      }
      await sleep(backoff);
      continue;
    }

    if (!res.ok && res.status >= 500 && attempt < maxRetries) {
      retryCount += 1;
      const backoff = Math.min(30_000, 750 * 2 ** attempt);
      await sleep(backoff);
      continue;
    }

    return { res, payload };
  }

  return { res: null, payload: null };
}

const POSTER_QUERY_BY_MAL = `query ($idMal: Int) {
  Media(idMal: $idMal, type: ANIME) {
    id
    idMal
    coverImage { extraLarge large medium color }
    bannerImage
  }
}`;

const POSTER_QUERY_BY_ANILIST = `query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id
    idMal
    coverImage { extraLarge large medium color }
    bannerImage
  }
}`;

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

function pickNumeric(raw) {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === "string") {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function pickString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function malFromDoc(doc) {
  const mal = pickNumeric(doc?.mal_id ?? doc?.external_ids?.mal_id);
  if (mal != null) return mal;
  const m = /^anime_(\d+)$/i.exec(String(doc?.id ?? "").trim());
  return m ? pickNumeric(m[1]) : null;
}

function anilistFromDoc(doc) {
  return pickNumeric(doc?.anilist_id ?? doc?.anilist?.id ?? doc?.external_ids?.anilist_id);
}

function posterFromAnilist(media) {
  return (
    pickString(media?.coverImage?.extraLarge) ||
    pickString(media?.coverImage?.large) ||
    pickString(media?.coverImage?.medium) ||
    null
  );
}

function backdropFromAnilist(media, poster) {
  return pickString(media?.bannerImage) || poster;
}

async function fetchAnilistArt(anilistId, malId) {
  if (malId != null) {
    const { res, payload } = await anilistPostWithRetry({
      query: POSTER_QUERY_BY_MAL,
      variables: { idMal: malId },
    });
    if (res?.ok) {
      const media = payload?.data?.Media;
      if (media) return media;
    }
  }
  if (anilistId != null) {
    const { res, payload } = await anilistPostWithRetry({
      query: POSTER_QUERY_BY_ANILIST,
      variables: { id: anilistId },
    });
    if (!res?.ok) return null;
    return payload?.data?.Media ?? null;
  }
  return null;
}

function buildAnilistImageBlock(media) {
  if (!media) return null;
  return {
    ...(media.id != null ? { id: media.id } : {}),
    coverImage: {
      extraLarge: pickString(media?.coverImage?.extraLarge),
      large: pickString(media?.coverImage?.large),
      medium: pickString(media?.coverImage?.medium),
      color: pickString(media?.coverImage?.color),
    },
    bannerImage: pickString(media?.bannerImage),
  };
}

function buildUpdatePayload(doc, media, malId, anilistId) {
  const poster = posterFromAnilist(media);
  if (!poster) return { status: "skipped", reason: "no_poster" };

  const backdrop = backdropFromAnilist(media, poster);
  const resolvedAnilistId = pickNumeric(media.id) ?? anilistId;
  const imageBlock = buildAnilistImageBlock(media);

  const changed =
    doc.poster_path !== poster ||
    doc.backdrop_path !== backdrop ||
    doc.anilist_id !== resolvedAnilistId;

  if (!changed) return { status: "unchanged" };

  const $set = {
    poster_path: poster,
    backdrop_path: backdrop,
    updated_at: new Date().toISOString(),
    last_poster_source: "anilist",
  };
  if (resolvedAnilistId != null) {
    $set.anilist_id = resolvedAnilistId;
    $set.external_ids = {
      ...(doc.external_ids && typeof doc.external_ids === "object" ? doc.external_ids : {}),
      anilist_id: resolvedAnilistId,
      mal_id: malId ?? doc.mal_id ?? null,
    };
  }
  if (imageBlock) {
    $set.anilist = {
      ...(doc.anilist && typeof doc.anilist === "object" ? doc.anilist : {}),
      ...imageBlock,
      id: resolvedAnilistId ?? doc.anilist?.id ?? null,
    };
  }

  return {
    status: "pending_update",
    id: doc.id,
    title: doc.title ?? doc.name ?? "",
    filter: { _id: doc._id },
    $set,
  };
}

async function fetchJikanArt(malId, { maxRetries = 5 } = {}) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    await acquireJikanSlot();
    const res = await jikanGet(`anime/${malId}`);
    if (res.status === 429 && attempt < maxRetries) {
      const retryAfter = parseInt(res.headers.get("retry-after") || "", 10);
      await sleep(retryAfter > 0 ? retryAfter * 1000 : 5000 * 2 ** attempt);
      continue;
    }
    if (!res.ok) return null;
    const json = await res.json();
    const data = json?.data;
    if (!data) return null;
    const poster = jikanPosterFromEntry(data);
    if (!poster) return null;
    const backdrop =
      pickString(data?.trailer?.images?.maximum_image_url) ||
      pickString(data?.trailer?.images?.large_image_url) ||
      poster;
    return { poster, backdrop };
  }
  return null;
}

function buildUpdateFromJikan(doc, art, malId) {
  const { poster, backdrop } = art;
  if (!poster) return { status: "skipped", reason: "no_poster" };
  if (doc.poster_path === poster && doc.backdrop_path === backdrop) {
    return { status: "unchanged" };
  }
  return {
    status: "pending_update",
    id: doc.id,
    title: doc.title ?? doc.name ?? "",
    filter: { _id: doc._id },
    $set: {
      poster_path: poster,
      backdrop_path: backdrop,
      updated_at: new Date().toISOString(),
      last_poster_source: "jikan",
      ...(malId != null
        ? {
            mal_id: malId,
            external_ids: {
              ...(doc.external_ids && typeof doc.external_ids === "object" ? doc.external_ids : {}),
              mal_id: malId,
            },
          }
        : {}),
    },
  };
}

function hasOmdbPoster(doc) {
  return (
    doc?.last_poster_source === "omdb" || isSharedOmdbAnimePoster(doc?.poster_path)
  );
}

function buildUpdateFromEmbeddedAnilist(doc, malId) {
  const poster = posterFromAnilist(doc?.anilist);
  if (!poster) return { status: "skipped", reason: "no_embedded_poster" };
  const backdrop = backdropFromAnilist(doc?.anilist, poster);
  if (doc.poster_path === poster && doc.backdrop_path === backdrop) {
    return { status: "unchanged" };
  }
  const resolvedAnilistId = anilistFromDoc(doc);
  return {
    status: "pending_update",
    id: doc.id,
    title: doc.title ?? doc.name ?? "",
    filter: { _id: doc._id },
    $set: {
      poster_path: poster,
      backdrop_path: backdrop,
      updated_at: new Date().toISOString(),
      last_poster_source: "anilist",
      ...(resolvedAnilistId != null
        ? {
            anilist_id: resolvedAnilistId,
            external_ids: {
              ...(doc.external_ids && typeof doc.external_ids === "object" ? doc.external_ids : {}),
              anilist_id: resolvedAnilistId,
              mal_id: malId ?? doc.mal_id ?? null,
            },
          }
        : {}),
    },
  };
}

async function resolveDoc(doc, { jikanOnly = false } = {}) {
  const malId = malFromDoc(doc);
  let anilistId = anilistFromDoc(doc);
  if (malId == null && anilistId == null) {
    return { status: "skipped", reason: "no_ids" };
  }

  if (!jikanOnly && hasOmdbPoster(doc) && doc?.anilist?.coverImage) {
    const embedded = buildUpdateFromEmbeddedAnilist(doc, malId);
    if (embedded.status !== "skipped") return embedded;
  }

  if (!jikanOnly) {
    if (anilistId == null && malId != null) {
      const kometa = await lookupKometaByMalId(malId);
      if (kometa?.anilistId) anilistId = kometa.anilistId;
    }

    const media = await fetchAnilistArt(anilistId, malId);
    if (media) return buildUpdatePayload(doc, media, malId, anilistId);
  }

  if (malId != null) {
    const jikan = await fetchJikanArt(malId);
    if (jikan) return buildUpdateFromJikan(doc, jikan, malId);
    if (jikanOnly) return { status: "skipped", reason: "jikan_miss" };
  }

  return { status: "skipped", reason: malId != null ? "jikan_anilist_miss" : "anilist_miss" };
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

  const dryRun = hasFlag("--dry-run");
  const cap = intFlag("--cap", 0);
  const concurrency = Math.min(4, Math.max(1, intFlag("--concurrency", DEFAULT_CONCURRENCY)));
  const anilistPerMin = Math.min(
    90,
    Math.max(1, intFlag("--anilist-per-min", DEFAULT_ANILIST_PER_MIN))
  );
  const jikanPerMin = Math.min(60, Math.max(1, intFlag("--jikan-per-min", DEFAULT_JIKAN_PER_MIN)));
  const replaceOmdbOnly = hasFlag("--replace-omdb");
  const multiSeasonOnly = hasFlag("--multi-season");
  const jikanOnly = hasFlag("--jikan-only") || multiSeasonOnly;
  acquireAnilistSlot = createRateLimiterPerMin(anilistPerMin);
  acquireJikanSlot = createRateLimiterPerMin(jikanPerMin);
  retryCount = 0;

  // Warm Kometa index once (used for anilist_id fallback per MAL).
  const franchiseMals = multiSeasonOnly ? await loadMultiSeasonFranchiseMalSet() : null;
  await lookupKometaByMalId(1).catch(() => null);

  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db(DB_NAME).collection(COLLECTION);

  try {
    const filter = {
      type: "tv",
      $or: [{ is_anime: true }, { id: { $regex: /^anime_/ } }],
    };
    if (replaceOmdbOnly) {
      filter.$and = [
        {
          $or: [
            { last_poster_source: "omdb" },
            { poster_path: { $regex: /^https?:\/\/m\.media-amazon\.com/i } },
          ],
        },
      ];
    }

    let query = col.find(filter, {
      projection: {
        _id: 1,
        id: 1,
        mal_id: 1,
        anilist_id: 1,
        external_ids: 1,
        anilist: 1,
        title: 1,
        name: 1,
        poster_path: 1,
        backdrop_path: 1,
      },
    });

    if (cap > 0) query = query.limit(cap);

    const docs = await query.toArray();
    const scoped = multiSeasonOnly
      ? docs.filter((doc) => {
          const mal = malFromDoc(doc);
          return mal != null && franchiseMals.has(String(mal));
        })
      : docs;

    console.log(
      `mongo=${mongoHostHint(uri)} anime_rows=${scoped.length}${multiSeasonOnly ? ` (multi_season of ${docs.length})` : ""} dry_run=${dryRun} cap=${cap || "none"} concurrency=${concurrency} jikan=${jikanPerMin}/min anilist=${anilistPerMin}/min replace_omdb_only=${replaceOmdbOnly} multi_season=${multiSeasonOnly} jikan_only=${jikanOnly}`
    );

    const started = Date.now();
    const results = await runPool(scoped, concurrency, (doc) =>
      resolveDoc(doc, { jikanOnly })
    );

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
      `done: scanned=${scoped.length} updated=${counts.updated ?? 0} would_update=${counts.would_update ?? 0} unchanged=${counts.unchanged ?? 0} skipped=${counts.skipped ?? 0} retries=${retryCount} elapsed_s=${elapsedSec}`
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
