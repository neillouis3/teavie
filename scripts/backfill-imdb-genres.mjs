/**
 * Backfill `imdb_genres` and remove TMDB `genre_ids` / `genres` from all catalog rows.
 *
 *   node scripts/backfill-imdb-genres.mjs
 *   node scripts/backfill-imdb-genres.mjs --dry-run --limit=500
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { MongoClient } from "mongodb";
import { catalogGenreMongoPatch } from "../src/lib/imdbGenres.js";

const require = createRequire(import.meta.url);
const { loadMongoEnv, mongoHostHint } = require(path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "lib/mongoEnv.cjs"
));

const DB_NAME = "teavie";
const COLLECTION = "content";

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

function buildPatch(doc) {
  const { set, unset } = catalogGenreMongoPatch(doc);
  const changed =
    JSON.stringify(doc.imdb_genres ?? []) !== JSON.stringify(set.imdb_genres) ||
    doc.is_kdrama !== set.is_kdrama ||
    doc.genre_ids != null ||
    doc.genres != null ||
    JSON.stringify(doc.catalog_categories ?? []) !==
      JSON.stringify(set.catalog_categories ?? doc.catalog_categories ?? []);
  if (!changed) return null;
  return { set, unset };
}

async function main() {
  loadMongoEnv();
  const dryRun = hasFlag("--dry-run");
  const limit = parseIntFlag("--limit", 0);

  const uri = String(process.env.MONGODB_URI ?? "").trim();
  if (!uri) {
    console.error("Missing MONGODB_URI");
    process.exit(1);
  }

  console.log(
    `backfill imdb genres (strip TMDB) | mongo=${mongoHostHint(uri)} dryRun=${dryRun}`
  );

  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db(DB_NAME).collection(COLLECTION);

  let cursor = col.find(
    { type: { $in: ["movie", "tv"] } },
    {
      projection: {
        type: 1,
        id: 1,
        title: 1,
        name: 1,
        genres: 1,
        genre_ids: 1,
        imdb_genres: 1,
        omdb: 1,
        origin_country: 1,
        original_language: 1,
        is_anime: 1,
        is_kdrama: 1,
        catalog_categories: 1,
        anilist: 1,
      },
    }
  );

  if (limit > 0) cursor = cursor.limit(limit);

  let scanned = 0;
  let updated = 0;
  const ops = [];

  for await (const doc of cursor) {
    scanned += 1;
    const patch = buildPatch(doc);
    if (!patch) continue;

    ops.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: patch.set, $unset: patch.unset },
      },
    });

    if (ops.length >= 200 && !dryRun) {
      const r = await col.bulkWrite(ops, { ordered: false });
      updated += r.modifiedCount;
      ops.length = 0;
    }
  }

  if (!dryRun && ops.length > 0) {
    const r = await col.bulkWrite(ops, { ordered: false });
    updated += r.modifiedCount;
  } else if (dryRun) {
    updated = ops.length;
  }

  const withTmdb = await col.countDocuments({
    $or: [{ genre_ids: { $exists: true } }, { genres: { $exists: true } }],
  });
  const withImdb = await col.countDocuments({
    imdb_genres: { $exists: true, $ne: [] },
  });

  console.log(
    `done: scanned=${scanned} updated=${updated} remaining_tmdb_genre_fields=${withTmdb} with_imdb_genres=${withImdb}`
  );
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
