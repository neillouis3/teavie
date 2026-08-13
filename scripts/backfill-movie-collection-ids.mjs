#!/usr/bin/env node
/**
 * Backfill tmdb_collection_id (+ name/poster) on movie docs from belongs_to_collection.
 *
 *   node scripts/backfill-movie-collection-ids.mjs
 *   node scripts/backfill-movie-collection-ids.mjs --dry-run
 *   node scripts/backfill-movie-collection-ids.mjs --limit=5000
 *
 * Env: MONGODB_URI — see scripts/lib/mongoEnv.cjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { MongoClient } from "mongodb";

const require = createRequire(import.meta.url);
const { loadMongoEnv } = require(path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "lib/mongoEnv.cjs"
));
loadMongoEnv();

function tmdbCollectionFieldsFromMovie(movie) {
  const btc = movie?.belongs_to_collection;
  if (!btc || typeof btc !== "object") {
    return {
      tmdb_collection_id: null,
      tmdb_collection_name: null,
      tmdb_collection_poster_path: null,
      tmdb_collection_backdrop_path: null,
    };
  }
  const id = Number(btc.id);
  if (!Number.isFinite(id) || id <= 0) {
    return {
      tmdb_collection_id: null,
      tmdb_collection_name: null,
      tmdb_collection_poster_path: null,
      tmdb_collection_backdrop_path: null,
    };
  }
  return {
    tmdb_collection_id: id,
    tmdb_collection_name:
      typeof btc.name === "string" && btc.name.trim() ? btc.name.trim() : null,
    tmdb_collection_poster_path:
      typeof btc.poster_path === "string" ? btc.poster_path : null,
    tmdb_collection_backdrop_path:
      typeof btc.backdrop_path === "string" ? btc.backdrop_path : null,
  };
}

const uri = String(process.env.MONGODB_URI ?? "").trim();
if (!uri) {
  console.error("Missing MONGODB_URI (set in .env or .env.local)");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 0;

const client = new MongoClient(uri);
await client.connect();
const col = client.db("teavie").collection("content");

const query = {
  type: "movie",
  "belongs_to_collection.id": { $type: "number" },
  $or: [
    { tmdb_collection_id: { $exists: false } },
    { tmdb_collection_id: null },
  ],
};

const cursor = col.find(query, {
  projection: { id: 1, belongs_to_collection: 1 },
});
if (limit > 0) cursor.limit(limit);

let scanned = 0;
let updated = 0;

for await (const doc of cursor) {
  scanned += 1;
  const fields = tmdbCollectionFieldsFromMovie(doc);
  if (!fields.tmdb_collection_id) continue;
  updated += 1;
  if (!dryRun) {
    await col.updateOne(
      { _id: doc._id },
      {
        $set: fields,
      }
    );
  }
}

console.log(
  JSON.stringify({ dryRun, scanned, updated }, null, 2)
);
await client.close();
