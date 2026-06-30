/**
 * Flag manually blocked TMDB movie ids as `adult: true` in Mongo (catalog hide).
 *
 * Default: dry-run. Pass `--execute` to update matching documents.
 *
 *   node scripts/mark-blocked-movie-ids-adult.mjs
 *   node scripts/mark-blocked-movie-ids-adult.mjs --execute
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { MongoClient } from "mongodb";

const require = createRequire(import.meta.url);
const { loadMongoEnv, mongoHostHint } = require(path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "lib/mongoEnv.cjs"
));
const { BLOCKED_MOVIE_TMDB_IDS } = require(path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/lib/tmdbMovieContentPolicy.js"
));

const DB_NAME = "teavie";
const COLLECTION = "content";

async function main() {
  loadMongoEnv();
  const execute = process.argv.includes("--execute");
  const uri = String(process.env.MONGODB_URI ?? "").trim();
  if (!uri) {
    console.error("Missing MONGODB_URI");
    process.exit(1);
  }

  const ids = BLOCKED_MOVIE_TMDB_IDS.filter(
    (id) => typeof id === "number" && Number.isFinite(id) && id > 0
  );
  if (ids.length === 0) {
    console.log("No blocked movie ids configured.");
    return;
  }

  const idStrings = ids.map(String);
  const filter = {
    type: "movie",
    $or: [
      { id: { $in: [...ids, ...idStrings] } },
      { tmdb_id: { $in: ids } },
    ],
  };

  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db(DB_NAME).collection(COLLECTION);

  const docs = await col
    .find(filter)
    .project({ id: 1, tmdb_id: 1, title: 1, name: 1, adult: 1 })
    .toArray();

  console.log(`mongo=${mongoHostHint(uri)} blocked movie ids: ${ids.join(", ")}`);
  console.log(`matching catalog docs: ${docs.length}`);
  for (const d of docs) {
    console.log(
      `  id=${d.id} tmdb_id=${d.tmdb_id ?? ""} adult=${d.adult === true} ${d.title ?? d.name ?? ""}`
    );
  }

  if (!execute) {
    console.log("Dry-run only. Re-run with --execute to set adult: true.");
    await client.close();
    return;
  }

  const r = await col.updateMany(filter, {
    $set: { adult: true, updatedAt: new Date() },
  });
  console.log(
    `updated: acknowledged=${r.acknowledged} matched=${r.matchedCount} modified=${r.modifiedCount}`
  );
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
