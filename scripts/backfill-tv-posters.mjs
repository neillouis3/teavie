/**
 * Backfill posters for catalog TV rows that were seeded as bare list rows
 * (no `poster_path`). Re-fetches full TMDB detail (`/tv/{id}`) and re-maps with
 * the same shape seed-popular-catalog / seed-search-catalog write.
 *
 * Only touches non-anime numeric-id rows (anime `anime_*` posters come from a
 * different pipeline). Rows TMDB still has no poster for are left as-is.
 *
 *   node scripts/backfill-tv-posters.mjs
 *   node scripts/backfill-tv-posters.mjs --dry-run --cap=50
 *
 * Env: MONGODB_URI, TMDB_BEARER (or NEXT_PUBLIC_TMDB_BEARER)
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { MongoClient } from "mongodb";
import { tmdbBearerToken } from "../src/lib/tmdbAuth.js";
import { shouldRejectTmdbTvFromCatalog } from "../src/lib/tmdbMovieContentPolicy.js";

const require = createRequire(import.meta.url);
const { loadMongoEnv, mongoHostHint } = require(path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "lib/mongoEnv.cjs"
));

const DB_NAME = "teavie";
const COLLECTION = "content";
const TMDB_BASE = "https://api.themoviedb.org/3";
const FETCH_TIMEOUT_MS = 20000;
const SLEEP_MS = 45;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function intFlag(name, def) {
  const prefix = `${name}=`;
  const eq = process.argv.find((a) => a.startsWith(prefix));
  if (eq) {
    const n = parseInt(eq.slice(prefix.length), 10);
    if (Number.isFinite(n)) return n;
  }
  return def;
}

/** Same shape seed-popular-catalog writes for non-anime TV rows. */
function mapTmdbTvToDoc(show) {
  const id = show.id;
  if (typeof id !== "number" || !Number.isFinite(id)) return null;
  if (shouldRejectTmdbTvFromCatalog(show)) return null;
  const name = show.name ?? show.original_name ?? `TV ${id}`;
  return {
    ...show,
    type: "tv",
    id,
    name,
    title: show.name ?? name,
    tmdb_id: id,
    updatedAt: new Date(),
    is_anime: false,
  };
}

async function tmdbGet(pathWithQuery, token) {
  const url = `${TMDB_BASE}${pathWithQuery}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json", Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`TMDB ${res.status}: ${txt.slice(0, 200)}`);
    }
    return res.json();
  } finally {
    clearTimeout(t);
  }
}

/** TMDB tv id for a doc: numeric `tmdb_id` first, then numeric `id`. */
function tmdbIdForDoc(doc) {
  const t = typeof doc.tmdb_id === "number" ? doc.tmdb_id : Number(doc.tmdb_id);
  if (Number.isFinite(t) && t > 0) return t;
  const i = typeof doc.id === "number" ? doc.id : Number(doc.id);
  if (Number.isFinite(i) && i > 0) return i;
  return null;
}

async function main() {
  loadMongoEnv();
  const dryRun = hasFlag("--dry-run");
  const cap = Math.max(1, intFlag("--cap", 500));

  const uri = String(process.env.MONGODB_URI ?? "").trim();
  const token = tmdbBearerToken().trim();
  if (!uri) {
    console.error("Missing MONGODB_URI");
    process.exit(1);
  }
  if (!token) {
    console.error("Missing TMDB_BEARER (or NEXT_PUBLIC_TMDB_BEARER)");
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db(DB_NAME).collection(COLLECTION);

  const missing = await col
    .find(
      {
        type: "tv",
        id: { $not: { $type: "string" } },
        $or: [
          { poster_path: { $exists: false } },
          { poster_path: null },
          { poster_path: "" },
        ],
      },
      { projection: { id: 1, tmdb_id: 1, name: 1 } }
    )
    .limit(cap)
    .toArray();

  console.log(
    `backfill tv posters | mongo=${mongoHostHint(uri)} candidates=${missing.length} cap=${cap} dryRun=${dryRun}`
  );

  const ops = [];
  let stillNoPoster = 0;
  let skipped = 0;
  let err = 0;
  for (let i = 0; i < missing.length; i += 1) {
    const d = missing[i];
    const tmdbId = tmdbIdForDoc(d);
    if (tmdbId == null) {
      skipped += 1;
      continue;
    }
    try {
      const show = await tmdbGet(`/tv/${tmdbId}?language=en-US&include_adult=false`, token);
      await sleep(SLEEP_MS);
      const doc = mapTmdbTvToDoc(show);
      if (!doc) {
        skipped += 1;
        continue;
      }
      if (!doc.poster_path) {
        stillNoPoster += 1;
        continue;
      }
      console.log(`  + ${doc.id} ${doc.name} -> ${doc.poster_path}`);
      ops.push({
        updateOne: {
          filter: { type: "tv", id: doc.id },
          update: { $set: doc },
          upsert: false,
        },
      });
    } catch (e) {
      err += 1;
      console.warn(`tv ${tmdbId}: ${e instanceof Error ? e.message : e}`);
    }
    if ((i + 1) % 40 === 0) console.log(`  processed ${i + 1}/${missing.length}…`);
  }

  console.log(
    `fixable=${ops.length} stillNoPosterOnTmdb=${stillNoPoster} skipped=${skipped} errors=${err}`
  );

  if (dryRun) {
    console.log("dry-run: no Mongo writes");
    await client.close();
    return;
  }

  if (ops.length > 0) {
    const batch = 100;
    let modified = 0;
    for (let j = 0; j < ops.length; j += batch) {
      const r = await col.bulkWrite(ops.slice(j, j + batch), { ordered: false });
      modified += r.modifiedCount;
    }
    console.log(`done: modified=${modified}`);
  } else {
    console.log("nothing to update");
  }

  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
